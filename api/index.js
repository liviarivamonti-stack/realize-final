const { Pool } = require("pg");
const crypto = require("crypto");

// Configuração do Banco de Dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000 // 10 segundos de timeout
});

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "loan_crm_salt").digest("hex");
}

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.url || "";
  let client;

  try {
    // 1. ROTA: GET /api/auth/me (Verificar usuário logado)
    if (url.includes("/auth/me") && req.method === "GET") {
      const cookie = req.headers.cookie || "";
      const match = cookie.match(/session_token=([^;]+)/);
      const token = match ? match[1] : null;
      
      if (!token) return res.status(401).json({ error: "Não autenticado" });
      
      client = await pool.connect();
      const s = await client.query("SELECT * FROM sessions WHERE token=$1 AND expires_at > NOW()", [token]);
      if (!s.rows[0]) return res.status(401).json({ error: "Sessão expirada" });
      
      const u = await client.query("SELECT id, nome, email FROM users WHERE id=$1", [s.rows[0].user_id]);
      return res.status(200).json({ ...u.rows[0], active_team_id: s.rows[0].active_team_id });
    }

    // 2. ROTA: POST /api/auth/register (Criar conta)
    if (url.includes("/auth/register") && req.method === "POST") {
      const { nome, email, senha } = req.body || {};
      if (!nome || !email || !senha) return res.status(400).json({ error: "Campos obrigatórios faltando" });

      client = await pool.connect();
      const check = await client.query("SELECT id FROM users WHERE email=$1", [email]);
      if (check.rows[0]) return res.status(400).json({ error: "Email já cadastrado" });
      
      const newUser = await client.query(
        "INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email",
        [nome, email, hashPassword(senha)]
      );
      
      return res.status(201).json({ success: true, user: newUser.rows[0] });
    }

    // 3. ROTA: POST /api/auth/login (Entrar)
    if (url.includes("/auth/login") && req.method === "POST") {
      const { email, senha } = req.body || {};
      if (!email || !senha) return res.status(400).json({ error: "Email e senha obrigatórios" });

      client = await pool.connect();
      const u = await client.query("SELECT * FROM users WHERE email=$1", [email]);
      const user = u.rows[0];
      
      if (!user || user.senha_hash !== hashPassword(senha)) {
        return res.status(401).json({ error: "E-mail ou senha incorretos" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await client.query(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
        [user.id, token, expiresAt]
      );

      res.setHeader("Set-Cookie", `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
      return res.status(200).json({ success: true, user: { id: user.id, nome: user.nome, email: user.email } });
    }

    return res.status(404).json({ error: "Rota não encontrada" });

  } catch (error) {
    console.error("ERRO:", error.message);
    return res.status(500).json({ error: "Erro no servidor", details: error.message });
  } finally {
    if (client) client.release();
  }
};
