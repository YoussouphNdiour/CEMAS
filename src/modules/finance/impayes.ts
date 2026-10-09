export interface EleveImpayeInput {
	id: string;
	matricule: string;
	prenom: string;
	nom: string;
	classeId: string;
	classeNom: string;
	niveauId: string;
	telephone: string | null;
	parentNom: string | null;
}
export interface FraisInput {
	id: string;
	nom: string;
	montantDefaut: number;
	mensuel: boolean;
}
export interface MoisImpaye {
	typeFraisId: string;
	typeFraisNom: string;
	mois: number | null;
	annee: number | null;
	montant: number;
}
export interface LigneImpaye extends EleveImpayeInput {
	du: number;
	paye: number;
	reste: number;
	moisImpayes: MoisImpaye[];
}
export interface ResultatImpayes {
	lignes: LigneImpaye[];
	totalDu: number;
	totalPaye: number;
	totalReste: number;
	classesMontantDefaut: { classeId: string; classeNom: string; frais: string[] }[];
}

const MOIS_COURTS = [
	"",
	"Janv",
	"Févr",
	"Mars",
	"Avr",
	"Mai",
	"Juin",
	"Juil",
	"Août",
	"Sept",
	"Oct",
	"Nov",
	"Déc",
];
const cle = (annee: number, mois: number) => annee * 100 + mois;
const anneeMois = (date: string) => date.split("-").slice(0, 2).map(Number) as [number, number];

/** Mois calendaires dus : du mois de début au mois de min(aujourd'hui, fin), inclus. */
export function moisDus(dateDebut: string, dateFin: string, aujourdhui: string) {
	let [annee, mois] = anneeMois(dateDebut);
	const fin = Math.min(cle(...anneeMois(dateFin)), cle(...anneeMois(aujourdhui)));
	const resultat: { annee: number; mois: number }[] = [];
	while (cle(annee, mois) <= fin) {
		resultat.push({ annee, mois });
		if (mois === 12) {
			annee++;
			mois = 1;
		} else {
			mois++;
		}
	}
	return resultat;
}

export function calculerImpayes(p: {
	dateDebut: string;
	dateFin: string;
	aujourdhui: string;
	eleves: EleveImpayeInput[];
	frais: FraisInput[];
	grille: { classeId: string; typeFraisId: string; montant: number }[];
	paiements: { eleveId: string; typeFraisId: string; mois: number; montant: number }[];
}): ResultatImpayes {
	const dus = moisDus(p.dateDebut, p.dateFin, p.aujourdhui);
	const grille = new Map(p.grille.map((g) => [`${g.classeId}:${g.typeFraisId}`, g.montant]));
	const payes = new Map<string, Set<number>>(); // `${eleveId}:${typeFraisId}` -> mois payés
	const totalPayeEleve = new Map<string, number>();
	for (const pa of p.paiements) {
		const k = `${pa.eleveId}:${pa.typeFraisId}`;
		if (!payes.has(k)) payes.set(k, new Set());
		payes.get(k)?.add(pa.mois);
		totalPayeEleve.set(pa.eleveId, (totalPayeEleve.get(pa.eleveId) ?? 0) + pa.montant);
	}
	const defauts = new Map<string, { classeId: string; classeNom: string; frais: string[] }>();

	const lignes: LigneImpaye[] = [];
	for (const e of p.eleves) {
		let du = 0;
		let reste = 0;
		const moisImpayes: MoisImpaye[] = [];
		for (const f of p.frais) {
			const montantGrille = grille.get(`${e.classeId}:${f.id}`);
			const montant = montantGrille ?? f.montantDefaut;
			if (montantGrille === undefined) {
				const d = defauts.get(e.classeId) ?? {
					classeId: e.classeId,
					classeNom: e.classeNom,
					frais: [],
				};
				if (!d.frais.includes(f.nom)) d.frais.push(f.nom);
				defauts.set(e.classeId, d);
			}
			const moisPayes = payes.get(`${e.id}:${f.id}`);
			if (f.mensuel) {
				du += montant * dus.length;
				for (const { annee, mois } of dus) {
					if (!moisPayes?.has(mois)) {
						reste += montant;
						moisImpayes.push({ typeFraisId: f.id, typeFraisNom: f.nom, mois, annee, montant });
					}
				}
			} else {
				du += montant;
				if (!moisPayes?.size) {
					reste += montant;
					moisImpayes.push({
						typeFraisId: f.id,
						typeFraisNom: f.nom,
						mois: null,
						annee: null,
						montant,
					});
				}
			}
		}
		if (reste > 0)
			lignes.push({ ...e, du, paye: totalPayeEleve.get(e.id) ?? 0, reste, moisImpayes });
	}

	lignes.sort(
		(a, b) => b.reste - a.reste || a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom),
	);
	const somme = (k: "du" | "paye" | "reste") => lignes.reduce((t, l) => t + l[k], 0);
	return {
		lignes,
		totalDu: somme("du"),
		totalPaye: somme("paye"),
		totalReste: somme("reste"),
		classesMontantDefaut: [...defauts.values()],
	};
}

/** « Scolarité : Nov, Déc · Inscription » */
export function libelleMoisImpayes(moisImpayes: MoisImpaye[]): string {
	const parFrais = new Map<string, string[]>();
	for (const m of moisImpayes) {
		const liste = parFrais.get(m.typeFraisNom) ?? [];
		if (m.mois !== null) liste.push(MOIS_COURTS[m.mois]);
		parFrais.set(m.typeFraisNom, liste);
	}
	return [...parFrais.entries()]
		.map(([nom, mois]) => (mois.length ? `${nom} : ${mois.join(", ")}` : nom))
		.join(" · ");
}
