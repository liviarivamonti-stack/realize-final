const { Pool } = require("pg");
const crypto = require("crypto");

// Usamos uma variável global para o Pool para evitar abrir conexões demais na Vercel
let pool;
if (!pool) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

const hash = (p) => crypto.createHash("sha256").update(p + "loan_crm_salt").digest("hex");

module.exports = async (req, res) => {
  // CORS - Liberando para o seu frontend
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const url = req.url || "";
  let client;

  try {
    client = await pool.connect();

    // ROTA DE REGISTRO
    if (url.includes("/auth/register") && req.method === "POST") {
      const { nome, email, senha } = req.body;
      await client.query("INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3)", [nome, email, hash(senha)]);
      return res.status(201).json({ success: true });
    }

    // ROTA DE LOGIN
    if (url.includes("/auth/login") && req.method === "POST") {
      const { email, senha } = req.body;
      const u = await client.query("SELECT * FROM users WHERE email=$1", [email]);
      if (u.rows[0] && u.rows[0].senha_hash === hash(senha)) {
        const token = crypto.randomBytes(20).toString("hex");
        await client.query("INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [u.rows[0].id, token]);
        res.setHeader("Set-Cookie", `session_token=${token}; Path=/; HttpOnly; Max-Age=604800; SameSite=Lax`);
        return res.status(200).json({ success: true, user: { nome: u.rows[0].nome } });
      }
      return res.status(401).json({ error: "Dados inválidos" });
    }

    return res.status(404).json({ error: "Rota não encontrada" });
  } catch (e) {
    return res.status(500).json({ error: "Erro no Banco", details: e.message });
  } finally {
    if (client) client.release();
  }
};
