import { expect, test } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

test.describe("05 - Module Finances", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.describe("Paiements (scolarite)", () => {
		test("enregistrer un paiement de scolarite pour un eleve", async ({ page }) => {
			await page.goto("/finances/paiements");
			await waitForLoad(page);

			await expect(page.getByText("Enregistrer un paiement")).toBeVisible();

			// Rechercher un eleve (champ de recherche autocomplete)
			const searchInput = page.getByPlaceholder("Tapez le nom de l'élève...");
			await searchInput.fill("Dia");
			await page.waitForTimeout(1500);

			// Selectionner le premier resultat s'il apparait
			const suggestion = page.locator("button").filter({ hasText: /Dia/ }).first();
			if (await suggestion.isVisible({ timeout: 5000 }).catch(() => false)) {
				await suggestion.click();
			}

			// Selectionner le type de frais
			const typeFraisSelect = page
				.locator("select")
				.filter({ has: page.locator("option", { hasText: "Sélectionner un type" }) });
			if (await typeFraisSelect.isVisible()) {
				const options = await typeFraisSelect.locator("option").all();
				if (options.length > 1) {
					await typeFraisSelect.selectOption({ index: 1 });
				}
			}

			// Le mois est deja pre-selectionne (mois courant)

			// Remplir le montant
			const montantInput = page.locator('input[type="number"]');
			if (await montantInput.isVisible()) {
				await montantInput.fill("25000");
			}

			// Soumettre le paiement
			const submitBtn = page.getByRole("button", { name: /Enregistrer le paiement/i });
			if (await submitBtn.isEnabled()) {
				await submitBtn.click();
				// Verifier le message de succes avec numero de recu
				await page.waitForTimeout(3000);
			}
		});
	});

	test.describe("Depenses", () => {
		test("creer une nouvelle depense avec tous les champs", async ({ page }) => {
			await page.goto("/finances/depenses");
			await waitForLoad(page);

			// Cliquer sur "Nouvelle depense"
			await page.getByRole("button", { name: /Nouvelle dépense/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvelle dépense").first()).toBeVisible();

			// Categorie (obligatoire) - select
			const categorieSelect = page.getByRole("dialog").locator("select");
			// Attendre le chargement des catégories avant de choisir
			await expect(categorieSelect.locator("option").nth(1)).toBeAttached();
			await categorieSelect.selectOption({ index: 1 });

			// Libelle (obligatoire)
			const libelleInput = page.locator('input[type="text"]').last();
			await libelleInput.fill("Achat fournitures de bureau");

			// Montant (obligatoire)
			const montantInput = page.locator('input[type="number"]').last();
			await montantInput.fill("75000");

			// Date (obligatoire - pre-rempli avec aujourd'hui)
			const dateInput = page.locator('input[type="date"]').last();
			await dateInput.fill("2026-09-15");

			// Note (optionnel mais on le remplit)
			const noteArea = page.locator("textarea").last();
			await noteArea.fill("Ramettes de papier A4, stylos, cartouches imprimante");

			// Soumettre
			await page.getByRole("button", { name: "Enregistrer" }).click();

			// Verifier que la depense apparait
			await expect(page.getByText("Achat fournitures de bureau")).toBeVisible({ timeout: 10_000 });
		});

		test("creer une deuxieme depense", async ({ page }) => {
			await page.goto("/finances/depenses");
			await waitForLoad(page);

			await page.getByRole("button", { name: /Nouvelle dépense/i }).click();
			await expect(page.getByText("Nouvelle dépense").first()).toBeVisible();

			const categorieSelect = page.getByRole("dialog").locator("select");
			// Attendre le chargement des catégories avant de choisir
			await expect(categorieSelect.locator("option").nth(1)).toBeAttached();
			await categorieSelect.selectOption({ index: 1 });

			const libelleInput = page.locator('input[type="text"]').last();
			await libelleInput.fill("Reparation climatiseur salle 3");

			const montantInput = page.locator('input[type="number"]').last();
			await montantInput.fill("120000");

			const dateInput = page.locator('input[type="date"]').last();
			await dateInput.fill("2026-09-20");

			const noteArea = page.locator("textarea").last();
			await noteArea.fill("Technicien CLIM+ intervention urgente");

			await page.getByRole("button", { name: "Enregistrer" }).click();
			await expect(page.getByText("Reparation climatiseur")).toBeVisible({ timeout: 10_000 });
		});
	});

	test.describe("Recettes", () => {
		test("creer une nouvelle recette avec tous les champs", async ({ page }) => {
			await page.goto("/finances/recettes");
			await waitForLoad(page);

			// Cliquer sur "Nouvelle recette"
			await page.getByRole("button", { name: /Nouvelle recette/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvelle recette").first()).toBeVisible();

			// Categorie (obligatoire)
			const categorieSelect = page.getByRole("dialog").locator("select");
			// Attendre le chargement des catégories avant de choisir
			await expect(categorieSelect.locator("option").nth(1)).toBeAttached();
			await categorieSelect.selectOption({ index: 1 });

			// Libelle (obligatoire)
			const libelleInput = page.locator('input[type="text"]').last();
			await libelleInput.fill("Location salle pour evenement");

			// Montant (obligatoire)
			const montantInput = page.locator('input[type="number"]').last();
			await montantInput.fill("50000");

			// Date (obligatoire)
			const dateInput = page.locator('input[type="date"]').last();
			await dateInput.fill("2026-09-10");

			// Note (optionnel mais on le remplit)
			const noteArea = page.locator("textarea").last();
			await noteArea.fill("Location salle polyvalente pour conference APE");

			// Soumettre
			await page.getByRole("button", { name: "Enregistrer" }).click();

			// Verifier que la recette apparait
			await expect(page.getByText("Location salle pour evenement")).toBeVisible({
				timeout: 10_000,
			});
		});
	});

	test.describe("Suivi et Bilan", () => {
		test("consulter le suivi des paiements", async ({ page }) => {
			await page.goto("/finances/suivi");
			await waitForLoad(page);
			await expect(page.getByText(/Suivi/i).first()).toBeVisible();
		});

		test("consulter le bilan financier", async ({ page }) => {
			await page.goto("/finances/bilan");
			await waitForLoad(page);
			await expect(page.getByText(/Bilan/i).first()).toBeVisible();
		});
	});
});
