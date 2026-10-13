export type StatutMois = "paye" | "impaye" | "inclus" | "non_du";

/**
 * Statut d'un mois dans le suivi des paiements. Pour la scolarité (obligatoire et mensuelle)
 * d'un niveau au forfait : octobre est inclus dans le forfait et seuls les mois de l'échéancier
 * sont dus (aucun si l'échéancier est vide, comme dans le calcul des impayés).
 */
export function statutMois(
	tf: { mensuel: boolean; obligatoire: boolean },
	mois: number,
	paye: boolean,
	ctx: { forfait: boolean; dus: Set<number> },
): StatutMois {
	if (paye) return "paye";
	if (tf.mensuel && tf.obligatoire && (ctx.forfait || ctx.dus.size > 0)) {
		if (mois === 10 && ctx.forfait) return "inclus";
		if (!ctx.dus.has(mois)) return "non_du";
	}
	return "impaye";
}

/** Frais facultatif unique (Tenue, Fourniture) : inclus s'il est compris dans le forfait déjà réglé. */
export function statutFraisUnique(
	paye: boolean,
	ctx: { associe: boolean; inscriptionPayee: boolean },
): StatutMois {
	if (paye) return "paye";
	return ctx.associe && ctx.inscriptionPayee ? "inclus" : "impaye";
}

/** Carte affichée sauf si le frais n'a rien à voir avec le forfait du niveau et que personne ne l'a payé. */
export function fraisUniqueVisible(ctx: {
	forfait: boolean;
	associe: boolean;
	payeDansClasse: boolean;
}): boolean {
	return !ctx.forfait || ctx.associe || ctx.payeDansClasse;
}
