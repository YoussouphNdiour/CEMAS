import { TRPCError } from "@trpc/server";
import { and, desc, eq, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import { anneesScolaires, classes } from "@/modules/academic/schema";
import { bulletinsPaie } from "@/modules/payroll/schema";
import { getParametres } from "@/modules/settings/service";
import { eleveParents, eleves, parents } from "@/modules/students/schema";
import { nextSequence } from "@/shared/lib/sequence";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { generateRecuNumber } from "@/shared/lib/utils";
import { buildBilanMensuel, totauxBilan } from "./bilan";
import { getImpayes } from "./impayes-service";
import {
	categoriesDepenses,
	categoriesRecettes,
	depenses,
	grilleFrais,
	paiements,
	recettes,
	typesFrais,
} from "./schema";
import {
	createDepenseSchema,
	createPaiementSchema,
	createRecetteSchema,
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

			return {
				...row,
				parentPrenom: parentInfo?.parentPrenom ?? null,
				parentNom: parentInfo?.parentNom ?? null,
				parentTel: parentInfo?.parentTel ?? null,
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

			return studentsList.map((student) => {
				const byType = paidLookup.get(student.id);
				const typesFraisStatus = fraisTypes.map((tf) => {
					const paidMonths = byType?.get(tf.id);
					const months = schoolMonths.map((m) => ({
						mois: m,
						paid: paidMonths?.has(m) ?? false,
					}));
					return {
						typeFraisId: tf.id,
						typeFraisNom: tf.nom,
						mensuel: tf.mensuel,
						montantDefaut: tf.montantDefaut,
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

export const financeRouter = createTRPCRouter({
	typesFrais: typesFraisRouter,
	grilleFrais: grilleFraisRouter,
	paiements: paiementsRouter,
	suivi: suiviRouter,
	depenses: depensesRouter,
	recettes: recettesRouter,
	bilan: bilanRouter,
	impayes: impayesRouter,
});
