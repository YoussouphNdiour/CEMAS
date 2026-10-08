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
});
