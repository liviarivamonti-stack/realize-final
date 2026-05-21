const { Pool } = require("pg");
const crypto = require("crypto");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "loan_crm_salt").digest("hex");
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.url || "";

  // GET /api/auth/me
  if (url.includes("/auth/me") && req.method === "GET") {
    const cookie = req.headers.cookie || "";
    const match = cookie.match(/session_token=([^;]+)/);
    const token = match ? match[1] : null;
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    const client = await pool.connect();
    try {
      const s = await client.query("SELECT * FROM sessions WHERE token=$1 AND expires_at > NOW()", [token]);
      if (!s.rows[0]) return res.status(401).json({ error: "Session expired" });
      const u = await client.query("SELECT id, nome, email, created_at FROM users WHERE id=$1", [s.rows[0].user_id]);
      if (!u.rows[0]) return res.status(401).json({ error: "User not found" });
      return res.status(200).json({ ...u.rows[0], active_team_id: s.rows[0].active_team_id, needs_team: !s.rows[0].active_team_id });
    } finally { client.release(); }
  }

  // POST /api/auth/login
  if (url.includes("/auth/login") && req.method === "POST") {
    const { email, senha } = req.body || {};
    if (!email || !senha) return res.status(400).json({ error: "Email e senha obrigatórios" });
    const client = await pool.connect();
    try {
      const u = await client.query("SELECT * FROM users WHERE email=$1", [email]);
      const user = u.rows[0];
      if (!user || user.senha_hash !== hashPassword(senha)) return res.status(401).json({ error: "Email ou senha inválidos" });
      const m = await client.query("SELECT team_id FROM team_members WHERE user_id=$1 LIMIT 1", [user.id]);
      const activeTeamId = m.rows[0]?.team_id || null;
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      // CORREÇÃO DA LINHA 52:
      await client.query(
        "INSERT INTO sessions (user_id, active_team_id, token, expires_at) VALUES ($1, $2, $3, $4)",
        [user.id, activeTeamId, token, expiresAt]
      );

      res.setHeader("Set-Cookie", `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
      return res.status(200).json({ success: true, user: { id: user.id, nome: user.nome, email: user.email }, active_team_id: activeTeamId });
    } finally { client.release(); }
  }

  // POST /api/auth/register
  if (url.includes("/auth/register") && req.method === "POST") {
    const { nome, email, senha } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ error: "Todos os campos são obrigatórios" });
    const client = await pool.connect();
    try {
      const check = await client.query("SELECT id FROM users WHERE email=$1", [email]);
      if (check.rows[0]) return res.status(400).json({ error: "Email já cadastrado" });
      
      const newUser = await client.query(
        "INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email",
        [nome, email, hashPassword(senha)]
      );
      
      return res.status(201).json({ success: true, user: newUser.rows[0] });
    } finally { client.release(); }
  }

  return res.status(404).json({ error: "Route not found" });
};
