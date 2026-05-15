import { Router, type IRouter } from "express";
import { db, clientsTable, installmentsTable, clientEventsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, lt, count, sum } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { calculateCommission, processOverdueInstallments } from "../lib/installment-engine";

const router: IRouter = Router();

function getMonthRange(date: Date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const { start, end } = getMonthRange();

  // Commission: sum of valor_contrato for clients created this month by this seller
  const salesRows = await db
    .select({ valorContrato: clientsTable.valorContrato })
    .from(clientsTable)
    .where(
      and(
        eq(clientsTable.vendedorId, currentUser.id),
        gte(clientsTable.createdAt, start),
        lte(clientsTable.createdAt, end)
      )
    );

  const totalVendasMes = salesRows.reduce((s, r) => s + parseFloat(r.valorContrato), 0);
  const { comissao, bonus } = calculateCommission(totalVendasMes);

  // Active clients
  const activeRows = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(and(eq(clientsTable.vendedorId, currentUser.id), eq(clientsTable.status, "ativo")));

  // Paid installments this month
  const paidRows = await db
    .select({ id: installmentsTable.id })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(
      and(
        eq(clientsTable.vendedorId, currentUser.id),
        eq(installmentsTable.status, "pago"),
        gte(installmentsTable.pagoEm!, start),
        lte(installmentsTable.pagoEm!, end)
      )
    );

  // Overdue installments
  const overdueRows = await db
    .select({ id: installmentsTable.id })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(
      and(
        eq(clientsTable.vendedorId, currentUser.id),
        eq(installmentsTable.status, "atrasado")
      )
    );

  // Ranking position
  const allUsers = await db.select().from(usersTable);
  const rankingData: Array<{ userId: number; totalVendas: number }> = [];

  for (const u of allUsers) {
    if (u.papel === "cobrador") continue;
    const rows = await db
      .select({ valorContrato: clientsTable.valorContrato })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.vendedorId, u.id),
          gte(clientsTable.createdAt, start),
          lte(clientsTable.createdAt, end)
        )
      );
    const total = rows.reduce((s, r) => s + parseFloat(r.valorContrato), 0);
    rankingData.push({ userId: u.id, totalVendas: total });
  }

  rankingData.sort((a, b) => b.totalVendas - a.totalVendas);
  const myPos = rankingData.findIndex(r => r.userId === currentUser.id);
  const rankingPosition = myPos === -1 ? 0 : myPos + 1;

  // Recent events
  const recentEvents = await db
    .select({ event: clientEventsTable, clientNome: clientsTable.nome, userNome: usersTable.nome })
    .from(clientEventsTable)
    .leftJoin(clientsTable, eq(clientEventsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(clientEventsTable.userId, usersTable.id))
    .where(eq(clientEventsTable.userId, currentUser.id))
    .orderBy(clientEventsTable.data)
    .limit(10);

  res.json({
    comissao_mes: comissao,
    bonus,
    total_vendas_mes: totalVendasMes,
    clientes_ativos: activeRows.length,
    parcelas_pagas_mes: paidRows.length,
    parcelas_atrasadas: overdueRows.length,
    ranking_position: rankingPosition,
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
  // Get all overdue installments with client and vendedor info
  const rows = await db
    .select({
      installment: installmentsTable,
      clientNome: clientsTable.nome,
      vendedorId: clientsTable.vendedorId,
      vendedorNome: usersTable.nome,
    })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(clientsTable.vendedorId, usersTable.id))
    .where(eq(installmentsTable.status, "atrasado"))
    .orderBy(installmentsTable.vencimento);

  const totalAtrasados = rows.length;
  const valorTotalAtrasado = rows.reduce((s, r) => s + parseFloat(r.installment.valor), 0);

  // Group by vendedor
  const vendedorMap = new Map<number, { vendedor_id: number; vendedor_nome: string; total: number; valor: number }>();
  for (const r of rows) {
    if (!r.vendedorId) continue;
    const existing = vendedorMap.get(r.vendedorId);
    if (existing) {
      existing.total++;
      existing.valor += parseFloat(r.installment.valor);
    } else {
      vendedorMap.set(r.vendedorId, {
        vendedor_id: r.vendedorId,
        vendedor_nome: r.vendedorNome ?? "Desconhecido",
        total: 1,
        valor: parseFloat(r.installment.valor),
      });
    }
  }

  res.json({
    total_atrasados: totalAtrasados,
    valor_total_atrasado: valorTotalAtrasado,
    atrasados_por_vendedor: Array.from(vendedorMap.values()),
    installments_atrasadas: rows.map(r => ({
      id: r.installment.id,
      client_id: r.installment.clientId,
      client_nome: r.clientNome ?? null,
      vendedor_id: r.vendedorId ?? null,
      numero_parcela: r.installment.numeroParcela,
      valor: parseFloat(r.installment.valor),
      vencimento: r.installment.vencimento,
      status: r.installment.status,
      pago_em: r.installment.pagoEm?.toISOString?.() ?? null,
    })),
  });
});

router.post("/cron/process-overdue", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const result = await processOverdueInstallments(currentUser.id);
  res.json({
    processed: result.updated,
    updated_installments: result.updated,
    events_created: result.eventsCreated,
    tasks_created: result.tasksCreated,
  });
});

export default router;
