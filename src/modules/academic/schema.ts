import { pgTable, uuid, varchar, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const anneesScolaires = pgTable("annees_scolaires", {
	id: uuid("id").defaultRandom().primaryKey(),
	libelle: varchar("libelle", { length: 20 }).notNull(),
	dateDebut: date("date_debut").notNull(),
	dateFin: date("date_fin").notNull(),
	active: boolean("active").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const niveaux = pgTable("niveaux", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 50 }).notNull(),
	ordre: integer("ordre").notNull(),
});

export const classes = pgTable("classes", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
	niveauId: uuid("niveau_id")
		.notNull()
		.references(() => niveaux.id),
	capacite: integer("capacite").notNull().default(30),
	anneeScolaireId: uuid("annee_scolaire_id")
		.notNull()
		.references(() => anneesScolaires.id),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const matieres = pgTable("matieres", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
	coefficient: integer("coefficient").notNull().default(1),
	niveauId: uuid("niveau_id")
		.notNull()
		.references(() => niveaux.id),
});

// Relations
export const niveauxRelations = relations(niveaux, ({ many }) => ({
	classes: many(classes),
	matieres: many(matieres),
}));

export const classesRelations = relations(classes, ({ one }) => ({
	niveau: one(niveaux, { fields: [classes.niveauId], references: [niveaux.id] }),
	anneeScolaire: one(anneesScolaires, {
		fields: [classes.anneeScolaireId],
		references: [anneesScolaires.id],
	}),
}));

export const matieresRelations = relations(matieres, ({ one }) => ({
	niveau: one(niveaux, { fields: [matieres.niveauId], references: [niveaux.id] }),
}));
