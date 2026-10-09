import { expect, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

test.describe("09 - Capacité des classes", () => {
	test("classe pleine : effectif affiché, avertissement et confirmation à l'inscription", async ({
		page,
	}) => {
		await login(page);
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");

		// Classe de capacité 1, remplie par un élève
		const nomClasse = `CAP-${Date.now()}`;
		const classe = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{ nom: nomClasse, niveauId: niveau.id, capacite: 1, anneeScolaireId: annee.id },
			true,
		);
		await trpc(
			page,
			"students.create",
			{
				prenom: "Premier",
				nom: "Capacite",
				dateNaissance: "2016-01-01",
				sexe: "M",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "P", nom: "Capacite", telephone: "77 000 00 01", relation: "pere" },
			},
			true,
		);

		// Liste des classes : effectif et état
		await page.goto("/academique/classes");
		await waitForLoad(page);
		const ligne = page.getByRole("row", { name: new RegExp(nomClasse) });
		await expect(ligne).toContainText("1 / 1");
		await expect(ligne).toContainText("Complète");

		// Inscription d'un 2e élève dans la classe pleine
		await page.goto("/eleves/nouveau");
		await waitForLoad(page);
		await page.locator('input[type="text"]').first().fill("Second");
		await page.locator('input[type="text"]').nth(1).fill("Capacite");
		await page.locator('input[type="date"]').first().fill("2016-02-02");
		await page.getByLabel("Masculin").check();
		await page.getByRole("button", { name: /Suivant/i }).click();
		await page.locator('input[type="text"]').first().fill("Parent");
		await page.locator('input[type="text"]').nth(1).fill("Capacite");
		await page.locator('input[type="tel"]').first().fill("77 000 00 02");
		await page.getByRole("button", { name: /Suivant/i }).click();

		await page.locator("select").first().selectOption(niveau.id);
		const classeSelect = page.locator("select").nth(1);
		await expect(classeSelect.locator(`option[value="${classe.id}"]`)).toContainText("1/1");
		await classeSelect.selectOption(classe.id);
		await expect(page.getByText(/Classe complète \(1\/1\)/)).toBeVisible();

		// Annuler : rien n'est créé
		await page.getByRole("button", { name: /Inscrire l'élève/i }).click();
		const dialog = page.getByRole("alertdialog");
		await expect(dialog).toContainText("Inscrire quand même ?");
		await dialog.getByRole("button", { name: "Annuler" }).click();
		await expect(dialog).toBeHidden();
		await expect(page).toHaveURL(/\/eleves\/nouveau/);

		// Confirmer : l'élève est inscrit malgré la capacité
		await page.getByRole("button", { name: /Inscrire l'élève/i }).click();
		await page
			.getByRole("alertdialog")
			.getByRole("button", { name: "Inscrire quand même" })
			.click();
		await page.waitForURL(/\/eleves\/[0-9a-f-]{36}/, { timeout: 15_000 });

		await page.goto("/academique/classes");
		await waitForLoad(page);
		await expect(page.getByRole("row", { name: new RegExp(nomClasse) })).toContainText(
			"Dépassement : 1",
		);
	});
});
