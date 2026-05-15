import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { hashPassword } from "../lib/auth";
import {
  CreateUserBody,
  GetUserParams,
  UpdateUserParams,
  UpdateUserBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", requireAuth, async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    nome: usersTable.nome,
    email: usersTable.email,
    papel: usersTable.papel,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.nome);

  res.json(users.map(u => ({ ...u, createdAt: u.createdAt.toISOString() })));
});

router.post("/users", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { nome, email, senha, papel } = parsed.data;
  const senhaHash = hashPassword(senha);

  const [user] = await db.insert(usersTable).values({ nome, email, senhaHash, papel }).returning();
  res.status(201).json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
    createdAt: user.createdAt.toISOString(),
  });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse({ id: parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateUserParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { senha, ...rest } = parsed.data;
  const updates: Record<string, unknown> = { ...rest };
  if (senha) updates.senhaHash = hashPassword(senha);

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, params.data.id))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    nome: user.nome,
    email: user.email,
    papel: user.papel,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
