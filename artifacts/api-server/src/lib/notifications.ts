import { db, notificationsTable, teamMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Notification } from "@workspace/db";

type NotifTipo = Notification["tipo"];

export async function createNotification(params: {
  userId: number;
  teamId: number;
  tipo: NotifTipo;
  titulo: string;
  mensagem: string;
  clientId?: number | null;
}) {
  await db.insert(notificationsTable).values({
    userId: params.userId,
    teamId: params.teamId,
    tipo: params.tipo,
    titulo: params.titulo,
    mensagem: params.mensagem,
    clientId: params.clientId ?? null,
    lida: false,
  });
}

export async function createNotificationForTeamRoles(params: {
  teamId: number;
  roles: Array<"vendedor" | "cobrador" | "lider">;
  tipo: NotifTipo;
  titulo: string;
  mensagem: string;
  clientId?: number | null;
}) {
  const members = await db
    .select({ userId: teamMembersTable.userId })
    .from(teamMembersTable)
    .where(eq(teamMembersTable.teamId, params.teamId));

  const filtered = members.filter(m => params.roles.includes("vendedor" as any));

  for (const m of members) {
    await createNotification({
      userId: m.userId,
      teamId: params.teamId,
      tipo: params.tipo,
      titulo: params.titulo,
      mensagem: params.mensagem,
      clientId: params.clientId ?? null,
    });
  }
}
