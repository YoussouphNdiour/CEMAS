import { z } from "zod";

export const parentSchema = z.object({
	prenom: z.string().trim().min(1, "Prénom du parent requis"),
	nom: z.string().trim().min(1, "Nom du parent requis"),
	telephone: z.string().trim().min(1, "Téléphone requis"),
	telephone2: z.string().optional(),
	profession: z.string().optional(),
	adresse: z.string().optional(),
	relation: z.enum(["pere", "mere", "tuteur"]),
});

export type ParentInput = z.infer<typeof parentSchema>;

export const createStudentSchema = z.object({
	prenom: z.string().min(1, "Prénom requis"),
	nom: z.string().min(1, "Nom requis"),
	dateNaissance: z.string().min(1, "Date de naissance requise"),
	lieuNaissance: z.string().optional(),
	sexe: z.enum(["M", "F"]),
	adresse: z.string().optional(),
	classeId: z.string().uuid("Classe requise"),
	anneeScolaireId: z.string().uuid(),
	parent: parentSchema,
	/** 2e contact optionnel */
	parent2: parentSchema.optional(),
});

export const addParentSchema = z.object({
	eleveId: z.string().uuid(),
	parent: parentSchema,
});

export const updateStudentSchema = z.object({
	id: z.string().uuid(),
	prenom: z.string().min(1).optional(),
	nom: z.string().min(1).optional(),
	dateNaissance: z.string().optional(),
	lieuNaissance: z.string().optional(),
	sexe: z.enum(["M", "F"]).optional(),
	adresse: z.string().optional(),
	classeId: z.string().uuid().optional(),
	statut: z.enum(["actif", "inactif", "transfere"]).optional(),
});

export const studentFiltersSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	classeId: z.string().uuid().optional(),
	niveauId: z.string().uuid().optional(),
	statut: z.string().optional(),
	search: z.string().optional(),
});
