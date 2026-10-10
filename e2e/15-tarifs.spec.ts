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

		// Refus : type associé obligatoire (ex. Scolarité) — il serait compté deux fois
		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		const sco = frais.find((f) => f.nom === "Scolarité");
		await expect(
			trpc(
				page,
				"finance.tarifs.enregistrer",
				{
					anneeScolaireId: annee.id,
					niveauId: elem?.niveauId,
					lignes: [{ libelle: "Frais", montant: 1, typeFraisId: sco?.id ?? null }],
					echeancier: [],
				},
				true,
			),
		).rejects.toThrow(/facultatif/i);

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

	test("modifier un tarif depuis la page", async ({ page }) => {
		await page.goto("/finances/tarifs");
		await waitForLoad(page);
		const carte = page.getByRole("region", { name: "Moyen" });
		await expect(carte).toContainText("70 000");
		await carte.getByLabel("Janvier", { exact: true }).fill("30500");
		await carte.getByRole("button", { name: "Enregistrer" }).click();
		await expect(carte.getByText("Tarifs enregistrés")).toBeVisible();
		await carte.getByLabel("Janvier", { exact: true }).fill("30000");
		await carte.getByRole("button", { name: "Enregistrer" }).click();
		await expect(carte.getByText("Tarifs enregistrés")).toBeVisible();
	});

	test("suivi : octobre inclus dans le forfait, juin et juillet non dus", async ({ page }) => {
		const annee = await anneeActive(page);
		const niveaux = await trpc<{ id: string; nom: string }[]>(page, "academic.niveaux.list");
		const elem = niveaux.find((n) => n.nom === "Élémentaire") ?? niveaux[0];
		const classe = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{ nom: `SUIVI-${Date.now()}`, niveauId: elem.id, capacite: 30, anneeScolaireId: annee.id },
			true,
		);
		await trpc(
			page,
			"students.create",
			{
				prenom: "Suivi",
				nom: `Statut${Date.now()}`,
				dateNaissance: "2016-01-01",
				sexe: "M",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "P", nom: "S", telephone: "77 000 00 15", relation: "pere" },
			},
			true,
		);
		const suivi = await trpc<
			{ typesFrais: { typeFraisNom: string; months: { mois: number; statut: string }[] }[] }[]
		>(page, "finance.suivi.byClasse", { classeId: classe.id, anneeScolaireId: annee.id });
		const sco = suivi[0].typesFrais.find((t) => t.typeFraisNom === "Scolarité");
		const statut = (m: number) => sco?.months.find((x) => x.mois === m)?.statut;
		expect(statut(10)).toBe("inclus");
		expect(statut(11)).toBe("impaye");
		expect(statut(6)).toBe("non_du");
		expect(statut(7)).toBe("non_du");
	});
});
