import { and, count, desc, eq, gte, lt, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "@/shared/lib/trpc";
import { journalModifications } from "./schema";

const PAR_PAGE = 50;

export const auditRouter = createTRPCRouter({
	/** Journal des modifications et suppressions, du plus récent au plus ancien (administrateur). */
	list: adminProcedure
		.input(
			z.object({
				entite: z
					.enum(["eleve", "contact", "paiement", "employe", "abonnement", "service"])
					.optional(),
				du: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.optional(),
				au: z
					.string()
					.regex(/^\d{4}-\d{2}-\d{2}$/)
					.optional(),
				page: z.number().int().min(1).default(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			const conditions: SQL[] = [];
			if (input.entite) conditions.push(eq(journalModifications.entite, input.entite));
			if (input.du) conditions.push(gte(journalModifications.createdAt, sql`${input.du}::date`));
			if (input.au)
				conditions.push(
					lt(journalModifications.createdAt, sql`(${input.au}::date + interval '1 day')`),
				);
			const where = conditions.length ? and(...conditions) : undefined;
			const lignes = await ctx.db
				.select()
				.from(journalModifications)
				.where(where)
				.orderBy(desc(journalModifications.createdAt))
				.limit(PAR_PAGE)
				.offset((input.page - 1) * PAR_PAGE);
			const [{ total }] = await ctx.db
				.select({ total: count() })
				.from(journalModifications)
				.where(where);
			return { lignes, total, pages: Math.max(1, Math.ceil(total / PAR_PAGE)) };
		}),
});
