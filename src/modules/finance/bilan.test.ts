import { describe, expect, it } from "vitest";
import { buildBilanMensuel, totauxBilan } from "./bilan";

const ANNEE = { dateDebut: "2026-10-01", dateFin: "2027-07-31" };
const vide = { paiements: [], recettes: [], depenses: [], salaires: [] };

describe("buildBilanMensuel", () => {
	it("affiche toujours les mois d'octobre à juillet, même sans mouvement", () => {
		const lignes = buildBilanMensuel({ ...ANNEE, ...vide });
		expect(lignes.map((l) => `${l.annee}-${l.mois}`)).toEqual([
			"2026-10",
			"2026-11",
			"2026-12",
			"2027-1",
			"2027-2",
			"2027-3",
			"2027-4",
			"2027-5",
			"2027-6",
			"2027-7",
		]);
		expect(lignes.every((l) => l.solde === 0 && l.soldeCumule === 0)).toBe(true);
	});

	it("ajoute un mois hors période s'il a des mouvements, à sa place chronologique", () => {
		const lignes = buildBilanMensuel({
			...ANNEE,
			...vide,
			depenses: [{ annee: 2026, mois: 9, montant: 310_600 }],
		});
		expect(lignes[0]).toMatchObject({ annee: 2026, mois: 9, depenses: 310_600, solde: -310_600 });
		expect(lignes).toHaveLength(11);
	});

	it("calcule le solde du mois et le solde cumulé, salaires déduits", () => {
		const lignes = buildBilanMensuel({
			...ANNEE,
			paiements: [
				{ annee: 2026, mois: 10, montant: 1_000_000 },
				{ annee: 2026, mois: 11, montant: 200_000 },
			],
			recettes: [{ annee: 2026, mois: 10, montant: 50_000 }],
			depenses: [{ annee: 2026, mois: 10, montant: 100_000 }],
			salaires: [{ annee: 2026, mois: 11, montant: 400_000 }],
		});
		expect(lignes[0]).toMatchObject({
			paiements: 1_000_000,
			recettes: 50_000,
			depenses: 100_000,
			salaires: 0,
			solde: 950_000,
			soldeCumule: 950_000,
		});
		expect(lignes[1]).toMatchObject({ salaires: 400_000, solde: -200_000, soldeCumule: 750_000 });
		expect(lignes[9].soldeCumule).toBe(750_000);
	});

	it("additionne plusieurs entrées du même mois", () => {
		const lignes = buildBilanMensuel({
			...ANNEE,
			...vide,
			paiements: [
				{ annee: 2027, mois: 1, montant: 10 },
				{ annee: 2027, mois: 1, montant: 5 },
			],
		});
		expect(lignes.find((l) => l.annee === 2027 && l.mois === 1)?.paiements).toBe(15);
	});
});

describe("totauxBilan", () => {
	it("totalise les lignes : solde = paiements + recettes − dépenses − salaires", () => {
		const lignes = buildBilanMensuel({
			...ANNEE,
			paiements: [{ annee: 2026, mois: 10, montant: 1_000 }],
			recettes: [{ annee: 2027, mois: 3, montant: 200 }],
			depenses: [{ annee: 2026, mois: 9, montant: 300 }],
			salaires: [{ annee: 2027, mois: 7, montant: 400 }],
		});
		expect(totauxBilan(lignes)).toEqual({
			totalPaiements: 1_000,
			totalRecettes: 200,
			totalDepenses: 300,
			totalSalaires: 400,
			solde: 500,
		});
	});
});
