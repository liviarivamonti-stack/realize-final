import { Router, type IRouter } from "express";
import { db, installmentsTable, clientsTable, clientEventsTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  ListInstallmentsQueryParams,
  GetInstallmentParams,
  UpdateInstallmentParams,
  UpdateInstallmentBody,
  PayInstallmentParams,
  PayInstallmentBody,
} from "@workspace/api-zod";

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
  const qp = ListInstallmentsQueryParams.safeParse(req.query);
  const { client_id, status, vendedor_id, overdue_only } = qp.success ? qp.data : {};

  const currentUser = getCurrentUser(req);

  const rows = await db
    .select({
      installment: installmentsTable,
      clientNome: clientsTable.nome,
      vendedorId: clientsTable.vendedorId,
    })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .orderBy(installmentsTable.vencimento);

  let filtered = rows;

  if (currentUser.papel === "vendedor") {
    filtered = filtered.filter(r => r.vendedorId === currentUser.id);
  } else if (vendedor_id) {
    filtered = filtered.filter(r => r.vendedorId === vendedor_id);
  }

  if (client_id) filtered = filtered.filter(r => r.installment.clientId === client_id);
  if (status) filtered = filtered.filter(r => r.installment.status === status);
  if (overdue_only) filtered = filtered.filter(r => r.installment.status === "atrasado");

  res.json(filtered.map(r => formatInstallment(r.installment, r.clientNome, r.vendedorId)));
});

router.get("/installments/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetInstallmentParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [row] = await db
    .select({ installment: installmentsTable, clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId })
    .from(installmentsTable)
    .leftJoin(clientsTable, eq(installmentsTable.clientId, clientsTable.id))
    .where(eq(installmentsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  res.json(formatInstallment(row.installment, row.clientNome, row.vendedorId));
});

router.patch("/installments/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateInstallmentParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateInstallmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.valor !== undefined) updates.valor = String(parsed.data.valor);
  if (parsed.data.vencimento !== undefined) updates.vencimento = parsed.data.vencimento;

  const [inst] = await db
    .update(installmentsTable)
    .set(updates)
    .where(eq(installmentsTable.id, params.data.id))
    .returning();

  if (!inst) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  const [row] = await db
    .select({ clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId })
    .from(clientsTable)
    .where(eq(clientsTable.id, inst.clientId));

  res.json(formatInstallment(inst, row?.clientNome, row?.vendedorId));
});

router.post("/installments/:id/pay", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = PayInstallmentParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = PayInstallmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const now = new Date();

  const [inst] = await db
    .update(installmentsTable)
    .set({ status: "pago", pagoEm: now })
    .where(eq(installmentsTable.id, params.data.id))
    .returning();

  if (!inst) {
    res.status(404).json({ error: "Installment not found" });
    return;
  }

  // Create parcela_paga event
  await db.insert(clientEventsTable).values({
    clientId: inst.clientId,
    tipo: "parcela_paga",
    userId: currentUser.id,
    observacao: parsed.data.observacao ?? `Parcela ${inst.numeroParcela} paga - R$ ${parseFloat(inst.valor).toFixed(2)}`,
    data: now,
  });

  const [row] = await db
    .select({ clientNome: clientsTable.nome, vendedorId: clientsTable.vendedorId })
    .from(clientsTable)
    .where(eq(clientsTable.id, inst.clientId));

  res.json(formatInstallment(inst, row?.clientNome, row?.vendedorId));
});

export default router;
