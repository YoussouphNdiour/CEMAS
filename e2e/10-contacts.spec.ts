import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

async function activeAnnee(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	return annee;
}

async function premiereClasse(page: Page, anneeId: string) {
	const classes = await trpc<{ id: string; placesRestantes: number }[]>(
		page,
		"academic.classes.list",
		{ anneeScolaireId: anneeId },
	);
	const classe = classes.find((c) => c.placesRestantes > 0) ?? classes[0];
	if (!classe) throw new Error("Aucune classe");
	return classe;
}

test.describe("10 - Second contact parent", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("inscrire un élève avec deux contacts", async ({ page }) => {
		const annee = await activeAnnee(page);
		const classe = await premiereClasse(page, annee.id);
		const nom = `Contacts${Date.now()}`;

		await page.goto("/eleves/nouveau");
		await waitForLoad(page);
		await page.locator('input[type="text"]').first().fill("Awa");
		await page.locator('input[type="text"]').nth(1).fill(nom);
		await page.locator('input[type="date"]').first().fill("2017-05-05");
		await page.getByLabel("Féminin").check();
		await page.getByRole("button", { name: /Suivant/i }).click();

		// Contact principal
		await page.locator('input[type="text"]').first().fill("Moussa");
		await page.locator('input[type="text"]').nth(1).fill(nom);
		await page.locator('input[type="tel"]').first().fill("77 111 11 11");

		// 2e contact
		await page.getByRole("button", { name: "Ajouter un 2e contact" }).click();
		const second = page.getByRole("group", { name: "2e contact" });
		await second.getByLabel("Prénom *", { exact: true }).fill("Fatou");
		await second.getByLabel("Nom *", { exact: true }).fill(nom);
		await second.getByLabel("Téléphone *").fill("77 222 22 22");
		await second.getByLabel("Mère").check();
		await page.getByRole("button", { name: /Suivant/i }).click();

		await page.locator("select").nth(1).selectOption(classe.id);
		await expect(page.getByText(`Fatou ${nom}`)).toBeVisible();
		await page.getByRole("button", { name: /Inscrire l'élève/i }).click();
		const confirm = page.getByRole("alertdialog");
		if (await confirm.isVisible({ timeout: 1000 }).catch(() => false)) {
			await confirm.getByRole("button", { name: "Inscrire quand même" }).click();
		}
		await page.waitForURL(/\/eleves\/[0-9a-f-]{36}/, { timeout: 15_000 });

		const cartes = page.getByTestId("contact");
		await expect(cartes).toHaveCount(2);
		await expect(cartes.first()).toContainText("Moussa");
		await expect(cartes.first()).toContainText("Principal");
		await expect(cartes.nth(1)).toContainText("Fatou");
		await expect(cartes.nth(1)).toContainText("77 222 22 22");
		await expect(page.getByRole("button", { name: "Ajouter un 2e contact" })).toHaveCount(0);
	});

	test("ajouter un 2e contact depuis la fiche, un 3e est refusé", async ({ page }) => {
		const annee = await activeAnnee(page);
		const classe = await premiereClasse(page, annee.id);
		const eleve = await trpc<{ id: string }>(
			page,
			"students.create",
			{
				prenom: "Ibou",
				nom: `Fiche${Date.now()}`,
				dateNaissance: "2016-03-03",
				sexe: "M",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "Cheikh", nom: "Fiche", telephone: "77 333 33 33", relation: "pere" },
			},
			true,
		);

		await page.goto(`/eleves/${eleve.id}`);
		await waitForLoad(page);
		await expect(page.getByTestId("contact")).toHaveCount(1);
		await page.getByRole("button", { name: "Ajouter un 2e contact" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Prénom *", { exact: true }).fill("Khady");
		await dialog.getByLabel("Nom *", { exact: true }).fill("Fiche");
		await dialog.getByLabel("Téléphone *").fill("77 444 44 44");
		await dialog.getByLabel("Tuteur").check();
		await dialog.getByRole("button", { name: "Enregistrer" }).click();

		await expect(page.getByTestId("contact")).toHaveCount(2);
		await expect(page.getByTestId("contact").nth(1)).toContainText("Khady");
		await expect(page.getByRole("button", { name: "Ajouter un 2e contact" })).toHaveCount(0);

		await expect(
			trpc(
				page,
				"students.addParent",
				{
					eleveId: eleve.id,
					parent: { prenom: "X", nom: "Y", telephone: "77 555 55 55", relation: "tuteur" },
				},
				true,
			),
		).rejects.toThrow(/déjà 2 contacts/);
	});
});
