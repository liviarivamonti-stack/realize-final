import { Router, type IRouter } from "express";
import { db, clientsTable, installmentsTable, clientEventsTable, usersTable, teamMembersTable } from "@workspace/db";
import { eq, and, gte, lte, lt, desc } from "drizzle-orm";
import { requireAuth, getCurrentUser, requireTeam } from "../lib/auth";
import { calculateCommission, processOverdueInstallments } from "../lib/installment-engine";

const router: IRouter = Router();

function getMonthRange(date: Date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

function daysOverdue(vencimento: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(vencimento + "T00:00:00");
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

type RiskLevel = "atencao" | "risco" | "critico" | null;

function autoRiskFromDays(days: number): RiskLevel {
  if (days >= 20) return "critico";
  if (days >= 10) return "risco";
  if (days >= 3) return "atencao";
  return null;
}

const riskOrder: Record<string, number> = { atencao: 1, risco: 2, critico: 3 };

function higherRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  const aVal = a ? riskOrder[a] : 0;
  const bVal = b ? riskOrder[b] : 0;
  return aVal >= bVal ? a : b;
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const currentUser = getCurrentUser(req);
  const { start, end } = getMonthRange();

  const salesRows = await db
    .select({ valorContrato: clientsTable.valorContrato })
    .from(clientsTable)
    .where(and(eq(clientsTable.teamId, teamId), eq(clientsTable.vendedorId, currentUser.id), gte(clientsTable.createdAt, start), lte(clientsTable.createdAt, end)));

  const totalVendasMes = salesRows.reduce((s, r) => s + parseFloat(r.valorContrato), 0);
  const { comissao, bonus } = calculateCommission(totalVendasMes);

  const activeRows = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.teamId, teamId), eq(clientsTable.vendedorId, currentUser.id), eq(clientsTable.status, "ativo")));

  const paidRows = await db
    .select({ id: installmentsTable.id })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(and(
      eq(installmentsTable.teamId, teamId),
      eq(clientsTable.vendedorId, currentUser.id),
      eq(installmentsTable.status, "pago"),
      gte(installmentsTable.pagoEm!, start),
      lte(installmentsTable.pagoEm!, end)
    ));

  const overdueRows = await db
    .select({ id: installmentsTable.id })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(and(eq(installmentsTable.teamId, teamId), eq(clientsTable.vendedorId, currentUser.id), eq(installmentsTable.status, "atrasado")));

  // Ranking: all team members with vendedor or lider role
  const teamMembers = await db
    .select({ userId: teamMembersTable.userId, role: teamMembersTable.role, user: usersTable })
    .from(teamMembersTable)
    .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, teamId));

  const rankingData: Array<{ userId: number; nome: string; role: string; totalVendas: number }> = [];
  for (const m of teamMembers) {
    if (m.role === "cobrador" || !m.user) continue;
    const rows = await db
      .select({ valorContrato: clientsTable.valorContrato })
      .from(clientsTable)
      .where(and(eq(clientsTable.teamId, teamId), eq(clientsTable.vendedorId, m.userId), gte(clientsTable.createdAt, start), lte(clientsTable.createdAt, end)));
    const total = rows.reduce((s, r) => s + parseFloat(r.valorContrato), 0);
    rankingData.push({ userId: m.userId, nome: m.user.nome, role: m.role, totalVendas: total });
  }
  rankingData.sort((a, b) => b.totalVendas - a.totalVendas);
  const myPos = rankingData.findIndex(r => r.userId === currentUser.id);
  const rankingPosition = myPos === -1 ? 0 : myPos + 1;

  const recentEvents = await db
    .select({ event: clientEventsTable, clientNome: clientsTable.nome, userNome: usersTable.nome })
    .from(clientEventsTable)
    .leftJoin(clientsTable, eq(clientEventsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(clientEventsTable.userId, usersTable.id))
    .where(and(eq(clientEventsTable.teamId, teamId), eq(clientEventsTable.userId, currentUser.id)))
    .orderBy(desc(clientEventsTable.data))
    .limit(10);

  // Top 3 for podium
  const podium = rankingData.slice(0, 3).map((r, i) => ({
    posicao: i + 1,
    user_id: r.userId,
    nome: r.nome,
    total_vendas: r.totalVendas,
    ...calculateCommission(r.totalVendas),
  }));

  res.json({
    comissao_mes: comissao,
    bonus,
    total_vendas_mes: totalVendasMes,
    clientes_ativos: activeRows.length,
    parcelas_pagas_mes: paidRows.length,
    parcelas_atrasadas: overdueRows.length,
    ranking_position: rankingPosition,
    podium,
    recent_events: recentEvents.map(e => ({
      id: e.event.id,
      client_id: e.event.clientId,
      client_nome: e.clientNome ?? null,
      tipo: e.event.tipo,
      user_id: e.event.userId,
      user_nome: e.userNome ?? null,
      observacao: e.event.observacao ?? null,
      data: e.event.data.toISOString(),
    })),
  });
});

