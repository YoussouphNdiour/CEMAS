import { expect, test } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

test.describe("06 - Module Transport", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.describe("Vehicules", () => {
		test("creer un nouveau vehicule avec tous les champs", async ({ page }) => {
			await page.goto("/transport/vehicules");
			await waitForLoad(page);

			// Cliquer sur "Nouveau vehicule"
			await page.getByRole("button", { name: /Nouveau véhicule/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouveau véhicule").first()).toBeVisible();

			// Immatriculation (obligatoire)
			const inputs = page.getByRole("dialog").locator('input[type="text"]');
			await inputs.nth(0).fill("DK-4567-AB");

			// Marque (optionnel mais on le remplit)
			await inputs.nth(1).fill("Toyota Coaster");

			// Capacite (obligatoire)
			const capaciteInput = page.getByRole("dialog").locator('input[type="number"]');
			await capaciteInput.last().fill("30");

			// Nom du chauffeur (obligatoire)
			await inputs.nth(2).fill("Abdoulaye Diop");

			// Telephone du chauffeur (obligatoire)
			await inputs.nth(3).fill("77 888 99 00");

			// Soumettre
			await page.getByRole("button", { name: "Créer" }).click();

			// Verifier que le vehicule apparait
			await expect(page.getByText("DK-4567-AB")).toBeVisible({ timeout: 10_000 });
		});

		test("creer un deuxieme vehicule", async ({ page }) => {
			await page.goto("/transport/vehicules");
			await waitForLoad(page);

			await page.getByRole("button", { name: /Nouveau véhicule/i }).click();
			await expect(page.getByText("Nouveau véhicule").first()).toBeVisible();

			const inputs = page.getByRole("dialog").locator('input[type="text"]');
			await inputs.nth(0).fill("DK-1234-CD");
			await inputs.nth(1).fill("Mercedes Sprinter");

			const capaciteInput = page.getByRole("dialog").locator('input[type="number"]');
			await capaciteInput.last().fill("20");

			await inputs.nth(2).fill("Moussa Fall");
			await inputs.nth(3).fill("76 111 22 33");

			await page.getByRole("button", { name: "Créer" }).click();
			await expect(page.getByText("DK-1234-CD")).toBeVisible({ timeout: 10_000 });
		});
	});

	test.describe("Itineraires", () => {
		test("creer un nouvel itineraire avec tous les champs", async ({ page }) => {
			await page.goto("/transport/itineraires");
			await waitForLoad(page);

			// Cliquer sur "Nouvel itineraire"
			await page.getByRole("button", { name: /Nouvel itinéraire/i }).click();

			// Verifier que le modal s'ouvre
			await expect(page.getByText("Nouvel itinéraire").first()).toBeVisible();

			// Nom (obligatoire)
			const nameInput = page.locator('input[type="text"]').last();
			await nameInput.fill("Parcelles Assainies → Ecole");

			// Vehicule (optionnel - select)
			const vehiculeSelect = page.locator("select").last();
			const options = await vehiculeSelect.locator("option").all();
			if (options.length > 1) {
				await vehiculeSelect.selectOption({ index: 1 });
			}

			// Description (optionnel mais on le remplit)
			const descArea = page.locator("textarea").last();
			await descArea.fill("Itineraire principal couvrant les Parcelles Assainies unites 10 a 26");

			// Soumettre
			await page.getByRole("button", { name: "Créer" }).click();

			// Verifier que la modale se ferme et que l'itineraire apparait dans la liste
			await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
			await expect(page.getByRole("cell", { name: /Parcelles Assainies/ }).first()).toBeVisible();
		});

		test("ajouter des arrets a un itineraire", async ({ page }) => {
			await page.goto("/transport/itineraires");
			await waitForLoad(page);

			// Cliquer sur une ligne pour expander les arrets (chevron)
			const expandBtn = page.getByTitle("Voir les arrêts").first();
			if (await expandBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
				await expandBtn.click();
				await page.waitForTimeout(1000);

				// Cliquer sur "Ajouter un arret"
				const addArretBtn = page.getByRole("button", { name: /Ajouter un arrêt/i });
				if (await addArretBtn.isVisible()) {
					await addArretBtn.click();

					// Verifier que le modal s'ouvre
					await expect(page.getByText("Nouvel arrêt")).toBeVisible();

					// Nom de l'arret (obligatoire)
					const nameInput = page.locator('input[type="text"]').last();
					await nameInput.fill("Arret Marche Sandaga");

					// Ordre (obligatoire - pre-rempli)
					const ordreInput = page.locator('input[type="number"]').last();
					await ordreInput.clear();
					await ordreInput.fill("1");

					// Heure de passage (optionnel mais on le remplit)
					const timeInput = page.locator('input[type="time"]').last();
					await timeInput.fill("07:15");

					// Soumettre
					await page.getByRole("button", { name: "Créer" }).click();

					// Verifier que l'arret apparait
					await expect(page.getByText("Arret Marche Sandaga")).toBeVisible({ timeout: 10_000 });
				}
			}
		});

		test("ajouter un deuxieme arret", async ({ page }) => {
			await page.goto("/transport/itineraires");
			await waitForLoad(page);

			const expandBtn = page.getByTitle("Voir les arrêts").first();
			if (await expandBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
				await expandBtn.click();
				await page.waitForTimeout(1000);

				const addArretBtn = page.getByRole("button", { name: /Ajouter un arrêt/i });
				if (await addArretBtn.isVisible()) {
					await addArretBtn.click();
					await expect(page.getByText("Nouvel arrêt")).toBeVisible();

					const nameInput = page.locator('input[type="text"]').last();
					await nameInput.fill("Arret Universite");

					const ordreInput = page.locator('input[type="number"]').last();
					await ordreInput.clear();
					await ordreInput.fill("2");

					const timeInput = page.locator('input[type="time"]').last();
					await timeInput.fill("07:30");

					await page.getByRole("button", { name: "Créer" }).click();
					await expect(page.getByText("Arret Universite")).toBeVisible({ timeout: 10_000 });
				}
			}
		});
	});

	test.describe("Affectations transport", () => {
		test("affecter un eleve a un itineraire avec un arret", async ({ page }) => {
			await page.goto("/transport/affectations");
			await waitForLoad(page);

			// Cliquer sur "Nouvelle affectation"
			const newBtn = page.getByRole("button", { name: /Nouvelle affectation/i });
			if (await newBtn.isEnabled()) {
				await newBtn.click();

				// Verifier que le modal s'ouvre
				await expect(page.getByText("Nouvelle affectation").first()).toBeVisible();

				// Rechercher un eleve
				const searchInput = page.getByPlaceholder("Rechercher par nom ou matricule...");
				await searchInput.fill("Dia");
				await page.waitForTimeout(500);

				// Selectionner un eleve dans la liste deroulante
				const eleveSelect = page
					.locator("select")
					.filter({ has: page.locator("option", { hasText: "Sélectionner un élève" }) });
				const eleveOptions = await eleveSelect.locator("option").all();
				if (eleveOptions.length > 1) {
					await eleveSelect.selectOption({ index: 1 });
				}

				// Selectionner un itineraire
				const itineraireSelect = page
					.locator("select")
					.filter({ has: page.locator("option", { hasText: "Sélectionner un itinéraire" }) });
				const itineraireOptions = await itineraireSelect.locator("option").all();
				if (itineraireOptions.length > 1) {
					await itineraireSelect.selectOption({ index: 1 });
					await page.waitForTimeout(1000);
				}

				// Selectionner un arret (depend de l'itineraire)
				const arretSelect = page
					.locator("select")
					.filter({ has: page.locator("option", { hasText: "Sélectionner un arrêt" }) });
				await page.waitForTimeout(1000);
				const arretOptions = await arretSelect.locator("option").all();
				if (arretOptions.length > 1) {
					await arretSelect.selectOption({ index: 1 });
				}

				// Soumettre
				await page.getByRole("button", { name: "Créer" }).click();
				await page.waitForTimeout(3000);
			}
		});
	});
});
