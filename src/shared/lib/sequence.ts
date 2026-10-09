import { sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { db } from "./db";

/**
 * Prochain numéro de séquence parmi les valeurs de `column` qui correspondent à `pattern`
 * (regex PostgreSQL avec un groupe capturant les chiffres). Comparaison numérique.
 */
export async function nextSequence(
	database: Pick<typeof db, "select">,
	table: PgTable,
	column: AnyPgColumn,
	pattern: string,
): Promise<number> {
	const [row] = await database
		.select({ max: sql<number | null>`MAX(substring(${column} from ${pattern})::int)` })
		.from(table);
	return Number(row?.max ?? 0) + 1;
}
