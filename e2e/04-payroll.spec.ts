import { expect, test } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

test.describe("04 - Module Paie (Payroll)", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.describe("Employes", () => {
		test("creer un nouvel employe avec tous les champs obligatoires", async ({ page }) => {
			await page.goto("/payroll/employes");
			await waitForLoad(page);

			// Cliquer sur "Nouvel employe"
			await page.getByRole("button", { name: /Nouvel employe/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvel employe").first()).toBeVisible();

			// Remplir le formulaire complet
			// Prenom (obligatoire)
			const dialog = page.getByRole("dialog");
			const inputs = dialog.locator('input[type="text"]');
			await inputs.nth(0).fill("Ousmane");

			// Nom (obligatoire)
			await inputs.nth(1).fill("Sow");

			// Telephone (optionnel mais on le remplit)
			await inputs.nth(2).fill("77 555 12 34");

			// Poste (obligatoire)
			await inputs.nth(3).fill("Professeur de Mathematiques");

			// Type (select) - selectionner "Enseignant"
			const typeSelect = dialog.locator("select");
			await typeSelect.last().selectOption("enseignant");

			// Salaire de base (obligatoire)
			const salaireInput = dialog.locator('input[type="number"]');
			await salaireInput.last().fill("350000");

			// Date d'embauche (obligatoire)
			const dateInput = dialog.locator('input[type="date"]');
			await dateInput.last().fill("2024-09-01");

			// Soumettre
			await dialog.getByRole("button", { name: /Creer/i }).click();

			// Verifier que l'employe apparait dans la liste
			await expect(page.getByRole("cell", { name: "Ousmane" }).first()).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("cell", { name: "Sow" }).first()).toBeVisible();
		});

		test("creer un employe administratif", async ({ page }) => {
			await page.goto("/payroll/employes");
			await waitForLoad(page);

			await page.getByRole("button", { name: /Nouvel employe/i }).click();
			await expect(page.getByText("Nouvel employe").first()).toBeVisible();

			const dialog = page.getByRole("dialog");
			const inputs = dialog.locator('input[type="text"]');
			await inputs.nth(0).fill("Fatou");
			await inputs.nth(1).fill("Ndiaye");
			await inputs.nth(2).fill("78 444 55 66");
			await inputs.nth(3).fill("Secretaire Generale");

			// Type : Administratif
			const typeSelect = dialog.locator("select");
			await typeSelect.last().selectOption("administratif");

			const salaireInput = dialog.locator('input[type="number"]');
			await salaireInput.last().fill("250000");

			const dateInput = dialog.locator('input[type="date"]');
			await dateInput.last().fill("2023-01-15");

			await dialog.getByRole("button", { name: /Creer/i }).click();
			await expect(page.getByRole("cell", { name: "Fatou" }).first()).toBeVisible({
				timeout: 10_000,
			});
		});

		test("creer un employe d'entretien", async ({ page }) => {
			await page.goto("/payroll/employes");
			await waitForLoad(page);

			await page.getByRole("button", { name: /Nouvel employe/i }).click();
			await expect(page.getByText("Nouvel employe").first()).toBeVisible();

			const dialog = page.getByRole("dialog");
			const inputs = dialog.locator('input[type="text"]');
			await inputs.nth(0).fill("Ibrahima");
			await inputs.nth(1).fill("Ba");
			await inputs.nth(2).fill("70 333 22 11");
			await inputs.nth(3).fill("Agent d'entretien");

			const typeSelect = dialog.locator("select");
			await typeSelect.last().selectOption("entretien");

			const salaireInput = dialog.locator('input[type="number"]');
			await salaireInput.last().fill("150000");

			const dateInput = dialog.locator('input[type="date"]');
			await dateInput.last().fill("2024-03-01");

			await dialog.getByRole("button", { name: /Creer/i }).click();
			await expect(page.getByRole("cell", { name: "Ibrahima" }).first()).toBeVisible({
				timeout: 10_000,
			});
		});
	});

	test.describe("Bulletins de paie", () => {
		test("generer les bulletins de paie pour le mois courant", async ({ page }) => {
			await page.goto("/payroll/bulletins");
			await waitForLoad(page);

			// Verifier que la page charge
			await expect(page.getByText("Bulletins de paie")).toBeVisible();

			// Cliquer sur "Generer les bulletins"
			const generateBtn = page.getByRole("button", { name: /Generer les bulletins/i });
			if (await generateBtn.isVisible()) {
				await generateBtn.click();
				// Attendre le message de succes ou la mise a jour de la table
				await page.waitForTimeout(3000);
			}
		});

		test("modifier les primes d'un bulletin (edition inline)", async ({ page }) => {
			await page.goto("/payroll/bulletins");
			await waitForLoad(page);

			// Chercher un bouton de prime a cliquer (edition inline)
			const primeCell = page.locator("button").filter({ hasText: /FCFA/ }).first();
			if (await primeCell.isVisible({ timeout: 5000 }).catch(() => false)) {
				await primeCell.click();
				// Un input apparait
				const input = page.locator('input[type="number"][autofocus]');
				if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
					await input.clear();
					await input.fill("25000");
					await input.press("Enter");
					await page.waitForTimeout(2000);
				}
			}
		});

		test("marquer un bulletin comme paye", async ({ page }) => {
			await page.goto("/payroll/bulletins");
			await waitForLoad(page);

			// Chercher le bouton "Marquer paye"
			const markPaidBtn = page.getByRole("button", { name: /Marquer paye/i }).first();
			if (await markPaidBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
				await markPaidBtn.click();
				await page.waitForTimeout(2000);
			}
		});
	});

	test.describe("Historique", () => {
		test("consulter l'historique de paie", async ({ page }) => {
			await page.goto("/payroll/historique");
			await waitForLoad(page);
			await expect(page.getByText(/Historique|Paie/i).first()).toBeVisible();
		});
	});
});
