import { Router, type IRouter } from "express";
import { db, tasksTable, clientsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  ListTasksQueryParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
  CompleteTaskParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatTask(t: any, clientNome?: string | null) {
  return {
    id: t.id,
    user_id: t.userId,
    client_id: t.clientId ?? null,
    client_nome: clientNome ?? null,
    titulo: t.titulo,
    data: t.data,
    tipo: t.tipo,
    concluido: t.concluido,
  };
}

router.get("/tasks", requireAuth, async (req, res): Promise<void> => {
  const qp = ListTasksQueryParams.safeParse(req.query);
  const { tipo, concluido, client_id } = qp.success ? qp.data : {};
  const currentUser = getCurrentUser(req);

  const rows = await db
    .select({ task: tasksTable, clientNome: clientsTable.nome })
    .from(tasksTable)
    .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
    .where(eq(tasksTable.userId, currentUser.id))
    .orderBy(tasksTable.data);

  let filtered = rows;
  if (tipo) filtered = filtered.filter(r => r.task.tipo === tipo);
  if (concluido !== undefined) filtered = filtered.filter(r => r.task.concluido === concluido);
  if (client_id) filtered = filtered.filter(r => r.task.clientId === client_id);

  res.json(filtered.map(r => formatTask(r.task, r.clientNome)));
});

router.post("/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const [task] = await db.insert(tasksTable).values({
    userId: currentUser.id,
    clientId: parsed.data.client_id ?? null,
    titulo: parsed.data.titulo,
    data: parsed.data.data,
    tipo: parsed.data.tipo as any,
    concluido: false,
  }).returning();

  let clientNome: string | null = null;
  if (task.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, task.clientId));
    clientNome = c?.nome ?? null;
  }

  res.status(201).json(formatTask(task, clientNome));
});

router.patch("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTaskParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const updates: Record<string, unknown> = {};
  if (parsed.data.titulo !== undefined) updates.titulo = parsed.data.titulo;
  if (parsed.data.data !== undefined) updates.data = parsed.data.data;
  if (parsed.data.tipo !== undefined) updates.tipo = parsed.data.tipo;
  if (parsed.data.concluido !== undefined) updates.concluido = parsed.data.concluido;

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, currentUser.id)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  let clientNome: string | null = null;
  if (task.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, task.clientId));
    clientNome = c?.nome ?? null;
  }

  res.json(formatTask(task, clientNome));
});

router.delete("/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTaskParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const currentUser = getCurrentUser(req);
  await db
    .delete(tasksTable)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, currentUser.id)));

  res.sendStatus(204);
});

router.post("/tasks/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = CompleteTaskParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const currentUser = getCurrentUser(req);
  const [task] = await db
    .update(tasksTable)
    .set({ concluido: true })
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.userId, currentUser.id)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  let clientNome: string | null = null;
  if (task.clientId) {
    const [c] = await db.select().from(clientsTable).where(eq(clientsTable.id, task.clientId));
    clientNome = c?.nome ?? null;
  }

  res.json(formatTask(task, clientNome));
});

export default router;
