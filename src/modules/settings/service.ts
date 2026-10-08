import { eq } from "drizzle-orm";
import type { db } from "@/shared/lib/db";
import { parametresEcole } from "./schema";
import { PARAMETRES_DEFAUT, type Parametres } from "./defaults";

export type { Parametres };

/** Lit la ligne unique ; retombe sur les valeurs par défaut si la table ou la ligne manque. */
export async function getParametres(database: Pick<typeof db, "select">): Promise<Parametres> {
	try {
		const [row] = await database.select().from(parametresEcole).where(eq(parametresEcole.id, 1));
		if (!row) return PARAMETRES_DEFAUT;
		const { id: _id, updatedAt: _u, ...rest } = row;
		return rest;
	} catch {
		return PARAMETRES_DEFAUT;
	}
}
