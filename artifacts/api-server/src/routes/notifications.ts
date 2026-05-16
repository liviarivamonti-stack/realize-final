import { Router, type IRouter } from "express";
import { db, notificationsTable, clientsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, getCurrentUser, requireTeam } from "../lib/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const currentUser = getCurrentUser(req);
  const lidaParam = req.query.lida;
  const limitParam = req.query.limit ? parseInt(req.query.limit as string) : 50;

  const baseCondition = and(
    eq(notificationsTable.userId, currentUser.id),
    eq(notificationsTable.teamId, teamId)
  );

  const rows = await db
    .select({ notif: notificationsTable, clientNome: clientsTable.nome })
    .from(notificationsTable)
    .leftJoin(clientsTable, eq(notificationsTable.clientId, clientsTable.id))
    .where(
      lidaParam !== undefined
        ? and(baseCondition, eq(notificationsTable.lida, lidaParam === "true"))
        : baseCondition
    )
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limitParam);

  res.json(rows.map(r => ({
    id: r.notif.id,
    user_id: r.notif.userId,
    tipo: r.notif.tipo,
    titulo: r.notif.titulo,
    mensagem: r.notif.mensagem,
    client_id: r.notif.clientId ?? null,
    client_nome: r.clientNome ?? null,
    lida: r.notif.lida,
    createdAt: r.notif.createdAt.toISOString(),
  })));
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const teamId = requireTeam(req, res);
  if (!teamId) return;

  const currentUser = getCurrentUser(req);
  await db
    .update(notificationsTable)
    .set({ lida: true })
    .where(and(
      eq(notificationsTable.userId, currentUser.id),
      eq(notificationsTable.teamId, teamId),
      eq(notificationsTable.lida, false)
    ));

  res.json({ ok: true });
});

export default router;
