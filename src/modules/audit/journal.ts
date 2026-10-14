import type { db } from "@/shared/lib/db";
import { journalModifications } from "./schema";

type Executeur = Pick<typeof db, "insert">;
export type EntiteJournal = "eleve" | "contact" | "paiement" | "employe";

const vide = (v: unknown) => v === null || v === undefined || v === "";
const egaux = (a: unknown, b: unknown) => {
	if (vide(a) && vide(b)) return true;
	if (a instanceof Date || b instanceof Date)
		return new Date(a as Date).getTime() === new Date(b as Date).getTime();
	return a === b;
};

/** Champs de `apres` dont la valeur diffère de `avant` ; null si rien ne change. */
export function differences(
	avant: Record<string, unknown>,
	apres: Record<string, unknown>,
): { avant: Record<string, unknown>; apres: Record<string, unknown> } | null {
	const a: Record<string, unknown> = {};
	const b: Record<string, unknown> = {};
	for (const cle of Object.keys(apres)) {
		if (egaux(avant[cle], apres[cle])) continue;
		a[cle] = avant[cle] ?? null;
		b[cle] = apres[cle] ?? null;
	}
	return Object.keys(b).length ? { avant: a, apres: b } : null;
}

/** Écrit une ligne du journal (à appeler dans la transaction de l'action). */
export async function journaliser(
	tx: Executeur,
	e: {
		userId: string;
		userNom: string;
		entite: EntiteJournal;
		entiteId: string;
		action: "modification" | "suppression";
		libelle: string;
		avant: unknown;
		apres: unknown | null;
		motif?: string | null;
	},
): Promise<void> {
	await tx.insert(journalModifications).values({
		userId: e.userId,
		userNom: e.userNom.slice(0, 100),
		entite: e.entite,
		entiteId: e.entiteId,
		action: e.action,
		libelle: e.libelle.slice(0, 200),
		avant: e.avant ?? null,
		apres: e.apres ?? null,
		motif: e.motif?.trim() || null,
	});
}
