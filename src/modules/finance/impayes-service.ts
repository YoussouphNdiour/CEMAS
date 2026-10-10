import { and, eq, inArray } from "drizzle-orm";
import { anneesScolaires, classes } from "@/modules/academic/schema";
import { eleveParents, eleves, parents } from "@/modules/students/schema";
import type { db } from "@/shared/lib/db";
import { calculerImpayes, type ResultatImpayes } from "./impayes";
import type { Reduction } from "./reductions";
import {
	echeancier,
	forfaitLignes,
	grilleFrais,
	paiements,
	reductions,
	typesFrais,
} from "./schema";

const VIDE: ResultatImpayes = {
	lignes: [],
	totalDu: 0,
	totalPaye: 0,
	totalReste: 0,
	classesMontantDefaut: [],
};

/** Impayés de l'année scolaire (élèves actifs des classes de l'année, frais obligatoires). */
export async function getImpayes(
	database: typeof db,
	anneeScolaireId: string,
	filtres: { classeId?: string; niveauId?: string } = {},
	aujourdhui: string = new Date().toISOString().slice(0, 10),
): Promise<ResultatImpayes> {
	const [annee] = await database
		.select({ dateDebut: anneesScolaires.dateDebut, dateFin: anneesScolaires.dateFin })
		.from(anneesScolaires)
		.where(eq(anneesScolaires.id, anneeScolaireId));
	if (!annee) return VIDE;

	const conditions = [eq(classes.anneeScolaireId, anneeScolaireId), eq(eleves.statut, "actif")];
	if (filtres.classeId) conditions.push(eq(eleves.classeId, filtres.classeId));
	if (filtres.niveauId) conditions.push(eq(classes.niveauId, filtres.niveauId));

	const elevesRows = await database
		.select({
			id: eleves.id,
			matricule: eleves.matricule,
			prenom: eleves.prenom,
			nom: eleves.nom,
			classeId: classes.id,
			classeNom: classes.nom,
			niveauId: classes.niveauId,
			telephone: parents.telephone,
			parentPrenom: parents.prenom,
			parentNomFamille: parents.nom,
		})
		.from(eleves)
		.innerJoin(classes, eq(eleves.classeId, classes.id))
		.leftJoin(
			eleveParents,
			and(eq(eleveParents.eleveId, eleves.id), eq(eleveParents.principal, true)),
		)
		.leftJoin(parents, eq(eleveParents.parentId, parents.id))
		.where(and(...conditions));
	if (elevesRows.length === 0) return VIDE;

	const frais = await database
		.select({
			id: typesFrais.id,
			nom: typesFrais.nom,
			montantDefaut: typesFrais.montantDefaut,
			mensuel: typesFrais.mensuel,
		})
		.from(typesFrais)
		.where(eq(typesFrais.obligatoire, true))
		.orderBy(typesFrais.mensuel, typesFrais.nom);
	if (frais.length === 0) return VIDE;

	// Forfaits d'inscription et échéanciers par niveau
	const lignesForfait = await database
		.select({
			niveauId: forfaitLignes.niveauId,
			montant: forfaitLignes.montant,
			typeFraisId: forfaitLignes.typeFraisId,
		})
		.from(forfaitLignes)
		.where(eq(forfaitLignes.anneeScolaireId, anneeScolaireId));
	const forfaits = [...new Set(lignesForfait.map((l) => l.niveauId))].map((niveauId) => {
		const ls = lignesForfait.filter((l) => l.niveauId === niveauId);
		return {
			niveauId,
			total: ls.reduce((t, l) => t + l.montant, 0),
			typesAssocies: [...new Set(ls.flatMap((l) => (l.typeFraisId ? [l.typeFraisId] : [])))],
		};
	});
	const echeanciers = await database
		.select({ niveauId: echeancier.niveauId, mois: echeancier.mois, montant: echeancier.montant })
		.from(echeancier)
		.where(eq(echeancier.anneeScolaireId, anneeScolaireId));

	// Paiements utiles : frais obligatoires + types associés aux forfaits (ex. fournitures)
	const fraisIds = [
		...new Set([...frais.map((f) => f.id), ...forfaits.flatMap((f) => f.typesAssocies)]),
	];

	const grille = await database
		.select({
			classeId: grilleFrais.classeId,
			typeFraisId: grilleFrais.typeFraisId,
			montant: grilleFrais.montantMensuel,
		})
		.from(grilleFrais)
		.where(eq(grilleFrais.anneeScolaireId, anneeScolaireId));

	const paiementsRows = await database
		.select({
			eleveId: paiements.eleveId,
			typeFraisId: paiements.typeFraisId,
			mois: paiements.mois,
			montant: paiements.montant,
		})
		.from(paiements)
		.where(
			and(eq(paiements.anneeScolaireId, anneeScolaireId), inArray(paiements.typeFraisId, fraisIds)),
		);

	return calculerImpayes({
		dateDebut: annee.dateDebut,
		dateFin: annee.dateFin,
		aujourdhui,
		eleves: elevesRows.map(({ parentPrenom, parentNomFamille, ...e }) => ({
			...e,
			parentNom: parentPrenom ? `${parentPrenom} ${parentNomFamille}` : null,
		})),
		frais,
		grille,
		paiements: paiementsRows,
		forfaits,
		echeanciers,
		reductions: (
			await database
				.select({
					eleveId: reductions.eleveId,
					type: reductions.type,
					portee: reductions.portee,
					mode: reductions.mode,
					valeur: reductions.valeur,
				})
				.from(reductions)
				.where(eq(reductions.anneeScolaireId, anneeScolaireId))
		).map((r) => r as Reduction & { eleveId: string }),
	});
}
