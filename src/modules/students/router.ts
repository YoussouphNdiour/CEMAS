import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { anneesScolaires, classes, niveaux } from "@/modules/academic/schema";
import { getParametres } from "@/modules/settings/service";
import { db } from "@/shared/lib/db";
import { nextSequence } from "@/shared/lib/sequence";
import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { generateMatricule } from "@/shared/lib/utils";
import { eleveParents, eleves, inscriptions, parents } from "./schema";
import {
	addParentSchema,
	createStudentSchema,
	type ParentInput,
	studentFiltersSchema,
	updateStudentSchema,
} from "./validation";

const MAX_CONTACTS = 2;

/** Insère un parent et le lie à l'élève. */
async function insertContact(
	tx: Pick<typeof db, "insert">,
	eleveId: string,
	parent: ParentInput,
	principal: boolean,
) {
	const [created] = await tx
		.insert(parents)
		.values({
			prenom: parent.prenom,
			nom: parent.nom,
			telephone: parent.telephone,
			telephone2: parent.telephone2 || null,
			profession: parent.profession || null,
			adresse: parent.adresse || null,
			relation: parent.relation,
		})
		.returning();
	await tx.insert(eleveParents).values({ eleveId, parentId: created.id, principal });
	return created;
}

export const studentsRouter = createTRPCRouter({
	list: protectedProcedure.input(studentFiltersSchema).query(async ({ input }) => {
		const conditions = [eq(eleves.anneeScolaireId, input.anneeScolaireId)];

		if (input.classeId) {
			conditions.push(eq(eleves.classeId, input.classeId));
		}
		if (input.statut) {
			conditions.push(eq(eleves.statut, input.statut));
		}
		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				or(
					ilike(eleves.prenom, search),
					ilike(eleves.nom, search),
					ilike(eleves.matricule, search),
				)!,
			);
		}
		if (input.niveauId) {
			conditions.push(eq(niveaux.id, input.niveauId));
		}

		return db
			.select({
				id: eleves.id,
				matricule: eleves.matricule,
				prenom: eleves.prenom,
				nom: eleves.nom,
				dateNaissance: eleves.dateNaissance,
				sexe: eleves.sexe,
				statut: eleves.statut,
				classeNom: classes.nom,
				niveauNom: niveaux.nom,
				niveauId: niveaux.id,
			})
			.from(eleves)
			.innerJoin(classes, eq(eleves.classeId, classes.id))
			.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
			.where(and(...conditions))
			.orderBy(desc(eleves.createdAt));
	}),

	getById: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.query(async ({ input }) => {
			const [student] = await db
				.select({
					id: eleves.id,
					matricule: eleves.matricule,
					prenom: eleves.prenom,
					nom: eleves.nom,
					dateNaissance: eleves.dateNaissance,
					lieuNaissance: eleves.lieuNaissance,
					sexe: eleves.sexe,
					adresse: eleves.adresse,
					photoUrl: eleves.photoUrl,
					statut: eleves.statut,
					classeId: eleves.classeId,
					classeNom: classes.nom,
					niveauNom: niveaux.nom,
					createdAt: eleves.createdAt,
				})
				.from(eleves)
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
				.where(eq(eleves.id, input.id));

			if (!student) throw new Error("Élève non trouvé");

			// Fetch parents
			const studentParents = await db
				.select({
					id: parents.id,
					prenom: parents.prenom,
					nom: parents.nom,
					telephone: parents.telephone,
					telephone2: parents.telephone2,
					profession: parents.profession,
					adresse: parents.adresse,
					relation: parents.relation,
					principal: eleveParents.principal,
				})
				.from(parents)
				.innerJoin(eleveParents, eq(parents.id, eleveParents.parentId))
				.where(eq(eleveParents.eleveId, input.id))
				.orderBy(desc(eleveParents.principal), parents.createdAt);

			return { ...student, parents: studentParents };
		}),

	create: protectedProcedure.input(createStudentSchema).mutation(async ({ input }) => {
		// Read outside the transaction: a missing settings table would abort it
		const { prefixeMatricule } = await getParametres(db);
		return await db.transaction(async (tx) => {
			// Get year for matricule
			const [annee] = await tx
				.select()
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.anneeScolaireId));
			const year = annee ? parseInt(annee.libelle.split("-")[0], 10) : new Date().getFullYear();

			// Next sequence number for the configured prefix
			const seq = await nextSequence(
				tx,
				eleves,
				eleves.matricule,
				`^${prefixeMatricule}-${year}-(\\d+)$`,
			);
			const matricule = generateMatricule(prefixeMatricule, year, seq);

			// Insert student
			const [student] = await tx
				.insert(eleves)
				.values({
					matricule,
					prenom: input.prenom,
					nom: input.nom,
					dateNaissance: input.dateNaissance,
					lieuNaissance: input.lieuNaissance || null,
					sexe: input.sexe,
					adresse: input.adresse || null,
					classeId: input.classeId,
					anneeScolaireId: input.anneeScolaireId,
				})
				.returning();

			// Contacts: principal, then optional second contact
			await insertContact(tx, student.id, input.parent, true);
			if (input.parent2) {
				await insertContact(tx, student.id, input.parent2, false);
			}

			// Create inscription
			await tx.insert(inscriptions).values({
				eleveId: student.id,
				classeId: input.classeId,
				anneeScolaireId: input.anneeScolaireId,
				statut: "confirmee",
			});

			return student;
		});
	}),

	update: protectedProcedure.input(updateStudentSchema).mutation(async ({ input }) => {
		const { id, ...data } = input;
		const updateData: Record<string, unknown> = {};
		if (data.prenom) updateData.prenom = data.prenom;
		if (data.nom) updateData.nom = data.nom;
		if (data.dateNaissance) updateData.dateNaissance = data.dateNaissance;
		if (data.lieuNaissance !== undefined) updateData.lieuNaissance = data.lieuNaissance;
		if (data.sexe) updateData.sexe = data.sexe;
		if (data.adresse !== undefined) updateData.adresse = data.adresse;
		if (data.classeId) updateData.classeId = data.classeId;
		if (data.statut) updateData.statut = data.statut;
		updateData.updatedAt = new Date();

		const [updated] = await db.update(eleves).set(updateData).where(eq(eleves.id, id)).returning();
		return updated;
	}),

	/** Ajoute le 2e contact d'un élève existant (2 contacts au maximum). */
	addParent: protectedProcedure.input(addParentSchema).mutation(async ({ input }) => {
		return await db.transaction(async (tx) => {
			const [eleve] = await tx
				.select({ id: eleves.id })
				.from(eleves)
				.where(eq(eleves.id, input.eleveId));
			if (!eleve) throw new TRPCError({ code: "NOT_FOUND", message: "Élève non trouvé" });

			const [{ total }] = await tx
				.select({ total: count() })
				.from(eleveParents)
				.where(eq(eleveParents.eleveId, input.eleveId));
			if (total >= MAX_CONTACTS) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Cet élève a déjà ${MAX_CONTACTS} contacts.`,
				});
			}

			return insertContact(tx, input.eleveId, input.parent, total === 0);
		});
	}),

	delete: protectedProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ input }) => {
			await db.delete(eleves).where(eq(eleves.id, input.id));
			return { success: true };
		}),

	count: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ input }) => {
			const results = await db
				.select({
					niveauNom: niveaux.nom,
					count: count(),
				})
				.from(eleves)
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
				.where(and(eq(eleves.anneeScolaireId, input.anneeScolaireId), eq(eleves.statut, "actif")))
				.groupBy(niveaux.nom);

			const total = results.reduce((sum, r) => sum + r.count, 0);
			const byNiveau = Object.fromEntries(results.map((r) => [r.niveauNom, r.count]));

			return { total, byNiveau };
		}),
});
