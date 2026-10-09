import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { classes, niveaux } from "@/modules/academic/schema";
import { getImpayes } from "@/modules/finance/impayes-service";
import { depenses, paiements, typesFrais } from "@/modules/finance/schema";
import { bulletinsPaie, employes } from "@/modules/payroll/schema";
import { eleves } from "@/modules/students/schema";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";

export const dashboardRouter = createTRPCRouter({
	stats: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			// Total students
			const [studentsResult] = await ctx.db
				.select({ total: count() })
				.from(eleves)
				.where(and(eq(eleves.anneeScolaireId, input.anneeScolaireId), eq(eleves.statut, "actif")));

			// Total classes
			const [classesResult] = await ctx.db
				.select({ total: count() })
				.from(classes)
				.where(eq(classes.anneeScolaireId, input.anneeScolaireId));

			// Total payments collected this year
			const [paiementsResult] = await ctx.db
				.select({ total: sql<number>`COALESCE(SUM(${paiements.montant}), 0)` })
				.from(paiements)
				.where(eq(paiements.anneeScolaireId, input.anneeScolaireId));

			// Total depenses this year (no annee filter on depenses, use date range)
			const [depensesResult] = await ctx.db
				.select({ total: sql<number>`COALESCE(SUM(${depenses.montant}), 0)` })
				.from(depenses);

			// Active employees count
			const [employesResult] = await ctx.db
				.select({ total: count() })
				.from(employes)
				.where(eq(employes.statut, "actif"));

			// Current month payroll
			const now = new Date();
			const currentMois = now.getMonth() + 1;
			const currentAnnee = now.getFullYear();
			const [payrollResult] = await ctx.db
				.select({ total: sql<number>`COALESCE(SUM(${bulletinsPaie.netAPayer}), 0)` })
				.from(bulletinsPaie)
				.where(and(eq(bulletinsPaie.mois, currentMois), eq(bulletinsPaie.annee, currentAnnee)));

			const impayes = await getImpayes(ctx.db, input.anneeScolaireId);

			return {
				totalEleves: studentsResult.total,
				totalClasses: classesResult.total,
				totalPaiements: Number(paiementsResult.total),
				totalDepenses: Number(depensesResult.total),
				totalEmployes: employesResult.total,
				masseSalariale: Number(payrollResult.total),
				totalImpayes: impayes.totalReste,
			};
		}),

	studentsByNiveau: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const results = await ctx.db
				.select({
					niveauNom: niveaux.nom,
					count: count(),
				})
				.from(eleves)
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
				.where(and(eq(eleves.anneeScolaireId, input.anneeScolaireId), eq(eleves.statut, "actif")))
				.groupBy(niveaux.nom)
				.orderBy(niveaux.nom);

			return results;
		}),

	recentPayments: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const results = await ctx.db
				.select({
					id: paiements.id,
					montant: paiements.montant,
					mois: paiements.mois,
					datePaiement: paiements.datePaiement,
					numeroRecu: paiements.numeroRecu,
					elevePrenom: eleves.prenom,
					eleveNom: eleves.nom,
					typeFraisNom: typesFrais.nom,
				})
				.from(paiements)
				.innerJoin(eleves, eq(paiements.eleveId, eleves.id))
				.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
				.where(eq(paiements.anneeScolaireId, input.anneeScolaireId))
				.orderBy(desc(paiements.createdAt))
				.limit(10);

			return results;
		}),

	monthlyRevenue: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const results = await ctx.db
				.select({
					mois: paiements.mois,
					total: sql<number>`COALESCE(SUM(${paiements.montant}), 0)`,
				})
				.from(paiements)
				.where(eq(paiements.anneeScolaireId, input.anneeScolaireId))
				.groupBy(paiements.mois)
				.orderBy(paiements.mois);

			return results.map((r) => ({
				mois: r.mois,
				total: Number(r.total),
			}));
		}),
});
