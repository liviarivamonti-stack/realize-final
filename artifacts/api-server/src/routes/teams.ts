import { Router, type IRouter } from "express";
import { db, teamsTable, teamMembersTable, usersTable, sessionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getCurrentUser, getCurrentSession, updateSessionTeam } from "../lib/auth";
import crypto from "crypto";

const router: IRouter = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function formatTeam(team: any, role?: string | null) {
  return {
    id: team.id,
    nome: team.nome,
    invite_code: team.inviteCode,
    meta_mensal: parseFloat(team.metaMensal),
    created_by: team.createdBy,
    created_at: team.createdAt?.toISOString?.() ?? team.createdAt,
    role: role ?? null,
  };
}

router.get("/teams", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const currentSession = getCurrentSession(req);

  const rows = await db
    .select({ team: teamsTable, member: teamMembersTable })
    .from(teamMembersTable)
    .leftJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
    .where(eq(teamMembersTable.userId, currentUser.id));

  res.json({
    teams: rows.map(r => ({
      ...formatTeam(r.team, r.member.role),
      is_active: r.team?.id === currentSession.activeTeamId,
    })),
    active_team_id: currentSession.activeTeamId ?? null,
  });
});

router.post("/teams", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const { nome } = req.body ?? {};

  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    res.status(400).json({ error: "Nome do time deve ter pelo menos 2 caracteres." });
    return;
  }

  const inviteCode = generateInviteCode();
  const [team] = await db
    .insert(teamsTable)
    .values({ nome: nome.trim(), createdBy: currentUser.id, inviteCode })
    .returning();

  await db.insert(teamMembersTable).values({ userId: currentUser.id, teamId: team.id, role: "lider" });

  // Switch active team to this new team
  const token = req.cookies?.session_token;
  if (token) await updateSessionTeam(token, team.id);

  res.status(201).json(formatTeam(team, "lider"));
});

router.post("/teams/join", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const { invite_code } = req.body ?? {};

  if (!invite_code || typeof invite_code !== "string") {
    res.status(400).json({ error: "Código de convite inválido." });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.inviteCode, invite_code.trim().toUpperCase()));
  if (!team) {
    res.status(404).json({ error: "Time não encontrado. Verifique o código de convite." });
    return;
  }

  const [existing] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.userId, currentUser.id), eq(teamMembersTable.teamId, team.id)));

  if (existing) {
    res.status(409).json({ error: "Você já é membro deste time.", team: formatTeam(team, existing.role) });
    return;
  }

  await db.insert(teamMembersTable).values({ userId: currentUser.id, teamId: team.id, role: "vendedor" });

  // Switch active team
  const token = req.cookies?.session_token;
  if (token) await updateSessionTeam(token, team.id);

  res.status(201).json({ ...formatTeam(team, "vendedor"), message: `Você entrou no time "${team.nome}"!` });
});

router.post("/teams/switch", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const { team_id } = req.body ?? {};

  if (!team_id || typeof team_id !== "number") {
    res.status(400).json({ error: "team_id inválido." });
    return;
  }

  const [member] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.userId, currentUser.id), eq(teamMembersTable.teamId, team_id)));

  if (!member) {
    res.status(403).json({ error: "Você não é membro deste time." });
    return;
  }

  const token = req.cookies?.session_token;
  if (token) await updateSessionTeam(token, team_id);

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, team_id));
  res.json({ ...formatTeam(team, member.role), active: true });
});

router.get("/teams/:id/members", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid team ID" }); return; }

  const [myMembership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.userId, currentUser.id), eq(teamMembersTable.teamId, teamId)));

  if (!myMembership) {
    res.status(403).json({ error: "Você não é membro deste time." });
    return;
  }

  const rows = await db
    .select({ member: teamMembersTable, user: usersTable })
    .from(teamMembersTable)
    .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(eq(teamMembersTable.teamId, teamId));

  res.json(rows.map(r => ({
    id: r.member.id,
    user_id: r.user?.id ?? null,
    nome: r.user?.nome ?? null,
    email: r.user?.email ?? null,
    role: r.member.role,
    created_at: r.member.createdAt?.toISOString?.() ?? null,
  })));
});

router.patch("/teams/:id/members/:userId", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  const targetUserId = parseInt(Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId);

  const [myMembership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.userId, currentUser.id), eq(teamMembersTable.teamId, teamId)));

  if (!myMembership || myMembership.role !== "lider") {
    res.status(403).json({ error: "Apenas líderes podem alterar papéis." });
    return;
  }

  const { role } = req.body ?? {};
  if (!["vendedor", "cobrador", "lider"].includes(role)) {
    res.status(400).json({ error: "Role inválido." });
    return;
  }

  const [updated] = await db
    .update(teamMembersTable)
    .set({ role })
    .where(and(eq(teamMembersTable.userId, targetUserId), eq(teamMembersTable.teamId, teamId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Membro não encontrado." }); return; }
  res.json({ id: updated.id, user_id: updated.userId, team_id: updated.teamId, role: updated.role });
});

router.patch("/teams/:id", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const teamId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);

  const [myMembership] = await db
    .select()
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.userId, currentUser.id), eq(teamMembersTable.teamId, teamId)));

  if (!myMembership || myMembership.role !== "lider") {
    res.status(403).json({ error: "Apenas líderes podem editar o time." });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (req.body?.nome) updates.nome = req.body.nome;
  if (req.body?.meta_mensal !== undefined) updates.metaMensal = String(req.body.meta_mensal);

  const [team] = await db.update(teamsTable).set(updates).where(eq(teamsTable.id, teamId)).returning();
  if (!team) { res.status(404).json({ error: "Time não encontrado." }); return; }

  res.json(formatTeam(team, myMembership.role));
});

export default router;
