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
