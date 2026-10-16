import { describe, expect, it } from "vitest";
import { construireComptabilite, type Operation } from "./comptabilite";

const op = (o: Partial<Operation> & Pick<Operation, "nature" | "montant">): Operation => ({
	date: "2026-10-13",
	ordre: "2026-10-13T10:00:00.000Z",
	reference: "",
	libelle: "",
	rubrique: "Divers",
	...o,
});

describe("construireComptabilite", () => {
	it("regroupe par rubrique, calcule le solde et trie par date puis heure", () => {
		const r = construireComptabilite([
			op({ nature: "depense", montant: 4_000, rubrique: "Fournitures", date: "2026-10-14" }),
			op({
				nature: "paiement",
				montant: 25_000,
				rubrique: "Scolarité",
				ordre: "2026-10-13T11:00:00Z",
			}),
			op({
				nature: "paiement",
				montant: 70_000,
				rubrique: "Inscription",
				ordre: "2026-10-13T09:00:00Z",
			}),
			op({
				nature: "paiement",
				montant: 20_000,
				rubrique: "Scolarité",
				ordre: "2026-10-13T12:00:00Z",
			}),
			op({ nature: "recette", montant: 5_000, rubrique: "Location salle" }),
			op({ nature: "salaire", montant: 60_000, rubrique: "Salaires" }),
		]);
		expect(r.encaissements).toEqual([
			{ rubrique: "Inscription", montant: 70_000 },
			{ rubrique: "Scolarité", montant: 45_000 },
		]);
		expect(r.totalEncaissements).toBe(115_000);
		expect(r.totalRecettes).toBe(5_000);
		expect(r.depenses).toEqual([{ rubrique: "Fournitures", montant: 4_000 }]);
		expect(r.salaires).toEqual({ nombre: 1, montant: 60_000 });
		expect(r.solde).toBe(115_000 + 5_000 - 4_000 - 60_000);
		expect(r.operations.map((o) => o.montant)).toEqual([
			70_000, 5_000, 60_000, 25_000, 20_000, 4_000,
		]);
	});
	it("période vide : tout à zéro", () => {
		const r = construireComptabilite([]);
		expect(r).toMatchObject({
			encaissements: [],
			totalEncaissements: 0,
			totalRecettes: 0,
			totalDepenses: 0,
			salaires: { nombre: 0, montant: 0 },
			solde: 0,
			operations: [],
		});
	});

	it("fournitures : rubrique à part, hors encaissements élèves, comptées dans le solde", () => {
		const r = construireComptabilite([
			op({ nature: "paiement", montant: 65_000, rubrique: "Inscription" }),
			op({ nature: "fourniture", montant: 7_000, rubrique: "Fourniture" }),
			op({ nature: "depense", montant: 2_000, rubrique: "Divers" }),
		]);
		expect(r.encaissements).toEqual([{ rubrique: "Inscription", montant: 65_000 }]);
		expect(r.totalEncaissements).toBe(65_000);
		expect(r.fournitures).toEqual([{ rubrique: "Fourniture", montant: 7_000 }]);
		expect(r.totalFournitures).toBe(7_000);
		expect(r.solde).toBe(65_000 + 7_000 - 2_000);
	});
});
