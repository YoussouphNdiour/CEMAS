import { eq } from "drizzle-orm";
import type { db } from "@/shared/lib/db";
import { PARAMETRES_DEFAUT, type Parametres } from "./defaults";
import { parametresEcole } from "./schema";

export type { Parametres };

/** Code PostgreSQL « relation inexistante » (migration 0005 non appliquée). */
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
	const err = error as { code?: string; cause?: { code?: string } } | null;
	return err?.code === UNDEFINED_TABLE || err?.cause?.code === UNDEFINED_TABLE;
}

/**
 * Lit la ligne unique ; retombe sur les valeurs par défaut si la ligne manque ou si la table
 * n'existe pas encore. Toute autre erreur est propagée (ne jamais masquer un incident réel).
 * Ne pas appeler dans une transaction : une table absente avorterait la transaction.
 */
export async function getParametres(database: Pick<typeof db, "select">): Promise<Parametres> {
	try {
		const [row] = await database.select().from(parametresEcole).where(eq(parametresEcole.id, 1));
		if (!row) return PARAMETRES_DEFAUT;
		const { id: _id, updatedAt: _u, ...rest } = row;
		return rest;
	} catch (error) {
		if (isUndefinedTable(error)) return PARAMETRES_DEFAUT;
		throw error;
	}
}
