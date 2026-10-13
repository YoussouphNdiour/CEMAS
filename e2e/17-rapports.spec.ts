import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Comptabilite = {
	solde: number;
	totalEncaissements: number;
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

		const apres = await trpc<Comptabilite>(page, "reports.comptabilite", { du: jour, au: jour });
		expect(apres.solde - avant.solde).toBe(12_345 - 4_321);
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
});
