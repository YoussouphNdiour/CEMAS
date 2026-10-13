import { describe, expect, it } from "vitest";
import type { RapportEtablissement } from "@/modules/reports/types";
import { PARAMETRES_DEFAUT } from "@/modules/settings/defaults";
import { buildRapportEtablissementPdf } from "./generate-rapport-etablissement-pdf";

const base: RapportEtablissement = {
	annee: { libelle: "2026-2027", dateDebut: "2026-10-01", dateFin: "2027-07-31" },
	effectifs: [
		{ niveau: "Élémentaire", classe: "CP", capacite: 30, garcons: 12, filles: 15, total: 27 },
		{ niveau: "Moyen", classe: "6eme", capacite: 30, garcons: 10, filles: 8, total: 18 },
	],
	bilan: {
		lignes: [
			{
				annee: 2026,
				mois: 10,
				paiements: 900_000,
				recettes: 0,
				depenses: 100_000,
				salaires: 400_000,
				solde: 400_000,
				soldeCumule: 400_000,
			},
		],
		totaux: {
			totalPaiements: 900_000,
			totalRecettes: 0,
			totalDepenses: 100_000,
			totalSalaires: 400_000,
			solde: 400_000,
		},
	},
	impayes: {
		totalDu: 1_000_000,
		totalPaye: 900_000,
		totalReste: 100_000,
		parClasse: [{ classe: "CP", reste: 60_000, eleves: 2 }],
		top: [{ eleve: "Joshua Ngoma", classe: "Crèche", reste: 40_000 }],
	},
	reductions: { parType: [{ type: "negociee", nombre: 1 }], montantTotal: 40_000 },
	personnel: {
		parType: [{ type: "enseignant", nombre: 8 }],
		masseMensuelle: 800_000,
		salairesPayes: 400_000,
	},
	transport: {
		vehicules: [{ immatriculation: "TH-1234-A", capacite: 20 }],
		itineraires: 2,
		eleves: 15,
	},
};

describe("buildRapportEtablissementPdf", () => {
	it("contient les quatre sections et les chiffres clés", () => {
		const texte = buildRapportEtablissementPdf(base, PARAMETRES_DEFAUT).output();
		for (const titre of ["Effectifs", "Finances de l", "Impay", "Personnel et transport"])
			expect(texte).toContain(titre);
		expect(texte).toContain("2026-2027");
		expect(texte).toContain("Joshua Ngoma");
		expect(texte).toContain("TH-1234-A");
		expect(texte).toContain("400 000 FCFA");
		expect(texte).toContain("45"); // effectif total
	});

	it("sections vides : mentions explicites, pas d'erreur", () => {
		const vide: RapportEtablissement = {
			...base,
			effectifs: [],
			impayes: { ...base.impayes, parClasse: [], top: [] },
			reductions: { parType: [], montantTotal: 0 },
			personnel: { parType: [], masseMensuelle: 0, salairesPayes: 0 },
			transport: { vehicules: [], itineraires: 0, eleves: 0 },
		};
		const texte = buildRapportEtablissementPdf(vide, PARAMETRES_DEFAUT).output();
		expect(texte).toContain("Aucun v");
		expect(texte).toContain("Aucun impay");
	});
});
