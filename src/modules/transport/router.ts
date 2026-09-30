import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { z } from "zod";
import {
	vehicules,
	itineraires,
	arrets,
	affectationsTransport,
} from "./schema";
import { eleves } from "@/modules/students/schema";
import {
	createVehiculeSchema,
	updateVehiculeSchema,
	createItineraireSchema,
	updateItineraireSchema,
	createArretSchema,
	createAffectationSchema,
} from "./validation";
import { eq, sql } from "drizzle-orm";

const vehiculesRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.query.vehicules.findMany({
			orderBy: [vehicules.marque],
		});
	}),

	create: protectedProcedure
		.input(createVehiculeSchema)
		.mutation(async ({ ctx, input }) => {
			const [vehicule] = await ctx.db
				.insert(vehicules)
				.values({
					immatriculation: input.immatriculation,
					marque: input.marque ?? null,
					capacite: input.capacite,
					chauffeurNom: input.chauffeurNom,
					chauffeurTel: input.chauffeurTel,
				})
				.returning();
			return vehicule;
		}),

	update: protectedProcedure
		.input(updateVehiculeSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const updateData: Record<string, unknown> = {};
			if (data.immatriculation !== undefined) updateData.immatriculation = data.immatriculation;
			if (data.marque !== undefined) updateData.marque = data.marque;
			if (data.capacite !== undefined) updateData.capacite = data.capacite;
			if (data.chauffeurNom !== undefined) updateData.chauffeurNom = data.chauffeurNom;
			if (data.chauffeurTel !== undefined) updateData.chauffeurTel = data.chauffeurTel;

			const [vehicule] = await ctx.db
				.update(vehicules)
				.set(updateData)
				.where(eq(vehicules.id, id))
				.returning();
			return vehicule;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(vehicules).where(eq(vehicules.id, input.id));
			return { success: true };
		}),
});

const itinerairesRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const rows = await ctx.db
			.select({
				id: itineraires.id,
				nom: itineraires.nom,
				vehiculeId: itineraires.vehiculeId,
				description: itineraires.description,
				createdAt: itineraires.createdAt,
				vehiculeImmatriculation: vehicules.immatriculation,
				vehiculeMarque: vehicules.marque,
				arretsCount: sql<number>`(SELECT COUNT(*) FROM arrets WHERE arrets.itineraire_id = ${itineraires.id})::int`,
			})
			.from(itineraires)
			.leftJoin(vehicules, eq(itineraires.vehiculeId, vehicules.id))
			.orderBy(itineraires.nom);

		return rows;
	}),

	create: protectedProcedure
		.input(createItineraireSchema)
		.mutation(async ({ ctx, input }) => {
			const [itineraire] = await ctx.db
				.insert(itineraires)
				.values({
					nom: input.nom,
					vehiculeId: input.vehiculeId ?? null,
					description: input.description ?? null,
				})
				.returning();
			return itineraire;
		}),

	update: protectedProcedure
		.input(updateItineraireSchema)
		.mutation(async ({ ctx, input }) => {
			const { id, ...data } = input;
			const updateData: Record<string, unknown> = {};
			if (data.nom !== undefined) updateData.nom = data.nom;
			if (data.vehiculeId !== undefined) updateData.vehiculeId = data.vehiculeId;
			if (data.description !== undefined) updateData.description = data.description;

			const [itineraire] = await ctx.db
				.update(itineraires)
				.set(updateData)
				.where(eq(itineraires.id, id))
				.returning();
			return itineraire;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(itineraires).where(eq(itineraires.id, input.id));
			return { success: true };
		}),
});

const arretsRouter = createTRPCRouter({
	listByItineraire: protectedProcedure
		.input(z.object({ itineraireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.query.arrets.findMany({
				where: eq(arrets.itineraireId, input.itineraireId),
				orderBy: [arrets.ordre],
			});
		}),

	create: protectedProcedure
		.input(createArretSchema)
		.mutation(async ({ ctx, input }) => {
			const [arret] = await ctx.db
				.insert(arrets)
				.values({
					itineraireId: input.itineraireId,
					nom: input.nom,
					ordre: input.ordre,
					heurePassage: input.heurePassage ?? null,
				})
				.returning();
			return arret;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db.delete(arrets).where(eq(arrets.id, input.id));
			return { success: true };
		}),
});

const affectationsRouter = createTRPCRouter({
	list: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const rows = await ctx.db
				.select({
					id: affectationsTransport.id,
					eleveId: affectationsTransport.eleveId,
					itineraireId: affectationsTransport.itineraireId,
					arretId: affectationsTransport.arretId,
					anneeScolaireId: affectationsTransport.anneeScolaireId,
					elevePrenom: eleves.prenom,
					eleveNom: eleves.nom,
					eleveMatricule: eleves.matricule,
					itineraireNom: itineraires.nom,
					arretNom: arrets.nom,
				})
				.from(affectationsTransport)
				.innerJoin(eleves, eq(affectationsTransport.eleveId, eleves.id))
				.innerJoin(itineraires, eq(affectationsTransport.itineraireId, itineraires.id))
				.innerJoin(arrets, eq(affectationsTransport.arretId, arrets.id))
				.where(eq(affectationsTransport.anneeScolaireId, input.anneeScolaireId));

			return rows;
		}),

	create: protectedProcedure
		.input(createAffectationSchema)
		.mutation(async ({ ctx, input }) => {
			const [affectation] = await ctx.db
				.insert(affectationsTransport)
				.values({
					eleveId: input.eleveId,
					itineraireId: input.itineraireId,
					arretId: input.arretId,
					anneeScolaireId: input.anneeScolaireId,
				})
				.returning();
			return affectation;
		}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			await ctx.db
				.delete(affectationsTransport)
				.where(eq(affectationsTransport.id, input.id));
			return { success: true };
		}),
});

export const transportRouter = createTRPCRouter({
	vehicules: vehiculesRouter,
	itineraires: itinerairesRouter,
	arrets: arretsRouter,
	affectations: affectationsRouter,
});
