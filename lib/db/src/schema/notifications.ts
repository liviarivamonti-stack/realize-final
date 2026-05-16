import { pgTable, text, serial, timestamp, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { clientsTable } from "./clients";

export const notificationTypeEnum = pgEnum("notification_type", [
  "cobranca_alerta",
  "follow_up",
  "vencimento_proximo",
  "pagamento_confirmado",
  "cliente_critico",
  "atraso_novo",
  "renegociacao",
  "risco_alterado",
]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tipo: notificationTypeEnum("tipo").notNull(),
  titulo: text("titulo").notNull(),
  mensagem: text("mensagem").notNull(),
  clientId: integer("client_id").references(() => clientsTable.id),
  lida: boolean("lida").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
