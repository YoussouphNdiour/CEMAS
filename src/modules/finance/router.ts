import { TRPCError } from "@trpc/server";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { anneesScolaires, classes, niveaux } from "@/modules/academic/schema";
import { bulletinsPaie } from "@/modules/payroll/schema";
import { getParametres } from "@/modules/settings/service";
import { eleveParents, eleves, inscriptions, parents } from "@/modules/students/schema";
import type { db } from "@/shared/lib/db";
import { nextSequence } from "@/shared/lib/sequence";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { generateRecuNumber, MOIS_LABELS } from "@/shared/lib/utils";
import { buildBilanMensuel, totauxBilan } from "./bilan";
import { associesDesLignes, estForfait, moisDus, verseSurForfait } from "./impayes";
import { getImpayes } from "./impayes-service";
import {
	LIBELLES_TYPE_REDUCTION,
	montantAnnuelReduction,
	montantReduction,
	montantReduit,
	type Reduction,
} from "./reductions";
import {
	categoriesDepenses,
	categoriesRecettes,
	depenses,
	echeancier,
	forfaitLignes,
	grilleFrais,
	paiements,
	recettes,
	reductions,
	typesFrais,
} from "./schema";
import { statutMois } from "./suivi-statut";
import {
	createDepenseSchema,
	createPaiementSchema,
	createRecetteSchema,
	enregistrerReductionSchema,
	enregistrerTarifsSchema,
	grilleFraisSchema,
	impayesFiltersSchema,
	upsertGrilleSchema,
} from "./validation";

const typesFraisRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(typesFrais).orderBy(typesFrais.nom);
	}),
});

const grilleFraisRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select({
					id: grilleFrais.id,
					classeId: grilleFrais.classeId,
					typeFraisId: grilleFrais.typeFraisId,
					anneeScolaireId: grilleFrais.anneeScolaireId,
					montantMensuel: grilleFrais.montantMensuel,
					classeNom: classes.nom,
					typeFraisNom: typesFrais.nom,
				})
				.from(grilleFrais)
				.innerJoin(classes, eq(grilleFrais.classeId, classes.id))
				.innerJoin(typesFrais, eq(grilleFrais.typeFraisId, typesFrais.id))
				.where(eq(grilleFrais.anneeScolaireId, input.anneeScolaireId))
				.orderBy(classes.nom, typesFrais.nom);
		}),

	upsertMany: protectedProcedure.input(upsertGrilleSchema).mutation(async ({ ctx, input }) => {
		await ctx.db.transaction(async (tx) => {
			for (const c of input.cellules) {
				await tx
					.insert(grilleFrais)
					.values({
						classeId: c.classeId,
						typeFraisId: c.typeFraisId,
						anneeScolaireId: input.anneeScolaireId,
						montantMensuel: c.montant,
					})
					.onConflictDoUpdate({
						target: [grilleFrais.classeId, grilleFrais.typeFraisId, grilleFrais.anneeScolaireId],
						set: { montantMensuel: c.montant },
					});
			}
		});
		return { count: input.cellules.length };
	}),

	upsert: protectedProcedure.input(grilleFraisSchema).mutation(async ({ ctx, input }) => {
		// Check if entry already exists
		const [existing] = await ctx.db
			.select()
			.from(grilleFrais)
			.where(
				and(
					eq(grilleFrais.classeId, input.classeId),
					eq(grilleFrais.typeFraisId, input.typeFraisId),
					eq(grilleFrais.anneeScolaireId, input.anneeScolaireId),
				),
			);

		if (existing) {
			const [updated] = await ctx.db
				.update(grilleFrais)
				.set({ montantMensuel: input.montantMensuel })
				.where(eq(grilleFrais.id, existing.id))
				.returning();
			return updated;
		}

		const [created] = await ctx.db
			.insert(grilleFrais)
			.values({
				classeId: input.classeId,
				typeFraisId: input.typeFraisId,
				anneeScolaireId: input.anneeScolaireId,
				montantMensuel: input.montantMensuel,
			})
			.returning();
		return created;
	}),
});

