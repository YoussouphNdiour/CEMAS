import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Tarif = {
	niveauId: string;
	niveauNom: string;
	total: number;
	lignes: { libelle: string; montant: number; typeFraisId: string | null }[];
	echeancier: { mois: number; montant: number }[];
};

async function anneeActive(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const a = annees.find((x) => x.active);
	if (!a) throw new Error("Aucune année active");
	return a;
}

test.describe("15 - Tarifs par niveau", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("valeurs des fiches 2026-2027 présentes et modifiables", async ({ page }) => {
		const annee = await anneeActive(page);
		const tarifs = await trpc<Tarif[]>(page, "finance.tarifs.list", { anneeScolaireId: annee.id });
		const elem = tarifs.find((t) => t.niveauNom === "Élémentaire");
		expect(elem?.total).toBe(65_000);
		expect(elem?.echeancier.find((e) => e.mois === 11)?.montant).toBe(20_000);
		expect(elem?.echeancier.find((e) => e.mois === 1)?.montant).toBe(24_000);
		expect(elem?.echeancier.some((e) => e.mois === 10 || e.mois === 6 || e.mois === 7)).toBe(false);
		expect(tarifs.find((t) => t.niveauNom === "Préscolaire")?.total).toBe(67_000);
		expect(tarifs.find((t) => t.niveauNom === "Crèche")?.total).toBe(80_000);
		expect(tarifs.find((t) => t.niveauNom === "Moyen")?.total).toBe(70_000);

		// Refus : montant négatif, octobre dans l'échéancier
		await expect(
			trpc(
				page,
				"finance.tarifs.enregistrer",
				{
					anneeScolaireId: annee.id,
					niveauId: elem?.niveauId,
					lignes: [{ libelle: "Frais", montant: -1, typeFraisId: null }],
					echeancier: [],
				},
				true,
			),
		).rejects.toThrow();
		await expect(
			trpc(
				page,
				"finance.tarifs.enregistrer",
				{
					anneeScolaireId: annee.id,
					niveauId: elem?.niveauId,
					lignes: [{ libelle: "Frais", montant: 1, typeFraisId: null }],
					echeancier: [{ mois: 10, montant: 1 }],
				},
				true,
			),
		).rejects.toThrow(/octobre/i);

		// Aller-retour : remettre les mêmes valeurs
		const r = await trpc<{ lignes: number; mois: number }>(
			page,
			"finance.tarifs.enregistrer",
			{
				anneeScolaireId: annee.id,
				niveauId: elem?.niveauId,
				lignes: elem?.lignes.map((l) => ({
					libelle: l.libelle,
					montant: l.montant,
					typeFraisId: l.typeFraisId,
				})),
				echeancier: elem?.echeancier,
			},
			true,
		);
		expect(r).toEqual({ lignes: 3, mois: 7 });
	});
});
