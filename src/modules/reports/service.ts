import { and, between, eq, sql } from "drizzle-orm";
import { anneesScolaires, classes, niveaux } from "@/modules/academic/schema";
import {
	categoriesDepenses,
	categoriesRecettes,
	depenses,
	paiements,
	recettes,
	typesFrais,
} from "@/modules/finance/schema";
import { bulletinsPaie, employes } from "@/modules/payroll/schema";
import { eleves } from "@/modules/students/schema";
import { affectationsTransport, itineraires, vehicules } from "@/modules/transport/schema";
import type { db } from "@/shared/lib/db";
import { MOIS_LABELS } from "@/shared/lib/utils";
import type { Operation } from "./comptabilite";

/** Type de frais présenté à part des encaissements élèves dans le rapport. */
export const TYPE_FOURNITURE = "Fourniture";

type Db = typeof db;
const iso = (d: Date | null) => (d ? d.toISOString() : "");

/**
 * Opérations d'une période : par date entre `du` et `au` (inclus), ou, pour une année scolaire,
 * rattachées à l'année comme dans le bilan (paiements, recettes, dépenses par année ; salaires
 * dont le mois du bulletin tombe dans l'année) pour que les deux rapports concordent.
 */
export async function operationsPeriode(
	database: Db,
	du: string,
	au: string,
	anneeScolaireId?: string,
): Promise<Operation[]> {
	const pays = await database
		.select({
			date: paiements.datePaiement,
			createdAt: paiements.createdAt,
			numeroRecu: paiements.numeroRecu,
			montant: paiements.montant,
			mois: paiements.mois,
			type: typesFrais.nom,
			mensuel: typesFrais.mensuel,
			prenom: eleves.prenom,
			nom: eleves.nom,
		})
		.from(paiements)
		.innerJoin(eleves, eq(paiements.eleveId, eleves.id))
		.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
		.where(
			anneeScolaireId
				? eq(paiements.anneeScolaireId, anneeScolaireId)
				: between(paiements.datePaiement, du, au),
		);

	const recs = await database
		.select({
			date: recettes.date,
			createdAt: recettes.createdAt,
			libelle: recettes.libelle,
			montant: recettes.montant,
			categorie: categoriesRecettes.nom,
		})
		.from(recettes)
		.innerJoin(categoriesRecettes, eq(recettes.categorieId, categoriesRecettes.id))
		.where(
			anneeScolaireId
				? eq(recettes.anneeScolaireId, anneeScolaireId)
				: between(recettes.date, du, au),
		);

	const deps = await database
		.select({
			date: depenses.date,
			createdAt: depenses.createdAt,
			libelle: depenses.libelle,
			montant: depenses.montant,
			categorie: categoriesDepenses.nom,
		})
		.from(depenses)
		.innerJoin(categoriesDepenses, eq(depenses.categorieId, categoriesDepenses.id))
		.where(
			anneeScolaireId
				? eq(depenses.anneeScolaireId, anneeScolaireId)
				: between(depenses.date, du, au),
		);

	// Salaires payés : date de paiement, sinon 1er jour du mois du bulletin (comme le bilan)
	const dateSalaire = sql<string>`COALESCE(${bulletinsPaie.datePaiement}, make_date(${bulletinsPaie.annee}, ${bulletinsPaie.mois}, 1))::text`;
	const sals = await database
		.select({
			date: dateSalaire,
			createdAt: bulletinsPaie.createdAt,
			montant: bulletinsPaie.netAPayer,
			mois: bulletinsPaie.mois,
			annee: bulletinsPaie.annee,
			matricule: employes.matricule,
			prenom: employes.prenom,
			nom: employes.nom,
		})
		.from(bulletinsPaie)
		.innerJoin(employes, eq(bulletinsPaie.employeId, employes.id))
		.where(
			and(
				eq(bulletinsPaie.paye, true),
				anneeScolaireId
					? sql`make_date(${bulletinsPaie.annee}, ${bulletinsPaie.mois}, 1) BETWEEN date_trunc('month', ${du}::date) AND ${au}::date`
					: sql`${dateSalaire}::date BETWEEN ${du}::date AND ${au}::date`,
			),
		);

	return [
		...pays.map(
			(p): Operation => ({
				date: p.date,
				ordre: iso(p.createdAt),
				nature: p.type === TYPE_FOURNITURE ? "fourniture" : "paiement",
				reference: p.numeroRecu,
				libelle: `${p.prenom} ${p.nom} — ${p.type}${p.mensuel ? ` ${MOIS_LABELS[p.mois].toLowerCase()}` : ""}`,
				rubrique: p.type,
				montant: p.montant,
			}),
		),
		...recs.map(
			(r): Operation => ({
				date: r.date,
				ordre: iso(r.createdAt),
				nature: "recette",
				reference: r.categorie,
				libelle: r.libelle,
				rubrique: r.categorie,
				montant: r.montant,
			}),
		),
		...deps.map(
			(d): Operation => ({
				date: d.date,
				ordre: iso(d.createdAt),
				nature: "depense",
				reference: d.categorie,
				libelle: d.libelle,
				rubrique: d.categorie,
				montant: d.montant,
			}),
		),
		...sals.map(
			(s): Operation => ({
				date: s.date,
				ordre: iso(s.createdAt),
				nature: "salaire",
				reference: s.matricule,
				libelle: `${s.prenom} ${s.nom} — salaire ${MOIS_LABELS[s.mois].toLowerCase()} ${s.annee}`,
				rubrique: "Salaires",
				montant: s.montant,
			}),
		),
	];
}

