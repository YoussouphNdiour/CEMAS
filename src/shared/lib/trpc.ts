import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "./auth";
import { db } from "./db";

export const createTRPCContext = async () => {
	const session = await auth();
	return { db, session };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Non autorisé" });
	}
	return next({ ctx: { ...ctx, session: ctx.session } });
});
