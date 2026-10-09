import { describe, expect, it } from "vitest";
import {
	aujourdhuiServeur,
	choisirDerniereSauvegarde,
	etatFenetrePassage,
	libelleDateFr,
	sauvegardeRecente,
} from "./fenetre";

describe("etatFenetrePassage", () => {
	const fin = "2027-07-31";
	it("aucun avant le 15 juin", () => {
		expect(etatFenetrePassage(fin, "2027-06-14").etat).toBe("aucun");
	});
	it("préparation du 15 juin au dernier jour inclus", () => {
		expect(etatFenetrePassage(fin, "2027-06-15").etat).toBe("preparation");
		expect(etatFenetrePassage(fin, "2027-07-31").etat).toBe("preparation");
	});
	it("ouvert dès le lendemain de la fin", () => {
		expect(etatFenetrePassage(fin, "2027-08-01")).toEqual({
			etat: "ouvert",
			ouverture: "2027-08-01",
			debutPreparation: "2027-06-15",
		});
	});
	it("suit une date de fin différente", () => {
		expect(etatFenetrePassage("2027-06-30", "2027-07-01").etat).toBe("ouvert");
		expect(etatFenetrePassage("2027-06-30", "2027-06-30").etat).toBe("preparation");
	});
});

describe("aujourdhuiServeur", () => {
	const maintenant = new Date("2026-10-09T23:30:00Z");
	it("date UTC du jour", () => {
		expect(aujourdhuiServeur({ NODE_ENV: "development" }, maintenant)).toBe("2026-10-09");
	});
	it("PASSAGE_AUJOURDHUI hors production", () => {
		expect(
			aujourdhuiServeur({ NODE_ENV: "development", PASSAGE_AUJOURDHUI: "2027-08-01" }, maintenant),
		).toBe("2027-08-01");
	});
	it("PASSAGE_AUJOURDHUI ignoré en production", () => {
		expect(
			aujourdhuiServeur({ NODE_ENV: "production", PASSAGE_AUJOURDHUI: "2027-08-01" }, maintenant),
		).toBe("2026-10-09");
	});
	it("PASSAGE_AUJOURDHUI invalide ignoré", () => {
		expect(aujourdhuiServeur({ NODE_ENV: "test", PASSAGE_AUJOURDHUI: "demain" }, maintenant)).toBe(
			"2026-10-09",
		);
	});
});

describe("sauvegardes", () => {
	const f = (nom: string, iso: string) => ({ nom, mtime: new Date(iso), taille: 1000 });
	it("choisit la plus récente parmi cemas-* et prepassage-*", () => {
		expect(
			choisirDerniereSauvegarde([
				f("cemas-20271001-020000.dump", "2027-10-01T02:00:00Z"),
				f("prepassage-20271001-090000.dump", "2027-10-01T09:00:00Z"),
				f("autre.txt", "2027-10-02T00:00:00Z"),
				f("cemas-x.dump.tmp", "2027-10-02T00:00:00Z"),
				f("cemas-20271001-100000123-a1b2c3.dump.tmp", "2027-10-03T00:00:00Z"),
			])?.nom,
		).toBe("prepassage-20271001-090000.dump");
	});
	it("reconnaît les noms des sauvegardes faites depuis l'application (ms + suffixe)", () => {
		expect(
			choisirDerniereSauvegarde([
				f("cemas-20271001-020000.dump", "2027-10-01T02:00:00Z"),
				f("prepassage-20271001-090000123-a1b2c3.dump", "2027-10-01T09:00:00Z"),
			])?.nom,
		).toBe("prepassage-20271001-090000123-a1b2c3.dump");
	});
	it("aucune sauvegarde", () => {
		expect(choisirDerniereSauvegarde([])).toBeNull();
		expect(sauvegardeRecente(null, new Date())).toBe(false);
	});
	it("moins de 24 h : récente ; 24 h ou plus : non", () => {
		const maintenant = new Date("2027-08-02T02:00:00Z");
		expect(sauvegardeRecente(f("cemas-a.dump", "2027-08-01T02:00:01Z"), maintenant)).toBe(true);
		expect(sauvegardeRecente(f("cemas-a.dump", "2027-08-01T02:00:00Z"), maintenant)).toBe(false);
	});
});

describe("libelleDateFr", () => {
	it("1er et jours ordinaires", () => {
		expect(libelleDateFr("2027-08-01")).toBe("1er août 2027");
		expect(libelleDateFr("2027-06-15")).toBe("15 juin 2027");
	});
});
