import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { eleves } from "@/modules/students/schema";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import {
	chargerContexte,
	configurerClasses,
	controlesPassage,
	enregistrerDecisions,
	executerPassage,
	previsualiserPassage,
} from "./passage-service";
import { sauvegarder } from "./sauvegarde-service";
import { anneesScolaires, classes, matieres, niveaux } from "./schema";
import {
	configurerClassesSchema,
	createAnneeSchema,
	createClasseSchema,
	createMatiereSchema,
	decisionsSchema,
	enregistrerDecisionsSchema,
	executerPassageSchema,
	updateAnneeSchema,
	updateClasseSchema,
	updateMatiereSchema,
} from "./validation";

const niveauxRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.query.niveaux.findMany({
			orderBy: [niveaux.ordre],
		});
	}),
});

const anneesRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.query.anneesScolaires.findMany({
			orderBy: [desc(anneesScolaires.dateDebut)],
		});
	}),

	create: protectedProcedure.input(createAnneeSchema).mutation(async ({ ctx, input }) => {
		const [annee] = await ctx.db
			.insert(anneesScolaires)
			.values({
				libelle: input.libelle,
				dateDebut: input.dateDebut,
				dateFin: input.dateFin,
			})
			.returning();
		return annee;
	}),

	update: protectedProcedure.input(updateAnneeSchema).mutation(async ({ ctx, input }) => {
		const { id, ...data } = input;
		const [annee] = await ctx.db
			.update(anneesScolaires)
			.set(data)
			.where(eq(anneesScolaires.id, id))
			.returning();
		return annee;
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(anneesScolaires).where(eq(anneesScolaires.id, input.id));
			return { success: true };
		}),

	setActive: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			// Cannot activate an archived year
			const [annee] = await ctx.db
				.select()
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.id));
			if (annee?.archived) {
				throw new Error("Impossible d'activer une année archivée.");
			}
			await ctx.db.transaction(async (tx) => {
				// Deactivate all
				await tx.update(anneesScolaires).set({ active: false });
				// Activate selected
				await tx
					.update(anneesScolaires)
					.set({ active: true })
					.where(eq(anneesScolaires.id, input.id));
			});
			return { success: true };
		}),

	archive: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			const [annee] = await ctx.db
				.select()
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.id));
			if (!annee) throw new Error("Année scolaire non trouvée.");
			if (annee.archived) throw new Error("Cette année est déjà archivée.");
			if (annee.active) {
				throw new Error("Impossible d'archiver l'année active. Activez une autre année d'abord.");
			}

			await ctx.db
				.update(anneesScolaires)
				.set({ archived: true, updatedAt: new Date() })
				.where(eq(anneesScolaires.id, input.id));

			return { success: true };
		}),
});

