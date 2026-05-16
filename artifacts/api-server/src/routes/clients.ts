import { Router, type IRouter } from "express";
import { db, clientsTable, usersTable, installmentsTable, clientEventsTable, teamMembersTable } from "@workspace/db";
import { eq, and, ilike, inArray, SQL } from "drizzle-orm";
import { requireAuth, getCurrentUser, requireTeam, getCurrentTeamMember } from "../lib/auth";
import { generateInstallments } from "../lib/installment-engine";
import {
  ListClientsQueryParams,
  CreateClientBody,
  GetClientParams,
  UpdateClientParams,
  UpdateClientBody,
  RenovacaoClientParams,
  RenovacaoClientBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatClient(c: any, vendedorNome?: string | null) {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    vendedor_id: c.vendedorId,
    vendedor_nome: vendedorNome ?? null,
    valor_contrato: parseFloat(c.valorContrato),
    parcelas: c.parcelas,
    dia_vencimento: c.diaVencimento,
    status: c.status,
    risk_level: c.riskLevel ?? null,
    createdAt: c.createdAt?.toISOString?.() ?? c.createdAt,
  };
}

router.get("/clients", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const qp = ListClientsQueryParams.safeParse(req.query);
  const { status, vendedor_id, search } = qp.success ? qp.data : {};

  const currentUser = getCurrentUser(req);
  const teamMember = getCurrentTeamMember(req);

  const conditions: SQL[] = [eq(clientsTable.teamId, teamId)];
  if (teamMember?.role === "vendedor") {
    conditions.push(eq(clientsTable.vendedorId, currentUser.id));
  } else if (vendedor_id) {
    conditions.push(eq(clientsTable.vendedorId, vendedor_id));
  }
  if (status) conditions.push(eq(clientsTable.status, status));
  if (search) conditions.push(ilike(clientsTable.nome, `%${search}%`));

  const rows = await db
    .select({ client: clientsTable, vendedorNome: usersTable.nome })
    .from(clientsTable)
    .leftJoin(usersTable, eq(clientsTable.vendedorId, usersTable.id))
    .where(and(...conditions))
    .orderBy(clientsTable.createdAt);

  res.json(rows.map(r => formatClient(r.client, r.vendedorNome)));
});

router.post("/clients", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const teamMember = getCurrentTeamMember(req);
  if (!teamMember || !["vendedor", "lider"].includes(teamMember.role)) {
    res.status(403).json({ error: "Apenas vendedores e líderes podem cadastrar clientes." });
    return;
  }

  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const { nome, telefone, valor_contrato, parcelas, dia_vencimento, vendedor_id } = parsed.data;
  const vendedorId = vendedor_id ?? currentUser.id;

  const [client] = await db
    .insert(clientsTable)
    .values({ teamId, nome, telefone, vendedorId, valorContrato: String(valor_contrato), parcelas, diaVencimento: dia_vencimento, status: "ativo" })
    .returning();

  await generateInstallments(client.id, teamId, valor_contrato, parcelas, dia_vencimento);

  await db.insert(clientEventsTable).values({
    teamId,
    clientId: client.id,
    tipo: "venda_fechada",
    userId: currentUser.id,
    observacao: `Contrato de R$ ${valor_contrato.toFixed(2)} em ${parcelas} parcelas`,
    data: new Date(),
  });

  const [vendedor] = await db.select().from(usersTable).where(eq(usersTable.id, vendedorId));
  res.status(201).json(formatClient(client, vendedor?.nome));
});

