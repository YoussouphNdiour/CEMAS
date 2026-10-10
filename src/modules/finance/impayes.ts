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
	/** Forfait d'inscription par niveau (total des lignes, types dont les paiements comptent). */
	forfaits?: { niveauId: string; total: number; typesAssocies: string[] }[];
	/** Échéancier mensuel par niveau (mois absent = non dû). */
	echeanciers?: { niveauId: string; mois: number; montant: number }[];
}): ResultatImpayes {
	const dus = moisDus(p.dateDebut, p.dateFin, p.aujourdhui);
	const grille = new Map(p.grille.map((g) => [`${g.classeId}:${g.typeFraisId}`, g.montant]));
	const payes = new Map<string, Set<number>>(); // `${eleveId}:${typeFraisId}` -> mois payés
	const sommeParType = new Map<string, number>(); // `${eleveId}:${typeFraisId}` -> somme versée
	for (const pa of p.paiements) {
		const k = `${pa.eleveId}:${pa.typeFraisId}`;
		if (!payes.has(k)) payes.set(k, new Set());
		payes.get(k)?.add(pa.mois);
		sommeParType.set(k, (sommeParType.get(k) ?? 0) + pa.montant);
	}
	const forfaitParNiveau = new Map((p.forfaits ?? []).map((f) => [f.niveauId, f]));
	const echeancierParNiveau = new Map<string, Map<number, number>>();
	for (const e of p.echeanciers ?? []) {
		if (!echeancierParNiveau.has(e.niveauId)) echeancierParNiveau.set(e.niveauId, new Map());
		echeancierParNiveau.get(e.niveauId)?.set(e.mois, e.montant);
	}
	const verse = (eleveId: string, typeFraisId: string) =>
		sommeParType.get(`${eleveId}:${typeFraisId}`) ?? 0;
	const defauts = new Map<string, { classeId: string; classeNom: string; frais: string[] }>();

	const lignes: LigneImpaye[] = [];
	// Un élève peut apparaître plusieurs fois (plusieurs contacts principaux) : le premier gagne
	const vus = new Set<string>();
	const eleves = p.eleves.filter((e) => !vus.has(e.id) && vus.add(e.id));
	for (const e of eleves) {
		let du = 0;
		let reste = 0;
		const moisImpayes: MoisImpaye[] = [];
		const forfait = forfaitParNiveau.get(e.niveauId);
		const ech = echeancierParNiveau.get(e.niveauId);
		let paye = 0;
		for (const f of p.frais) {
			paye += verse(e.id, f.id);
			// Forfait d'inscription du niveau : reste = forfait − versé (Inscription + types associés)
			if (!f.mensuel && forfait) {
				const verseForfait =
					verse(e.id, f.id) + forfait.typesAssocies.reduce((t, id) => t + verse(e.id, id), 0);
				du += forfait.total;
				const r = Math.max(0, forfait.total - verseForfait);
				if (r > 0) {
					reste += r;
					moisImpayes.push({
						typeFraisId: f.id,
						typeFraisNom: `${f.nom} (forfait)`,
						mois: null,
						annee: null,
						montant: r,
					});
				}
				continue;
			}
			// Échéancier du niveau : seuls ses mois sont dus, au montant du mois
			if (f.mensuel && ech) {
				const moisPayesEch = payes.get(`${e.id}:${f.id}`);
				for (const { annee, mois } of dus) {
					const montantMois = ech.get(mois);
					if (montantMois === undefined || montantMois === 0) continue;
					du += montantMois;
					if (!moisPayesEch?.has(mois)) {
						reste += montantMois;
						moisImpayes.push({
							typeFraisId: f.id,
							typeFraisNom: f.nom,
							mois,
							annee,
							montant: montantMois,
						});
					}
				}
				continue;
			}
			const montantGrille = grille.get(`${e.classeId}:${f.id}`);
			const montant = montantGrille ?? f.montantDefaut;
			// Frais gratuit pour cette classe
			if (montant === 0) continue;
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
		// Les paiements des types associés au forfait (ex. fournitures) comptent aussi dans « Payé »
		for (const id of forfait?.typesAssocies ?? []) {
			if (!p.frais.some((f) => f.id === id)) paye += verse(e.id, id);
		}
		if (reste > 0) lignes.push({ ...e, du, paye, reste, moisImpayes });
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
