import { pgTable, serial, timestamp, pgEnum, numeric, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const installmentStatusEnum = pgEnum("installment_status", ["pendente", "pago", "atrasado"]);

export const installmentsTable = pgTable("installments", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  numeroParcela: integer("numero_parcela").notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  vencimento: date("vencimento").notNull(),
  status: installmentStatusEnum("status").notNull().default("pendente"),
  pagoEm: timestamp("pago_em", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstallmentSchema = createInsertSchema(installmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInstallment = z.infer<typeof insertInstallmentSchema>;
export type Installment = typeof installmentsTable.$inferSelect;
