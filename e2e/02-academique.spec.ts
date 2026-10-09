import { expect, test } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

test.describe("02 - Module Academique", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.describe("Annees scolaires", () => {
		test("creer une nouvelle annee scolaire avec tous les champs", async ({ page }) => {
			await page.goto("/academique/annees");
			await waitForLoad(page);

			// Cliquer sur "Nouvelle annee"
			await page.getByRole("button", { name: /Nouvelle année/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvelle année scolaire")).toBeVisible();

			// Remplir le formulaire
			await page.locator('input[type="text"]').last().fill("2026-2027");
			await page.locator('input[type="date"]').first().fill("2026-10-01");
			await page.locator('input[type="date"]').last().fill("2027-07-31");

			// Soumettre
			await page.getByRole("button", { name: "Créer" }).click();

			// Verifier que l'annee apparait dans la table
			await expect(page.getByText("2026-2027").first()).toBeVisible({ timeout: 10_000 });
		});

		test("activer une annee scolaire", async ({ page }) => {
			await page.goto("/academique/annees");
			await waitForLoad(page);

			// Chercher le bouton d'activation (CheckCircle icon)
			const activateButton = page.getByTitle("Activer").first();
			if (await activateButton.isVisible({ timeout: 3000 }).catch(() => false)) {
				await activateButton.click();
				// Verifier que le statut change
				await expect(page.getByText("actif").first()).toBeVisible({ timeout: 10_000 });
			}
		});
	});

	test.describe("Classes", () => {
		test("creer une nouvelle classe avec tous les champs obligatoires", async ({ page }) => {
			await page.goto("/academique/classes");
			await waitForLoad(page);

			// Cliquer sur "Nouvelle classe"
			await page.getByRole("button", { name: /Nouvelle classe/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvelle classe").first()).toBeVisible();

			// Remplir les champs
			// Nom de la classe
			const nameInput = page.locator('input[type="text"]').last();
			await nameInput.fill("CM2 Test");

			// Selectionner un niveau
			const niveauSelect = page.locator("select").filter({ hasText: "Sélectionner un niveau" });
			if (await niveauSelect.isVisible()) {
				// Prendre la premiere option disponible
				const options = await niveauSelect.locator("option").all();
				if (options.length > 1) {
					await niveauSelect.selectOption({ index: 1 });
				}
			}

			// Capacite (deja pre-rempli a 30)
			const capaciteInput = page.locator('input[type="number"]').last();
			await capaciteInput.clear();
			await capaciteInput.fill("35");

			// Soumettre
			await page.getByRole("button", { name: "Créer" }).click();

			// Verifier que la classe apparait
			// La liste est paginée : rechercher la classe créée
			await page.getByPlaceholder("Rechercher une classe...").fill("CM2 Test");
			await expect(page.getByText("CM2 Test").first()).toBeVisible({ timeout: 10_000 });
		});

		test("filtrer les classes par niveau", async ({ page }) => {
			await page.goto("/academique/classes");
			await waitForLoad(page);

			// Selectionner un filtre de niveau
			const filterSelect = page.locator("select").filter({ hasText: "Tous les niveaux" });
			if (await filterSelect.isVisible()) {
				const options = await filterSelect.locator("option").all();
				if (options.length > 1) {
					await filterSelect.selectOption({ index: 1 });
					await page.waitForTimeout(1000);
				}
			}
		});
	});

	test.describe("Matieres", () => {
		test("creer une nouvelle matiere avec tous les champs obligatoires", async ({ page }) => {
			await page.goto("/academique/matieres");
			await waitForLoad(page);

			// Cliquer sur "Nouvelle matiere"
			await page.getByRole("button", { name: /Nouvelle matière/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvelle matière").first()).toBeVisible();

			// Remplir le nom
			const nameInput = page.locator('input[type="text"]').last();
			await nameInput.fill("Sciences Physiques");

			// Remplir le coefficient
			const coeffInput = page.locator('input[type="number"]').last();
			await coeffInput.clear();
			await coeffInput.fill("3");

			// Selectionner un niveau
			const niveauSelect = page.locator("select").filter({ hasText: "Sélectionner un niveau" });
			if (await niveauSelect.isVisible()) {
				const options = await niveauSelect.locator("option").all();
				if (options.length > 1) {
					await niveauSelect.selectOption({ index: 1 });
				}
			}

			// Soumettre
			await page.getByRole("button", { name: "Créer" }).click();

			// Verifier que la matiere apparait
			await expect(page.getByText("Sciences Physiques")).toBeVisible({ timeout: 10_000 });
		});
	});
});
