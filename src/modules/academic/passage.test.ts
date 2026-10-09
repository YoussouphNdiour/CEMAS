import { describe, expect, it } from "vitest";
import { type ClassePassage, planifierPassage } from "./passage";

const A: ClassePassage = {
	id: "A",
	nom: "CP",
	capacite: 2,
	classeSuivanteId: "B",
	finDeCycle: false,
};
const B: ClassePassage = {
	id: "B",
	nom: "CE1",
	capacite: 30,
	classeSuivanteId: null,
	finDeCycle: true,
};
const eleves = [
	{ id: "e1", classeId: "A" },
	{ id: "e2", classeId: "A" },
	{ id: "e3", classeId: "B" },
	{ id: "e4", classeId: "A" },
];

describe("planifierPassage", () => {
	it("par défaut : passe en classe suivante ; fin de cycle → sortant", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: {} });
		expect(p.erreurs).toEqual([]);
		expect(p.mouvements.find((m) => m.eleveId === "e1")).toEqual({
			eleveId: "e1",
			classeSourceId: "A",
			resultat: "promu",
			classeDestinationSourceId: "B",
		});
		expect(p.mouvements.find((m) => m.eleveId === "e3")).toMatchObject({
			resultat: "sortant",
			classeDestinationSourceId: null,
		});
	});

	it("redouble → même classe ; quitte → départ", () => {
		const p = planifierPassage({
			classes: [A, B],
			eleves,
			decisions: { e2: "redouble", e4: "quitte" },
		});
		expect(p.mouvements.find((m) => m.eleveId === "e2")).toMatchObject({
			resultat: "redouble",
			classeDestinationSourceId: "A",
		});
		expect(p.mouvements.find((m) => m.eleveId === "e4")).toMatchObject({
			resultat: "depart",
			classeDestinationSourceId: null,
		});
	});

	it("compte par classe et calcule les effectifs prévus", () => {
		const p = planifierPassage({
			classes: [A, B],
			eleves,
			decisions: { e2: "redouble", e4: "quitte" },
		});
		expect(p.parClasse).toEqual([
			{ classeId: "A", nom: "CP", promus: 1, redoublants: 1, sortants: 0, departs: 1 },
			{ classeId: "B", nom: "CE1", promus: 0, redoublants: 0, sortants: 1, departs: 0 },
		]);
		expect(p.effectifsPrevus).toEqual([
			{ classeSourceId: "A", nom: "CP", effectif: 1, capacite: 2 },
			{ classeSourceId: "B", nom: "CE1", effectif: 1, capacite: 30 },
		]);
	});

	it("effectif prévu au-delà de la capacité : signalé par les nombres, pas une erreur", () => {
		const p = planifierPassage({
			classes: [A, B],
			eleves,
			decisions: { e1: "redouble", e2: "redouble", e4: "redouble" },
		});
		expect(p.erreurs).toEqual([]);
		expect(p.effectifsPrevus[0]).toMatchObject({ effectif: 3, capacite: 2 });
	});

	it("refuse une classe non configurée", () => {
		const p = planifierPassage({
			classes: [{ ...A, classeSuivanteId: null }, B],
			eleves,
			decisions: {},
		});
		expect(p.erreurs).toEqual(["CP : classe suivante non configurée"]);
		expect(p.mouvements).toEqual([]);
	});

	it("refuse une classe suivante invalide (hors année ou elle-même)", () => {
		expect(
			planifierPassage({ classes: [{ ...A, classeSuivanteId: "X" }, B], eleves, decisions: {} })
				.erreurs,
		).toEqual(["CP : classe suivante invalide"]);
		expect(
			planifierPassage({ classes: [{ ...A, classeSuivanteId: "A" }, B], eleves, decisions: {} })
				.erreurs,
		).toEqual(["CP : classe suivante invalide"]);
	});

	it("refuse une décision pour un élève non concerné", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: { inconnu: "passe" } });
		expect(p.erreurs).toEqual(["Décision pour un élève non concerné : inconnu"]);
	});

	it("refuse deux classes de même nom dans l'année (sinon fusion silencieuse)", () => {
		const doublon: ClassePassage = { ...B, id: "B2", nom: " ce1 " };
		const p = planifierPassage({ classes: [A, B, doublon], eleves, decisions: {} });
		expect(p.erreurs).toEqual([
			"Plusieurs classes nommées « CE1 » : renommez-les avant le passage",
		]);
	});
});
