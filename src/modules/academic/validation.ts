import { z } from "zod";

export const createAnneeSchema = z.object({
	libelle: z.string().min(1, "Le libellé est requis"),
	dateDebut: z.string(),
	dateFin: z.string(),
});

export const updateAnneeSchema = z.object({
	id: z.string().uuid(),
	libelle: z.string().min(1).optional(),
	dateDebut: z.string().optional(),
	dateFin: z.string().optional(),
});

export const createClasseSchema = z.object({
	nom: z.string().min(1, "Le nom est requis"),
	niveauId: z.string().uuid(),
	capacite: z.number().int().min(1, "La capacité doit être au moins 1"),
	anneeScolaireId: z.string().uuid(),
});

export const updateClasseSchema = z.object({
	id: z.string().uuid(),
	nom: z.string().min(1).optional(),
	capacite: z.number().int().min(1).optional(),
	classeSuivanteId: z.string().uuid().nullable().optional(),
	finDeCycle: z.boolean().optional(),
});

export const configurerClassesSchema = z.object({
	classes: z
		.array(
			z.object({
				id: z.string().uuid(),
				classeSuivanteId: z.string().uuid().nullable(),
				finDeCycle: z.boolean(),
			}),
		)
		.min(1)
		.max(500),
});

export const decisionsSchema = z.record(z.string().uuid(), z.enum(["passe", "redouble", "quitte"]));

export const executerPassageSchema = z.object({
	cible: z.object({
		libelle: z.string().trim().min(1, "Libellé requis").max(20),
		dateDebut: z.string().min(1),
		dateFin: z.string().min(1),
	}),
	decisions: decisionsSchema,
});

export const createMatiereSchema = z.object({
	nom: z.string().min(1, "Le nom est requis"),
	coefficient: z.number().int().min(1, "Le coefficient doit être au moins 1"),
	niveauId: z.string().uuid(),
});

export const updateMatiereSchema = z.object({
	id: z.string().uuid(),
	nom: z.string().min(1).optional(),
	coefficient: z.number().int().min(1).optional(),
});
