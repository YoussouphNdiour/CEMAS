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
import { classes, anneesScolaires } from "@/modules/academic/schema";
import { eleves } from "@/modules/students/schema";

export const typesFrais = pgTable("types_frais", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
	montantDefaut: integer("montant_defaut").notNull().default(0),
	obligatoire: boolean("obligatoire").notNull().default(true),
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
	(t) => [uniqueIndex("grille_frais_unique_idx").on(t.classeId, t.typeFraisId, t.anneeScolaireId)],
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
		uniqueIndex("paiements_unique_idx").on(
			t.eleveId,
			t.typeFraisId,
			t.anneeScolaireId,
			t.mois,
		),
	],
);

export const categoriesDepenses = pgTable("categories_depenses", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
});

export const depenses = pgTable("depenses", {
	id: uuid("id").defaultRandom().primaryKey(),
	categorieId: uuid("categorie_id")
		.notNull()
		.references(() => categoriesDepenses.id),
	libelle: varchar("libelle", { length: 200 }).notNull(),
	montant: integer("montant").notNull(),
	date: date("date").notNull().defaultNow(),
	note: text("note"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const categoriesRecettes = pgTable("categories_recettes", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
});

export const recettes = pgTable("recettes", {
	id: uuid("id").defaultRandom().primaryKey(),
	categorieId: uuid("categorie_id")
		.notNull()
		.references(() => categoriesRecettes.id),
	libelle: varchar("libelle", { length: 200 }).notNull(),
	montant: integer("montant").notNull(),
	date: date("date").notNull().defaultNow(),
	note: text("note"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

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
}));

export const recettesRelations = relations(recettes, ({ one }) => ({
	categorie: one(categoriesRecettes, {
		fields: [recettes.categorieId],
		references: [categoriesRecettes.id],
	}),
}));
