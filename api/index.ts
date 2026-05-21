import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { eq, and } from "drizzle-orm";

const { Pool } = pg;

// Schema Definition (Consolidated to avoid ERR_MODULE_NOT_FOUND)
export const papelEnum = pgEnum("papel", ["vendedor", "cobrador", "lider"]);
export const teamRoleEnum = pgEnum("team_role", ["vendedor", "cobrador", "lider"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  papel: papelEnum("papel").notNull().default("vendedor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  createdBy: integer("created_by").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  metaMensal: text("meta_mensal").notNull().default("20000"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  teamId: integer("team_id").notNull(),
  role: teamRoleEnum("role").notNull().default("vendedor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  activeTeamId: integer("active_team_id"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// DB Connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const db = drizzle(pool);

// Express App
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
app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies?.session_token;
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
    if (!session || session.expiresAt < new Date()) return res.status(401).json({ error: "Session expired" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
    if (!user) return res.status(401).json({ error: "User not found" });

    res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      active_team_id: session.activeTeamId ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: "Email e senha são obrigatórios" });

    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user || user.senhaHash !== hashPassword(senha)) return res.status(401).json({ error: "Email ou senha inválidos" });

    const [membership] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.userId, user.id));
    const token = await createSession(user.id, membership?.teamId);

    res.cookie("session_token", token, cookieOpts());
    res.json({ user: { id: user.id, nome: user.nome, email: user.email }, active_team_id: membership?.teamId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body ?? {};
    if (!nome || !email || !senha) return res.status(400).json({ error: "Dados incompletos" });

    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (existing) return res.status(409).json({ error: "Email já cadastrado" });

    const [user] = await db.insert(usersTable).values({ nome, email, senhaHash: hashPassword(senha) }).returning();
    const [team] = await db.insert(teamsTable).values({ nome: `Time de ${nome}`, createdBy: user.id, inviteCode: generateInviteCode() }).returning();
    await db.insert(teamMembersTable).values({ userId: user.id, teamId: team.id, role: "lider" });

    const token = await createSession(user.id, team.id);
    res.cookie("session_token", token, cookieOpts());
    res.status(201).json({ user: { id: user.id, nome: user.nome, email: user.email }, team: { id: team.id, nome: team.nome } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
