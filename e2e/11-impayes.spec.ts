import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Resultat = {
	lignes: {
		id: string;
		reste: number;
		du: number;
		paye: number;
		moisImpayes: { typeFraisNom: string; mois: number | null }[];
	}[];
	totalReste: number;
	classesMontantDefaut: { classeId: string }[];
};

async function contexte(page: Page) {
	const annees = await trpc<{ id: string; active: boolean; dateDebut: string }[]>(
		page,
		"academic.annees.list",
	);
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const frais = await trpc<{ id: string; nom: string; obligatoire: boolean; mensuel: boolean }[]>(
		page,
		"finance.typesFrais.list",
	);
	const sco = frais.find((f) => f.obligatoire && f.mensuel);
	const ins = frais.find((f) => f.obligatoire && !f.mensuel);
	if (!sco || !ins) throw new Error("Frais obligatoires manquants");
	const classe = await trpc<{ id: string }>(
		page,
		"academic.classes.create",
		{ nom: `IMP-${Date.now()}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id },
		true,
	);
	const eleve = await trpc<{ id: string }>(
		page,
		"students.create",
		{
			prenom: "Impaye",
			nom: `Test${Date.now()}`,
			dateNaissance: "2016-01-01",
			sexe: "F",
			classeId: classe.id,
			anneeScolaireId: annee.id,
			parent: { prenom: "Parent", nom: "Impaye", telephone: "77 999 99 99", relation: "mere" },
		},
		true,
	);
	return { annee, niveau, sco, ins, classe, eleve };
}

/** Nombre de mois dus à la date du jour (mêmes règles que le serveur). */
function nbMoisDus(dateDebut: string): number {
	const [a0, m0] = dateDebut.split("-").map(Number);
	const now = new Date();
	const n = (now.getUTCFullYear() - a0) * 12 + (now.getUTCMonth() + 1 - m0) + 1;
	return Math.max(0, Math.min(10, n));
}

test.describe("11 - Impayés et relances", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("API : grille, reste calculé, paiement de l'inscription", async ({ page }) => {
		const { annee, sco, ins, classe, eleve } = await contexte(page);
		await expect(
			trpc(
				page,
				"finance.grilleFrais.upsertMany",
				{
					anneeScolaireId: annee.id,
					cellules: [{ classeId: classe.id, typeFraisId: sco.id, montant: -5 }],
				},
				true,
			),
		).rejects.toThrow();

		const r0 = await trpc<{ count: number }>(
			page,
			"finance.grilleFrais.upsertMany",
			{
				anneeScolaireId: annee.id,
				cellules: [
					{ classeId: classe.id, typeFraisId: sco.id, montant: 21_000 },
					{ classeId: classe.id, typeFraisId: ins.id, montant: 61_000 },
				],
			},
			true,
		);
		expect(r0.count).toBe(2);

		const avant = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: classe.id,
		});
		const n = nbMoisDus(annee.dateDebut);
		expect(avant.lignes).toHaveLength(1);
		expect(avant.lignes[0]).toMatchObject({ id: eleve.id, reste: 21_000 * n + 61_000, paye: 0 });
		expect(avant.classesMontantDefaut).toEqual([]);

		await trpc(
			page,
			"finance.paiements.create",
			{
				eleveId: eleve.id,
				typeFraisId: ins.id,
				anneeScolaireId: annee.id,
				mois: 10,
				montant: 55_000,
			},
			true,
		);
		const apres = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: classe.id,
		});
		if (n === 0) expect(apres.lignes).toHaveLength(0);
		else expect(apres.lignes[0]).toMatchObject({ reste: 21_000 * n, paye: 55_000 });

		// Filtre sans élève : liste vide, totaux à zéro
		const vide = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: "00000000-0000-4000-8000-000000000000",
		});
		expect(vide).toMatchObject({ lignes: [], totalReste: 0 });

		const stats = await trpc<{ totalImpayes: number }>(page, "dashboard.stats", {
			anneeScolaireId: annee.id,
		});
		expect(stats.totalImpayes).toBeGreaterThanOrEqual(apres.totalReste);
	});
});
