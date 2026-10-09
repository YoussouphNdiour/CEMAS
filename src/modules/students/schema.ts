import { relations } from "drizzle-orm";
import {
	boolean,
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
import { anneesScolaires, classes } from "@/modules/academic/schema";

export const eleves = pgTable(
	"eleves",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		matricule: varchar("matricule", { length: 20 }).unique().notNull(),
		prenom: varchar("prenom", { length: 100 }).notNull(),
		nom: varchar("nom", { length: 100 }).notNull(),
		dateNaissance: date("date_naissance").notNull(),
		lieuNaissance: varchar("lieu_naissance", { length: 200 }),
		sexe: varchar("sexe", { length: 1 }).notNull(),
		adresse: text("adresse"),
		photoUrl: text("photo_url"),
		classeId: uuid("classe_id")
			.notNull()
			.references(() => classes.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id),
		statut: varchar("statut", { length: 20 }).notNull().default("actif"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		index("eleves_annee_classe_idx").on(t.anneeScolaireId, t.classeId),
		index("eleves_annee_idx").on(t.anneeScolaireId),
	],
);

export const parents = pgTable("parents", {
	id: uuid("id").defaultRandom().primaryKey(),
	prenom: varchar("prenom", { length: 100 }).notNull(),
	nom: varchar("nom", { length: 100 }).notNull(),
	telephone: varchar("telephone", { length: 20 }).notNull(),
	telephone2: varchar("telephone_2", { length: 20 }),
	profession: varchar("profession", { length: 100 }),
	adresse: text("adresse"),
	relation: varchar("relation", { length: 10 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const eleveParents = pgTable(
	"eleve_parents",
	{
		eleveId: uuid("eleve_id")
			.notNull()
			.references(() => eleves.id, { onDelete: "cascade" }),
		parentId: uuid("parent_id")
			.notNull()
			.references(() => parents.id, { onDelete: "cascade" }),
		/** Contact principal (reçus, relances). Le 2e contact a principal = false. */
		principal: boolean("principal").notNull().default(true),
	},
	(t) => [primaryKey({ columns: [t.eleveId, t.parentId] })],
);

export const inscriptions = pgTable(
	"inscriptions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eleveId: uuid("eleve_id")
			.notNull()
			.references(() => eleves.id),
		classeId: uuid("classe_id")
			.notNull()
			.references(() => classes.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id),
		dateInscription: date("date_inscription").notNull().defaultNow(),
		montantInscription: integer("montant_inscription").notNull().default(0),
		statut: varchar("statut", { length: 20 }).notNull().default("en_attente"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [
		uniqueIndex("inscriptions_eleve_annee_idx").on(t.eleveId, t.anneeScolaireId),
		index("inscriptions_annee_idx").on(t.anneeScolaireId),
	],
);

// Relations
export const elevesRelations = relations(eleves, ({ one, many }) => ({
	classe: one(classes, { fields: [eleves.classeId], references: [classes.id] }),
	anneeScolaire: one(anneesScolaires, {
		fields: [eleves.anneeScolaireId],
		references: [anneesScolaires.id],
	}),
	eleveParents: many(eleveParents),
	inscriptions: many(inscriptions),
}));

export const parentsRelations = relations(parents, ({ many }) => ({
	eleveParents: many(eleveParents),
}));

export const eleveParentsRelations = relations(eleveParents, ({ one }) => ({
	eleve: one(eleves, { fields: [eleveParents.eleveId], references: [eleves.id] }),
	parent: one(parents, { fields: [eleveParents.parentId], references: [parents.id] }),
}));
