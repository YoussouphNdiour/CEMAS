import { eq } from "drizzle-orm";
import { users } from "@/modules/auth/schema";
import {
	createTRPCRouter,
	protectedProcedure,
	publicProcedure,
	ROLES_ADMIN,
} from "@/shared/lib/trpc";
import { parametresEcole } from "./schema";
import { getParametres } from "./service";
import { updateParametresSchema } from "./validation";

export const settingsRouter = createTRPCRouter({
	get: protectedProcedure.query(({ ctx }) => getParametres(ctx.db)),

	/** Utilisateur connecté : nom et droits d'administration (pour afficher les actions). */
	moi: protectedProcedure.query(async ({ ctx }) => {
		const [user] = await ctx.db
			.select({ nom: users.nom, role: users.role })
			.from(users)
			.where(eq(users.id, ctx.session.user?.id ?? ""));
		return { nom: user?.nom ?? "", estAdmin: !!user && ROLES_ADMIN.includes(user.role) };
	}),

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
