import { pgTable, text, serial, timestamp, pgEnum, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clientStatusEnum = pgEnum("client_status", ["ativo", "em_cobranca", "quitado"]);

export const clientsTable = pgTable("clients", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  telefone: text("telefone").notNull(),
  vendedorId: integer("vendedor_id").notNull().references(() => usersTable.id),
  valorContrato: numeric("valor_contrato", { precision: 12, scale: 2 }).notNull(),
  parcelas: integer("parcelas").notNull(),
  diaVencimento: integer("dia_vencimento").notNull(),
  status: clientStatusEnum("status").notNull().default("ativo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
