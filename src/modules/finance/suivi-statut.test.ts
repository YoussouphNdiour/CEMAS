import { describe, expect, it } from "vitest";
import { statutMois } from "./suivi-statut";

const sco = { mensuel: true, obligatoire: true };
const cantine = { mensuel: true, obligatoire: false };

describe("statutMois", () => {
	it("payé l'emporte toujours", () => {
		expect(statutMois(sco, 10, true, { forfait: true, dus: new Set([11]) })).toBe("paye");
	});
	it("forfait + échéancier : octobre inclus, juin non dû, novembre impayé", () => {
		const ctx = { forfait: true, dus: new Set([11, 12, 1, 2, 3, 4, 5]) };
		expect(statutMois(sco, 10, false, ctx)).toBe("inclus");
		expect(statutMois(sco, 6, false, ctx)).toBe("non_du");
		expect(statutMois(sco, 11, false, ctx)).toBe("impaye");
	});
	it("forfait sans échéancier : octobre inclus, autres mois non dus", () => {
		const ctx = { forfait: true, dus: new Set<number>() };
		expect(statutMois(sco, 10, false, ctx)).toBe("inclus");
		expect(statutMois(sco, 11, false, ctx)).toBe("non_du");
	});
	it("niveau non configuré : règle historique (impayé)", () => {
		const ctx = { forfait: false, dus: new Set<number>() };
		expect(statutMois(sco, 10, false, ctx)).toBe("impaye");
	});
	it("frais facultatif : jamais inclus", () => {
		expect(statutMois(cantine, 10, false, { forfait: true, dus: new Set([11]) })).toBe("impaye");
	});
});
