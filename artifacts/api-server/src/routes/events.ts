import { Router, type IRouter } from "express";
import { db, clientEventsTable, clientsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { ListEventsQueryParams, CreateEventBody } from "@workspace/api-zod";

const router: IRouter = Router();

function formatEvent(e: any, clientNome?: string | null, userNome?: string | null) {
  return {
    id: e.id,
    client_id: e.clientId,
    client_nome: clientNome ?? null,
    tipo: e.tipo,
    user_id: e.userId,
    user_nome: userNome ?? null,
    observacao: e.observacao ?? null,
    data: e.data?.toISOString?.() ?? e.data,
  };
}

router.get("/events", requireAuth, async (req, res): Promise<void> => {
  const qp = ListEventsQueryParams.safeParse(req.query);
  const { client_id, tipo, user_id, limit } = qp.success ? qp.data : {};

  const rows = await db
    .select({
      event: clientEventsTable,
      clientNome: clientsTable.nome,
      userNome: usersTable.nome,
    })
    .from(clientEventsTable)
    .leftJoin(clientsTable, eq(clientEventsTable.clientId, clientsTable.id))
    .leftJoin(usersTable, eq(clientEventsTable.userId, usersTable.id))
    .orderBy(desc(clientEventsTable.data));

  let filtered = rows;
  if (client_id) filtered = filtered.filter(r => r.event.clientId === client_id);
  if (tipo) filtered = filtered.filter(r => r.event.tipo === tipo);
  if (user_id) filtered = filtered.filter(r => r.event.userId === user_id);
  if (limit) filtered = filtered.slice(0, limit);

  res.json(filtered.map(r => formatEvent(r.event, r.clientNome, r.userNome)));
});

router.post("/events", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const [event] = await db.insert(clientEventsTable).values({
    clientId: parsed.data.client_id,
    tipo: parsed.data.tipo as any,
    userId: currentUser.id,
    observacao: parsed.data.observacao ?? null,
    data: new Date(),
  }).returning();

  const [clientRow] = await db.select().from(clientsTable).where(eq(clientsTable.id, parsed.data.client_id));
  res.status(201).json(formatEvent(event, clientRow?.nome, currentUser.nome));
});

export default router;
