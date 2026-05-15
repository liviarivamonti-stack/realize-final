import { pgTable, text, serial, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const eventTypeEnum = pgEnum("event_type", [
  "venda_fechada",
  "parcela_paga",
  "atraso",
  "renovacao",
  "follow_up",
  "anotacao",
]);

export const clientEventsTable = pgTable("client_events", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  tipo: eventTypeEnum("tipo").notNull(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  observacao: text("observacao"),
  data: timestamp("data", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(clientEventsTable).omit({ id: true, createdAt: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type ClientEvent = typeof clientEventsTable.$inferSelect;
