import { describe, expect, it } from "vitest";
import { calculerImpayes, libelleMoisImpayes, moisDus } from "./impayes";

const ANNEE = { dateDebut: "2026-10-01", dateFin: "2027-07-31" };
const SCO = { id: "sco", nom: "Scolarité", montantDefaut: 25_000, mensuel: true };
const INS = { id: "ins", nom: "Inscription", montantDefaut: 50_000, mensuel: false };
const eleve = (id: string, classeId = "c1", nom = "Diop") => ({
	id,
	matricule: `M-${id}`,
	prenom: "Awa",
	nom,
	classeId,
	classeNom: `Classe ${classeId}`,
	niveauId: "n1",
	telephone: "77 000 00 00",
	parentNom: "Moussa Diop",
});
const base = { ...ANNEE, frais: [SCO, INS], grille: [], paiements: [] };

describe("moisDus", () => {
	it("va du mois de début au mois courant inclus", () => {
		expect(moisDus(ANNEE.dateDebut, ANNEE.dateFin, "2026-12-15")).toEqual([
			{ annee: 2026, mois: 10 },
			{ annee: 2026, mois: 11 },
			{ annee: 2026, mois: 12 },
		]);
	});
	it("est vide avant le début de l'année", () => {
		expect(moisDus(ANNEE.dateDebut, ANNEE.dateFin, "2026-09-20")).toEqual([]);
	});
	it("est plafonné à date_fin", () => {
		expect(moisDus(ANNEE.dateDebut, ANNEE.dateFin, "2027-09-01")).toHaveLength(10);
	});
});

describe("calculerImpayes", () => {
	it("compte les mois dus et l'inscription unique d'un élève sans paiement (montants par défaut)", () => {
		const r = calculerImpayes({ ...base, aujourdhui: "2026-11-05", eleves: [eleve("e1")] });
		expect(r.lignes).toHaveLength(1);
		expect(r.lignes[0]).toMatchObject({ du: 2 * 25_000 + 50_000, paye: 0, reste: 100_000 });
		expect(r.lignes[0].moisImpayes.map((m) => [m.typeFraisNom, m.mois])).toEqual([
			["Scolarité", 10],
			["Scolarité", 11],
			["Inscription", null],
		]);
		expect(r.classesMontantDefaut).toEqual([
			{ classeId: "c1", classeNom: "Classe c1", frais: ["Scolarité", "Inscription"] },
		]);
	});

	it("utilise la grille et considère un mois payé partiellement comme soldé", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-11-05",
			eleves: [eleve("e1")],
			grille: [
				{ classeId: "c1", typeFraisId: "sco", montant: 24_000 },
				{ classeId: "c1", typeFraisId: "ins", montant: 65_000 },
			],
			paiements: [
				{ eleveId: "e1", typeFraisId: "sco", mois: 10, montant: 20_000 },
				{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 60_000 },
			],
		});
		expect(r.lignes[0]).toMatchObject({ du: 2 * 24_000 + 65_000, paye: 80_000, reste: 24_000 });
		expect(r.lignes[0].moisImpayes).toEqual([
			{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 24_000 },
		]);
		expect(r.classesMontantDefaut).toEqual([]);
	});

	it("ne réduit pas le reste avec une avance, mais la compte dans Payé", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-10-05",
			eleves: [eleve("e1")],
			paiements: [
				{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 50_000 },
				{ eleveId: "e1", typeFraisId: "sco", mois: 1, montant: 25_000 },
			],
		});
		expect(r.lignes[0]).toMatchObject({ paye: 75_000, reste: 25_000 });
	});

	it("signale seulement le frais sans grille (grille partielle)", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-10-05",
			eleves: [eleve("e1")],
			grille: [{ classeId: "c1", typeFraisId: "sco", montant: 20_000 }],
		});
		expect(r.classesMontantDefaut).toEqual([
			{ classeId: "c1", classeNom: "Classe c1", frais: ["Inscription"] },
		]);
	});

	it("exclut l'élève à jour, trie par reste décroissant et totalise", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-11-05",
			eleves: [
				eleve("ajour", "c1", "Ba"),
				eleve("peu", "c1", "Sow"),
				eleve("beaucoup", "c1", "Fall"),
			],
			paiements: [
				{ eleveId: "ajour", typeFraisId: "ins", mois: 10, montant: 50_000 },
				{ eleveId: "ajour", typeFraisId: "sco", mois: 10, montant: 25_000 },
				{ eleveId: "ajour", typeFraisId: "sco", mois: 11, montant: 25_000 },
				{ eleveId: "peu", typeFraisId: "ins", mois: 10, montant: 50_000 },
				{ eleveId: "peu", typeFraisId: "sco", mois: 10, montant: 25_000 },
			],
		});
		expect(r.lignes.map((l) => l.id)).toEqual(["beaucoup", "peu"]);
		expect(r.totalReste).toBe(100_000 + 25_000);
		expect(r.totalPaye).toBe(75_000);
		expect(r.totalDu).toBe(200_000);
	});

	it("conserve un téléphone absent", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-10-05",
			eleves: [{ ...eleve("e1"), telephone: null, parentNom: null }],
		});
		expect(r.lignes[0].telephone).toBeNull();
	});

	it("n'a aucun mois dû avant le début, mais l'inscription reste due", () => {
		const r = calculerImpayes({ ...base, aujourdhui: "2026-09-10", eleves: [eleve("e1")] });
		expect(r.lignes[0]).toMatchObject({ du: 50_000, reste: 50_000 });
	});
});

