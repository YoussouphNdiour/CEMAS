import { type AnyColumn, and, eq, ne, type SQL, sql } from "drizzle-orm";
import type { db } from "@/shared/lib/db";
import { eleves } from "./schema";

/** Nom comparable : formes Unicode unifiées, espaces/tabulations/insécables réduits à une espace, minuscules. */
export const normaliserNom = (v: string) =>
	v.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Même normalisation côté PostgreSQL (l'espace insécable n'est pas dans \s). */
export const nomNormaliseSql = (c: AnyColumn): SQL =>
	sql`lower(trim(regexp_replace(${c}, '[\\s' || chr(160) || ']+', ' ', 'g')))`;

type Tx = Pick<typeof db, "select" | "execute">;

/**
 * Autre fiche de la même année avec les mêmes prénom, nom et date de naissance (D-025).
 * Prend d'abord un verrou de transaction pour sérialiser deux demandes identiques simultanées.
 */
export async function trouverDoublon(
	tx: Tx,
	p: {
		anneeScolaireId: string;
		prenom: string;
		nom: string;
		dateNaissance: string;
		exclureId?: string;
	},
): Promise<{ matricule: string } | undefined> {
	const prenom = normaliserNom(p.prenom);
	const nom = normaliserNom(p.nom);
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext(${`${p.anneeScolaireId}:${prenom}:${nom}:${p.dateNaissance}`}))`,
	);
	const [doublon] = await tx
		.select({ matricule: eleves.matricule })
		.from(eleves)
		.where(
			and(
				eq(eleves.anneeScolaireId, p.anneeScolaireId),
				eq(eleves.dateNaissance, p.dateNaissance),
				sql`${nomNormaliseSql(eleves.prenom)} = ${prenom}`,
				sql`${nomNormaliseSql(eleves.nom)} = ${nom}`,
				p.exclureId ? ne(eleves.id, p.exclureId) : undefined,
			),
		)
		.limit(1);
	return doublon;
}
