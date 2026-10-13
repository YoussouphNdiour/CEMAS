import { describe, expect, it } from "vitest";
import { construireComptabilite, type Operation } from "@/modules/reports/comptabilite";
import { PARAMETRES_DEFAUT } from "@/modules/settings/defaults";
import { buildRapportComptablePdf } from "./generate-rapport-comptable-pdf";

const op = (i: number, o: Partial<Operation> = {}): Operation => ({
	date: "2026-10-13",
	ordre: `2026-10-13T08:${String(i % 60).padStart(2, "0")}:00Z`,
	nature: "paiement",
	reference: `REC-2026-${String(i).padStart(4, "0")}`,
	libelle: `Élève ${i} — Scolarité novembre`,
	rubrique: "Scolarité",
	montant: 1_000,
	...o,
});

const rapport = (ops: Operation[]) => ({
	du: "2026-10-12",
	au: "2026-10-18",
	...construireComptabilite(ops),
});

describe("buildRapportComptablePdf", () => {
	it("affiche le titre, la période, la synthèse et le solde", () => {
		const doc = buildRapportComptablePdf(
			rapport([
				op(1, { montant: 70_000, rubrique: "Inscription" }),
				op(2, { nature: "depense", montant: 4_000, rubrique: "Fournitures", libelle: "Craie" }),
				op(3, {
					nature: "salaire",
					montant: 60_000,
					rubrique: "Salaires",
					libelle: "Awa Ndiaye — salaire octobre 2026",
				}),
			]),
			"Semaine du 12 au 18 octobre 2026",
			PARAMETRES_DEFAUT,
		);
		const texte = doc.output();
		expect(texte).toContain("Rapport de comptabilit");
		expect(texte).toContain("Semaine du 12 au 18 octobre 2026");
		expect(texte).toContain("70 000 FCFA");
		expect(texte).toContain("Craie");
		expect(texte).toContain("Solde de la p");
		expect(texte).toContain("6 000 FCFA");
		expect(texte).toContain(PARAMETRES_DEFAUT.nom);
	});

	it("pagine un long détail et garde le total final", () => {
		const ops = Array.from({ length: 300 }, (_, i) => op(i + 1));
		const doc = buildRapportComptablePdf(rapport(ops), "Octobre 2026", PARAMETRES_DEFAUT);
		const pages = doc.getNumberOfPages();
		expect(pages).toBeGreaterThan(3);
		const texte = doc.output();
		expect(texte).toContain(`Page 1 / ${pages}`);
		expect(texte).toContain(`Page ${pages} / ${pages}`);
		expect(texte).toContain("REC-2026-0300");
		expect(texte).toContain("300 000 FCFA");
	});

	it("période vide : mention explicite", () => {
		const doc = buildRapportComptablePdf(rapport([]), "Mardi 13 octobre 2026", PARAMETRES_DEFAUT);
		expect(doc.output()).toContain("Aucune op");
	});
});
