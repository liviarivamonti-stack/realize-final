import { Router, type IRouter } from "express";
import { db, privateNotesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  CreateNoteBody,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatNote(n: any) {
  return {
    id: n.id,
    user_id: n.userId,
    texto: n.texto,
    createdAt: n.createdAt?.toISOString?.() ?? n.createdAt,
  };
}

router.get("/notes", requireAuth, async (req, res): Promise<void> => {
  const currentUser = getCurrentUser(req);
  const notes = await db
    .select()
    .from(privateNotesTable)
    .where(eq(privateNotesTable.userId, currentUser.id))
    .orderBy(privateNotesTable.createdAt);

  res.json(notes.map(formatNote));
});

router.post("/notes", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const [note] = await db
    .insert(privateNotesTable)
    .values({ userId: currentUser.id, texto: parsed.data.texto })
    .returning();

  res.status(201).json(formatNote(note));
});

router.patch("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateNoteParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = getCurrentUser(req);
  const [note] = await db
    .update(privateNotesTable)
    .set({ texto: parsed.data.texto })
    .where(and(eq(privateNotesTable.id, params.data.id), eq(privateNotesTable.userId, currentUser.id)))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  res.json(formatNote(note));
});

router.delete("/notes/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteNoteParams.safeParse({ id: parseInt(raw) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const currentUser = getCurrentUser(req);
  await db
    .delete(privateNotesTable)
    .where(and(eq(privateNotesTable.id, params.data.id), eq(privateNotesTable.userId, currentUser.id)));

  res.sendStatus(204);
});

export default router;