/** Effectifs actifs par classe de l'année (garçons, filles, capacité), triés par niveau puis classe. */
export async function effectifsAnnee(database: Db, anneeScolaireId: string) {
	return database
		.select({
			niveauId: niveaux.id,
			niveau: niveaux.nom,
			classe: classes.nom,
			capacite: classes.capacite,
			garcons: sql<number>`COUNT(${eleves.id}) FILTER (WHERE ${eleves.sexe} = 'M' AND ${eleves.statut} = 'actif')::int`,
			filles: sql<number>`COUNT(${eleves.id}) FILTER (WHERE ${eleves.sexe} = 'F' AND ${eleves.statut} = 'actif')::int`,
			total: sql<number>`COUNT(${eleves.id}) FILTER (WHERE ${eleves.statut} = 'actif')::int`,
		})
		.from(classes)
		.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
		.leftJoin(eleves, eq(eleves.classeId, classes.id))
		.where(eq(classes.anneeScolaireId, anneeScolaireId))
		.groupBy(niveaux.id, niveaux.nom, niveaux.ordre, classes.id, classes.nom, classes.capacite)
		.orderBy(niveaux.ordre, classes.nom);
}

export async function personnelEtTransport(database: Db, anneeScolaireId: string) {
	const parType = await database
		.select({
			type: employes.type,
			nombre: sql<number>`COUNT(*)::int`,
			masse: sql<number>`COALESCE(SUM(${employes.salaireBase}), 0)::int`,
		})
		.from(employes)
		.where(eq(employes.statut, "actif"))
		.groupBy(employes.type)
		.orderBy(employes.type);
	const lesVehicules = await database
		.select({ immatriculation: vehicules.immatriculation, capacite: vehicules.capacite })
		.from(vehicules)
		.orderBy(vehicules.immatriculation);
	const [{ nombre: nbItineraires }] = await database
		.select({ nombre: sql<number>`COUNT(*)::int` })
		.from(itineraires);
	const [{ nombre: nbEleves }] = await database
		.select({ nombre: sql<number>`COUNT(DISTINCT ${affectationsTransport.eleveId})::int` })
		.from(affectationsTransport)
		.where(eq(affectationsTransport.anneeScolaireId, anneeScolaireId));
	return {
		personnel: {
			parType: parType.map(({ type, nombre }) => ({ type, nombre })),
			masseMensuelle: parType.reduce((t, p) => t + p.masse, 0),
		},
		transport: { vehicules: lesVehicules, itineraires: nbItineraires, eleves: nbEleves },
	};
}

export async function anneeScolaire(database: Db, id: string) {
	const [annee] = await database
		.select({
			libelle: anneesScolaires.libelle,
			dateDebut: anneesScolaires.dateDebut,
			dateFin: anneesScolaires.dateFin,
		})
		.from(anneesScolaires)
		.where(eq(anneesScolaires.id, id));
	return annee ?? null;
}
