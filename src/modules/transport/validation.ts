import { z } from "zod";

export const createVehiculeSchema = z.object({
	immatriculation: z.string().min(1, "L'immatriculation est requise"),
	marque: z.string().optional(),
	capacite: z.number().int().min(1, "La capacité doit être au moins 1"),
	chauffeurNom: z.string().min(1, "Le nom du chauffeur est requis"),
	chauffeurTel: z.string().min(1, "Le téléphone du chauffeur est requis"),
});

export const updateVehiculeSchema = z.object({
	id: z.string().uuid(),
	immatriculation: z.string().min(1).optional(),
	marque: z.string().optional(),
	capacite: z.number().int().min(1).optional(),
	chauffeurNom: z.string().min(1).optional(),
	chauffeurTel: z.string().min(1).optional(),
});

export const createItineraireSchema = z.object({
	nom: z.string().min(1, "Le nom est requis"),
	vehiculeId: z.string().uuid().optional(),
	description: z.string().optional(),
});

export const updateItineraireSchema = z.object({
	id: z.string().uuid(),
	nom: z.string().min(1).optional(),
	vehiculeId: z.string().uuid().nullable().optional(),
	description: z.string().optional(),
});

export const createArretSchema = z.object({
	itineraireId: z.string().uuid(),
	nom: z.string().min(1, "Le nom est requis"),
	ordre: z.number().int().min(1, "L'ordre doit être au moins 1"),
	heurePassage: z.string().optional(),
});

export const createAffectationSchema = z.object({
	eleveId: z.string().uuid(),
	itineraireId: z.string().uuid(),
	arretId: z.string().uuid(),
	anneeScolaireId: z.string().uuid(),
});
