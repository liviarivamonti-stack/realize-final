import { Router, type IRouter } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, createSession, requireAuth, getCurrentUser } from "../lib/auth";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

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

  const token = await createSession(user.id);

  res.cookie("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      papel: user.papel,
      createdAt: user.createdAt.toISOString(),
    },
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

  const papelValido = ["vendedor", "cobrador", "lider"].includes(req.body?.papel ?? "")
    ? req.body.papel
    : "vendedor";

  const senhaHash = hashPassword(senha);
  const [user] = await db
    .insert(usersTable)
    .values({ nome, email, senhaHash, papel: papelValido })
    .returning();

  const token = await createSession(user.id);

  res.cookie("session_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      papel: user.papel,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.session_token;
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.clearCookie("session_token");
  res.json({ ok: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = getCurrentUser(req);
  res.json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
