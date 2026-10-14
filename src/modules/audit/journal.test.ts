import { describe, expect, it } from "vitest";
import { differences } from "./journal";

describe("differences", () => {
	it("ne garde que les champs modifiés", () => {
		expect(differences({ a: 1, b: 2, c: "x" }, { a: 1, b: 3, c: "x" })).toEqual({
			avant: { b: 2 },
			apres: { b: 3 },
		});
	});
	it("renvoie null quand rien ne change", () => {
		expect(differences({ a: 1, b: "x" }, { a: 1, b: "x" })).toBeNull();
	});
	it("considère null, undefined et chaîne vide comme égaux", () => {
		expect(differences({ adresse: null, lieu: undefined }, { adresse: "", lieu: "" })).toBeNull();
	});
	it("compare les dates par leur valeur", () => {
		expect(
			differences({ d: new Date("2026-10-01T00:00:00Z") }, { d: new Date("2026-10-01T00:00:00Z") }),
		).toBeNull();
	});
	it("ignore les champs absents de l'après", () => {
		expect(differences({ a: 1, b: 2 }, { b: 5 })).toEqual({ avant: { b: 2 }, apres: { b: 5 } });
	});
});
