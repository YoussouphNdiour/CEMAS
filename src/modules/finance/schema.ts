import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { anneesScolaires, classes, niveaux } from "@/modules/academic/schema";
import { eleves } from "@/modules/students/schema";

export const typesFrais = pgTable("types_frais", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
	montantDefaut: integer("montant_defaut").notNull().default(0),
	obligatoire: boolean("obligatoire").notNull().default(true),
	mensuel: boolean("mensuel").notNull().default(true),
});

export const grilleFrais = pgTable(
	"grille_frais",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		classeId: uuid("classe_id")
			.notNull()
			.references(() => classes.id),
		typeFraisId: uuid("type_frais_id")
			.notNull()
			.references(() => typesFrais.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id),
		montantMensuel: integer("montant_mensuel").notNull(),
	},
	(t) => [
		uniqueIndex("grille_frais_unique_idx").on(t.classeId, t.typeFraisId, t.anneeScolaireId),
		index("grille_frais_annee_idx").on(t.anneeScolaireId),
	],
);

export const paiements = pgTable(
	"paiements",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eleveId: uuid("eleve_id")
			.notNull()
			.references(() => eleves.id),
		typeFraisId: uuid("type_frais_id")
			.notNull()
			.references(() => typesFrais.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id),
		mois: integer("mois").notNull(),
		montant: integer("montant").notNull(),
		datePaiement: date("date_paiement").notNull().defaultNow(),
		numeroRecu: varchar("numero_recu", { length: 20 }).unique().notNull(),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		uniqueIndex("paiements_unique_idx").on(t.eleveId, t.typeFraisId, t.anneeScolaireId, t.mois),
		index("paiements_annee_mois_idx").on(t.anneeScolaireId, t.mois),
		index("paiements_eleve_annee_idx").on(t.eleveId, t.anneeScolaireId),
	],
);

export const categoriesDepenses = pgTable("categories_depenses", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
});

export const depenses = pgTable(
	"depenses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		categorieId: uuid("categorie_id")
			.notNull()
			.references(() => categoriesDepenses.id),
		anneeScolaireId: uuid("annee_scolaire_id").references(() => anneesScolaires.id),
		libelle: varchar("libelle", { length: 200 }).notNull(),
		montant: integer("montant").notNull(),
		date: date("date").notNull().defaultNow(),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [index("depenses_annee_idx").on(t.anneeScolaireId), index("depenses_date_idx").on(t.date)],
);

export const categoriesRecettes = pgTable("categories_recettes", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
});

export const recettes = pgTable(
	"recettes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		categorieId: uuid("categorie_id")
			.notNull()
			.references(() => categoriesRecettes.id),
		anneeScolaireId: uuid("annee_scolaire_id").references(() => anneesScolaires.id),
		libelle: varchar("libelle", { length: 200 }).notNull(),
		montant: integer("montant").notNull(),
		date: date("date").notNull().defaultNow(),
		note: text("note"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [index("recettes_annee_idx").on(t.anneeScolaireId), index("recettes_date_idx").on(t.date)],
);

// Relations
export const paiementsRelations = relations(paiements, ({ one }) => ({
	eleve: one(eleves, { fields: [paiements.eleveId], references: [eleves.id] }),
	typeFrais: one(typesFrais, { fields: [paiements.typeFraisId], references: [typesFrais.id] }),
	anneeScolaire: one(anneesScolaires, {
		fields: [paiements.anneeScolaireId],
		references: [anneesScolaires.id],
	}),
}));

export const depensesRelations = relations(depenses, ({ one }) => ({
	categorie: one(categoriesDepenses, {
		fields: [depenses.categorieId],
		references: [categoriesDepenses.id],
	}),
	anneeScolaire: one(anneesScolaires, {
		fields: [depenses.anneeScolaireId],
		references: [anneesScolaires.id],
	}),
}));

export const recettesRelations = relations(recettes, ({ one }) => ({
	categorie: one(categoriesRecettes, {
		fields: [recettes.categorieId],
		references: [categoriesRecettes.id],
	}),
	anneeScolaire: one(anneesScolaires, {
		fields: [recettes.anneeScolaireId],
		references: [anneesScolaires.id],
	}),
}));

export const forfaitLignes = pgTable(
	"forfait_lignes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		niveauId: uuid("niveau_id")
			.notNull()
			.references(() => niveaux.id, { onDelete: "cascade" }),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id, { onDelete: "cascade" }),
		libelle: varchar("libelle", { length: 60 }).notNull(),
		montant: integer("montant").notNull(),
		ordre: integer("ordre").notNull(),
		typeFraisId: uuid("type_frais_id").references(() => typesFrais.id),
	},
	(t) => [index("forfait_lignes_niveau_annee_idx").on(t.niveauId, t.anneeScolaireId)],
);

export const echeancier = pgTable(
	"echeancier",
	{
		niveauId: uuid("niveau_id")
			.notNull()
			.references(() => niveaux.id, { onDelete: "cascade" }),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id, { onDelete: "cascade" }),
		mois: integer("mois").notNull(),
		montant: integer("montant").notNull(),
	},
	(t) => [primaryKey({ columns: [t.niveauId, t.anneeScolaireId, t.mois] })],
);

/** Réduction accordée à un élève pour une année (une au plus). */
export const reductions = pgTable(
	"reductions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eleveId: uuid("eleve_id")
			.notNull()
			.references(() => eleves.id, { onDelete: "cascade" }),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id, { onDelete: "cascade" }),
		type: varchar("type", { length: 20 }).notNull(),
		portee: varchar("portee", { length: 12 }).notNull(),
		mode: varchar("mode", { length: 12 }).notNull(),
		valeur: integer("valeur").notNull(),
		motif: varchar("motif", { length: 200 }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		uniqueIndex("reductions_eleve_annee_idx").on(t.eleveId, t.anneeScolaireId),
		check(
			"reductions_type_check",
			sql`${t.type} in ('fratrie', 'personnel', 'negociee', 'bourse')`,
		),
		check("reductions_portee_check", sql`${t.portee} in ('forfait', 'mensualites', 'les_deux')`),
		check("reductions_mode_check", sql`${t.mode} in ('montant', 'pourcentage')`),
		check(
			"reductions_valeur_check",
			sql`${t.valeur} >= 1 and (${t.mode} <> 'pourcentage' or ${t.valeur} <= 100)`,
		),
	],
);
