import { TRPCError } from "@trpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { differences, journaliser } from "@/modules/audit/journal";
import { getParametres } from "@/modules/settings/service";
import { nextSequence } from "@/shared/lib/sequence";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { generateEmployeMatricule } from "@/shared/lib/utils";
import { bulletinsPaie, employes } from "./schema";
import {
	createEmployeSchema,
	generateBulletinsSchema,
	updateBulletinSchema,
	updateEmployeSchema,
} from "./validation";

const employesRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db
			.select({
				id: employes.id,
				matricule: employes.matricule,
				prenom: employes.prenom,
				nom: employes.nom,
				telephone: employes.telephone,
				poste: employes.poste,
				type: employes.type,
				salaireBase: employes.salaireBase,
				dateEmbauche: employes.dateEmbauche,
				statut: employes.statut,
				createdAt: employes.createdAt,
				bulletinsCount: count(bulletinsPaie.id),
			})
			.from(employes)
			.leftJoin(bulletinsPaie, eq(employes.id, bulletinsPaie.employeId))
			.groupBy(employes.id)
			.orderBy(employes.nom);

		return rows;
	}),

	create: protectedProcedure.input(createEmployeSchema).mutation(async ({ ctx, input }) => {
		// Next sequence number for the configured prefix
		const { prefixeEmploye } = await getParametres(ctx.db);
		const seq = await nextSequence(
			ctx.db,
			employes,
			employes.matricule,
			`^${prefixeEmploye}-(\\d+)$`,
		);
		const matricule = generateEmployeMatricule(prefixeEmploye, seq);

		const [created] = await ctx.db
			.insert(employes)
			.values({
				matricule,
				prenom: input.prenom,
				nom: input.nom,
				telephone: input.telephone,
				poste: input.poste,
				type: input.type,
				salaireBase: input.salaireBase,
				dateEmbauche: input.dateEmbauche,
			})
			.returning();

		return created;
	}),

	/** Modification (y compris désactiver / réactiver) par l'administrateur, avec journal (D-026). */
	update: adminProcedure.input(updateEmployeSchema).mutation(async ({ ctx, input }) => {
		const { id, ...data } = input;
		return await ctx.db.transaction(async (tx) => {
			const [avant] = await tx.select().from(employes).where(eq(employes.id, id));
			if (!avant) throw new TRPCError({ code: "NOT_FOUND", message: "Employé introuvable" });
			const diff = differences(avant, data);
			if (!diff) return avant;
			const [updated] = await tx
				.update(employes)
				.set({ ...data, updatedAt: new Date() })
				.where(eq(employes.id, id))
				.returning();
			await journaliser(tx, {
				userId: ctx.admin.id,
				userNom: ctx.admin.nom,
				entite: "employe",
				entiteId: id,
				action: "modification",
				libelle: `${avant.matricule} — ${updated.prenom} ${updated.nom}`,
				avant: diff.avant,
				apres: diff.apres,
			});
			return updated;
		});
	}),

	/** Suppression d'un employé sans bulletin ; sinon le désactiver pour garder l'historique. */
	delete: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.transaction(async (tx) => {
				const [avant] = await tx.select().from(employes).where(eq(employes.id, input.id));
				if (!avant) throw new TRPCError({ code: "NOT_FOUND", message: "Employé introuvable" });
				const [{ nb }] = await tx
					.select({ nb: count() })
					.from(bulletinsPaie)
					.where(eq(bulletinsPaie.employeId, input.id));
				if (nb > 0)
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Cet employé a des bulletins de paie : désactivez-le pour garder l'historique.",
					});
				await tx.delete(employes).where(eq(employes.id, input.id));
				await journaliser(tx, {
					userId: ctx.admin.id,
					userNom: ctx.admin.nom,
					entite: "employe",
					entiteId: input.id,
					action: "suppression",
					libelle: `${avant.matricule} — ${avant.prenom} ${avant.nom}`,
					avant,
					apres: null,
				});
				return avant;
			});
		}),
});