const paiementsRouter = createTRPCRouter({
	create: protectedProcedure.input(createPaiementSchema).mutation(async ({ ctx, input }) => {
		// Next receipt sequence for the configured prefix and current year
		const year = new Date().getFullYear();
		const { prefixeRecu } = await getParametres(ctx.db);
		const seq = await nextSequence(
			ctx.db,
			paiements,
			paiements.numeroRecu,
			`^${prefixeRecu}-${year}-(\\d+)$`,
		);
		const numeroRecu = generateRecuNumber(prefixeRecu, year, seq);

		const [created] = await ctx.db
			.insert(paiements)
			.values({
				eleveId: input.eleveId,
				typeFraisId: input.typeFraisId,
				anneeScolaireId: input.anneeScolaireId,
				mois: input.mois,
				montant: input.montant,
				numeroRecu,
			})
			.returning();

		return created;
	}),

	listByEleve: protectedProcedure
		.input(
			z.object({
				eleveId: z.string().uuid(),
				anneeScolaireId: z.string().uuid(),
			}),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select({
					id: paiements.id,
					eleveId: paiements.eleveId,
					typeFraisId: paiements.typeFraisId,
					anneeScolaireId: paiements.anneeScolaireId,
					mois: paiements.mois,
					montant: paiements.montant,
					datePaiement: paiements.datePaiement,
					numeroRecu: paiements.numeroRecu,
					note: paiements.note,
					typeFraisNom: typesFrais.nom,
				})
				.from(paiements)
				.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
				.where(
					and(
						eq(paiements.eleveId, input.eleveId),
						eq(paiements.anneeScolaireId, input.anneeScolaireId),
					),
				)
				.orderBy(desc(paiements.datePaiement));
		}),

	listByMonth: protectedProcedure
		.input(
			z.object({
				anneeScolaireId: z.string().uuid(),
				mois: z.number().int().min(1).max(12),
				typeFraisId: z.string().uuid().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [
				eq(paiements.anneeScolaireId, input.anneeScolaireId),
				eq(paiements.mois, input.mois),
			];
			if (input.typeFraisId) {
				conditions.push(eq(paiements.typeFraisId, input.typeFraisId));
			}
			return ctx.db
				.select({
					id: paiements.id,
					eleveId: paiements.eleveId,
					typeFraisId: paiements.typeFraisId,
					mois: paiements.mois,
					montant: paiements.montant,
					datePaiement: paiements.datePaiement,
					numeroRecu: paiements.numeroRecu,
					note: paiements.note,
					elevePrenom: eleves.prenom,
					eleveNom: eleves.nom,
					eleveMatricule: eleves.matricule,
					typeFraisNom: typesFrais.nom,
				})
				.from(paiements)
				.innerJoin(eleves, eq(paiements.eleveId, eleves.id))
				.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
				.where(and(...conditions))
				.orderBy(desc(paiements.datePaiement));
		}),

	getRecuData: protectedProcedure
		.input(z.object({ paiementId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [row] = await ctx.db
				.select({
					id: paiements.id,
					eleveId: paiements.eleveId,
					montant: paiements.montant,
					mois: paiements.mois,
					datePaiement: paiements.datePaiement,
					numeroRecu: paiements.numeroRecu,
					typeFraisNom: typesFrais.nom,
					elevePrenom: eleves.prenom,
					eleveNom: eleves.nom,
					eleveMatricule: eleves.matricule,
					classeNom: classes.nom,
					niveauId: classes.niveauId,
					anneeScolaireId: paiements.anneeScolaireId,
				})
				.from(paiements)
				.innerJoin(eleves, eq(paiements.eleveId, eleves.id))
				.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.where(eq(paiements.id, input.paiementId));

			if (!row) return null;

			const [parentInfo] = await ctx.db
				.select({
					parentPrenom: parents.prenom,
					parentNom: parents.nom,
					parentTel: parents.telephone,
				})
				.from(eleveParents)
				.innerJoin(parents, eq(eleveParents.parentId, parents.id))
				.where(and(eq(eleveParents.eleveId, row.eleveId), eq(eleveParents.principal, true)));

			// Inscription : détail du forfait du niveau et réduction éventuelle
			let detailForfait: { libelle: string; montant: number }[] | null = null;
			let reduction: { libelle: string; montant: number } | null = null;
			if (estForfait({ nom: row.typeFraisNom })) {
				// Niveau de l'élève l'année du paiement (inscription), sinon celui de sa classe actuelle
				const [insc] = await ctx.db
					.select({ niveauId: classes.niveauId })
					.from(inscriptions)
					.innerJoin(classes, eq(inscriptions.classeId, classes.id))
					.where(
						and(
							eq(inscriptions.eleveId, row.eleveId),
							eq(inscriptions.anneeScolaireId, row.anneeScolaireId),
						),
					)
					.limit(1);
				const niveauId = insc?.niveauId ?? row.niveauId;
				const lignes = await ctx.db
					.select({ libelle: forfaitLignes.libelle, montant: forfaitLignes.montant })
					.from(forfaitLignes)
					.where(
						and(
							eq(forfaitLignes.niveauId, niveauId),
							eq(forfaitLignes.anneeScolaireId, row.anneeScolaireId),
						),
					)
					.orderBy(forfaitLignes.ordre);
				if (lignes.length) {
					detailForfait = lignes;
					const [red] = await ctx.db
						.select()
						.from(reductions)
						.where(
							and(
								eq(reductions.eleveId, row.eleveId),
								eq(reductions.anneeScolaireId, row.anneeScolaireId),
							),
						);
					const total = lignes.reduce((t, l) => t + l.montant, 0);
					const montant = red ? montantReduction(total, red as unknown as Reduction, "forfait") : 0;
					if (red && montant > 0) {
						reduction = {
							libelle: LIBELLES_TYPE_REDUCTION[red.type as Reduction["type"]] ?? "Réduction",
							montant,
						};
					}
				}
			}

			const { niveauId: _n, anneeScolaireId: _a, ...recu } = row;
			return {
				...recu,
				parentPrenom: parentInfo?.parentPrenom ?? null,
				parentNom: parentInfo?.parentNom ?? null,
				parentTel: parentInfo?.parentTel ?? null,
				detailForfait,
				reduction,
			};
		}),
});

const suiviRouter = createTRPCRouter({
	byClasse: protectedProcedure
		.input(
			z.object({
				classeId: z.string().uuid(),
				anneeScolaireId: z.string().uuid(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Get all students in this class for this year
			const studentsList = await ctx.db
				.select({
					id: eleves.id,
					prenom: eleves.prenom,
					nom: eleves.nom,
					matricule: eleves.matricule,
				})
				.from(eleves)
				.where(
					and(
						eq(eleves.classeId, input.classeId),
						eq(eleves.anneeScolaireId, input.anneeScolaireId),
					),
				)
				.orderBy(eleves.nom, eleves.prenom);

			if (studentsList.length === 0) return [];

			// Get all types frais
			const fraisTypes = await ctx.db.select().from(typesFrais).orderBy(typesFrais.nom);

			// Get all payments for these students in this year
			const studentIds = studentsList.map((s) => s.id);
			const allPaiements = await ctx.db
				.select({
					eleveId: paiements.eleveId,
					typeFraisId: paiements.typeFraisId,
					mois: paiements.mois,
				})
				.from(paiements)
				.where(
					and(
						eq(paiements.anneeScolaireId, input.anneeScolaireId),
						sql`${paiements.eleveId} IN (${sql.join(
							studentIds.map((id) => sql`${id}`),
							sql`, `,
						)})`,
					),
				);

			// Build a lookup: eleveId -> typeFraisId -> Set<mois>
			const paidLookup = new Map<string, Map<string, Set<number>>>();
			for (const p of allPaiements) {
				if (!paidLookup.has(p.eleveId)) {
					paidLookup.set(p.eleveId, new Map());
				}
				const byType = paidLookup.get(p.eleveId)!;
				if (!byType.has(p.typeFraisId)) {
					byType.set(p.typeFraisId, new Set());
				}
				byType.get(p.typeFraisId)!.add(p.mois);
			}

			// School year months: Oct(10), Nov(11), Dec(12), Jan(1), Feb(2), Mar(3), Apr(4), May(5), Jun(6), Jul(7)
			const schoolMonths = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7];

			// Échéancier et forfait du niveau de la classe : octobre inclus, mois hors échéancier non dus
			const [classe] = await ctx.db
				.select({ niveauId: classes.niveauId })
				.from(classes)
				.where(eq(classes.id, input.classeId));
			const moisEcheancier = classe
				? await ctx.db
						.select({ mois: echeancier.mois, montant: echeancier.montant })
						.from(echeancier)
						.where(
							and(
								eq(echeancier.niveauId, classe.niveauId),
								eq(echeancier.anneeScolaireId, input.anneeScolaireId),
							),
						)
				: [];
			const lignesForfait = classe
				? await ctx.db
						.select({ montant: forfaitLignes.montant, typeFraisId: forfaitLignes.typeFraisId })
						.from(forfaitLignes)
						.where(
							and(
								eq(forfaitLignes.niveauId, classe.niveauId),
								eq(forfaitLignes.anneeScolaireId, input.anneeScolaireId),
							),
						)
				: [];
			const grilleClasse = await ctx.db
				.select({ typeFraisId: grilleFrais.typeFraisId, montant: grilleFrais.montantMensuel })
				.from(grilleFrais)
				.where(
					and(
						eq(grilleFrais.classeId, input.classeId),
						eq(grilleFrais.anneeScolaireId, input.anneeScolaireId),
					),
				);
			const dus = new Set(moisEcheancier.map((m) => m.mois));
			const ctxStatut = { forfait: lignesForfait.length > 0, dus };
			// Montant affiché en en-tête : tarif du niveau (forfait, échéancier, ligne associée), sinon grille ou défaut
			const tarifEnTete = (tf: (typeof fraisTypes)[number]) => {
				const associees = lignesForfait.filter((l) => l.typeFraisId === tf.id);
				let montants: number[];
				if (estForfait(tf) && lignesForfait.length)
					montants = [lignesForfait.reduce((t, l) => t + l.montant, 0)];
				else if (tf.mensuel && tf.obligatoire && moisEcheancier.length)
					montants = moisEcheancier.map((m) => m.montant);
				else if (associees.length) montants = [associees.reduce((t, l) => t + l.montant, 0)];
				else
					montants = [
						grilleClasse.find((g) => g.typeFraisId === tf.id)?.montant ?? tf.montantDefaut,
					];
				return { montantMin: Math.min(...montants), montantMax: Math.max(...montants) };
			};

			return studentsList.map((student) => {
				const byType = paidLookup.get(student.id);
				const typesFraisStatus = fraisTypes.map((tf) => {
					const paidMonths = byType?.get(tf.id);
					const months = schoolMonths.map((m) => {
						const paid = paidMonths?.has(m) ?? false;
						return { mois: m, paid, statut: statutMois(tf, m, paid, ctxStatut) };
					});
					return {
						typeFraisId: tf.id,
						typeFraisNom: tf.nom,
						mensuel: tf.mensuel,
						montantDefaut: tf.montantDefaut,
						...tarifEnTete(tf),
						paid: paidMonths ? paidMonths.size > 0 : false,
						months,
					};
				});

				return {
					id: student.id,
					prenom: student.prenom,
					nom: student.nom,
					matricule: student.matricule,
					typesFrais: typesFraisStatus,
				};
			});
		}),
});

const depensesRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select({
					id: depenses.id,
					categorieId: depenses.categorieId,
					anneeScolaireId: depenses.anneeScolaireId,
					libelle: depenses.libelle,
					montant: depenses.montant,
					date: depenses.date,
					note: depenses.note,
					createdAt: depenses.createdAt,
					categorieNom: categoriesDepenses.nom,
				})
				.from(depenses)
				.innerJoin(categoriesDepenses, eq(depenses.categorieId, categoriesDepenses.id))
				.where(eq(depenses.anneeScolaireId, input.anneeScolaireId))
				.orderBy(desc(depenses.date));
		}),

	create: protectedProcedure.input(createDepenseSchema).mutation(async ({ ctx, input }) => {
		const [created] = await ctx.db
			.insert(depenses)
			.values({
				categorieId: input.categorieId,
				anneeScolaireId: input.anneeScolaireId,
				libelle: input.libelle,
				montant: input.montant,
				date: input.date,
				note: input.note ?? null,
			})
			.returning();
		return created;
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(depenses).where(eq(depenses.id, input.id));
			return { success: true };
		}),

	categories: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(categoriesDepenses).orderBy(categoriesDepenses.nom);
	}),
});

const recettesRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db
				.select({
					id: recettes.id,
					categorieId: recettes.categorieId,
					anneeScolaireId: recettes.anneeScolaireId,
					libelle: recettes.libelle,
					montant: recettes.montant,
					date: recettes.date,
					note: recettes.note,
					createdAt: recettes.createdAt,
					categorieNom: categoriesRecettes.nom,
				})
				.from(recettes)
				.innerJoin(categoriesRecettes, eq(recettes.categorieId, categoriesRecettes.id))
				.where(eq(recettes.anneeScolaireId, input.anneeScolaireId))
				.orderBy(desc(recettes.date));
		}),

	create: protectedProcedure.input(createRecetteSchema).mutation(async ({ ctx, input }) => {
		const [created] = await ctx.db
			.insert(recettes)
			.values({
				categorieId: input.categorieId,
				anneeScolaireId: input.anneeScolaireId,
				libelle: input.libelle,
				montant: input.montant,
				date: input.date,
				note: input.note ?? null,
			})
			.returning();
		return created;
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(recettes).where(eq(recettes.id, input.id));
			return { success: true };
		}),

	categories: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.select().from(categoriesRecettes).orderBy(categoriesRecettes.nom);
	}),
});

const bilanRouter = createTRPCRouter({
	/**
	 * Bilan de l'année scolaire, vue trésorerie : chaque montant est rattaché au mois où l'argent
	 * a bougé. Solde = paiements + recettes − dépenses − salaires payés.
	 */
	summary: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [annee] = await ctx.db
				.select({ dateDebut: anneesScolaires.dateDebut, dateFin: anneesScolaires.dateFin })
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.anneeScolaireId));
			if (!annee) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Année scolaire introuvable" });
			}

			const parMois = (date: SQL | AnyPgColumn, montant: AnyPgColumn) => ({
				annee: sql<number>`EXTRACT(YEAR FROM ${date})::int`,
				mois: sql<number>`EXTRACT(MONTH FROM ${date})::int`,
				montant: sql<number>`COALESCE(SUM(${montant}), 0)::int`,
			});

			const paiementsMois = await ctx.db
				.select(parMois(paiements.datePaiement, paiements.montant))
				.from(paiements)
				.where(eq(paiements.anneeScolaireId, input.anneeScolaireId))
				.groupBy(sql`1, 2`);

			const recettesMois = await ctx.db
				.select(parMois(recettes.date, recettes.montant))
				.from(recettes)
				.where(eq(recettes.anneeScolaireId, input.anneeScolaireId))
				.groupBy(sql`1, 2`);

			const depensesMois = await ctx.db
				.select(parMois(depenses.date, depenses.montant))
				.from(depenses)
				.where(eq(depenses.anneeScolaireId, input.anneeScolaireId))
				.groupBy(sql`1, 2`);

			// Bulletins payés dont la période tombe dans l'année scolaire (pas de colonne d'année
			// scolaire sur les bulletins) ; rattachés à la date de paiement, sinon au mois du bulletin.
			const periode = sql`make_date(${bulletinsPaie.annee}, ${bulletinsPaie.mois}, 1)`;
			const salairesMois = await ctx.db
				.select(
					parMois(
						sql`COALESCE(${bulletinsPaie.datePaiement}, ${periode})`,
						bulletinsPaie.netAPayer,
					),
				)
				.from(bulletinsPaie)
				.where(
					and(
						eq(bulletinsPaie.paye, true),
						sql`${periode} BETWEEN date_trunc('month', ${annee.dateDebut}::date) AND ${annee.dateFin}::date`,
					),
				)
				.groupBy(sql`1, 2`);

			const mois = buildBilanMensuel({
				dateDebut: annee.dateDebut,
				dateFin: annee.dateFin,
				paiements: paiementsMois,
				recettes: recettesMois,
				depenses: depensesMois,
				salaires: salairesMois,
			});

			return { ...totauxBilan(mois), mois };
		}),
});

