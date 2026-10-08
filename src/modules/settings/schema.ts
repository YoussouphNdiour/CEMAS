import { pgTable, integer, varchar, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const parametresEcole = pgTable(
	"parametres_ecole",
	{
		id: integer("id").primaryKey().default(1),
		nom: varchar("nom", { length: 150 }).notNull(),
		sigle: varchar("sigle", { length: 30 }).notNull(),
		adresse: varchar("adresse", { length: 255 }),
		telephone1: varchar("telephone1", { length: 30 }),
		telephone2: varchar("telephone2", { length: 30 }),
		email: varchar("email", { length: 150 }),
		contactsEntete: text("contacts_entete"),
		prefixeMatricule: varchar("prefixe_matricule", { length: 10 }).notNull(),
		prefixeRecu: varchar("prefixe_recu", { length: 10 }).notNull(),
		prefixeEmploye: varchar("prefixe_employe", { length: 10 }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [check("parametres_ecole_single_row", sql`${t.id} = 1`)],
);

export type ParametresEcole = typeof parametresEcole.$inferSelect;
