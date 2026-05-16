import { Router, type IRouter } from "express";
import { db, installmentsTable, clientsTable, clientEventsTable, teamMembersTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import { requireAuth, getCurrentUser, requireTeam, getCurrentTeamMember } from "../lib/auth";
import {
  ListInstallmentsQueryParams,
  GetInstallmentParams,
  UpdateInstallmentParams,
  UpdateInstallmentBody,
  PayInstallmentParams,
  PayInstallmentBody,
} from "@workspace/api-zod";
import { createNotification } from "../lib/notifications";

const router: IRouter = Router();

function formatInstallment(i: any, clientNome?: string | null, vendedorId?: number | null) {
  return {
    id: i.id,
    client_id: i.clientId,
    client_nome: clientNome ?? null,
    vendedor_id: vendedorId ?? null,
    numero_parcela: i.numeroParcela,
    valor: parseFloat(i.valor),
    vencimento: i.vencimento,
    status: i.status,
    pago_em: i.pagoEm?.toISOString?.() ?? null,
  };
}

router.get("/installments", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const qp = ListInstallmentsQueryParams.safeParse(req.query);
  const { client_id, status, vendedor_id, overdue_only } = qp.success ? qp.data : {};

  const currentUser = getCurrentUser(req);
  const teamMember = getCurrentTeamMember(req);

  const rows = await db
    .select({ installment: installmentsTable, clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(eq(installmentsTable.teamId, teamId))
    .orderBy(installmentsTable.vencimento);

  let filtered = rows;
  if (teamMember?.role === "vendedor") filtered = filtered.filter(r => r.vendedorId === currentUser.id);
  else if (vendedor_id) filtered = filtered.filter(r => r.vendedorId === vendedor_id);
  if (client_id) filtered = filtered.filter(r => r.installment.clientId === client_id);
  if (status) filtered = filtered.filter(r => r.installment.status === status);
  if (overdue_only) filtered = filtered.filter(r => r.installment.status === "atrasado");

  res.json(filtered.map(r => formatInstallment(r.installment, r.clientNome, r.vendedorId)));
});

router.get("/installments/:id", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetInstallmentParams.safeParse({ id: parseInt(raw) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({ installment: installmentsTable, clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.teamId, teamId)));

  if (!row) { res.status(404).json({ error: "Installment not found" }); return; }
  res.json(formatInstallment(row.installment, row.clientNome, row.vendedorId));
});

router.patch("/installments/:id", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateInstallmentParams.safeParse({ id: parseInt(raw) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateInstallmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.valor !== undefined) updates.valor = String(parsed.data.valor);
  if (parsed.data.vencimento !== undefined) updates.vencimento = parsed.data.vencimento;

  const [inst] = await db.update(installmentsTable).set(updates).where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.teamId, teamId))).returning();
  if (!inst) { res.status(404).json({ error: "Installment not found" }); return; }

  const [row] = await db.select({ clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId }).from(clientsTable).where(eq(clientsTable.id, inst.clientId));
  res.json(formatInstallment(inst, row?.clientNome, row?.vendedorId));
});

router.post("/installments/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = PayInstallmentParams.safeParse({ id: parseInt(raw) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = PayInstallmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const currentUser = getCurrentUser(req);
  const now = new Date();

  const [inst] = await db.update(installmentsTable).set({ status: "pago", pagoEm: now }).where(and(eq(installmentsTable.id, params.data.id), eq(installmentsTable.teamId, teamId))).returning();
  if (!inst) { res.status(404).json({ error: "Installment not found" }); return; }

  const [clientRow] = await db.select({ clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId }).from(clientsTable).where(eq(clientsTable.id, inst.clientId));

  await db.insert(clientEventsTable).values({
    teamId,
    clientId: inst.clientId,
    tipo: "parcela_paga",
    userId: currentUser.id,
    observacao: parsed.data.observacao ?? `Parcela ${inst.numeroParcela} paga - R$ ${parseFloat(inst.valor).toFixed(2)}`,
    data: now,
  });

  // Notify all cobradores and líderes in the team
  const recipients = await db
    .select({ userId: teamMembersTable.userId, role: teamMembersTable.role })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.teamId, teamId));

  const valor = parseFloat(inst.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  for (const u of recipients.filter(r => ["cobrador", "lider"].includes(r.role))) {
    await createNotification({
      userId: u.userId,
      teamId,
      tipo: "pagamento_confirmado",
      titulo: "Pagamento confirmado",
      mensagem: `${clientRow?.clientNome ?? "Cliente"} — parcela ${inst.numeroParcela} de ${valor} confirmada.`,
      clientId: inst.clientId,
    });
  }

  res.json(formatInstallment(inst, clientRow?.clientNome, clientRow?.vendedorId));
});

export default router;
