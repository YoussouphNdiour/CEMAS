import { describe, expect, it } from "vitest";
import {
	montantAnnuelReduction,
	montantReduction,
	montantReduit,
	type Reduction,
} from "./reductions";

const r = (portee: Reduction["portee"], mode: Reduction["mode"], valeur: number): Reduction => ({
	type: "negociee",
	portee,
	mode,
	valeur,
});

describe("montantReduit", () => {
	it("montant fixe sur le forfait", () => {
		expect(montantReduit(80_000, r("forfait", "montant", 40_000), "forfait")).toBe(40_000);
	});
	it("pourcentage sur les mensualités (arrondi)", () => {
		expect(montantReduit(24_000, r("mensualites", "pourcentage", 50), "mensualite")).toBe(12_000);
		expect(montantReduit(17_500, r("mensualites", "pourcentage", 33), "mensualite")).toBe(11_725);
	});
	it("les deux : s'applique au forfait et aux mensualités", () => {
		expect(montantReduit(70_000, r("les_deux", "pourcentage", 10), "forfait")).toBe(63_000);
		expect(montantReduit(30_000, r("les_deux", "pourcentage", 10), "mensualite")).toBe(27_000);
	});
	it("portée non concernée : tarif inchangé", () => {
		expect(montantReduit(80_000, r("mensualites", "montant", 5_000), "forfait")).toBe(80_000);
		expect(montantReduit(20_000, r("forfait", "montant", 5_000), "mensualite")).toBe(20_000);
	});
	it("jamais négatif ; gratuité à 100 %", () => {
		expect(montantReduit(20_000, r("mensualites", "montant", 25_000), "mensualite")).toBe(0);
		expect(montantReduit(67_000, r("les_deux", "pourcentage", 100), "forfait")).toBe(0);
	});
	it("sans réduction", () => {
		expect(montantReduit(65_000, null, "forfait")).toBe(65_000);
		expect(montantReduction(65_000, undefined, "forfait")).toBe(0);
	});
	it("montant de la réduction", () => {
		expect(montantReduction(80_000, r("forfait", "montant", 40_000), "forfait")).toBe(40_000);
	});
});

describe("montantAnnuelReduction (M4)", () => {
	it("niveau au forfait : forfait + échéancier", () => {
		expect(
			montantAnnuelReduction(r("les_deux", "pourcentage", 10), {
				forfait: 70_000,
				echeancier: [25_000, 30_000],
				uniques: [],
				mensuels: [25_000],
				nbMois: 10,
			}),
		).toBe(7_000 + 2_500 + 3_000);
	});
	it("forfait sans échéancier : aucune mensualité", () => {
		expect(
			montantAnnuelReduction(r("mensualites", "montant", 5_000), {
				forfait: 70_000,
				echeancier: null,
				uniques: [],
				mensuels: [25_000],
				nbMois: 10,
			}),
		).toBe(0);
	});
	it("niveau en grille : frais uniques + mensualités × nombre de mois", () => {
		expect(
			montantAnnuelReduction(r("les_deux", "montant", 1_000), {
				forfait: null,
				echeancier: null,
				uniques: [50_000],
				mensuels: [17_000],
				nbMois: 10,
			}),
		).toBe(1_000 + 10 * 1_000);
	});
});

describe("montantAnnuelReduction — cohérence avec les impayés (relecture)", () => {
	it("avec forfait, les autres frais uniques de la grille restent comptés", () => {
		expect(
			montantAnnuelReduction(r("forfait", "pourcentage", 10), {
				forfait: 70_000,
				echeancier: null,
				uniques: [5_000],
				mensuels: [],
				nbMois: 10,
			}),
		).toBe(7_000 + 500);
	});
	it("l'échéancier s'applique à chaque frais mensuel obligatoire", () => {
		expect(
			montantAnnuelReduction(r("mensualites", "montant", 1_000), {
				forfait: 70_000,
				echeancier: [25_000, 30_000],
				uniques: [],
				mensuels: [25_000, 3_000],
				nbMois: 10,
			}),
		).toBe(2 * 2 * 1_000);
	});
});
