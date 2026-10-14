import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { anneesScolaires, classes, niveaux } from "@/modules/academic/schema";
import { differences, journaliser } from "@/modules/audit/journal";
import { paiements, reductions } from "@/modules/finance/schema";
import { getParametres } from "@/modules/settings/service";
import { affectationsTransport } from "@/modules/transport/schema";
import { db } from "@/shared/lib/db";
import { nextSequence } from "@/shared/lib/sequence";
import { adminProcedure, createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { generateMatricule } from "@/shared/lib/utils";
import { trouverDoublon } from "./noms";
import { eleveParents, eleves, inscriptions, parents, passageDecisions } from "./schema";
import {
	addParentSchema,
	createStudentSchema,
	type ParentInput,
	studentFiltersSchema,
	updateParentSchema,
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
					anneeScolaireId: eleves.anneeScolaireId,
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

			// Doublon : même prénom, nom (casse et espaces ignorés) et date de naissance cette année (D-025)
			const doublon = await trouverDoublon(tx, input);
			if (doublon)
				throw new TRPCError({
					code: "CONFLICT",
					message: `Cet élève est déjà inscrit cette année (matricule ${doublon.matricule}). Ouvrez sa fiche au lieu de le réinscrire.`,
				});

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

	/** Modification par l'administrateur : doublons, classe de la même année, inscription, journal (D-026). */
	update: adminProcedure.input(updateStudentSchema).mutation(async ({ ctx, input }) => {
		const { id, ...data } = input;
		return await db.transaction(async (tx) => {
			const [avant] = await tx
				.select({
					id: eleves.id,
					matricule: eleves.matricule,
					prenom: eleves.prenom,
					nom: eleves.nom,
					dateNaissance: eleves.dateNaissance,
					lieuNaissance: eleves.lieuNaissance,
					sexe: eleves.sexe,
					adresse: eleves.adresse,
					statut: eleves.statut,
					classeId: eleves.classeId,
					anneeScolaireId: eleves.anneeScolaireId,
					classeNom: classes.nom,
					niveauId: classes.niveauId,
				})
				.from(eleves)
				.innerJoin(classes, eq(eleves.classeId, classes.id))
				.where(eq(eleves.id, id));
			if (!avant) throw new TRPCError({ code: "NOT_FOUND", message: "Élève non trouvé" });

			const champs = {
				prenom: data.prenom?.trim() || avant.prenom,
				nom: data.nom?.trim() || avant.nom,
				dateNaissance: data.dateNaissance || avant.dateNaissance,
				lieuNaissance:
					data.lieuNaissance !== undefined ? data.lieuNaissance || null : avant.lieuNaissance,
				sexe: data.sexe ?? avant.sexe,
				adresse: data.adresse !== undefined ? data.adresse || null : avant.adresse,
				statut: data.statut ?? avant.statut,
				classeId: data.classeId ?? avant.classeId,
			};

			// Classe : uniquement une classe de l'année de l'élève
			let classe = { nom: avant.classeNom, niveauId: avant.niveauId };
			if (champs.classeId !== avant.classeId) {
				const [cible] = await tx
					.select({
						nom: classes.nom,
						niveauId: classes.niveauId,
						anneeScolaireId: classes.anneeScolaireId,
					})
					.from(classes)
					.where(eq(classes.id, champs.classeId));
				if (!cible || cible.anneeScolaireId !== avant.anneeScolaireId)
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "La nouvelle classe doit appartenir à la même année scolaire que l'élève.",
					});
				classe = cible;
			}

			// Identité changée : même contrôle des doublons qu'à l'inscription (D-025)
			const identiteChangee =
				champs.prenom !== avant.prenom ||
				champs.nom !== avant.nom ||
				champs.dateNaissance !== avant.dateNaissance;
			if (identiteChangee) {
				const doublon = await trouverDoublon(tx, {
					anneeScolaireId: avant.anneeScolaireId,
					prenom: champs.prenom,
					nom: champs.nom,
					dateNaissance: champs.dateNaissance,
					exclureId: id,
				});
				if (doublon)
					throw new TRPCError({
						code: "CONFLICT",
						message: `Cet élève est déjà inscrit cette année (matricule ${doublon.matricule}).`,
					});
			}

			const diff = differences(
				{ ...avant, classe: avant.classeNom },
				{ ...champs, classe: classe.nom },
			);
			if (!diff) return { eleve: avant, niveauChange: false, niveauNom: null };
			const { classeId: _a, ...diffAvant } = diff.avant;
			const { classeId: _b, ...diffApres } = diff.apres;

			const [eleve] = await tx
				.update(eleves)
				.set({ ...champs, updatedAt: new Date() })
				.where(eq(eleves.id, id))
				.returning();
			if (champs.classeId !== avant.classeId) {
				await tx
					.update(inscriptions)
					.set({ classeId: champs.classeId })
					.where(
						and(
							eq(inscriptions.eleveId, id),
							eq(inscriptions.anneeScolaireId, avant.anneeScolaireId),
						),
					);
			}
			await journaliser(tx, {
				userId: ctx.admin.id,
				userNom: ctx.admin.nom,
				entite: "eleve",
				entiteId: id,
				action: "modification",
				libelle: `${avant.matricule} — ${champs.prenom} ${champs.nom}`,
				avant: diffAvant,
				apres: diffApres,
			});
			const niveauChange = classe.niveauId !== avant.niveauId;
			let niveauNom: string | null = null;
			if (niveauChange) {
				const [n] = await tx
					.select({ nom: niveaux.nom })
					.from(niveaux)
					.where(eq(niveaux.id, classe.niveauId));
				niveauNom = n?.nom ?? null;
			}
			return { eleve, niveauChange, niveauNom };
		});
	}),

	/** Modification d'un contact (parent) par l'administrateur ; renvoie le nombre d'enfants liés. */
	updateParent: adminProcedure.input(updateParentSchema).mutation(async ({ ctx, input }) => {
		const { parentId, eleveId, ...champs } = input;
		return await db.transaction(async (tx) => {
			const [avant] = await tx
				.select()
				.from(parents)
				.innerJoin(eleveParents, eq(eleveParents.parentId, parents.id))
				.where(and(eq(parents.id, parentId), eq(eleveParents.eleveId, eleveId)));
			if (!avant) throw new TRPCError({ code: "NOT_FOUND", message: "Contact introuvable" });
			const p = avant.parents;
			const apres = {
				prenom: champs.prenom,
				nom: champs.nom,
				telephone: champs.telephone,
				telephone2: champs.telephone2 || null,
				profession: champs.profession || null,
				adresse: champs.adresse || null,
				relation: champs.relation,
			};
			const [{ partage }] = await tx
				.select({ partage: count() })
				.from(eleveParents)
				.where(eq(eleveParents.parentId, parentId));
			const diff = differences(p as unknown as Record<string, unknown>, apres);
			if (!diff) return { partage };
			await tx.update(parents).set(apres).where(eq(parents.id, parentId));
			await journaliser(tx, {
				userId: ctx.admin.id,
				userNom: ctx.admin.nom,
				entite: "contact",
				entiteId: parentId,
				action: "modification",
				libelle: `${apres.prenom} ${apres.nom} (${apres.telephone})`,
				avant: diff.avant,
				apres: diff.apres,
			});
			return { partage };
		});
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

	/** Suppression d'une fiche sans paiement (doublon) ; sinon « Retirer de l'école » (D-026). */
	delete: adminProcedure
		.input(z.object({ id: z.string().uuid() }))
		.mutation(async ({ ctx, input }) => {
			return await db.transaction(async (tx) => {
				const [eleve] = await tx.select().from(eleves).where(eq(eleves.id, input.id));
				if (!eleve) throw new TRPCError({ code: "NOT_FOUND", message: "Élève non trouvé" });
				const [{ nb }] = await tx
					.select({ nb: count() })
					.from(paiements)
					.where(eq(paiements.eleveId, input.id));
				if (nb > 0)
					throw new TRPCError({
						code: "BAD_REQUEST",
						message:
							"Cet élève a des paiements : utilisez « Retirer de l'école » pour garder la comptabilité.",
					});
				const liens = await tx
					.select({ parentId: eleveParents.parentId })
					.from(eleveParents)
					.where(eq(eleveParents.eleveId, input.id));
				await tx.delete(affectationsTransport).where(eq(affectationsTransport.eleveId, input.id));
				await tx.delete(reductions).where(eq(reductions.eleveId, input.id));
				await tx.delete(passageDecisions).where(eq(passageDecisions.eleveId, input.id));
				await tx.delete(inscriptions).where(eq(inscriptions.eleveId, input.id));
				await tx.delete(eleveParents).where(eq(eleveParents.eleveId, input.id));
				await tx.delete(eleves).where(eq(eleves.id, input.id));
				// Parents qui n'ont plus d'enfant
				for (const { parentId } of liens) {
					const [{ reste }] = await tx
						.select({ reste: count() })
						.from(eleveParents)
						.where(eq(eleveParents.parentId, parentId));
					if (reste === 0) await tx.delete(parents).where(eq(parents.id, parentId));
				}
				await journaliser(tx, {
					userId: ctx.admin.id,
					userNom: ctx.admin.nom,
					entite: "eleve",
					entiteId: input.id,
					action: "suppression",
					libelle: `${eleve.matricule} — ${eleve.prenom} ${eleve.nom}`,
					avant: eleve,
					apres: null,
				});
				return { success: true };
			});
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
