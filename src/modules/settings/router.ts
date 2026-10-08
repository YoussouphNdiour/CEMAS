import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/shared/lib/trpc";
import { parametresEcole } from "./schema";
import { updateParametresSchema } from "./validation";
import { getParametres } from "./service";

export const settingsRouter = createTRPCRouter({
	get: protectedProcedure.query(({ ctx }) => getParametres(ctx.db)),

	public: publicProcedure.query(async ({ ctx }) => {
		const { nom, sigle } = await getParametres(ctx.db);
		return { nom, sigle };
	}),

	update: protectedProcedure.input(updateParametresSchema).mutation(async ({ ctx, input }) => {
		const values = { ...input, updatedAt: new Date() };
		const [row] = await ctx.db
			.insert(parametresEcole)
			.values({ id: 1, ...values })
			.onConflictDoUpdate({ target: parametresEcole.id, set: values })
			.returning();
		return row;
	}),
});
