import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { db, usersTable, sessionsTable, teamsTable, teamMembersTable } from "./../lib/db/src/index.ts";
import { eq, and } from "drizzle-orm";
import { LoginBody } from "./../lib/api-zod/src/index.ts";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth Helpers
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "loan_crm_salt").digest("hex");
}

async function createSession(userId: number, activeTeamId?: number | null): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId, activeTeamId: activeTeamId ?? null, token, expiresAt });
  return token;
}

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

// Routes
app.post("/api/auth/login", async (req, res) => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const { email, senha } = parsed.data;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    
    if (!user || user.senhaHash !== hashPassword(senha)) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body ?? {};

    if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
      return res.status(400).json({ error: "Nome deve ter pelo menos 2 caracteres." });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Email inválido." });
    }
    if (!senha || typeof senha !== "string" || senha.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
    }

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) {
      return res.status(409).json({ error: "Este email já está cadastrado." });
    }

    const senhaHash = hashPassword(senha);
    const [user] = await db
      .insert(usersTable)
      .values({ nome: nome.trim(), email, senhaHash })
      .returning();

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.session_token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
