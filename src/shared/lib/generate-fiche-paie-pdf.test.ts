import { describe, expect, it } from "vitest";
import { PARAMETRES_DEFAUT } from "@/modules/settings/defaults";
import { buildFichesPaiePdf, type FichePaie } from "./generate-fiche-paie-pdf";

const fiche = (overrides: Partial<FichePaie> = {}): FichePaie => ({
	employeMatricule: "EMP-001",
	employePrenom: "Fatou",
	employeNom: "Ndiaye",
	employePoste: "Enseignante CP",
	mois: 10,
	annee: 2026,
	salaireBase: 150_000,
	primes: 10_000,
	retenues: 5_000,
	netAPayer: 155_000,
	paye: true,
	datePaiement: "2026-10-09",
	note: null,
	...overrides,
});

describe("buildFichesPaiePdf", () => {
	it("produit une page par bulletin avec employé, période, montants et statut payé", () => {
		const doc = buildFichesPaiePdf(
			[fiche(), fiche({ employeMatricule: "EMP-002", employeNom: "Sow" })],
			PARAMETRES_DEFAUT,
		);
		expect(doc.getNumberOfPages()).toBe(2);
		const contenu = doc.output();
		for (const attendu of [
			"BULLETIN DE PAIE",
			"Octobre 2026",
			"Fatou Ndiaye",
			"EMP-001",
			"EMP-002",
			"Enseignante CP",
			"150 000 FCFA",
			"155 000 FCFA",
			"Payé le 09 octobre 2026",
			PARAMETRES_DEFAUT.nom,
		]) {
			expect(contenu).toContain(attendu);
		}
	});

	it("indique un bulletin non payé et affiche la note", () => {
		const contenu = buildFichesPaiePdf(
			[fiche({ paye: false, datePaiement: null, note: "Avance de 20 000 déduite" })],
			PARAMETRES_DEFAUT,
		).output();
		expect(contenu).toContain("Non payé");
		expect(contenu).toContain("Avance de 20 000 déduite");
	});
});