describe("calculerImpayes — robustesse", () => {
	it("ne compte qu'une fois un élève présent deux fois (deux contacts principaux)", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-10-05",
			eleves: [eleve("e1"), eleve("e1")],
		});
		expect(r.lignes).toHaveLength(1);
		expect(r.totalReste).toBe(75_000);
	});

	it("ignore un frais dont le montant de grille est 0", () => {
		const r = calculerImpayes({
			...base,
			aujourdhui: "2026-11-05",
			eleves: [eleve("e1")],
			grille: [
				{ classeId: "c1", typeFraisId: "sco", montant: 0 },
				{ classeId: "c1", typeFraisId: "ins", montant: 60_000 },
			],
		});
		expect(r.lignes[0]).toMatchObject({ du: 60_000, reste: 60_000 });
		expect(r.lignes[0].moisImpayes.map((m) => m.typeFraisNom)).toEqual(["Inscription"]);
	});
});

describe("libelleMoisImpayes", () => {
	it("regroupe par frais", () => {
		expect(
			libelleMoisImpayes([
				{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 1 },
				{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 12, annee: 2026, montant: 1 },
				{ typeFraisId: "ins", typeFraisNom: "Inscription", mois: null, annee: null, montant: 1 },
			]),
		).toBe("Scolarité : Nov, Déc · Inscription");
	});
});

describe("forfait et échéancier", () => {
	const FOUR = "four";
	const forfaits = [{ niveauId: "n1", total: 67_000, typesAssocies: [FOUR] }];
	const echeanciers = [
		{ niveauId: "n1", mois: 11, montant: 20_000 },
		{ niveauId: "n1", mois: 12, montant: 20_000 },
		{ niveauId: "n1", mois: 1, montant: 24_000 },
		{ niveauId: "n1", mois: 5, montant: 24_000 },
	];
	const base2 = { ...ANNEE, frais: [SCO, INS], grille: [], paiements: [], forfaits, echeanciers };

	it("forfait payé en Inscription + Fourniture associée : à jour ; octobre non dû", () => {
		const r = calculerImpayes({
			...base2,
			aujourdhui: "2026-10-20",
			eleves: [eleve("e1")],
			paiements: [
				{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 60_000 },
				{ eleveId: "e1", typeFraisId: FOUR, mois: 10, montant: 7_000 },
			],
		});
		expect(r.lignes).toEqual([]);
	});

	it("forfait partiel : reste = forfait − payé", () => {
		const r = calculerImpayes({
			...base2,
			aujourdhui: "2026-10-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 40_000 }],
		});
		expect(r.lignes[0]).toMatchObject({ du: 67_000, paye: 40_000, reste: 27_000 });
		expect(r.lignes[0].moisImpayes).toEqual([
			{
				typeFraisId: "ins",
				typeFraisNom: "Inscription (forfait)",
				mois: null,
				annee: null,
				montant: 27_000,
			},
		]);
	});

	it("paiement supérieur au forfait : reste jamais négatif", () => {
		const r = calculerImpayes({
			...base2,
			aujourdhui: "2026-10-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 70_000 }],
		});
		expect(r.lignes).toEqual([]);
	});

	it("scolarité selon l'échéancier : novembre 20 000, janvier 24 000 ; juin/juillet non dus", () => {
		const r = calculerImpayes({
			...base2,
			aujourdhui: "2027-07-15",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 67_000 }],
		});
		expect(r.lignes[0].moisImpayes.map((m) => [m.mois, m.montant])).toEqual([
			[11, 20_000],
			[12, 20_000],
			[1, 24_000],
			[5, 24_000],
		]);
		expect(r.lignes[0].reste).toBe(88_000);
	});

	it("niveau non configuré : repli sur la grille / le défaut", () => {
		const r = calculerImpayes({
			...base2,
			aujourdhui: "2026-10-20",
			eleves: [{ ...eleve("e2"), niveauId: "autre" }],
		});
		expect(r.lignes[0]).toMatchObject({ reste: 25_000 + 50_000 });
	});
});

