import { describe, expect, it } from "vitest";
import { bornesPeriode } from "./periode";

describe("bornesPeriode", () => {
	it("jour", () => {
		expect(bornesPeriode("jour", "2026-10-13")).toEqual({
			du: "2026-10-13",
			au: "2026-10-13",
			libelle: "Mardi 13 octobre 2026",
		});
	});
	it("semaine : un dimanche appartient à la semaine qui finit ce jour-là", () => {
		expect(bornesPeriode("semaine", "2026-10-18")).toEqual({
			du: "2026-10-12",
			au: "2026-10-18",
			libelle: "Semaine du 12 au 18 octobre 2026",
		});
	});
	it("semaine à cheval sur deux mois", () => {
		expect(bornesPeriode("semaine", "2026-11-02").libelle).toBe("Semaine du 2 au 8 novembre 2026");
		expect(bornesPeriode("semaine", "2026-10-29")).toMatchObject({
			du: "2026-10-26",
			au: "2026-11-01",
			libelle: "Semaine du 26 octobre au 1er novembre 2026",
		});
	});
	it("semaine à cheval sur deux années", () => {
		expect(bornesPeriode("semaine", "2026-12-31")).toEqual({
			du: "2026-12-28",
			au: "2027-01-03",
			libelle: "Semaine du 28 décembre 2026 au 3 janvier 2027",
		});
	});
	it("mois (février non bissextile)", () => {
		expect(bornesPeriode("mois", "2027-02-10")).toEqual({
			du: "2027-02-01",
			au: "2027-02-28",
			libelle: "Février 2027",
		});
	});
});