const classesRouter = createTRPCRouter({
	list: protectedProcedure
		.input(
			z
				.object({
					anneeScolaireId: z.string().uuid().optional(),
					niveauId: z.string().uuid().optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			const conditions = [];
			if (input?.anneeScolaireId) {
				conditions.push(eq(classes.anneeScolaireId, input.anneeScolaireId));
			}
			if (input?.niveauId) {
				conditions.push(eq(classes.niveauId, input.niveauId));
			}

			const rows = await ctx.db.query.classes.findMany({
				where: conditions.length > 0 ? and(...conditions) : undefined,
				with: { niveau: true },
			});

			// Effectif = élèves actifs rattachés à la classe
			const effectifs = await ctx.db
				.select({ classeId: eleves.classeId, effectif: count() })
				.from(eleves)
				.where(eq(eleves.statut, "actif"))
				.groupBy(eleves.classeId);
			const parClasse = new Map(effectifs.map((e) => [e.classeId, e.effectif]));

			return rows
				.map((classe) => {
					const effectif = parClasse.get(classe.id) ?? 0;
					return { ...classe, effectif, placesRestantes: classe.capacite - effectif };
				})
				.sort(
					(a, b) =>
						(a.niveau?.ordre ?? 0) - (b.niveau?.ordre ?? 0) ||
						a.nom.localeCompare(b.nom, "fr", { numeric: true }),
				);
		}),

	create: protectedProcedure.input(createClasseSchema).mutation(async ({ ctx, input }) => {
		const [classe] = await ctx.db
			.insert(classes)
			.values({
				nom: input.nom,
				niveauId: input.niveauId,
				capacite: input.capacite,
				anneeScolaireId: input.anneeScolaireId,
			})
			.returning();
		return classe;
	}),

	update: protectedProcedure.input(updateClasseSchema).mutation(async ({ ctx, input }) => {
		const { id, ...data } = input;
		if (data.finDeCycle) data.classeSuivanteId = null;
		if (data.classeSuivanteId) {
			const [classe] = await ctx.db.select().from(classes).where(eq(classes.id, id));
			const [suivante] = await ctx.db
				.select()
				.from(classes)
				.where(eq(classes.id, data.classeSuivanteId));
			if (
				!classe ||
				!suivante ||
				suivante.id === classe.id ||
				suivante.anneeScolaireId !== classe.anneeScolaireId
			) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "La classe suivante doit être une autre classe de la même année.",
				});
			}
			data.finDeCycle = false;
		}
		const [classe] = await ctx.db.update(classes).set(data).where(eq(classes.id, id)).returning();
		return classe;
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(classes).where(eq(classes.id, input.id));
			return { success: true };
		}),
});

const matieresRouter = createTRPCRouter({
	list: protectedProcedure
		.input(
			z
				.object({
					niveauId: z.string().uuid().optional(),
				})
				.optional(),
		)
		.query(async ({ ctx, input }) => {
			return ctx.db.query.matieres.findMany({
				where: input?.niveauId ? eq(matieres.niveauId, input.niveauId) : undefined,
				with: { niveau: true },
			});
		}),

	create: protectedProcedure.input(createMatiereSchema).mutation(async ({ ctx, input }) => {
		const [matiere] = await ctx.db
			.insert(matieres)
			.values({
				nom: input.nom,
				coefficient: input.coefficient,
				niveauId: input.niveauId,
			})
			.returning();
		return matiere;
	}),

	update: protectedProcedure.input(updateMatiereSchema).mutation(async ({ ctx, input }) => {
		const { id, ...data } = input;
		const [matiere] = await ctx.db
			.update(matieres)
			.set(data)
			.where(eq(matieres.id, id))
			.returning();
		return matiere;
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(matieres).where(eq(matieres.id, input.id));
			return { success: true };
		}),
});

const passageRouter = createTRPCRouter({
	contexte: protectedProcedure.query(({ ctx }) => chargerContexte(ctx.db)),
	configurerClasses: protectedProcedure
		.input(configurerClassesSchema)
		.mutation(({ ctx, input }) => configurerClasses(ctx.db, input.classes)),
	preview: protectedProcedure
		.input(z.object({ decisions: decisionsSchema }))
		.query(({ ctx, input }) => previsualiserPassage(ctx.db, input.decisions)),
	controles: protectedProcedure.query(({ ctx }) => controlesPassage(ctx.db)),
	sauvegarder: protectedProcedure.mutation(() => sauvegarder("cemas")),
	enregistrerDecisions: protectedProcedure
		.input(enregistrerDecisionsSchema)
		.mutation(({ ctx, input }) => enregistrerDecisions(ctx.db, input.decisions)),
	executer: protectedProcedure
		.input(executerPassageSchema)
		.mutation(({ ctx, input }) => executerPassage(ctx.db, input)),
});

export const academicRouter = createTRPCRouter({
	niveaux: niveauxRouter,
	annees: anneesRouter,
	classes: classesRouter,
	matieres: matieresRouter,
	passage: passageRouter,
});
