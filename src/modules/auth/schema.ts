import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	email: varchar("email", { length: 255 }).unique().notNull(),
	passwordHash: text("password_hash").notNull(),
	nom: varchar("nom", { length: 200 }).notNull(),
	role: varchar("role", { length: 20 }).notNull().default("directeur"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
