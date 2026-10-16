import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "@/modules/auth/schema";

/** Journal des modifications et suppressions faites par l'administrateur (D-026). */
export const journalModifications = pgTable(
	"journal_modifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
		userNom: varchar("user_nom", { length: 100 }).notNull(),
		entite: varchar("entite", { length: 20 }).notNull(),
		entiteId: uuid("entite_id").notNull(),
		action: varchar("action", { length: 20 }).notNull(),
		libelle: varchar("libelle", { length: 200 }).notNull(),
		avant: jsonb("avant"),
		apres: jsonb("apres"),
		motif: varchar("motif", { length: 300 }),
	},
	(t) => [
		index("journal_created_idx").on(t.createdAt),
		check(
			"journal_entite_check",
			sql`${t.entite} in ('eleve', 'contact', 'paiement', 'employe', 'abonnement', 'service')`,
		),
		check("journal_action_check", sql`${t.action} in ('modification', 'suppression')`),
	],
);
