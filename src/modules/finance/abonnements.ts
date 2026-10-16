/** Rang d'un mois dans l'année scolaire : octobre = 0 … septembre = 11. */
export const ordreScolaire = (mois: number) => (mois + 2) % 12;

/** Dernier mois dû d'un service à abonnement. */
export const DERNIER_MOIS_SERVICE = 6;

/**
 * Mois dus d'un abonnement parmi les mois échus de l'année (`dus`) : du mois de début au mois
 * de fin (ou juin), dans l'ordre scolaire.
 */
export function moisDusAbonnement<T extends { mois: number }>(
	a: { moisDebut: number; moisFin: number | null },
	dus: T[],
): T[] {
	const debut = ordreScolaire(a.moisDebut);
	const fin = Math.min(
		ordreScolaire(a.moisFin ?? DERNIER_MOIS_SERVICE),
		ordreScolaire(DERNIER_MOIS_SERVICE),
	);
	return dus.filter((m) => ordreScolaire(m.mois) >= debut && ordreScolaire(m.mois) <= fin);
}
