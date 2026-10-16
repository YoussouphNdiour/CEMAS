import { describe, expect, it } from "vitest";
import { fraisUniqueVisible, statutFraisUnique, statutMois, statutService } from "./suivi-statut";

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

describe("statutFraisUnique", () => {
	it("payé directement", () =>
		expect(statutFraisUnique(true, { associe: true, inscriptionPayee: false })).toBe("paye"));
	it("associé + inscription payée → inclus", () =>
		expect(statutFraisUnique(false, { associe: true, inscriptionPayee: true })).toBe("inclus"));
	it("associé sans inscription → impayé", () =>
		expect(statutFraisUnique(false, { associe: true, inscriptionPayee: false })).toBe("impaye"));
	it("non associé → impayé", () =>
		expect(statutFraisUnique(false, { associe: false, inscriptionPayee: true })).toBe("impaye"));
});

describe("fraisUniqueVisible", () => {
	it("niveau sans forfait : visible", () =>
		expect(fraisUniqueVisible({ forfait: false, associe: false, payeDansClasse: false })).toBe(
			true,
		));
	it("associé : visible", () =>
		expect(fraisUniqueVisible({ forfait: true, associe: true, payeDansClasse: false })).toBe(true));
	it("non associé sans paiement : masqué", () =>
		expect(fraisUniqueVisible({ forfait: true, associe: false, payeDansClasse: false })).toBe(
			false,
		));
	it("non associé mais payé dans la classe : visible", () =>
		expect(fraisUniqueVisible({ forfait: true, associe: false, payeDansClasse: true })).toBe(true));
});

describe("statutService", () => {
	const ab = { moisDebut: 11, moisFin: 2 };
	it("payé l'emporte", () => expect(statutService(10, true, null)).toBe("paye"));
	it("dans l'abonnement et non payé : impayé", () =>
		expect(statutService(12, false, ab)).toBe("impaye"));
	it("hors abonnement : non dû", () => {
		expect(statutService(10, false, ab)).toBe("non_du");
		expect(statutService(3, false, ab)).toBe("non_du");
	});
	it("sans abonnement : non dû", () => expect(statutService(11, false, null)).toBe("non_du"));
	it("juillet n'est jamais dû", () =>
		expect(statutService(7, false, { moisDebut: 10, moisFin: null })).toBe("non_du"));
});
