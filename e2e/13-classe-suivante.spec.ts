import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

async function deuxClasses(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const t = Date.now();
	const a = await trpc<{ id: string; nom: string }>(
		page,
		"academic.classes.create",
		{ nom: `SUIV-A-${t}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id },
		true,
	);
	const b = await trpc<{ id: string; nom: string }>(
		page,
		"academic.classes.create",
		{ nom: `SUIV-B-${t}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id },
		true,
	);
	return { annee, a, b };
}

async function editer(page: Page, nom: string, valeur: string) {
	await page.getByPlaceholder("Rechercher une classe...").fill(nom);
	await page
		.getByRole("row", { name: new RegExp(nom) })
		.getByRole("button")
		.first()
		.click();
	await page.getByRole("dialog").getByLabel("Classe suivante").selectOption(valeur);
	await page.getByRole("dialog").getByRole("button", { name: "Modifier" }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("13 - Classe suivante", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("configurer la classe suivante et la fin de cycle", async ({ page }) => {
		const { a, b } = await deuxClasses(page);
		await page.goto("/academique/classes");
		await waitForLoad(page);

		await page.getByPlaceholder("Rechercher une classe...").fill(a.nom);
		await expect(page.getByRole("row", { name: new RegExp(a.nom) })).toContainText("À configurer");

		await editer(page, a.nom, b.id);
		await page.getByPlaceholder("Rechercher une classe...").fill(a.nom);
		await expect(page.getByRole("row", { name: new RegExp(a.nom) })).toContainText(b.nom);

		await editer(page, b.nom, "fin");
		await page.getByPlaceholder("Rechercher une classe...").fill(b.nom);
		await expect(page.getByRole("row", { name: new RegExp(b.nom) })).toContainText("Fin de cycle");
	});

	test("l'API refuse une classe suivante qui est elle-même", async ({ page }) => {
		const { a } = await deuxClasses(page);
		await expect(
			trpc(page, "academic.classes.update", { id: a.id, classeSuivanteId: a.id }, true),
		).rejects.toThrow(/classe suivante/i);
	});

	test("contexte et prévisualisation du passage", async ({ page }) => {
		const { a, b } = await deuxClasses(page);
		const ctx = await trpc<{ proposition: { libelle: string }; classes: { id: string }[] }>(
			page,
			"academic.passage.contexte",
		);
		expect(ctx.proposition.libelle).toMatch(/^\d{4}-\d{4}$/);
		expect(ctx.classes.some((c) => c.id === a.id)).toBe(true);

		const r = await trpc<{ count: number }>(
			page,
			"academic.passage.configurerClasses",
			{
				classes: [
					{ id: a.id, classeSuivanteId: b.id, finDeCycle: false },
					{ id: b.id, classeSuivanteId: null, finDeCycle: true },
				],
			},
			true,
		);
		expect(r.count).toBe(2);

		await expect(
			trpc(
				page,
				"academic.passage.configurerClasses",
				{
					classes: [{ id: a.id, classeSuivanteId: a.id, finDeCycle: false }],
				},
				true,
			),
		).rejects.toThrow(/classe suivante/i);

		const plan = await trpc<{ erreurs: string[] }>(page, "academic.passage.preview", {
			decisions: {},
		});
		expect(plan.erreurs.some((e) => e.startsWith(a.nom))).toBe(false);
		expect(plan.erreurs.some((e) => e.startsWith(b.nom))).toBe(false);
	});
});
