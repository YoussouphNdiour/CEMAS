import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	date,
	index,
	integer,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const anneesScolaires = pgTable("annees_scolaires", {
	id: uuid("id").defaultRandom().primaryKey(),
	libelle: varchar("libelle", { length: 20 }).notNull(),
	dateDebut: date("date_debut").notNull(),
	dateFin: date("date_fin").notNull(),
	active: boolean("active").notNull().default(false),
	archived: boolean("archived").notNull().default(false),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const niveaux = pgTable("niveaux", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 50 }).notNull(),
	ordre: integer("ordre").notNull(),
});

export const classes = pgTable(
	"classes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		nom: varchar("nom", { length: 100 }).notNull(),
		niveauId: uuid("niveau_id")
			.notNull()
			.references(() => niveaux.id),
		capacite: integer("capacite").notNull().default(30),
		classeSuivanteId: uuid("classe_suivante_id").references((): AnyPgColumn => classes.id, {
			onDelete: "set null",
		}),
		finDeCycle: boolean("fin_de_cycle").notNull().default(false),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		index("classes_annee_idx").on(t.anneeScolaireId),
		index("classes_niveau_idx").on(t.niveauId),
	],
);

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
