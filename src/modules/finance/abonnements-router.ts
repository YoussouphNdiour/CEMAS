import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { anneesScolaires, classes } from "@/modules/academic/schema";
import { differences, journaliser } from "@/modules/audit/journal";
import { eleves } from "@/modules/students/schema";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { MOIS_LABELS } from "@/shared/lib/utils";
import { DERNIER_MOIS_SERVICE, moisDusAbonnement, ordreScolaire } from "./abonnements";
import { moisDus } from "./impayes";
import { abonnements, paiements, typesFrais } from "./schema";

type Tx = Parameters<Parameters<typeof import("@/shared/lib/db").db.transaction>[0]>[0];

const cible = z.object({ eleveId: z.string().uuid(), typeFraisId: z.string().uuid() });
const mois = z.number().int().min(1).max(12);

/** Élève (année, libellé) et service à abonnement, sinon erreur claire. */
async function contexte(tx: Tx, eleveId: string, typeFraisId: string) {
	const [eleve] = await tx
		.select({
			id: eleves.id,
			anneeScolaireId: eleves.anneeScolaireId,
			libelle: eleves.matricule,
			prenom: eleves.prenom,
			nom: eleves.nom,
		})
		.from(eleves)
		.where(eq(eleves.id, eleveId));
	if (!eleve) throw new TRPCError({ code: "NOT_FOUND", message: "Élève non trouvé" });
	const [service] = await tx
		.select()
		.from(typesFrais)
		.where(and(eq(typesFrais.id, typeFraisId), eq(typesFrais.abonnement, true)));
	if (!service)
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Ce frais n'est pas un service à abonnement",
		});
	return {
		eleve,
		service,
		libelle: `${service.nom} — ${eleve.libelle} ${eleve.prenom} ${eleve.nom}`,
	};
}

async function abonnementExistant(
	tx: Tx,
	eleveId: string,
	typeFraisId: string,
	anneeScolaireId: string,
) {
	const [a] = await tx
		.select()
		.from(abonnements)
		.where(
			and(
				eq(abonnements.eleveId, eleveId),
				eq(abonnements.typeFraisId, typeFraisId),
				eq(abonnements.anneeScolaireId, anneeScolaireId),
			),
		)
		.for("update");
	return a;
}

const sansAbonnement = () =>
	new TRPCError({ code: "BAD_REQUEST", message: "L'élève n'est pas abonné à ce service" });

