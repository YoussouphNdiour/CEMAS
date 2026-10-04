import { z } from "zod";

export const createPaiementSchema = z.object({
	eleveId: z.string().uuid("Élève requis"),
	typeFraisId: z.string().uuid("Type de frais requis"),
	anneeScolaireId: z.string().uuid("Année scolaire requise"),
	mois: z.number().int().min(1).max(12),
	montant: z.number().int().positive("Le montant doit être positif"),
});

export const createDepenseSchema = z.object({
	categorieId: z.string().uuid("Catégorie requise"),
	anneeScolaireId: z.string().uuid("Année scolaire requise"),
	libelle: z.string().min(1, "Libellé requis"),
	montant: z.number().int().positive("Le montant doit être positif"),
	date: z.string().min(1, "Date requise"),
	note: z.string().optional(),
});

export const createRecetteSchema = z.object({
	categorieId: z.string().uuid("Catégorie requise"),
	anneeScolaireId: z.string().uuid("Année scolaire requise"),
	libelle: z.string().min(1, "Libellé requis"),
	montant: z.number().int().positive("Le montant doit être positif"),
	date: z.string().min(1, "Date requise"),
	note: z.string().optional(),
});

export const bilanFiltersSchema = z.object({
	anneeScolaireId: z.string().uuid("Année scolaire requise"),
	moisDebut: z.number().int().min(1).max(12).optional(),
	moisFin: z.number().int().min(1).max(12).optional(),
});

export const grilleFraisSchema = z.object({
	classeId: z.string().uuid("Classe requise"),
	typeFraisId: z.string().uuid("Type de frais requis"),
	anneeScolaireId: z.string().uuid("Année scolaire requise"),
	montantMensuel: z.number().int().positive("Le montant doit être positif"),
});
