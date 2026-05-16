import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const teamRoleEnum = pgEnum("team_role", ["vendedor", "cobrador", "lider"]);

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  nome: text("nome").notNull(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  inviteCode: text("invite_code").notNull().unique(),
  metaMensal: text("meta_mensal").notNull().default("20000"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  role: teamRoleEnum("role").notNull().default("vendedor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
export type TeamMember = typeof teamMembersTable.$inferSelect;
