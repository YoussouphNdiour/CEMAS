import { expect, test } from "@playwright/test";
import { CREDENTIALS } from "./helpers";

test.describe("01 - Connexion (Login)", () => {
	test("affiche la page de login Gestion Ecole avec le nom de l'école", async ({ page }) => {
		await page.goto("/login");
		await expect(page.getByRole("heading", { name: "Gestion Ecole" })).toBeVisible();
		await expect(page.getByText("Complexe Educatif Mame Anta Sidibe")).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Mot de passe")).toBeVisible();
	});

	test("refuse un login avec de mauvais identifiants", async ({ page }) => {
		await page.goto("/login");
		await page.getByLabel("Email").fill("mauvais@email.com");
		await page.getByLabel("Mot de passe").fill("mauvais");
		await page.getByRole("button", { name: "Se connecter" }).click();
		await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();
	});

	test("se connecte avec les identifiants du directeur et redirige vers le dashboard", async ({
		page,
	}) => {
		await page.goto("/login");

		// Remplir le formulaire de connexion
		await page.getByLabel("Email").fill(CREDENTIALS.email);
		await page.getByLabel("Mot de passe").fill(CREDENTIALS.password);

		// Soumettre
		await page.getByRole("button", { name: "Se connecter" }).click();

		// Attendre la redirection vers le dashboard
		await page.waitForURL("/", { timeout: 15_000 });

		// Verifier qu'on est sur le dashboard
		await expect(page).toHaveURL("/");
	});
});
