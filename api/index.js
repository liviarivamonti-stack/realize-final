const { Pool } = require("pg");
const crypto = require("crypto");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000 // Desiste após 5 segundos se não conectar
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

  console.log(`Recebendo requisição: ${req.method} ${req.url}`);

  const url = req.url || "";
  let client;

  try {
    // POST /api/auth/register
    if (url.includes("/auth/register") && req.method === "POST") {
      const { nome, email, senha } = req.body || {};
      if (!nome || !email || !senha) return res.status(400).json({ error: "Campos obrigatórios faltando" });

      console.log("Tentando conectar ao banco para registro...");
      client = await pool.connect();
      
      const check = await client.query("SELECT id FROM users WHERE email=$1", [email]);
      if (check.rows[0]) return res.status(400).json({ error: "Email já cadastrado" });
      
      const newUser = await client.query(
        "INSERT INTO users (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING id, nome, email",
        [nome, email, hashPassword(senha)]
      );
      
      console.log("Usuário criado com sucesso!");
      return res.status(201).json({ success: true, user: newUser.rows[0] });
    }

    // POST /api/auth/login
    if (url.includes("/auth/login") && req.method === "POST") {
      const { email, senha } = req.body || {};
      client = await pool.connect();
      const u = await client.query("SELECT * FROM users WHERE email=$1", [email]);
      const user = u.rows[0];
      
      if (!user || user.senha_hash !== hashPassword(senha)) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await client.query(
        "INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)",
        [user.id, token, expiresAt]
      );

      res.setHeader("Set-Cookie", `session_token=${token}; Path=/; HttpOnly; Max-Age=${7 * 24 * 60 * 60}`);
      return res.status(200).json({ success: true, user: { id: user.id, email: user.email } });
    }

    return res.status(404).json({ error: "Rota não encontrada" });

  } catch (error) {
    console.error("ERRO NA API:", error.message);
    return res.status(500).json({ error: "Erro interno no servidor", details: error.message });
  } finally {
    if (client) client.release();
  }
};
