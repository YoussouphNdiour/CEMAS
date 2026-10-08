import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError, z } from "zod";
import { auth } from "./auth";
import { db } from "./db";

export const createTRPCContext = async () => {
	const session = await auth();
	return { db, session };
};

function sanitizeDbError(error: unknown): string {
	if (error && typeof error === "object" && "code" in error) {
		const pgError = error as { code: string; constraint?: string; detail?: string };
		switch (pgError.code) {
			case "23505": {
				// Unique constraint violation
				if (pgError.constraint?.includes("paiements")) {
					return "Ce paiement a déjà été enregistré pour cet élève, ce type de frais et ce mois.";
				}
				if (pgError.constraint?.includes("eleves")) {
					return "Un élève avec ces informations existe déjà.";
				}
				return "Cet enregistrement existe déjà.";
			}
			case "23503":
				return "Référence invalide : un élément lié est introuvable.";
			case "23502":
				return "Un champ obligatoire est manquant.";
			case "23514":
				return "Une valeur saisie ne respecte pas les contraintes.";
			default:
				return "Une erreur est survenue lors de l'opération. Veuillez réessayer.";
		}
	}
	return "Une erreur inattendue est survenue. Veuillez réessayer.";
}

const t = initTRPC.context<typeof createTRPCContext>().create({
	errorFormatter({ shape, error }) {
		const cause = error.cause;
		// Check if this is a database error (not a TRPCError thrown intentionally)
		if (error.code === "INTERNAL_SERVER_ERROR" && cause) {
			return {
				...shape,
				message: sanitizeDbError(cause),
				data: {
					...shape.data,
					// Strip raw SQL from the response
					stack: undefined,
					zodError: null,
				},
			};
		}
		return {
			...shape,
			data: {
				...shape.data,
				stack: undefined,
				zodError:
					error.code === "BAD_REQUEST" && error.cause instanceof ZodError
						? z.flattenError(error.cause)
						: null,
			},
		};
	},
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.session?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED", message: "Non autorisé" });
	}
	return next({ ctx: { ...ctx, session: ctx.session } });
});
