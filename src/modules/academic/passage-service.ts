import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { grilleFrais } from "@/modules/finance/schema";
import { eleves, inscriptions } from "@/modules/students/schema";
import type { db } from "@/shared/lib/db";
import { type Decision, planifierPassage } from "./passage";
import { anneesScolaires, classes, niveaux } from "./schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const plusUnAn = (date: string) => {
	const [a, m, j] = date.split("-");
	return `${Number(a) + 1}-${m}-${j}`;
};

async function anneeActive(database: Db | Tx, verrouiller = false) {
	const requete = database.select().from(anneesScolaires).where(eq(anneesScolaires.active, true));
	// Dans la transaction du passage : verrou sur l'année active, un second passage simultané
	// attend puis ne trouve plus d'année active (elle a été archivée) et échoue proprement.
	const [source] = verrouiller ? await requete.for("update") : await requete;
	if (!source)
		throw new TRPCError({ code: "BAD_REQUEST", message: "Aucune année scolaire active." });
	return source;
}

async function chargerDonnees(database: Db | Tx, sourceId: string) {
	const classesS = await database
		.select({
			id: classes.id,
			nom: classes.nom,
			niveauId: classes.niveauId,
			capacite: classes.capacite,
			classeSuivanteId: classes.classeSuivanteId,
			finDeCycle: classes.finDeCycle,
			niveauNom: niveaux.nom,
			niveauOrdre: niveaux.ordre,
		})
		.from(classes)
		.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
		.where(eq(classes.anneeScolaireId, sourceId));
	classesS.sort(
		(x, y) => x.niveauOrdre - y.niveauOrdre || x.nom.localeCompare(y.nom, "fr", { numeric: true }),
	);
	const elevesS = await database
		.select({
			id: eleves.id,
			prenom: eleves.prenom,
			nom: eleves.nom,
			matricule: eleves.matricule,
			classeId: eleves.classeId,
		})
		.from(eleves)
		.innerJoin(classes, eq(eleves.classeId, classes.id))
		.where(and(eq(classes.anneeScolaireId, sourceId), eq(eleves.statut, "actif")))
		.orderBy(eleves.nom, eleves.prenom);
	return { classesS, elevesS };
}

export async function chargerContexte(database: Db) {
	const source = await anneeActive(database);
	const { classesS, elevesS } = await chargerDonnees(database, source.id);
	const m = source.libelle.match(/^(\d{4})\D+(\d{4})$/);
	const libelle = m
		? `${Number(m[1]) + 1}-${Number(m[2]) + 1}`
		: `${Number(source.dateDebut.slice(0, 4)) + 1}-${Number(source.dateFin.slice(0, 4)) + 1}`;
	return {
		source: {
			id: source.id,
			libelle: source.libelle,
			dateDebut: source.dateDebut,
			dateFin: source.dateFin,
		},
		proposition: {
			libelle,
			dateDebut: plusUnAn(source.dateDebut),
			dateFin: plusUnAn(source.dateFin),
		},
		classes: classesS,
		eleves: elevesS,
	};
}

/** Vérifie et enregistre la configuration des classes de l'année active. */
export async function configurerClasses(
	database: Db,
	items: { id: string; classeSuivanteId: string | null; finDeCycle: boolean }[],
) {
	return database.transaction(async (tx) => {
		const source = await anneeActive(tx);
		const ids = new Set(
			(
				await tx
					.select({ id: classes.id })
					.from(classes)
					.where(eq(classes.anneeScolaireId, source.id))
			).map((c) => c.id),
		);
		for (const it of items) {
			if (!ids.has(it.id))
				throw new TRPCError({ code: "BAD_REQUEST", message: "Classe hors de l'année active." });
			if (
				!it.finDeCycle &&
				it.classeSuivanteId &&
				(it.classeSuivanteId === it.id || !ids.has(it.classeSuivanteId))
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "La classe suivante doit être une autre classe de la même année.",
				});
			}
			await tx
				.update(classes)
				.set({
					finDeCycle: it.finDeCycle,
					classeSuivanteId: it.finDeCycle ? null : it.classeSuivanteId,
				})
				.where(eq(classes.id, it.id));
		}
		return { count: items.length };
	});
}

export async function previsualiserPassage(database: Db, decisions: Record<string, Decision>) {
	const source = await anneeActive(database);
	const { classesS, elevesS } = await chargerDonnees(database, source.id);
	return planifierPassage({ classes: classesS, eleves: elevesS, decisions });
}

