import {
	pgTable,
	uuid,
	varchar,
	text,
	integer,
	boolean,
	date,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const employes = pgTable("employes", {
	id: uuid("id").defaultRandom().primaryKey(),
	matricule: varchar("matricule", { length: 20 }).unique().notNull(),
	prenom: varchar("prenom", { length: 100 }).notNull(),
	nom: varchar("nom", { length: 100 }).notNull(),
	telephone: varchar("telephone", { length: 20 }),
	poste: varchar("poste", { length: 100 }).notNull(),
	type: varchar("type", { length: 20 }).notNull(),
	salaireBase: integer("salaire_base").notNull(),
	dateEmbauche: date("date_embauche").notNull(),
	statut: varchar("statut", { length: 10 }).notNull().default("actif"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const bulletinsPaie = pgTable(
	"bulletins_paie",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		employeId: uuid("employe_id")
			.notNull()
			.references(() => employes.id),
		mois: integer("mois").notNull(),
		annee: integer("annee").notNull(),
		salaireBase: integer("salaire_base").notNull(),
		primes: integer("primes").notNull().default(0),
		retenues: integer("retenues").notNull().default(0),
		netAPayer: integer("net_a_payer").notNull(),
		datePaiement: date("date_paiement"),
		paye: boolean("paye").notNull().default(false),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [uniqueIndex("bulletins_paie_unique_idx").on(t.employeId, t.mois, t.annee)],
);

// Relations
export const employesRelations = relations(employes, ({ many }) => ({
	bulletins: many(bulletinsPaie),
}));

export const bulletinsPaieRelations = relations(bulletinsPaie, ({ one }) => ({
	employe: one(employes, { fields: [bulletinsPaie.employeId], references: [employes.id] }),
}));