export const servicesRouter = createTRPCRouter({
	/** Services à abonnement (garderie, renforcement, cantine). */
	list: protectedProcedure.query(({ ctx }) =>
		ctx.db.select().from(typesFrais).where(eq(typesFrais.abonnement, true)).orderBy(typesFrais.nom),
	),

	/** Montant mensuel d'un service (administrateur, journalisé). */
	modifierMontant: adminProcedure
		.input(
			z.object({
				typeFraisId: z.string().uuid(),
				montant: z.number().int().min(1, "Montant requis").max(1_000_000),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return ctx.db.transaction(async (tx) => {
				const [service] = await tx
					.select()
					.from(typesFrais)
					.where(and(eq(typesFrais.id, input.typeFraisId), eq(typesFrais.abonnement, true)))
					.for("update");
				if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Service introuvable" });
				const diff = differences({ montant: service.montantDefaut }, { montant: input.montant });
				if (!diff) return service;
				const [modifie] = await tx
					.update(typesFrais)
					.set({ montantDefaut: input.montant })
					.where(eq(typesFrais.id, service.id))
					.returning();
				await journaliser(tx, {
					userId: ctx.admin.id,
					userNom: ctx.admin.nom,
					entite: "service",
					entiteId: service.id,
					action: "modification",
					libelle: service.nom,
					avant: diff.avant,
					apres: diff.apres,
				});
				return modifie;
			});
		}),
});

export const abonnementsRouter = createTRPCRouter({
	/** Abonnements d'un élève sur son année. */
	parEleve: protectedProcedure
		.input(z.object({ eleveId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [eleve] = await ctx.db
				.select({ anneeScolaireId: eleves.anneeScolaireId })
				.from(eleves)
				.where(eq(eleves.id, input.eleveId));
			if (!eleve) return [];
			return ctx.db
				.select()
				.from(abonnements)
				.where(
					and(
						eq(abonnements.eleveId, input.eleveId),
						eq(abonnements.anneeScolaireId, eleve.anneeScolaireId),
					),
				);
		}),

	abonner: adminProcedure
		.input(cible.extend({ moisDebut: mois }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.transaction(async (tx) => {
				const c = await contexte(tx, input.eleveId, input.typeFraisId);
				if (ordreScolaire(input.moisDebut) > ordreScolaire(DERNIER_MOIS_SERVICE))
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Le mois de début doit être entre octobre et juin.",
					});
				if (await abonnementExistant(tx, input.eleveId, input.typeFraisId, c.eleve.anneeScolaireId))
					throw new TRPCError({
						code: "CONFLICT",
						message: "L'élève est déjà abonné à ce service",
					});
				const [a] = await tx
					.insert(abonnements)
					.values({
						eleveId: input.eleveId,
						typeFraisId: input.typeFraisId,
						anneeScolaireId: c.eleve.anneeScolaireId,
						moisDebut: input.moisDebut,
					})
					.onConflictDoNothing()
					.returning();
				// Abonnement créé entre-temps par une autre demande
				if (!a)
					throw new TRPCError({
						code: "CONFLICT",
						message: "L'élève est déjà abonné à ce service",
					});
				await journaliser(tx, {
					userId: ctx.admin.id,
					userNom: ctx.admin.nom,
					entite: "abonnement",
					entiteId: a.id,
					action: "modification",
					libelle: c.libelle,
					avant: { abonnement: null },
					apres: { abonnement: `depuis ${MOIS_LABELS[input.moisDebut]}` },
				});
				return a;
			});
		}),

	arreter: adminProcedure
		.input(cible.extend({ moisFin: mois }))
		.mutation(async ({ ctx, input }) => {
			return ctx.db.transaction(async (tx) => {
				const c = await contexte(tx, input.eleveId, input.typeFraisId);
				const a = await abonnementExistant(
					tx,
					input.eleveId,
					input.typeFraisId,
					c.eleve.anneeScolaireId,
				);
				if (!a) throw sansAbonnement();
				const fin = ordreScolaire(input.moisFin);
				if (fin < ordreScolaire(a.moisDebut) || fin > ordreScolaire(DERNIER_MOIS_SERVICE))
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: `Le mois de fin doit être entre ${MOIS_LABELS[a.moisDebut]} et juin.`,
					});
				const [modifie] = await tx
					.update(abonnements)
					.set({ moisFin: input.moisFin })
					.where(eq(abonnements.id, a.id))
					.returning();
				await journaliser(tx, {
					userId: ctx.admin.id,
					userNom: ctx.admin.nom,
					entite: "abonnement",
					entiteId: a.id,
					action: "modification",
					libelle: c.libelle,
					avant: { finAbonnement: a.moisFin ? MOIS_LABELS[a.moisFin] : null },
					apres: { finAbonnement: MOIS_LABELS[input.moisFin] },
				});
				return modifie;
			});
		}),

	reprendre: adminProcedure.input(cible).mutation(async ({ ctx, input }) => {
		return ctx.db.transaction(async (tx) => {
			const c = await contexte(tx, input.eleveId, input.typeFraisId);
			const a = await abonnementExistant(
				tx,
				input.eleveId,
				input.typeFraisId,
				c.eleve.anneeScolaireId,
			);
			if (!a) throw sansAbonnement();
			if (a.moisFin === null) return a;
			const [modifie] = await tx
				.update(abonnements)
				.set({ moisFin: null })
				.where(eq(abonnements.id, a.id))
				.returning();
			await journaliser(tx, {
				userId: ctx.admin.id,
				userNom: ctx.admin.nom,
				entite: "abonnement",
				entiteId: a.id,
				action: "modification",
				libelle: c.libelle,
				avant: { finAbonnement: MOIS_LABELS[a.moisFin] },
				apres: { finAbonnement: null },
			});
			return modifie;
		});
	}),

	/** Suppression (abonnement saisi par erreur), seulement sans paiement du service sur l'année. */
	supprimer: adminProcedure.input(cible).mutation(async ({ ctx, input }) => {
		return ctx.db.transaction(async (tx) => {
			const c = await contexte(tx, input.eleveId, input.typeFraisId);
			const a = await abonnementExistant(
				tx,
				input.eleveId,
				input.typeFraisId,
				c.eleve.anneeScolaireId,
			);
			if (!a) throw sansAbonnement();
			const [{ nb }] = await tx
				.select({ nb: count() })
				.from(paiements)
				.where(
					and(
						eq(paiements.eleveId, input.eleveId),
						eq(paiements.typeFraisId, input.typeFraisId),
						eq(paiements.anneeScolaireId, c.eleve.anneeScolaireId),
					),
				);
			if (nb > 0)
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Des paiements existent pour ce service : utilisez « Arrêter » plutôt que supprimer.",
				});
			await tx.delete(abonnements).where(eq(abonnements.id, a.id));
			await journaliser(tx, {
				userId: ctx.admin.id,
				userNom: ctx.admin.nom,
				entite: "abonnement",
				entiteId: a.id,
				action: "suppression",
				libelle: c.libelle,
				avant: { abonnement: `depuis ${MOIS_LABELS[a.moisDebut]}` },
				apres: null,
			});
			return { success: true };
		});
	}),

	/** Abonnés de l'année par service, avec les mois dus et payés à ce jour. */
	listParService: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const [annee] = await ctx.db
				.select({ dateDebut: anneesScolaires.dateDebut, dateFin: anneesScolaires.dateFin })
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.anneeScolaireId));
			if (!annee) return [];
			const dus = moisDus(annee.dateDebut, annee.dateFin, new Date().toISOString().slice(0, 10));
			const lignes = await ctx.db
				.select({
					typeFraisId: abonnements.typeFraisId,
					eleveId: eleves.id,
					matricule: eleves.matricule,
					prenom: eleves.prenom,
					nom: eleves.nom,
					statut: eleves.statut,
					classeNom: classes.nom,
					moisDebut: abonnements.moisDebut,
					moisFin: abonnements.moisFin,
				})
				.from(abonnements)
				.innerJoin(eleves, eq(abonnements.eleveId, eleves.id))
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.where(eq(abonnements.anneeScolaireId, input.anneeScolaireId))
				.orderBy(classes.nom, eleves.nom, eleves.prenom);
			const payes = await ctx.db
				.select({
					eleveId: paiements.eleveId,
					typeFraisId: paiements.typeFraisId,
					mois: paiements.mois,
				})
				.from(paiements)
				.innerJoin(typesFrais, eq(paiements.typeFraisId, typesFrais.id))
				.where(
					and(
						eq(paiements.anneeScolaireId, input.anneeScolaireId),
						eq(typesFrais.abonnement, true),
					),
				);
			return lignes.map((l) => {
				const moisPayes = new Set(
					payes
						.filter((p) => p.eleveId === l.eleveId && p.typeFraisId === l.typeFraisId)
						.map((p) => p.mois),
				);
				const dusAb = moisDusAbonnement(l, dus);
				return {
					...l,
					moisDus: dusAb.length,
					moisPayes: dusAb.filter((m) => moisPayes.has(m.mois)).length,
				};
			});
		}),
});