export async function executerPassage(
	database: Db,
	input: {
		cible: { libelle: string; dateDebut: string; dateFin: string };
		decisions: Record<string, Decision>;
	},
) {
	return database.transaction(async (tx) => {
		const source = await anneeActive(tx, true);
		const { classesS, elevesS } = await chargerDonnees(tx, source.id);
		const plan = planifierPassage({
			classes: classesS,
			eleves: elevesS,
			decisions: input.decisions,
		});
		if (plan.erreurs.length)
			throw new TRPCError({ code: "BAD_REQUEST", message: plan.erreurs.join(" ; ") });

		// 1. Année cible (réutilisée si même libellé non archivée)
		const homonymes = await tx
			.select()
			.from(anneesScolaires)
			.where(eq(anneesScolaires.libelle, input.cible.libelle));
		if (homonymes.some((a) => a.archived)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `L'année ${input.cible.libelle} existe déjà et est archivée : choisissez un autre libellé.`,
			});
		}
		if (homonymes.length > 1) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `Plusieurs années s'appellent ${input.cible.libelle} : supprimez les doublons avant le passage.`,
			});
		}
		let [cible] = homonymes;
		if (cible?.id === source.id) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "L'année cible doit être différente de l'année active.",
			});
		}
		if (cible) {
			[cible] = await tx
				.update(anneesScolaires)
				.set({
					dateDebut: input.cible.dateDebut,
					dateFin: input.cible.dateFin,
					updatedAt: new Date(),
				})
				.where(eq(anneesScolaires.id, cible.id))
				.returning();
		} else {
			[cible] = await tx.insert(anneesScolaires).values(input.cible).returning();
		}

		// 2. Classes (réutilisées par nom)
		const classesCible = await tx
			.select({ id: classes.id, nom: classes.nom })
			.from(classes)
			.where(eq(classes.anneeScolaireId, cible.id));
		const existantes = new Map(classesCible.map((c) => [c.nom, c.id]));
		if (existantes.size !== classesCible.length) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: `L'année ${cible.libelle} contient des classes de même nom : renommez-les avant le passage.`,
			});
		}
		const copie = new Map<string, string>();
		let classesCreees = 0;
		for (const c of classesS) {
			let id = existantes.get(c.nom);
			if (!id) {
				const [nouvelle] = await tx
					.insert(classes)
					.values({
						nom: c.nom,
						niveauId: c.niveauId,
						capacite: c.capacite,
						anneeScolaireId: cible.id,
					})
					.returning({ id: classes.id });
				id = nouvelle.id;
				classesCreees++;
			}
			copie.set(c.id, id);
		}
		for (const c of classesS) {
			await tx
				.update(classes)
				.set({
					finDeCycle: c.finDeCycle,
					classeSuivanteId:
						c.finDeCycle || !c.classeSuivanteId ? null : (copie.get(c.classeSuivanteId) ?? null),
				})
				.where(eq(classes.id, copie.get(c.id) as string));
		}

		// 3. Grille (sans écraser une valeur déjà saisie dans la cible)
		const grille = await tx
			.select()
			.from(grilleFrais)
			.where(eq(grilleFrais.anneeScolaireId, source.id));
		let grilleCopiee = 0;
		for (const g of grille) {
			const inseres = await tx
				.insert(grilleFrais)
				.values({
					classeId: copie.get(g.classeId) as string,
					typeFraisId: g.typeFraisId,
					anneeScolaireId: cible.id,
					montantMensuel: g.montantMensuel,
				})
				.onConflictDoNothing()
				.returning({ id: grilleFrais.id });
			grilleCopiee += inseres.length;
		}

		// 4. Élèves
		const sortants = plan.mouvements
			.filter((m) => m.classeDestinationSourceId === null)
			.map((m) => m.eleveId);
		if (sortants.length) {
			await tx
				.update(eleves)
				.set({ statut: "inactif", updatedAt: new Date() })
				.where(inArray(eleves.id, sortants));
		}
		for (const m of plan.mouvements) {
			if (!m.classeDestinationSourceId) continue;
			const destination = copie.get(m.classeDestinationSourceId) as string;
			await tx
				.update(eleves)
				.set({ classeId: destination, anneeScolaireId: cible.id, updatedAt: new Date() })
				.where(eq(eleves.id, m.eleveId));
			await tx
				.insert(inscriptions)
				.values({
					eleveId: m.eleveId,
					classeId: destination,
					anneeScolaireId: cible.id,
					statut: "confirmee",
					montantInscription: 0,
				})
				.onConflictDoUpdate({
					target: [inscriptions.eleveId, inscriptions.anneeScolaireId],
					set: { classeId: destination, statut: "confirmee" },
				});
		}

		// 5. Activer la cible, archiver la source
		await tx.update(anneesScolaires).set({ active: false });
		await tx.update(anneesScolaires).set({ active: true }).where(eq(anneesScolaires.id, cible.id));
		await tx
			.update(anneesScolaires)
			.set({ archived: true, updatedAt: new Date() })
			.where(eq(anneesScolaires.id, source.id));

		const n = (r: string) => plan.mouvements.filter((m) => m.resultat === r).length;
		return {
			anneeId: cible.id,
			promus: n("promu"),
			redoublants: n("redouble"),
			sortants: n("sortant"),
			departs: n("depart"),
			classesCreees,
			grilleCopiee,
		};
	});
}
