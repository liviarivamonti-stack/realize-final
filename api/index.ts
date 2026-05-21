import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

// DB Connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

    const client = await pool.connect();
    try {
      const sessionRes = await client.query("SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()", [token]);
      if (sessionRes.rows.length === 0) return res.status(401).json({ error: "Session expired" });
      
      const session = sessionRes.rows[0];
      const userRes = await client.query("SELECT id, nome, email FROM users WHERE id = $1", [session.user_id]);
      if (userRes.rows.length === 0) return res.status(401).json({ error: "User not found" });

      res.json({
        ...userRes.rows[0],
        active_team_id: session.active_team_id,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: "Email e senha são obrigatórios" });

    const client = await pool.connect();
    try {
      const userRes = await client.query("SELECT * FROM users WHERE email = $1", [email]);
      const user = userRes.rows[0];

      if (!user || user.senha_hash !== hashPassword(senha)) {
        return res.status(401).json({ error: "Email ou senha inválidos" });
      }

      const memberRes = await client.query("SELECT team_id FROM team_members WHERE user_id = $1 LIMIT 1", [user.id]);
      const activeTeamId = memberRes.rows[0]?.team_id || null;

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client.query("INSERT INTO sessions (user_id, active_team_id, token, expires_at) VALUES ($1, $2, $3, $4)", [user.id, activeTeamId, token, expiresAt]);

      res.cookie("session_token", token, cookieOpts());
      res.json({ user: { id: user.id, nome: user.nome, email: user.email }, active_team_id: activeTeamId });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { nome, email, senha } = req.body ?? {};
    if (!nome || !email || !senha) return res.status(400).json({ error: "Dados incompletos" });

    const client = await pool.connect();
    try {
      const existingRes = await client.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existingRes.rows.length > 0) return res.status(409).json({ error: "Email já cadastrado" });

      const userRes = await client.query(
        "INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email",
        [nome, email, hashPassword(senha)]
      );
      const user = userRes.rows[0];

      const teamRes = await client.query(
        "INSERT INTO teams (nome, created_by, invite_code) VALUES ($1, $2, $3) RETURNING id, nome",
        [`Time de ${nome}`, user.id, generateInviteCode()]
      );
      const team = teamRes.rows[0];

      await client.query("INSERT INTO team_members (user_id, team_id, role) VALUES ($1, $2, $3)", [user.id, team.id, 'lider']);

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await client.query("INSERT INTO sessions (user_id, active_team_id, token, expires_at) VALUES ($1, $2, $3, $4)", [user.id, team.id, token, expiresAt]);

      res.cookie("session_token", token, cookieOpts());
      res.status(201).json({ user, team });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
