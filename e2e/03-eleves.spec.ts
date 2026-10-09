import { expect, test } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

test.describe("03 - Module Eleves (Inscription multi-etapes)", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("inscrire un nouvel eleve avec le formulaire en 3 etapes", async ({ page }) => {
		await page.goto("/eleves/nouveau");
		await waitForLoad(page);

		// ============================================
		// ETAPE 1 : Informations de l'eleve
		// ============================================
		await expect(page.getByText("Informations de l'élève")).toBeVisible();

		// Prenom (obligatoire)
		const prenomInput = page.locator('input[type="text"]').first();
		await prenomInput.fill("Aminata");

		// Nom (obligatoire)
		const nomInput = page.locator('input[type="text"]').nth(1);
		await nomInput.fill("Diallo");

		// Date de naissance (obligatoire)
		const dateNaissanceInput = page.locator('input[type="date"]').first();
		await dateNaissanceInput.fill("2015-03-15");

		// Lieu de naissance (optionnel mais on le remplit)
		const lieuInput = page.locator('input[type="text"]').nth(2);
		await lieuInput.fill("Dakar");

		// Sexe : selectionner Feminin
		await page.getByLabel("Féminin").check();

		// Adresse (optionnel mais on le remplit)
		const adresseInput = page.locator('input[type="text"]').nth(3);
		await adresseInput.fill("Parcelles Assainies U26, Dakar");

		// Passer a l'etape suivante
		await page.getByRole("button", { name: /Suivant/i }).click();

		// ============================================
		// ETAPE 2 : Informations du parent / tuteur
		// ============================================
		await expect(page.getByText("Informations du parent / tuteur")).toBeVisible();

		// Prenom du parent (obligatoire)
		const parentPrenomInput = page.locator('input[type="text"]').first();
		await parentPrenomInput.fill("Mamadou");

		// Nom du parent (obligatoire)
		const parentNomInput = page.locator('input[type="text"]').nth(1);
		await parentNomInput.fill("Diallo");

		// Telephone (obligatoire)
		const telInput = page.locator('input[type="tel"]').first();
		await telInput.fill("77 123 45 67");

		// Telephone 2 (optionnel mais on le remplit)
		const tel2Input = page.locator('input[type="tel"]').nth(1);
		await tel2Input.fill("76 987 65 43");

		// Profession (optionnel mais on le remplit)
		const professionInput = page.locator('input[type="text"]').nth(2);
		await professionInput.fill("Enseignant");

		// Relation : Pere est deja selectionne par defaut, on verifie
		await expect(page.getByLabel("Père")).toBeChecked();

		// Passer a l'etape suivante
		await page.getByRole("button", { name: /Suivant/i }).click();

		// ============================================
		// ETAPE 3 : Choix de la classe + Recapitulatif
		// ============================================
		await expect(page.getByText("Choix de la classe")).toBeVisible();

		// Selectionner un niveau (optionnel, filtre les classes)
		const niveauSelect = page.locator("select").first();
		const niveauOptions = await niveauSelect.locator("option").all();
		if (niveauOptions.length > 1) {
			await niveauSelect.selectOption({ index: 1 });
			await page.waitForTimeout(500);
		}

		// Selectionner une classe (obligatoire)
		const classeSelect = page.locator("select").nth(1);
		await page.waitForTimeout(500);
		const classeOptions = await classeSelect.locator("option").all();
		if (classeOptions.length > 1) {
			await classeSelect.selectOption({ index: 1 });
		}

		// Verifier le recapitulatif
		await expect(page.getByText("Récapitulatif")).toBeVisible();
		await expect(page.getByText("Aminata Diallo")).toBeVisible();
		await expect(page.getByText("Mamadou Diallo")).toBeVisible();

		// Soumettre l'inscription
		await page.getByRole("button", { name: /Inscrire/i }).click();

		// Attendre la redirection vers la page du profil eleve
		await page.waitForURL(/\/eleves\//, { timeout: 15_000 });
	});

	test("afficher la liste des eleves", async ({ page }) => {
		await page.goto("/eleves");
		await waitForLoad(page);

		// Verifier que la page charge correctement
		await expect(page.getByRole("heading", { name: "Élèves" })).toBeVisible();
	});
});
