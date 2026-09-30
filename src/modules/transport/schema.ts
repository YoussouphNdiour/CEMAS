import { pgTable, uuid, varchar, text, integer, time, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { eleves } from "@/modules/students/schema";
import { anneesScolaires } from "@/modules/academic/schema";

export const vehicules = pgTable("vehicules", {
	id: uuid("id").defaultRandom().primaryKey(),
	immatriculation: varchar("immatriculation", { length: 20 }).unique().notNull(),
	marque: varchar("marque", { length: 100 }),
	capacite: integer("capacite").notNull(),
	chauffeurNom: varchar("chauffeur_nom", { length: 100 }).notNull(),
	chauffeurTel: varchar("chauffeur_tel", { length: 20 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const itineraires = pgTable("itineraires", {
	id: uuid("id").defaultRandom().primaryKey(),
	nom: varchar("nom", { length: 100 }).notNull(),
	vehiculeId: uuid("vehicule_id").references(() => vehicules.id),
	description: text("description"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const arrets = pgTable("arrets", {
	id: uuid("id").defaultRandom().primaryKey(),
	itineraireId: uuid("itineraire_id")
		.notNull()
		.references(() => itineraires.id, { onDelete: "cascade" }),
	nom: varchar("nom", { length: 100 }).notNull(),
	ordre: integer("ordre").notNull(),
	heurePassage: time("heure_passage"),
});

export const affectationsTransport = pgTable(
	"affectations_transport",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		eleveId: uuid("eleve_id")
			.notNull()
			.references(() => eleves.id),
		itineraireId: uuid("itineraire_id")
			.notNull()
			.references(() => itineraires.id),
		arretId: uuid("arret_id")
			.notNull()
			.references(() => arrets.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id),
	},
	(t) => [uniqueIndex("affectations_transport_unique_idx").on(t.eleveId, t.anneeScolaireId)],
);

// Relations
export const itinerairesRelations = relations(itineraires, ({ one, many }) => ({
	vehicule: one(vehicules, { fields: [itineraires.vehiculeId], references: [vehicules.id] }),
	arrets: many(arrets),
	affectations: many(affectationsTransport),
}));

export const arretsRelations = relations(arrets, ({ one }) => ({
	itineraire: one(itineraires, { fields: [arrets.itineraireId], references: [itineraires.id] }),
}));

export const affectationsTransportRelations = relations(affectationsTransport, ({ one }) => ({
	eleve: one(eleves, { fields: [affectationsTransport.eleveId], references: [eleves.id] }),
	itineraire: one(itineraires, {
		fields: [affectationsTransport.itineraireId],
		references: [itineraires.id],
	}),
	arret: one(arrets, { fields: [affectationsTransport.arretId], references: [arrets.id] }),
}));
