import { test, expect, type Page } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

const ORIGINAL = { sigle: "CEMAS", prefixe: "CEMAS" };

async function setParametres(page: Page, sigle: string, prefixe: string) {
	await page.goto("/parametres");
	await waitForLoad(page);
	await page.getByLabel("Sigle").fill(sigle);
	await page.getByLabel("Préfixe matricule élève").fill(prefixe);
	await page.getByRole("button", { name: "Enregistrer" }).click();
	await expect(page.getByText("Paramètres enregistrés")).toBeVisible();
}

test.describe("07 - Paramètres de l'école", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.afterAll(async ({ browser }) => {
		const page = await browser.newPage();
		await login(page);
		await setParametres(page, ORIGINAL.sigle, ORIGINAL.prefixe);
		await page.close();
	});

	test("modifier le sigle met à jour la sidebar", async ({ page }) => {
		await setParametres(page, "ECOLETEST", "CEMAS");
		await expect(page.locator("aside").getByText("ECOLETEST")).toBeVisible();
	});

	test("refuser un préfixe invalide", async ({ page }) => {
		await page.goto("/parametres");
		await waitForLoad(page);
		await page.getByLabel("Préfixe matricule élève").fill("ab-c");
		await page.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByText(/majuscules et chiffres/)).toBeVisible();
		await page.reload();
		await waitForLoad(page);
		await expect(page.getByLabel("Préfixe matricule élève")).not.toHaveValue("ab-c");
	});

	test("un nouvel élève utilise le préfixe configuré", async ({ page }) => {
		await setParametres(page, "CEMAS", "TSTE2E");

		await page.goto("/eleves/nouveau");
		await waitForLoad(page);
		await page.locator('input[type="text"]').first().fill("Prefixe");
		await page.locator('input[type="text"]').nth(1).fill("Test");
		await page.locator('input[type="date"]').first().fill("2016-01-10");
		await page.getByLabel("Masculin").check();
		await page.getByRole("button", { name: /Suivant/i }).click();

		await page.locator('input[type="text"]').first().fill("Parent");
		await page.locator('input[type="text"]').nth(1).fill("Test");
		await page.locator('input[type="tel"]').first().fill("77 000 00 00");
		await page.getByRole("button", { name: /Suivant/i }).click();

		await page.locator("select").first().selectOption({ index: 1 });
		await page.waitForTimeout(500);
		await page.locator("select").nth(1).selectOption({ index: 1 });
		await page.getByRole("button", { name: /Inscrire/i }).click();
		await page.waitForURL(/\/eleves\//, { timeout: 15_000 });

		await expect(page.getByText(/TSTE2E-\d{4}-\d{4}/)).toBeVisible();
	});
});
