export type TonCapacite = "ok" | "alerte" | "pleine";

export interface EtatCapacite {
	placesRestantes: number;
	complete: boolean;
	depassement: number;
	libelle: string;
	ton: TonCapacite;
}

/** État de remplissage d'une classe (effectif = élèves actifs). Alerte à 10 % de places ou moins. */
export function etatCapacite(effectif: number, capacite: number): EtatCapacite {
	const placesRestantes = capacite - effectif;
	const complete = placesRestantes <= 0;
	const depassement = Math.max(0, -placesRestantes);

	let libelle: string;
	if (depassement > 0) libelle = `Dépassement : ${depassement}`;
	else if (complete) libelle = "Complète";
	else libelle = `${placesRestantes} ${placesRestantes === 1 ? "place" : "places"}`;

	const ton: TonCapacite = complete
		? "pleine"
		: placesRestantes <= capacite * 0.1
			? "alerte"
			: "ok";

	return { placesRestantes, complete, depassement, libelle, ton };
}