const impayesRouter = createTRPCRouter({
	list: protectedProcedure.input(impayesFiltersSchema).query(({ ctx, input }) =>
		getImpayes(ctx.db, input.anneeScolaireId, {
			classeId: input.classeId,
			niveauId: input.niveauId,
		}),
	),
});

/** Ordre scolaire des mois (octobre → septembre) pour l'affichage de l'échéancier. */
const ORDRE_SCOLAIRE = (m: number) => (m >= 9 ? m - 9 : m + 3);

async function anneeActiveId(database: typeof db) {
	const [annee] = await database
		.select({ id: anneesScolaires.id })
		.from(anneesScolaires)
		.where(eq(anneesScolaires.active, true));
	if (!annee)
		throw new TRPCError({ code: "BAD_REQUEST", message: "Aucune année scolaire active." });
	return annee.id;
}

const reductionsRouter = createTRPCRouter({
	get: protectedProcedure
		.input(z.object({ eleveId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const anneeId = await anneeActiveId(ctx.db);
			const [r] = await ctx.db
				.select()
				.from(reductions)
				.where(and(eq(reductions.eleveId, input.eleveId), eq(reductions.anneeScolaireId, anneeId)));
			return r ?? null;
		}),

	enregistrer: protectedProcedure
		.input(enregistrerReductionSchema)
		.mutation(async ({ ctx, input }) => {
			const anneeId = await anneeActiveId(ctx.db);
			const valeurs = {
				type: input.type,
				portee: input.portee,
				mode: input.mode,
				valeur: input.valeur,
				motif: input.motif || null,
			};
			const [r] = await ctx.db
				.insert(reductions)
				.values({ eleveId: input.eleveId, anneeScolaireId: anneeId, ...valeurs })
				.onConflictDoUpdate({
					target: [reductions.eleveId, reductions.anneeScolaireId],
					set: valeurs,
				})
				.returning();
			return r;
		}),

	supprimer: protectedProcedure
		.input(z.object({ eleveId: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const anneeId = await anneeActiveId(ctx.db);
			await ctx.db
				.delete(reductions)
				.where(and(eq(reductions.eleveId, input.eleveId), eq(reductions.anneeScolaireId, anneeId)));
			return { success: true };
		}),

	/** Élèves avec réduction et montant accordé sur l'année (forfait + mensualités de l'échéancier). */
	list: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const rows = await ctx.db
				.select({
					eleveId: reductions.eleveId,
					type: reductions.type,
					portee: reductions.portee,
					mode: reductions.mode,
					valeur: reductions.valeur,
					motif: reductions.motif,
					prenom: eleves.prenom,
					nom: eleves.nom,
					matricule: eleves.matricule,
					classeNom: classes.nom,
					classeId: classes.id,
					niveauId: classes.niveauId,
				})
				.from(reductions)
				.innerJoin(eleves, eq(reductions.eleveId, eleves.id))
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.where(eq(reductions.anneeScolaireId, input.anneeScolaireId))
				.orderBy(eleves.nom, eleves.prenom);
			const lignes = await ctx.db
				.select()
				.from(forfaitLignes)
				.where(eq(forfaitLignes.anneeScolaireId, input.anneeScolaireId));
			const mois = await ctx.db
				.select()
				.from(echeancier)
				.where(eq(echeancier.anneeScolaireId, input.anneeScolaireId));
			const [annee] = await ctx.db
				.select({ dateDebut: anneesScolaires.dateDebut, dateFin: anneesScolaires.dateFin })
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.anneeScolaireId));
			const nbMois = annee ? moisDus(annee.dateDebut, annee.dateFin, annee.dateFin).length : 0;
			const obligatoires = await ctx.db
				.select()
				.from(typesFrais)
				.where(eq(typesFrais.obligatoire, true));
			const grille = await ctx.db
				.select()
				.from(grilleFrais)
				.where(eq(grilleFrais.anneeScolaireId, input.anneeScolaireId));
			return rows.map((r) => {
				const red = r as unknown as Reduction;
				const ls = lignes.filter((l) => l.niveauId === r.niveauId);
				const ms = mois.filter((m) => m.niveauId === r.niveauId);
				const forfait = ls.length ? ls.reduce((t, l) => t + l.montant, 0) : null;
				// Repli sur la grille de la classe (sinon montant par défaut), comme les impayés
				const tarifGrille = (tf: (typeof obligatoires)[number]) =>
					grille.find((g) => g.classeId === r.classeId && g.typeFraisId === tf.id)
						?.montantMensuel ?? tf.montantDefaut;
				const { classeId: _c, niveauId: _n, ...ligne } = r;
				return {
					...ligne,
					montantAnnuel: montantAnnuelReduction(red, {
						forfait,
						echeancier: ms.length ? ms.map((m) => m.montant) : null,
						uniques: obligatoires
							.filter((tf) => !tf.mensuel && !(forfait !== null && estForfait(tf)))
							.map(tarifGrille),
						mensuels: obligatoires.filter((tf) => tf.mensuel).map(tarifGrille),
						nbMois,
					}),
				};
			});
		}),
});

const tarifsRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const lesNiveaux = await ctx.db.select().from(niveaux).orderBy(niveaux.ordre);
			const lignes = await ctx.db
				.select()
				.from(forfaitLignes)
				.where(eq(forfaitLignes.anneeScolaireId, input.anneeScolaireId))
				.orderBy(forfaitLignes.ordre);
			const mois = await ctx.db
				.select()
				.from(echeancier)
				.where(eq(echeancier.anneeScolaireId, input.anneeScolaireId));
			return lesNiveaux.map((n) => {
				const l = lignes
					.filter((x) => x.niveauId === n.id)
					.map((x) => ({
						libelle: x.libelle,
						montant: x.montant,
						ordre: x.ordre,
						typeFraisId: x.typeFraisId,
					}));
				return {
					niveauId: n.id,
					niveauNom: n.nom,
					ordre: n.ordre,
					lignes: l,
					total: l.reduce((t, x) => t + x.montant, 0),
					echeancier: mois
						.filter((x) => x.niveauId === n.id)
						.map((x) => ({ mois: x.mois, montant: x.montant }))
						.sort((a, b) => ORDRE_SCOLAIRE(a.mois) - ORDRE_SCOLAIRE(b.mois)),
				};
			});
		}),

	enregistrer: protectedProcedure
		.input(enregistrerTarifsSchema)
		.mutation(async ({ ctx, input }) => {
			const vus = new Set<number>();
			for (const e of input.echeancier) {
				if (vus.has(e.mois))
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Mois en double : ${MOIS_LABELS[e.mois]}`,
					});
				vus.add(e.mois);
			}
			const [niveau] = await ctx.db
				.select({ id: niveaux.id })
				.from(niveaux)
				.where(eq(niveaux.id, input.niveauId));
			const [annee] = await ctx.db
				.select({ id: anneesScolaires.id })
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.anneeScolaireId));
			if (!niveau || !annee)
				throw new TRPCError({ code: "NOT_FOUND", message: "Niveau ou année introuvable" });
			const associes = input.lignes.flatMap((l) => (l.typeFraisId ? [l.typeFraisId] : []));
			if (associes.length) {
				const facultatifs = new Set(
					(
						await ctx.db
							.select({ id: typesFrais.id })
							.from(typesFrais)
							.where(eq(typesFrais.obligatoire, false))
					).map((t) => t.id),
				);
				if (associes.some((id) => !facultatifs.has(id))) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Seuls les frais facultatifs (fournitures, tenue…) peuvent être associés au forfait",
					});
				}
			}
			return ctx.db.transaction(async (tx) => {
				const cle = and(
					eq(forfaitLignes.niveauId, input.niveauId),
					eq(forfaitLignes.anneeScolaireId, input.anneeScolaireId),
				);
				await tx.delete(forfaitLignes).where(cle);
				await tx
					.delete(echeancier)
					.where(
						and(
							eq(echeancier.niveauId, input.niveauId),
							eq(echeancier.anneeScolaireId, input.anneeScolaireId),
						),
					);
				if (input.lignes.length) {
					await tx.insert(forfaitLignes).values(
						input.lignes.map((l, i) => ({
							niveauId: input.niveauId,
							anneeScolaireId: input.anneeScolaireId,
							libelle: l.libelle,
							montant: l.montant,
							ordre: i,
							typeFraisId: l.typeFraisId,
						})),
					);
				}
				if (input.echeancier.length) {
					await tx.insert(echeancier).values(
						input.echeancier.map((e) => ({
							niveauId: input.niveauId,
							anneeScolaireId: input.anneeScolaireId,
							mois: e.mois,
							montant: e.montant,
						})),
					);
				}
				return { lignes: input.lignes.length, mois: input.echeancier.length };
			});
		}),

	/** Tarifs de l'élève (niveau de sa classe, année active) pour proposer les montants à la saisie. */
	pourEleve: protectedProcedure
		.input(z.object({ eleveId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [annee] = await ctx.db
				.select({ id: anneesScolaires.id })
				.from(anneesScolaires)
				.where(eq(anneesScolaires.active, true));
			const [eleve] = await ctx.db
				.select({ niveauId: classes.niveauId })
				.from(eleves)
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.where(eq(eleves.id, input.eleveId));
			if (!annee || !eleve)
				return {
					forfait: null,
					resteForfait: null,
					forfaitBrut: null,
					lignes: [],
					echeancier: {} as Record<number, number>,
					reduction: null,
				};
			const [reduction] = await ctx.db
				.select()
				.from(reductions)
				.where(
					and(eq(reductions.eleveId, input.eleveId), eq(reductions.anneeScolaireId, annee.id)),
				);
			const red = (reduction ?? null) as Reduction | null;
			const lignes = await ctx.db
				.select({
					libelle: forfaitLignes.libelle,
					montant: forfaitLignes.montant,
					typeFraisId: forfaitLignes.typeFraisId,
				})
				.from(forfaitLignes)
				.where(
					and(
						eq(forfaitLignes.niveauId, eleve.niveauId),
						eq(forfaitLignes.anneeScolaireId, annee.id),
					),
				)
				.orderBy(forfaitLignes.ordre);
			const mois = await ctx.db
				.select({ mois: echeancier.mois, montant: echeancier.montant })
				.from(echeancier)
				.where(
					and(eq(echeancier.niveauId, eleve.niveauId), eq(echeancier.anneeScolaireId, annee.id)),
				);
			const forfaitBrut = lignes.length ? lignes.reduce((t, l) => t + l.montant, 0) : null;
			const forfait = forfaitBrut === null ? null : montantReduit(forfaitBrut, red, "forfait");
			// Déjà versé sur le forfait (Inscription + types associés plafonnés) → reste dû
			let resteForfait: number | null = null;
			if (forfait !== null) {
				const verses = await ctx.db
					.select({
						typeFraisId: paiements.typeFraisId,
						nom: typesFrais.nom,
						montant: paiements.montant,
					})
					.from(paiements)
					.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
					.where(
						and(eq(paiements.eleveId, input.eleveId), eq(paiements.anneeScolaireId, annee.id)),
					);
				const parType = new Map<string, number>();
				for (const v of verses)
					parType.set(v.typeFraisId, (parType.get(v.typeFraisId) ?? 0) + v.montant);
				const inscription = verses.find((v) => estForfait(v));
				const verse = verseSurForfait(
					associesDesLignes(lignes),
					inscription?.typeFraisId ?? "",
					(id) => parType.get(id) ?? 0,
				);
				resteForfait = Math.max(0, forfait - verse);
			}
			return {
				forfait,
				resteForfait,
				forfaitBrut,
				lignes,
				echeancier: Object.fromEntries(
					mois.map((m) => [m.mois, montantReduit(m.montant, red, "mensualite")]),
				) as Record<number, number>,
				reduction: reduction ?? null,
			};
		}),
});

export const financeRouter = createTRPCRouter({
	typesFrais: typesFraisRouter,
	grilleFrais: grilleFraisRouter,
	paiements: paiementsRouter,
	suivi: suiviRouter,
	depenses: depensesRouter,
	recettes: recettesRouter,
	bilan: bilanRouter,
	impayes: impayesRouter,
	tarifs: tarifsRouter,
	reductions: reductionsRouter,
});