router.get("/dashboard/cobranca", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const rows = await db
    .select({ installment: installmentsTable, client: clientsTable, vendedorNome: usersTable.nome })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(clientsTable.vendedorId, usersTable.id))
    .where(and(eq(installmentsTable.teamId, teamId), eq(installmentsTable.status, "atrasado")))
    .orderBy(installmentsTable.vencimento);

  const clientMaxDays = new Map<number, number>();
  for (const r of rows) {
    if (!r.client) continue;
    const days = daysOverdue(r.installment.vencimento);
    const prev = clientMaxDays.get(r.client.id) ?? 0;
    if (days > prev) clientMaxDays.set(r.client.id, days);
  }

  for (const [clientId, maxDays] of clientMaxDays.entries()) {
    const autoRisk = autoRiskFromDays(maxDays);
    const row = rows.find(r => r.client?.id === clientId);
    if (!row?.client) continue;
    const current = row.client.riskLevel;
    const newRisk = higherRisk(autoRisk, current as RiskLevel);
    if (newRisk !== current) {
      await db.update(clientsTable).set({ riskLevel: newRisk as any }).where(eq(clientsTable.id, clientId));
      row.client.riskLevel = newRisk as any;
    }
  }

  const totalAtrasados = rows.length;
  const valorTotalAtrasado = rows.reduce((s, r) => s + parseFloat(r.installment.valor), 0);

  let totalCriticos = 0, totalRisco = 0, totalAtencao = 0;
  const seenClients = new Set<number>();
  for (const r of rows) {
    if (!r.client || seenClients.has(r.client.id)) continue;
    seenClients.add(r.client.id);
    if (r.client.riskLevel === "critico") totalCriticos++;
    else if (r.client.riskLevel === "risco") totalRisco++;
    else if (r.client.riskLevel === "atencao") totalAtencao++;
  }

  const vendedorMap = new Map<number, { vendedor_id: number; vendedor_nome: string; total: number; valor: number }>();
  for (const r of rows) {
    if (!r.client?.vendedorId) continue;
    const vId = r.client.vendedorId;
    const existing = vendedorMap.get(vId);
    if (existing) { existing.total++; existing.valor += parseFloat(r.installment.valor); }
    else vendedorMap.set(vId, { vendedor_id: vId, vendedor_nome: r.vendedorNome ?? "—", total: 1, valor: parseFloat(r.installment.valor) });
  }

  res.json({
    total_atrasados: totalAtrasados,
    total_criticos: totalCriticos,
    total_risco: totalRisco,
    total_atencao: totalAtencao,
    valor_total_atrasado: valorTotalAtrasado,
    atrasados_por_vendedor: Array.from(vendedorMap.values()),
    items: rows.map(r => ({
      id: r.installment.id,
      client_id: r.installment.clientId,
      client_nome: r.client?.nome ?? null,
      client_telefone: r.client?.telefone ?? null,
      vendedor_id: r.client?.vendedorId ?? null,
      vendedor_nome: r.vendedorNome ?? null,
      numero_parcela: r.installment.numeroParcela,
      valor: parseFloat(r.installment.valor),
      vencimento: r.installment.vencimento,
      status: r.installment.status,
      pago_em: r.installment.pagoEm?.toISOString?.() ?? null,
      dias_atraso: daysOverdue(r.installment.vencimento),
      risk_level: r.client?.riskLevel ?? null,
    })),
  });
});

router.post("/cron/process-overdue", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const currentUser = getCurrentUser(req);
  const result = await processOverdueInstallments(currentUser.id, teamId);
  res.json({ processed: result.updated, updated_installments: result.updated, events_created: result.eventsCreated, tasks_created: result.tasksCreated });
});

export default router;
