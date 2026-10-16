import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Comptabilite = {
	solde: number;
	totalEncaissements: number;
	totalFournitures: number;
	fournitures: { rubrique: string; montant: number }[];
	encaissements: { rubrique: string; montant: number }[];
	totalDepenses: number;
	operations: { nature: string; reference: string; libelle: string; montant: number }[];
};

async function anneeActive(page: Page) {
	const annees = await trpc<{ id: string; active: boolean; libelle: string }[]>(
		page,
		"academic.annees.list",
	);
	const a = annees.find((x) => x.active);
	if (!a) throw new Error("Aucune année active");
	return a;
}

const aujourdhui = () => {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("17 - Rapports", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("API : comptabilité du jour et rapport de l'établissement", async ({ page }) => {
		const annee = await anneeActive(page);
		const jour = aujourdhui();
		const avant = await trpc<Comptabilite>(page, "reports.comptabilite", { du: jour, au: jour });

		const niveaux = await trpc<{ id: string; nom: string }[]>(page, "academic.niveaux.list");
		const elem = niveaux.find((n) => n.nom === "Élémentaire") ?? niveaux[0];
		const nomClasse = `RAPP-${Date.now()}`;
		const classe = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{ nom: nomClasse, niveauId: elem.id, capacite: 25, anneeScolaireId: annee.id },
			true,
		);
		const nom = `Rapport${Date.now()}`;
		const eleve = await trpc<{ id: string }>(
			page,
			"students.create",
			{
				prenom: "Compta",
				nom,
				dateNaissance: "2016-01-01",
				sexe: "F",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "P", nom: "R", telephone: "77 000 00 23", relation: "mere" },
			},
			true,
		);
		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		const paiement = await trpc<{ numeroRecu: string }>(
			page,
			"finance.paiements.create",
			{
				eleveId: eleve.id,
				typeFraisId: frais.find((f) => f.nom === "Scolarité")?.id,
				anneeScolaireId: annee.id,
				mois: 11,
				montant: 12_345,
			},
			true,
		);
		const [categorie] = await trpc<{ id: string }[]>(page, "finance.depenses.categories");
		await trpc(
			page,
			"finance.depenses.create",
			{
				categorieId: categorie.id,
				anneeScolaireId: annee.id,
				libelle: `Craie ${nom}`,
				montant: 4_321,
				date: jour,
			},
			true,
		);

		// Fourniture : rubrique à part, hors encaissements élèves
		await trpc(
			page,
			"finance.paiements.create",
			{
				eleveId: eleve.id,
				typeFraisId: frais.find((f) => f.nom === "Fourniture")?.id,
				anneeScolaireId: annee.id,
				mois: 10,
				montant: 3_333,
			},
			true,
		);

		const apres = await trpc<Comptabilite>(page, "reports.comptabilite", { du: jour, au: jour });
		expect(apres.totalFournitures - avant.totalFournitures).toBe(3_333);
		expect(apres.encaissements.some((e) => e.rubrique === "Fourniture")).toBe(false);
		expect(apres.solde - avant.solde).toBe(12_345 + 3_333 - 4_321);
		expect(apres.totalEncaissements - avant.totalEncaissements).toBe(12_345);
		const opPaiement = apres.operations.find((o) => o.reference === paiement.numeroRecu);
		expect(opPaiement).toMatchObject({ nature: "paiement", montant: 12_345 });
		expect(opPaiement?.libelle).toContain(nom);
		expect(apres.operations.find((o) => o.libelle.includes(`Craie ${nom}`))).toMatchObject({
			nature: "depense",
			montant: 4_321,
		});

		const rapport = await trpc<{
			effectifs: {
				classe: string;
				filles: number;
				garcons: number;
				total: number;
				capacite: number;
			}[];
			bilan: { totaux: { totalPaiements: number } };
			impayes: { totalReste: number };
			personnel: { masseMensuelle: number };
			transport: { vehicules: unknown[] };
		}>(page, "reports.etablissement", { anneeScolaireId: annee.id });
		expect(rapport.effectifs.find((e) => e.classe === nomClasse)).toMatchObject({
			filles: 1,
			garcons: 0,
			total: 1,
			capacite: 25,
		});
		expect(rapport.bilan.totaux.totalPaiements).toBeGreaterThanOrEqual(12_345);
		expect(rapport.impayes.totalReste).toBeGreaterThan(0);
	});
	test("page Rapports : téléchargement des deux PDF, raccourci du tableau de bord", async ({
		page,
	}) => {
		const annee = await anneeActive(page);
		await page.goto("/");
		await waitForLoad(page);
		await page.getByRole("main").getByRole("link", { name: "Rapports" }).click();
		await expect(page).toHaveURL(/\/rapports$/);

		const compta = page.getByRole("region", { name: "Comptabilité" });
		await compta.getByLabel("Période").selectOption("semaine");
		const [pdfCompta] = await Promise.all([
			page.waitForEvent("download"),
			compta.getByRole("button", { name: "Télécharger le PDF" }).click(),
		]);
		expect(pdfCompta.suggestedFilename()).toMatch(
			/^rapport-comptable-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/,
		);

		await compta.getByLabel("Période").selectOption("annee");
		const [pdfAnnee] = await Promise.all([
			page.waitForEvent("download"),
			compta.getByRole("button", { name: "Télécharger le PDF" }).click(),
		]);
		expect(pdfAnnee.suggestedFilename()).toMatch(/^rapport-comptable-/);

		const etab = page.getByRole("region", { name: "Rapport de l'établissement" });
		const [pdfEtab] = await Promise.all([
			page.waitForEvent("download"),
			etab.getByRole("button", { name: "Télécharger le PDF" }).click(),
		]);
		expect(pdfEtab.suggestedFilename()).toBe(`rapport-etablissement-${annee.libelle}.pdf`);
	});
	test("année scolaire : la comptabilité concorde avec le bilan, reste par niveau (relecture)", async ({
		page,
	}) => {
		const annee = await anneeActive(page);
		const [categorie] = await trpc<{ id: string }[]>(page, "finance.depenses.categories");
		// Dépense rattachée à l'année mais datée avant son début (achats de rentrée)
		const libelle = `Rentree ${Date.now()}`;
		await trpc(
			page,
			"finance.depenses.create",
			{
				categorieId: categorie.id,
				anneeScolaireId: annee.id,
				libelle,
				montant: 7_777,
				date: "2026-09-20",
			},
			true,
		);
		const compta = await trpc<Comptabilite>(page, "reports.comptabilite", {
			du: "2026-10-01",
			au: "2027-07-31",
			anneeScolaireId: annee.id,
		});
		expect(compta.operations.some((o) => o.libelle === libelle)).toBe(true);
		const bilan = await trpc<{
			totalPaiements: number;
			totalDepenses: number;
			totalSalaires: number;
			totalRecettes: number;
			solde: number;
		}>(page, "finance.bilan.summary", { anneeScolaireId: annee.id });
		expect(compta.totalEncaissements + compta.totalFournitures).toBe(bilan.totalPaiements);
		expect(compta.totalDepenses).toBe(bilan.totalDepenses);
		expect(compta.solde).toBe(bilan.solde);

		const rapport = await trpc<{
			impayes: { parNiveau: { niveau: string; reste: number }[]; totalReste: number };
		}>(page, "reports.etablissement", { anneeScolaireId: annee.id });
		expect(rapport.impayes.parNiveau.reduce((t, n) => t + n.reste, 0)).toBe(
			rapport.impayes.totalReste,
		);
	});
});
