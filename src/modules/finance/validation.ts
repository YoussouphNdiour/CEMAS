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

export const upsertGrilleSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	cellules: z
		.array(
			z.object({
				classeId: z.string().uuid(),
				typeFraisId: z.string().uuid(),
				montant: z.number().int("Montant entier requis").min(0, "Le montant doit être positif"),
			}),
		)
		.min(1)
		.max(200),
});

export const impayesFiltersSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	classeId: z.string().uuid().optional(),
	niveauId: z.string().uuid().optional(),
});

export const enregistrerTarifsSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	niveauId: z.string().uuid(),
	lignes: z
		.array(
			z.object({
				libelle: z.string().trim().min(1, "Libellé requis").max(60),
				montant: z.number().int().min(0, "Montant positif requis"),
				typeFraisId: z.string().uuid().nullable(),
			}),
		)
		.max(10),
	echeancier: z
		.array(
			z.object({
				mois: z
					.number()
					.int()
					.min(1)
					.max(12)
					.refine((m) => m !== 10, "Octobre est inclus dans le forfait d'inscription"),
				montant: z.number().int().min(0),
			}),
		)
		.max(11),
});

export const enregistrerReductionSchema = z
	.object({
		eleveId: z.string().uuid(),
		type: z.enum(["fratrie", "personnel", "negociee", "bourse"]),
		portee: z.enum(["forfait", "mensualites", "les_deux"]),
		mode: z.enum(["montant", "pourcentage"]),
		valeur: z.number().int().min(1, "Valeur requise"),
		motif: z.string().trim().max(200).optional(),
	})
	.refine((r) => r.mode !== "pourcentage" || r.valeur <= 100, {
		message: "Un pourcentage ne peut pas dépasser 100",
		path: ["valeur"],
	});
