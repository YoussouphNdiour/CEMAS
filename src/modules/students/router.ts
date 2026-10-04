import { createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import { eleves, parents, eleveParents, inscriptions } from "./schema";
import { classes, niveaux, anneesScolaires } from "@/modules/academic/schema";
import { createStudentSchema, updateStudentSchema, studentFiltersSchema } from "./validation";
import { eq, and, desc, ilike, or, sql, count } from "drizzle-orm";
import { generateMatricule } from "@/shared/lib/utils";

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
				})
				.from(parents)
				.innerJoin(eleveParents, eq(parents.id, eleveParents.parentId))
				.where(eq(eleveParents.eleveId, input.id));

			return { ...student, parents: studentParents };
		}),

	create: protectedProcedure.input(createStudentSchema).mutation(async ({ input }) => {
		return await db.transaction(async (tx) => {
			// Get year for matricule
			const [annee] = await tx
				.select()
				.from(anneesScolaires)
				.where(eq(anneesScolaires.id, input.anneeScolaireId));
			const year = annee ? parseInt(annee.libelle.split("-")[0]) : new Date().getFullYear();

			// Get next sequence number
			const [maxResult] = await tx
				.select({ maxMatricule: sql<string>`MAX(${eleves.matricule})` })
				.from(eleves)
				.where(ilike(eleves.matricule, `CEMAS-${year}-%`));

			let seq = 1;
			if (maxResult?.maxMatricule) {
				const parts = maxResult.maxMatricule.split("-");
				seq = parseInt(parts[2]) + 1;
			}

			const matricule = generateMatricule("CEMAS", year, seq);

			// Insert parent
			const [parent] = await tx
				.insert(parents)
				.values({
					prenom: input.parent.prenom,
					nom: input.parent.nom,
					telephone: input.parent.telephone,
					telephone2: input.parent.telephone2 || null,
					profession: input.parent.profession || null,
					adresse: input.parent.adresse || null,
					relation: input.parent.relation,
				})
				.returning();

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

			// Link parent to student
			await tx.insert(eleveParents).values({
				eleveId: student.id,
				parentId: parent.id,
			});

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

		const [updated] = await db
			.update(eleves)
			.set(updateData)
			.where(eq(eleves.id, id))
			.returning();
		return updated;
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
				.where(
					and(
						eq(eleves.anneeScolaireId, input.anneeScolaireId),
						eq(eleves.statut, "actif"),
					),
				)
				.groupBy(niveaux.nom);

			const total = results.reduce((sum, r) => sum + r.count, 0);
			const byNiveau = Object.fromEntries(results.map((r) => [r.niveauNom, r.count]));

			return { total, byNiveau };
		}),
});
