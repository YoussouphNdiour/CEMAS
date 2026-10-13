export type NatureOperation = "paiement" | "recette" | "depense" | "salaire";

export interface Operation {
	/** Date comptable AAAA-MM-JJ. */
	date: string;
	/** Horodatage de saisie, pour départager les opérations d'un même jour. */
	ordre: string;
	nature: NatureOperation;
	reference: string;
	libelle: string;
	rubrique: string;
	montant: number;
}

export interface Rubrique {
	rubrique: string;
	montant: number;
}

export interface Comptabilite {
	encaissements: Rubrique[];
	totalEncaissements: number;
	recettes: Rubrique[];
	totalRecettes: number;
	depenses: Rubrique[];
	totalDepenses: number;
	salaires: { nombre: number; montant: number };
	solde: number;
	operations: Operation[];
}

const total = (ops: Operation[]) => ops.reduce((t, o) => t + o.montant, 0);

function parRubrique(ops: Operation[]): Rubrique[] {
	const m = new Map<string, number>();
	for (const o of ops) m.set(o.rubrique, (m.get(o.rubrique) ?? 0) + o.montant);
	return [...m]
		.map(([rubrique, montant]) => ({ rubrique, montant }))
		.sort((a, b) => b.montant - a.montant || a.rubrique.localeCompare(b.rubrique, "fr"));
}

/** Synthèse et détail chronologique d'une période. Solde = encaissements + recettes − dépenses − salaires. */
export function construireComptabilite(ops: Operation[]): Comptabilite {
	const de = (n: NatureOperation) => ops.filter((o) => o.nature === n);
	const [paiements, recettes, depenses, salaires] = (
		["paiement", "recette", "depense", "salaire"] as const
	).map(de);
	const operations = [...ops].sort(
		(a, b) =>
			a.date.localeCompare(b.date) || (Date.parse(a.ordre) || 0) - (Date.parse(b.ordre) || 0),
	);
	const totalEncaissements = total(paiements);
	const totalRecettes = total(recettes);
	const totalDepenses = total(depenses);
	const totalSalaires = total(salaires);
	return {
		encaissements: parRubrique(paiements),
		totalEncaissements,
		recettes: parRubrique(recettes),
		totalRecettes,
		depenses: parRubrique(depenses),
		totalDepenses,
		salaires: { nombre: salaires.length, montant: totalSalaires },
		solde: totalEncaissements + totalRecettes - totalDepenses - totalSalaires,
		operations,
	};
}
