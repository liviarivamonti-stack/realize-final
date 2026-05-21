const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "loan_crm_salt").digest("hex");
}

function cookieOpts() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

app.get("/api/auth/me", async (req, res) => {
  const token = req.cookies?.session_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  const client = await pool.connect();
  try {
    const s = await client.query("SELECT * FROM sessions WHERE token=$1 AND expires_at > NOW()", [token]);
    if (!s.rows[0]) return res.status(401).json({ error: "Session expired" });
    const u = await client.query("SELECT id, nome, email, created_at FROM users WHERE id=$1", [s.rows[0].user_id]);
    if (!u.rows[0]) return res.status(401).json({ error: "User not found" });
    res.json({ ...u.rows[0], active_team_id: s.rows[0].active_team_id, needs_team: !s.rows[0].active_team_id });
  } finally { client.release(); }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, senha } = req.body ?? {};
  if (!email || !senha) return res.status(400).json({ error: "Email e senha obrigatórios" });
  const client = await pool.connect();
  try {
    const u = await client.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = u.rows[0];
    if (!user || user.senha_hash !== hashPassword(senha)) return res.status(401).json({ error: "Email ou senha inválidos" });
    const m = await client.query("SELECT team_id FROM team_members WHERE user_id=$1 LIMIT 1", [user.id]);
    const activeTeamId = m.rows[0]?.team_id ?? null;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query("INSERT INTO sessions (user_id, active_team_id, token, expires_at) VALUES ($1,$2,$3,$4)", [user.id, activeTeamId, token, expiresAt]);
    res.cookie("session_token", token, cookieOpts());
    res.json({ user: { id: user.id, nome: user.nome, email: user.email }, active_team_id: activeTeamId, needs_team: !activeTeamId });
  } finally { client.release(); }
});

app.post("/api/auth/register", async (req, res) => {
  const { nome, email, senha } = req.body ?? {};
  if (!nome || !email || !senha) return res.status(400).json({ error: "Dados incompletos" });
  const client = await pool.connect();
  try {
    const ex = await client.query("SELECT id FROM users WHERE email=$1", [email]);
    if (ex.rows.length > 0) return res.status(409).json({ error: "Email já cadastrado" });
    const u = await client.query("INSERT INTO users (nome, email, senha_hash) VALUES ($1,$2,$3) RETURNING id, nome, email", [nome.trim(), email, hashPassword(senha)]);
    const user = u.rows[0];
    const inviteCode = crypto.randomBytes(4).toString("hex").toUpperCase();
    const t = await client.query("INSERT INTO teams (nome, created_by, invite_code) VALUES ($1,$2,$3) RETURNING id, nome", [`Time de ${nome.trim().split(" ")[0]}`, user.id, inviteCode]);
    const team = t.rows[0];
    await client.query("INSERT INTO team_members (user_id, team_id, role) VALUES ($1,$2,$3)", [user.id, team.id, "lider"]);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query("INSERT INTO sessions (user_id, active_team_id, token, expires_at) VALUES ($1,$2,$3,$4)", [user.id, team.id, token, expiresAt]);
    res.cookie("session_token", token, cookieOpts());
    res.status(201).json({ user, team: { id: team.id, nome: team.nome, invite_code: inviteCode, role: "lider" }, active_team_id: team.id });
  } finally { client.release(); }
});

module.exports = app;