describe("réductions", () => {
	const forfaits = [{ niveauId: "n1", total: 80_000, typesAssocies: [] }];
	const echeanciers = [{ niveauId: "n1", mois: 11, montant: 40_000 }];
	const base3 = { ...ANNEE, frais: [SCO, INS], grille: [], paiements: [], forfaits, echeanciers };

	it("réduction de 40 000 sur le forfait : élève ayant payé 40 000 à jour", () => {
		const r = calculerImpayes({
			...base3,
			aujourdhui: "2026-10-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 40_000 }],
			reductions: [
				{ eleveId: "e1", type: "negociee", portee: "forfait", mode: "montant", valeur: 40_000 },
			],
		});
		expect(r.lignes).toEqual([]);
	});

	it("50 % sur les mensualités : novembre dû 20 000", () => {
		const r = calculerImpayes({
			...base3,
			aujourdhui: "2026-11-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 80_000 }],
			reductions: [
				{ eleveId: "e1", type: "fratrie", portee: "mensualites", mode: "pourcentage", valeur: 50 },
			],
		});
		expect(r.lignes[0].moisImpayes).toEqual([
			{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 20_000 },
		]);
		expect(r.lignes[0].du).toBe(80_000 + 20_000);
	});

	it("gratuité totale : jamais en impayé", () => {
		const r = calculerImpayes({
			...base3,
			aujourdhui: "2027-05-20",
			eleves: [eleve("e1")],
			paiements: [],
			reductions: [
				{ eleveId: "e1", type: "bourse", portee: "les_deux", mode: "pourcentage", valeur: 100 },
			],
		});
		expect(r.lignes).toEqual([]);
	});
});

describe("forfait — robustesse (relecture)", () => {
	const forfaits = [{ niveauId: "n1", total: 67_000, typesAssocies: ["four"] }];
	const echeanciers = [{ niveauId: "n1", mois: 11, montant: 20_000 }];
	const ASSU = { id: "assu", nom: "Assurance", montantDefaut: 3_000, mensuel: false };
	const base4 = { ...ANNEE, grille: [], paiements: [], forfaits, echeanciers };

	it("un autre frais obligatoire unique n'est pas traité comme le forfait", () => {
		const r = calculerImpayes({
			...base4,
			frais: [SCO, INS, ASSU],
			aujourdhui: "2026-10-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 67_000 }],
		});
		expect(r.lignes[0]).toMatchObject({ du: 67_000 + 3_000, reste: 3_000 });
		expect(r.lignes[0].moisImpayes.map((m) => m.typeFraisNom)).toEqual(["Assurance"]);
	});

	it("le type du forfait lui-même n'est pas compté deux fois s'il est aussi associé", () => {
		const r = calculerImpayes({
			...base4,
			forfaits: [{ niveauId: "n1", total: 67_000, typesAssocies: ["ins", "four"] }],
			frais: [SCO, INS],
			aujourdhui: "2026-10-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 40_000 }],
		});
		expect(r.lignes[0]).toMatchObject({ reste: 27_000 });
	});

	it("forfait sans échéancier : aucune mensualité due (pas de repli qui rendrait octobre dû)", () => {
		const r = calculerImpayes({
			...base4,
			echeanciers: [],
			frais: [SCO, INS],
			aujourdhui: "2027-07-20",
			eleves: [eleve("e1")],
			paiements: [{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 67_000 }],
		});
		expect(r.lignes).toEqual([]);
	});
});
