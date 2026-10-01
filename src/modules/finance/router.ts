import { eq, and, sql, desc } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import {
	typesFrais,
	grilleFrais,
	paiements,
	categoriesDepenses,
	depenses,
	categoriesRecettes,
	recettes,
} from "./schema";
import { classes } from "@/modules/academic/schema";
import { eleves } from "@/modules/students/schema";
import { generateRecuNumber } from "@/shared/lib/utils";
import {
	createPaiementSchema,
	createDepenseSchema,
	createRecetteSchema,
	bilanFiltersSchema,
	grilleFraisSchema,
} from "./validation";
import { z } from "zod";

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

	upsert: protectedProcedure
		.input(grilleFraisSchema)
		.mutation(async ({ ctx, input }) => {
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
	create: protectedProcedure
		.input(createPaiementSchema)
		.mutation(async ({ ctx, input }) => {
			// Get max recu number sequence for the current year
			const [maxResult] = await ctx.db
				.select({
					maxRecu: sql<string>`MAX(${paiements.numeroRecu})`,
				})
				.from(paiements);

			let seq = 1;
			if (maxResult?.maxRecu) {
				const parts = maxResult.maxRecu.split("-");
				const lastSeq = parseInt(parts[2], 10);
				if (!isNaN(lastSeq)) {
					seq = lastSeq + 1;
				}
			}

			const year = new Date().getFullYear();
			const numeroRecu = generateRecuNumber(year, seq);

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
			}),
		)
		.query(async ({ ctx, input }) => {
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
				.where(
					and(
						eq(paiements.anneeScolaireId, input.anneeScolaireId),
						eq(paiements.mois, input.mois),
					),
				)
				.orderBy(desc(paiements.datePaiement));
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
			const fraisTypes = await ctx.db
				.select()
				.from(typesFrais)
				.orderBy(typesFrais.nom);

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
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select({
				id: depenses.id,
				categorieId: depenses.categorieId,
				libelle: depenses.libelle,
				montant: depenses.montant,
				date: depenses.date,
				note: depenses.note,
				createdAt: depenses.createdAt,
				categorieNom: categoriesDepenses.nom,
			})
			.from(depenses)
			.innerJoin(categoriesDepenses, eq(depenses.categorieId, categoriesDepenses.id))
			.orderBy(desc(depenses.date));
	}),

	create: protectedProcedure
		.input(createDepenseSchema)
		.mutation(async ({ ctx, input }) => {
			const [created] = await ctx.db
				.insert(depenses)
				.values({
					categorieId: input.categorieId,
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
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db
			.select({
				id: recettes.id,
				categorieId: recettes.categorieId,
				libelle: recettes.libelle,
				montant: recettes.montant,
				date: recettes.date,
				note: recettes.note,
				createdAt: recettes.createdAt,
				categorieNom: categoriesRecettes.nom,
			})
			.from(recettes)
			.innerJoin(categoriesRecettes, eq(recettes.categorieId, categoriesRecettes.id))
			.orderBy(desc(recettes.date));
	}),

	create: protectedProcedure
		.input(createRecetteSchema)
		.mutation(async ({ ctx, input }) => {
			const [created] = await ctx.db
				.insert(recettes)
				.values({
					categorieId: input.categorieId,
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
	summary: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [paiementsSum] = await ctx.db
				.select({
					total: sql<number>`COALESCE(SUM(${paiements.montant}), 0)`,
				})
				.from(paiements)
				.where(eq(paiements.anneeScolaireId, input.anneeScolaireId));

			const [depensesSum] = await ctx.db
				.select({
					total: sql<number>`COALESCE(SUM(${depenses.montant}), 0)`,
				})
				.from(depenses);

			const [recettesSum] = await ctx.db
				.select({
					total: sql<number>`COALESCE(SUM(${recettes.montant}), 0)`,
				})
				.from(recettes);

			const totalPaiements = Number(paiementsSum.total);
			const totalDepenses = Number(depensesSum.total);
			const totalRecettes = Number(recettesSum.total);
			const solde = totalPaiements + totalRecettes - totalDepenses;

			return { totalPaiements, totalDepenses, totalRecettes, solde };
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
});