router.get("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetClientParams.safeParse({ id: parseInt(raw) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [row] = await db
    .select({ client: clientsTable, vendedorNome: usersTable.nome })
    .from(clientsTable)
    .leftJoin(usersTable, eq(clientsTable.vendedorId, usersTable.id))
    .where(and(eq(clientsTable.id, params.data.id), eq(clientsTable.teamId, teamId)));

  if (!row) { res.status(404).json({ error: "Client not found" }); return; }

  const installments = await db.select().from(installmentsTable).where(eq(installmentsTable.clientId, params.data.id)).orderBy(installmentsTable.numeroParcela);
  const events = await db
    .select({ event: clientEventsTable, userNome: usersTable.nome })
    .from(clientEventsTable)
    .leftJoin(usersTable, eq(clientEventsTable.userId, usersTable.id))
    .where(eq(clientEventsTable.clientId, params.data.id))
    .orderBy(clientEventsTable.data);

  res.json({
    ...formatClient(row.client, row.vendedorNome),
    installments: installments.map(i => ({
      id: i.id,
      client_id: i.clientId,
      client_nome: row.client.nome,
      vendedor_id: row.client.vendedorId,
      numero_parcela: i.numeroParcela,
      valor: parseFloat(i.valor),
      vencimento: i.vencimento,
      status: i.status,
      pago_em: i.pagoEm?.toISOString() ?? null,
    })),
    events: events.map(e => ({
      id: e.event.id,
      client_id: e.event.clientId,
      client_nome: row.client.nome,
      tipo: e.event.tipo,
      user_id: e.event.userId,
      user_nome: e.userNome ?? null,
      observacao: e.event.observacao ?? null,
      data: e.event.data.toISOString(),
    })),
  });
});

router.patch("/clients/:id", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateClientParams.safeParse({ id: parseInt(raw) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, unknown> = {};
  if (parsed.data.nome !== undefined) updates.nome = parsed.data.nome;
  if (parsed.data.telefone !== undefined) updates.telefone = parsed.data.telefone;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.valor_contrato !== undefined) updates.valorContrato = String(parsed.data.valor_contrato);

  const [client] = await db.update(clientsTable).set(updates).where(and(eq(clientsTable.id, params.data.id), eq(clientsTable.teamId, teamId))).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [vendedor] = await db.select().from(usersTable).where(eq(usersTable.id, client.vendedorId));
  res.json(formatClient(client, vendedor?.nome));
});

router.patch("/clients/:id/risk-level", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const teamMember = getCurrentTeamMember(req);
  if (!teamMember || teamMember.role === "vendedor") {
    res.status(403).json({ error: "Apenas cobradores e líderes podem alterar o risco." });
    return;
  }

  const currentUser = getCurrentUser(req);
  const riskLevel = req.body?.risk_level;
  const allowed = [null, "atencao", "risco", "critico"];
  if (!allowed.includes(riskLevel)) {
    res.status(400).json({ error: "risk_level must be atencao | risco | critico | null" });
    return;
  }

  const [client] = await db.update(clientsTable).set({ riskLevel: riskLevel ?? null }).where(and(eq(clientsTable.id, id), eq(clientsTable.teamId, teamId))).returning();
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  await db.insert(clientEventsTable).values({
    teamId,
    clientId: id,
    tipo: "anotacao",
    userId: currentUser.id,
    observacao: riskLevel ? `Nível de risco alterado para: ${riskLevel}` : "Nível de risco removido",
    data: new Date(),
  });

  const [vendedor] = await db.select().from(usersTable).where(eq(usersTable.id, client.vendedorId));
  res.json(formatClient(client, vendedor?.nome));
});

router.post("/clients/:id/renovacao", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = RenovacaoClientParams.safeParse({ id: parseInt(raw) });
  if (!params.success) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = RenovacaoClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const currentUser = getCurrentUser(req);
  const { novas_parcelas, novo_valor, novo_dia_vencimento, observacao } = parsed.data;

  const [client] = await db
    .update(clientsTable)
    .set({ parcelas: novas_parcelas, valorContrato: String(novo_valor), diaVencimento: novo_dia_vencimento, status: "ativo" })
    .where(and(eq(clientsTable.id, params.data.id), eq(clientsTable.teamId, teamId)))
    .returning();

  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  await generateInstallments(client.id, teamId, novo_valor, novas_parcelas, novo_dia_vencimento);

  await db.insert(clientEventsTable).values({
    teamId,
    clientId: client.id,
    tipo: "renovacao",
    userId: currentUser.id,
    observacao: observacao ?? `Renovação: ${novas_parcelas} parcelas de R$ ${(novo_valor / novas_parcelas).toFixed(2)}`,
    data: new Date(),
  });

  const [vendedor] = await db.select().from(usersTable).where(eq(usersTable.id, client.vendedorId));
  res.json(formatClient(client, vendedor?.nome));
});

export default router;
