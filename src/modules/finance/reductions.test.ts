import { describe, expect, it } from "vitest";
import { montantReduction, montantReduit, type Reduction } from "./reductions";

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
