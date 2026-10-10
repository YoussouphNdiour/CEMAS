const nov_mai = (novDec: number, janMai: number) => ({
	11: novDec,
	12: novDec,
	1: janMai,
	2: janMai,
	3: janMai,
	4: janMai,
	5: janMai,
});

/** Fiches d'inscription 2026-2027 du CEMAS (octobre inclus dans le forfait, juin réparti sur janvier-mai). */
export const TARIFS_DEFAUT: Record<
	string,
	{
		lignes: { libelle: string; montant: number; typeFrais?: "Fourniture" | "Tenue" }[];
		echeancier: Record<number, number>;
	}
> = {
	Crèche: {
		lignes: [
			{ libelle: "Frais généraux", montant: 30_000 },
			{ libelle: "Fournitures diverses", montant: 10_000, typeFrais: "Fourniture" },
			{ libelle: "Mensualité octobre", montant: 40_000 },
		],
		echeancier: nov_mai(40_000, 40_000),
	},
	Préscolaire: {
		lignes: [
			{ libelle: "Frais généraux", montant: 32_500 },
			{ libelle: "Uniforme (2)", montant: 10_000 },
			{ libelle: "Fournitures", montant: 7_000, typeFrais: "Fourniture" },
			{ libelle: "Mensualité octobre", montant: 17_500 },
		],
		echeancier: nov_mai(20_000, 20_000),
	},
	Élémentaire: {
		lignes: [
			{ libelle: "Frais généraux", montant: 32_500 },
			{ libelle: "Uniforme (2)", montant: 12_500 },
			{ libelle: "Mensualité octobre", montant: 20_000 },
		],
		echeancier: nov_mai(20_000, 24_000),
	},
	Moyen: {
		lignes: [
			{ libelle: "Frais généraux", montant: 30_000 },
			{ libelle: "Uniforme (2)", montant: 15_000 },
			{ libelle: "Mensualité octobre", montant: 25_000 },
		],
		echeancier: nov_mai(25_000, 30_000),
	},
};
