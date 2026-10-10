export type Reduction = {
	type: "fratrie" | "personnel" | "negociee" | "bourse";
	portee: "forfait" | "mensualites" | "les_deux";
	mode: "montant" | "pourcentage";
	valeur: number;
};

export const LIBELLES_TYPE_REDUCTION: Record<Reduction["type"], string> = {
	fratrie: "Fratrie (4 enfants et plus)",
	personnel: "Enfant du personnel",
	negociee: "Réduction négociée",
	bourse: "Gratuité / bourse",
};

function concerne(r: Reduction, cible: "forfait" | "mensualite"): boolean {
	return (
		r.portee === "les_deux" ||
		(cible === "forfait" ? r.portee === "forfait" : r.portee === "mensualites")
	);
}

/** Tarif après réduction (jamais négatif). Montant fixe : déduit tel quel (par mois pour une mensualité). */
export function montantReduit(
	tarif: number,
	r: Reduction | null | undefined,
	cible: "forfait" | "mensualite",
): number {
	if (!r || !concerne(r, cible)) return tarif;
	const reduction = r.mode === "pourcentage" ? Math.round((tarif * r.valeur) / 100) : r.valeur;
	return Math.max(0, tarif - reduction);
}

export function montantReduction(
	tarif: number,
	r: Reduction | null | undefined,
	cible: "forfait" | "mensualite",
): number {
	return tarif - montantReduit(tarif, r, cible);
}

/**
 * Montant accordé sur l'année, selon les mêmes règles que les impayés : forfait et échéancier
 * du niveau s'il en a, sinon grille de la classe (frais uniques + mensualités × nombre de mois).
 */
export function montantAnnuelReduction(
	r: Reduction,
	t: {
		forfait: number | null;
		echeancier: number[] | null;
		uniques: number[];
		mensuels: number[];
		nbMois: number;
	},
): number {
	const somme = (xs: number[], cible: "forfait" | "mensualite", fois = 1) =>
		xs.reduce((s, x) => s + montantReduction(x, r, cible) * fois, 0);
	const forfait =
		t.forfait !== null ? montantReduction(t.forfait, r, "forfait") : somme(t.uniques, "forfait");
	const mensualites = t.echeancier
		? somme(t.echeancier, "mensualite")
		: t.forfait !== null
			? 0
			: somme(t.mensuels, "mensualite", t.nbMois);
	return forfait + mensualites;
}
