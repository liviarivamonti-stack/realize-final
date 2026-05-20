import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable, teamsTable, teamMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, createSession, requireAuth, getCurrentUser, getCurrentSession } from "../lib/auth";
import { LoginBody } from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? "none" : "lax") as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, senha } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.senhaHash !== hashPassword(senha)) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  // Find first team membership to set as active
  const [firstMembership] = await db
    .select({ teamId: teamMembersTable.teamId })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.userId, user.id));

  const activeTeamId = firstMembership?.teamId ?? null;
  const token = await createSession(user.id, activeTeamId);

  res.cookie("session_token", token, cookieOpts());
  res.json({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    active_team_id: activeTeamId,
    needs_team: !activeTeamId,
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { nome, email, senha } = req.body ?? {};

  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    res.status(400).json({ error: "Nome deve ter pelo menos 2 caracteres." });
    return;
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "Email inválido." });
    return;
  }
  if (!senha || typeof senha !== "string" || senha.length < 6) {
    res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Este email já está cadastrado." });
    return;
  }

  const senhaHash = hashPassword(senha);
  console.log("Tentando inserir usuário:", { nome, email });
  const [user] = await db
    .insert(usersTable)
    .values({ nome: nome.trim(), email, senhaHash })
    .returning();
  console.log("Usuário inserido com sucesso:", user.id);

  // Auto-create team for this user
  const teamNome = `Time de ${nome.trim().split(" ")[0]}`;
  const inviteCode = generateInviteCode();
  const [team] = await db
    .insert(teamsTable)
    .values({ nome: teamNome, createdBy: user.id, inviteCode })
    .returning();

  await db.insert(teamMembersTable).values({ userId: user.id, teamId: team.id, role: "lider" });

  const token = await createSession(user.id, team.id);

  res.cookie("session_token", token, cookieOpts());
  res.status(201).json({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    active_team_id: team.id,
    team: { id: team.id, nome: team.nome, invite_code: team.inviteCode, role: "lider" },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.session_token;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.clearCookie("session_token", cookieOpts());
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = getCurrentUser(req);
  const session = getCurrentSession(req);

  let activeTeam = null;
  let activeRole = null;
  if (session.activeTeamId) {
    const [row] = await db
      .select({ team: teamsTable, member: teamMembersTable })
      .from(teamMembersTable)
      .leftJoin(teamsTable, eq(teamMembersTable.teamId, teamsTable.id))
      .where(and(eq(teamMembersTable.userId, user.id), eq(teamMembersTable.teamId, session.activeTeamId)));
    if (row) {
      activeTeam = { id: row.team?.id, nome: row.team?.nome, invite_code: row.team?.inviteCode };
      activeRole = row.member.role;
    }
  }

  res.json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
    active_team_id: session.activeTeamId ?? null,
    active_team: activeTeam,
    papel: activeRole,
    needs_team: !session.activeTeamId,
  });
});

export default router;
