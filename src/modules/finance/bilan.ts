/** Montant agrégé d'un mois calendaire. */
export interface MoisMontant {
	annee: number;
	mois: number;
	montant: number;
}

export interface LigneBilan {
	annee: number;
	mois: number;
	paiements: number;
	recettes: number;
	depenses: number;
	salaires: number;
	solde: number;
	soldeCumule: number;
}

export interface TotauxBilan {
	totalPaiements: number;
	totalRecettes: number;
	totalDepenses: number;
	totalSalaires: number;
	solde: number;
}

type Source = "paiements" | "recettes" | "depenses" | "salaires";

const cle = (annee: number, mois: number) => annee * 100 + mois;

/**
 * Détail mensuel du bilan (vue trésorerie). Tous les mois de la période de l'année scolaire
 * apparaissent ; un mois hors période apparaît seulement s'il a des mouvements.
 */
export function buildBilanMensuel(params: {
	dateDebut: string;
	dateFin: string;
	paiements: MoisMontant[];
	recettes: MoisMontant[];
	depenses: MoisMontant[];
	salaires: MoisMontant[];
}): LigneBilan[] {
	const lignes = new Map<number, LigneBilan>();
	const ligne = (annee: number, mois: number) => {
		const k = cle(annee, mois);
		let l = lignes.get(k);
		if (!l) {
			l = {
				annee,
				mois,
				paiements: 0,
				recettes: 0,
				depenses: 0,
				salaires: 0,
				solde: 0,
				soldeCumule: 0,
			};
			lignes.set(k, l);
		}
		return l;
	};

	let [annee, mois] = params.dateDebut.split("-").map(Number);
	const [anneeFin, moisFin] = params.dateFin.split("-").map(Number);
	while (cle(annee, mois) <= cle(anneeFin, moisFin)) {
		ligne(annee, mois);
		if (mois === 12) {
			annee++;
			mois = 1;
		} else {
			mois++;
		}
	}

	for (const source of ["paiements", "recettes", "depenses", "salaires"] as Source[]) {
		for (const { annee, mois, montant } of params[source]) {
			ligne(annee, mois)[source] += montant;
		}
	}

	let cumul = 0;
	return [...lignes.entries()]
		.sort(([a], [b]) => a - b)
		.map(([, l]) => {
			l.solde = l.paiements + l.recettes - l.depenses - l.salaires;
			cumul += l.solde;
			l.soldeCumule = cumul;
			return l;
		});
}

export function totauxBilan(lignes: LigneBilan[]): TotauxBilan {
	const somme = (source: Source) => lignes.reduce((total, l) => total + l[source], 0);
	const totalPaiements = somme("paiements");
	const totalRecettes = somme("recettes");
	const totalDepenses = somme("depenses");
	const totalSalaires = somme("salaires");
	return {
		totalPaiements,
		totalRecettes,
		totalDepenses,
		totalSalaires,
		solde: totalPaiements + totalRecettes - totalDepenses - totalSalaires,
	};
}
