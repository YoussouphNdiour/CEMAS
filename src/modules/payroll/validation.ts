import { z } from "zod";

export const createEmployeSchema = z.object({
	prenom: z.string().min(1, "Prénom requis"),
	nom: z.string().min(1, "Nom requis"),
	telephone: z.string().optional(),
	poste: z.string().min(1, "Poste requis"),
	type: z.enum(["enseignant", "administratif", "entretien"]),
	salaireBase: z.number().int().positive("Le salaire doit être positif"),
	dateEmbauche: z.string().min(1, "Date d'embauche requise"),
});

export const updateEmployeSchema = z.object({
	id: z.string().uuid(),
	prenom: z.string().min(1).optional(),
	nom: z.string().min(1).optional(),
	telephone: z.string().optional(),
	poste: z.string().min(1).optional(),
	type: z.enum(["enseignant", "administratif", "entretien"]).optional(),
	salaireBase: z.number().int().positive().optional(),
	dateEmbauche: z.string().min(1).optional(),
});

export const generateBulletinsSchema = z.object({
	mois: z.number().int().min(1).max(12),
	annee: z.number().int(),
});

export const updateBulletinSchema = z.object({
	id: z.string().uuid(),
	primes: z.number().int().min(0, "Les primes doivent être >= 0"),
	retenues: z.number().int().min(0, "Les retenues doivent être >= 0"),
	note: z.string().optional(),
});
