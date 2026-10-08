import { z } from "zod";

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const prefixe = z
	.string()
	.trim()
	.regex(/^[A-Z0-9]{2,10}$/, "2 à 10 caractères : lettres majuscules et chiffres uniquement");

export const updateParametresSchema = z.object({
	nom: z.string().trim().min(2, "Nom requis").max(150),
	sigle: z.string().trim().min(1, "Sigle requis").max(30),
	adresse: optionalText(255),
	telephone1: optionalText(30),
	telephone2: optionalText(30),
	email: z
		.string()
		.trim()
		.optional()
		.nullable()
		.transform((v) => (v ? v : null))
		.pipe(z.email("Email invalide").nullable()),
	contactsEntete: optionalText(500),
	prefixeMatricule: prefixe,
	prefixeRecu: prefixe,
	prefixeEmploye: prefixe,
});

export type UpdateParametresInput = z.input<typeof updateParametresSchema>;
