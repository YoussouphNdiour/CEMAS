import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getImpayes } from "@/modules/finance/impayes-service";
import { financeRouter } from "@/modules/finance/router";
import { createCallerFactory, createTRPCRouter, protectedProcedure } from "@/shared/lib/trpc";
import { construireComptabilite } from "./comptabilite";
import { anneeScolaire, effectifsAnnee, operationsPeriode, personnelEtTransport } from "./service";

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date AAAA-MM-JJ");
const financeCaller = createCallerFactory(financeRouter);

export const reportsRouter = createTRPCRouter({
	/** Synthèse et détail des opérations entre deux dates incluses. */
	comptabilite: protectedProcedure
		.input(z.object({ du: dateIso, au: dateIso }).refine((p) => p.du <= p.au, "Période invalide"))
		.query(async ({ ctx, input }) => ({
			du: input.du,
			au: input.au,
			...construireComptabilite(await operationsPeriode(ctx.db, input.du, input.au)),
		})),

	/** Rapport d'ensemble d'une année scolaire. */
	etablissement: protectedProcedure
		.input(z.object({ anneeScolaireId: z.string().uuid() }))
		.query(async ({ ctx, input }) => {
			const annee = await anneeScolaire(ctx.db, input.anneeScolaireId);
			if (!annee) throw new TRPCError({ code: "NOT_FOUND", message: "Année scolaire introuvable" });
			const finance = financeCaller(ctx);
			const { mois, ...totaux } = await finance.bilan.summary({
				anneeScolaireId: input.anneeScolaireId,
			});
			const imp = await getImpayes(ctx.db, input.anneeScolaireId);
			const effectifs = await effectifsAnnee(ctx.db, input.anneeScolaireId);
			const reds = await finance.reductions.list({ anneeScolaireId: input.anneeScolaireId });
			const { personnel, transport } = await personnelEtTransport(ctx.db, input.anneeScolaireId);

			const parClasse = new Map<string, { classe: string; reste: number; eleves: number }>();
			for (const l of imp.lignes) {
				const c = parClasse.get(l.classeId) ?? { classe: l.classeNom, reste: 0, eleves: 0 };
				c.reste += l.reste;
				c.eleves += 1;
				parClasse.set(l.classeId, c);
			}
			const typesReduction = new Map<string, number>();
			for (const r of reds) typesReduction.set(r.type, (typesReduction.get(r.type) ?? 0) + 1);

			return {
				annee,
				effectifs,
				bilan: { lignes: mois, totaux },
				impayes: {
					totalDu: imp.totalDu,
					totalPaye: imp.totalPaye,
					totalReste: imp.totalReste,
					parClasse: [...parClasse.values()].sort((a, b) => b.reste - a.reste),
					top: imp.lignes.slice(0, 10).map((l) => ({
						eleve: `${l.prenom} ${l.nom}`,
						classe: l.classeNom,
						reste: l.reste,
					})),
				},
				reductions: {
					parType: [...typesReduction].map(([type, nombre]) => ({ type, nombre })),
					montantTotal: reds.reduce((t, r) => t + r.montantAnnuel, 0),
				},
				personnel: { ...personnel, salairesPayes: totaux.totalSalaires },
				transport,
			};
		}),
});
