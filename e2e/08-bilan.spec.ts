import { expect, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Summary = {
	totalPaiements: number;
	totalRecettes: number;
	totalDepenses: number;
	totalSalaires: number;
	solde: number;
	mois: { annee: number; mois: number; salaires: number; depenses: number }[];
};

const fmt = (n: number) =>
	`${new Intl.NumberFormat("fr-SN", { style: "decimal", minimumFractionDigits: 0 }).format(n)} FCFA`;

test.describe("08 - Bilan incluant les salaires", () => {
	test("un salaire payé et une dépense sont déduits du solde et apparaissent par mois", async ({
		page,
	}) => {
		await login(page);
		const annees = await trpc<{ id: string; active: boolean; dateDebut: string }[]>(
			page,
			"academic.annees.list",
		);
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const [anneeDebut, moisDebut] = annee.dateDebut.split("-").map(Number);

		const avant = await trpc<Summary>(page, "finance.bilan.summary", { anneeScolaireId: annee.id });

		// Salaire : employé + bulletin du premier mois de l'année, marqué payé
		const salaire = 123_457;
		const employe = await trpc<{ id: string }>(
			page,
			"payroll.employes.create",
			{
				prenom: "Bilan",
				nom: `E2E-${Date.now()}`,
				poste: "Test",
				type: "entretien",
				salaireBase: salaire,
				dateEmbauche: annee.dateDebut,
			},
			true,
		);
		await trpc(page, "payroll.bulletins.generate", { mois: moisDebut, annee: anneeDebut }, true);
		const bulletins = await trpc<{ id: string; employeId: string }[]>(
			page,
			"payroll.bulletins.list",
			{ mois: moisDebut, annee: anneeDebut },
		);
		const bulletin = bulletins.find((b) => b.employeId === employe.id);
		if (!bulletin) throw new Error("Bulletin non généré");
		await trpc(page, "payroll.bulletins.markPaid", { id: bulletin.id }, true);

		// Dépense datée du premier jour de l'année scolaire
		const [categorie] = await trpc<{ id: string }[]>(page, "finance.depenses.categories");
		const depense = 4_321;
		await trpc(
			page,
			"finance.depenses.create",
			{
				categorieId: categorie.id,
				anneeScolaireId: annee.id,
				libelle: "Dépense bilan E2E",
				montant: depense,
				date: annee.dateDebut,
			},
			true,
		);

		const apres = await trpc<Summary>(page, "finance.bilan.summary", { anneeScolaireId: annee.id });
		expect(apres.totalSalaires - avant.totalSalaires).toBe(salaire);
		expect(apres.totalDepenses - avant.totalDepenses).toBe(depense);
		expect(avant.solde - apres.solde).toBe(salaire + depense);
		const moisDepense = apres.mois.find((l) => l.annee === anneeDebut && l.mois === moisDebut);
		expect(moisDepense?.depenses).toBeGreaterThanOrEqual(depense);
		// Les totaux du détail mensuel égalent les indicateurs
		expect(apres.mois.reduce((t, l) => t + l.salaires, 0)).toBe(apres.totalSalaires);

		await page.goto("/finances/bilan");
		await waitForLoad(page);
		await expect(page.getByText("Salaires payés").first()).toBeVisible();
		await expect(page.getByText(fmt(apres.totalSalaires)).first()).toBeVisible();
		await expect(page.getByRole("heading", { name: "Détail par mois" })).toBeVisible();
		await expect(page.getByRole("row", { name: /Total/ })).toContainText(fmt(apres.solde));
	});
});
