import { expect, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

test.describe("12 - Fiches de paie", () => {
	test("télécharger la fiche d'un employé et les fiches du mois", async ({ page }) => {
		await login(page);
		const now = new Date();
		const mois = now.getMonth() + 1;
		const annee = now.getFullYear();
		const nom = `Paie${Date.now()}`;
		const employe = await trpc<{ id: string; matricule: string }>(
			page,
			"payroll.employes.create",
			{
				prenom: "Fiche",
				nom,
				poste: "Surveillant",
				type: "administratif",
				salaireBase: 90_000,
				dateEmbauche: "2026-09-01",
			},
			true,
		);
		await trpc(page, "payroll.bulletins.generate", { mois, annee }, true);

		await page.goto("/payroll/bulletins");
		await waitForLoad(page);
		// La liste est paginée : rechercher l'employé
		await page.getByPlaceholder(/Rechercher/).fill(nom);
		const ligne = page.getByRole("row", { name: new RegExp(employe.matricule) });
		const unique = page.waitForEvent("download");
		await ligne.getByRole("button", { name: "Fiche" }).click();
		const p = `${annee}-${String(mois).padStart(2, "0")}`;
		expect((await unique).suggestedFilename()).toBe(`fiche-paie-${employe.matricule}-${p}.pdf`);

		const lot = page.waitForEvent("download");
		await page.getByRole("button", { name: /Imprimer les fiches du mois \(\d+\)/ }).click();
		const fichier = await lot;
		expect(fichier.suggestedFilename()).toMatch(new RegExp(`^fiches?-paie-.*${p}\\.pdf$`));
	});
});