const bulletinsRouter = createTRPCRouter({
	list: protectedProcedure.input(generateBulletinsSchema).query(async ({ ctx, input }) => {
		const rows = await ctx.db
			.select({
				id: bulletinsPaie.id,
				employeId: bulletinsPaie.employeId,
				mois: bulletinsPaie.mois,
				annee: bulletinsPaie.annee,
				salaireBase: bulletinsPaie.salaireBase,
				primes: bulletinsPaie.primes,
				retenues: bulletinsPaie.retenues,
				netAPayer: bulletinsPaie.netAPayer,
				datePaiement: bulletinsPaie.datePaiement,
				paye: bulletinsPaie.paye,
				note: bulletinsPaie.note,
				employeMatricule: employes.matricule,
				employePrenom: employes.prenom,
				employeNom: employes.nom,
				employePoste: employes.poste,
			})
			.from(bulletinsPaie)
			.innerJoin(employes, eq(bulletinsPaie.employeId, employes.id))
			.where(and(eq(bulletinsPaie.mois, input.mois), eq(bulletinsPaie.annee, input.annee)))
			.orderBy(employes.nom);

		return rows;
	}),

	generate: protectedProcedure.input(generateBulletinsSchema).mutation(async ({ ctx, input }) => {
		// Get all active employees
		const activeEmployes = await ctx.db.select().from(employes).where(eq(employes.statut, "actif"));

		if (activeEmployes.length === 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Aucun employé actif trouvé",
			});
		}

		// Get existing bulletins for this month/year to skip them
		const existing = await ctx.db
			.select({ employeId: bulletinsPaie.employeId })
			.from(bulletinsPaie)
			.where(and(eq(bulletinsPaie.mois, input.mois), eq(bulletinsPaie.annee, input.annee)));

		const existingIds = new Set(existing.map((e) => e.employeId));

		const toInsert = activeEmployes
			.filter((emp) => !existingIds.has(emp.id))
			.map((emp) => ({
				employeId: emp.id,
				mois: input.mois,
				annee: input.annee,
				salaireBase: emp.salaireBase,
				primes: 0,
				retenues: 0,
				netAPayer: emp.salaireBase,
				paye: false,
			}));

		if (toInsert.length === 0) {
			return { created: 0, message: "Tous les bulletins existent déjà" };
		}

		await ctx.db.insert(bulletinsPaie).values(toInsert);

		return { created: toInsert.length, message: `${toInsert.length} bulletin(s) créé(s)` };
	}),

	update: protectedProcedure.input(updateBulletinSchema).mutation(async ({ ctx, input }) => {
		// Fetch the existing bulletin to get salaireBase
		const [bulletin] = await ctx.db
			.select()
			.from(bulletinsPaie)
			.where(eq(bulletinsPaie.id, input.id));

		if (!bulletin) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Bulletin introuvable" });
		}

		// Recompute net server-side
		const netAPayer = bulletin.salaireBase + input.primes - input.retenues;

		const [updated] = await ctx.db
			.update(bulletinsPaie)
			.set({
				primes: input.primes,
				retenues: input.retenues,
				note: input.note,
				netAPayer,
			})
			.where(eq(bulletinsPaie.id, input.id))
			.returning();

		return updated;
	}),

	markPaid: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const today = new Date().toISOString().split("T")[0];

			const [updated] = await ctx.db
				.update(bulletinsPaie)
				.set({ paye: true, datePaiement: today })
				.where(eq(bulletinsPaie.id, input.id))
				.returning();

			if (!updated) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Bulletin introuvable" });
			}

			return updated;
		}),

	stats: protectedProcedure.input(generateBulletinsSchema).query(async ({ ctx, input }) => {
		const [result] = await ctx.db
			.select({
				totalNet: sql<number>`COALESCE(SUM(${bulletinsPaie.netAPayer}), 0)`,
				totalPrimes: sql<number>`COALESCE(SUM(${bulletinsPaie.primes}), 0)`,
				totalRetenues: sql<number>`COALESCE(SUM(${bulletinsPaie.retenues}), 0)`,
				nbEmployes: count(bulletinsPaie.id),
			})
			.from(bulletinsPaie)
			.where(and(eq(bulletinsPaie.mois, input.mois), eq(bulletinsPaie.annee, input.annee)));

		return {
			totalNet: Number(result.totalNet),
			totalPrimes: Number(result.totalPrimes),
			totalRetenues: Number(result.totalRetenues),
			nbEmployes: Number(result.nbEmployes),
		};
	}),
});

const historiqueRouter = protectedProcedure
	.input(z.object({ annee: z.number().int() }))
	.query(async ({ ctx, input }) => {
		const rows = await ctx.db
			.select({
				mois: bulletinsPaie.mois,
				totalBase: sql<number>`COALESCE(SUM(${bulletinsPaie.salaireBase}), 0)`,
				totalPrimes: sql<number>`COALESCE(SUM(${bulletinsPaie.primes}), 0)`,
				totalRetenues: sql<number>`COALESCE(SUM(${bulletinsPaie.retenues}), 0)`,
				totalNet: sql<number>`COALESCE(SUM(${bulletinsPaie.netAPayer}), 0)`,
				nbPayes: sql<number>`COALESCE(SUM(CASE WHEN ${bulletinsPaie.paye} = true THEN 1 ELSE 0 END), 0)`,
			})
			.from(bulletinsPaie)
			.where(eq(bulletinsPaie.annee, input.annee))
			.groupBy(bulletinsPaie.mois)
			.orderBy(bulletinsPaie.mois);

		// Build full 12-month array, filling missing months with zeros
		const dataMap = new Map(rows.map((r) => [r.mois, r]));

		return Array.from({ length: 12 }, (_, i) => {
			const mois = i + 1;
			const row = dataMap.get(mois);
			return {
				mois,
				totalBase: Number(row?.totalBase ?? 0),
				totalPrimes: Number(row?.totalPrimes ?? 0),
				totalRetenues: Number(row?.totalRetenues ?? 0),
				totalNet: Number(row?.totalNet ?? 0),
				nbPayes: Number(row?.nbPayes ?? 0),
			};
		});
	});

export const payrollRouter = createTRPCRouter({
	employes: employesRouter,
	bulletins: bulletinsRouter,
	historique: historiqueRouter,
});
