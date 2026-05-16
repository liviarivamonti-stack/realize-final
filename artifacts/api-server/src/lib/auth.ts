import { db, sessionsTable, usersTable, teamMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "loan_crm_salt").digest("hex");
}

export async function createSession(userId: number, activeTeamId?: number | null): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId, activeTeamId: activeTeamId ?? null, token, expiresAt });
  return token;
}

export async function updateSessionTeam(token: string, teamId: number): Promise<void> {
  await db.update(sessionsTable).set({ activeTeamId: teamId }).where(eq(sessionsTable.token, token));
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.session_token;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));

  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  (req as any).currentUser = user;
  (req as any).currentSession = session;

  if (session.activeTeamId) {
    const [tm] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.userId, user.id), eq(teamMembersTable.teamId, session.activeTeamId)));
    (req as any).currentTeamMember = tm ?? null;
  } else {
    (req as any).currentTeamMember = null;
  }

  next();
}

export function getCurrentUser(req: Request) {
  return (req as any).currentUser as typeof usersTable.$inferSelect;
}

export function getCurrentSession(req: Request) {
  return (req as any).currentSession as typeof sessionsTable.$inferSelect;
}

export function getActiveTeamId(req: Request): number | null {
  const session = getCurrentSession(req);
  return session?.activeTeamId ?? null;
}

export function getCurrentTeamMember(req: Request) {
  return (req as any).currentTeamMember as typeof teamMembersTable.$inferSelect | null;
}

export function requireTeam(req: Request, res: Response): number | null {
  const teamId = getActiveTeamId(req);
  if (!teamId) {
    res.status(400).json({ error: "No active team. Select a team first." });
    return null;
  }
  return teamId;
}

export function requireRole(req: Request, res: Response, roles: string[]): boolean {
  const tm = getCurrentTeamMember(req);
  if (!tm || !roles.includes(tm.role)) {
    res.status(403).json({ error: "Insufficient permissions in this team." });
    return false;
  }
  return true;
}
