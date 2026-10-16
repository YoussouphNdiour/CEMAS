import { describe, expect, it } from "vitest";
import { moisDusAbonnement, ordreScolaire } from "./abonnements";
import { moisDus } from "./impayes";

const ANNEE = { debut: "2026-10-01", fin: "2027-07-31" };
const dus = (aujourdhui: string) => moisDus(ANNEE.debut, ANNEE.fin, aujourdhui);
const mois = (l: { mois: number }[]) => l.map((m) => m.mois);

describe("ordreScolaire", () => {
	it("octobre en premier, septembre en dernier", () => {
		expect([10, 11, 12, 1, 6, 9].map(ordreScolaire)).toEqual([0, 1, 2, 3, 8, 11]);
	});
});

describe("moisDusAbonnement", () => {
	it("de novembre au mois courant (décembre)", () => {
		expect(mois(moisDusAbonnement({ moisDebut: 11, moisFin: null }, dus("2026-12-15")))).toEqual([
			11, 12,
		]);
	});
	it("arrêt en février", () => {
		expect(mois(moisDusAbonnement({ moisDebut: 11, moisFin: 2 }, dus("2027-04-10")))).toEqual([
			11, 12, 1, 2,
		]);
	});
	it("juin est le dernier mois dû, même sans arrêt", () => {
		expect(mois(moisDusAbonnement({ moisDebut: 5, moisFin: null }, dus("2027-07-20")))).toEqual([
			5, 6,
		]);
	});
	it("début après le mois courant : rien de dû", () => {
		expect(moisDusAbonnement({ moisDebut: 1, moisFin: null }, dus("2026-11-05"))).toEqual([]);
	});
});

describe("moisDusAbonnement — fin après juin", () => {
	it("un mois de fin en août s'arrête en juin", () => {
		expect(mois(moisDusAbonnement({ moisDebut: 4, moisFin: 8 }, dus("2027-09-10")))).toEqual([
			4, 5, 6,
		]);
	});
});
