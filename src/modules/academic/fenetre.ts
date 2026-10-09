export type EtatFenetre = "aucun" | "preparation" | "ouvert";

const MOIS = [
	"janvier",
	"février",
	"mars",
	"avril",
	"mai",
	"juin",
	"juillet",
	"août",
	"septembre",
	"octobre",
	"novembre",
	"décembre",
];

function lendemain(iso: string): string {
	const d = new Date(`${iso}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

/** Fenêtre du passage d'année d'après la date de fin de l'année active. */
export function etatFenetrePassage(dateFin: string, aujourdhui: string) {
	const ouverture = lendemain(dateFin);
	const debutPreparation = `${dateFin.slice(0, 4)}-06-15`;
	const etat: EtatFenetre =
		aujourdhui >= ouverture ? "ouvert" : aujourdhui >= debutPreparation ? "preparation" : "aucun";
	return { etat, ouverture, debutPreparation };
}

/** Date du jour (UTC = Dakar). PASSAGE_AUJOURDHUI la remplace hors production (tests). */
export function aujourdhuiServeur(
	env: NodeJS.ProcessEnv = process.env,
	maintenant = new Date(),
): string {
	const forcee = env.PASSAGE_AUJOURDHUI;
	if (env.NODE_ENV !== "production" && forcee && /^\d{4}-\d{2}-\d{2}$/.test(forcee)) return forcee;
	return maintenant.toISOString().slice(0, 10);
}

export interface FichierSauvegarde {
	nom: string;
	mtime: Date;
	taille: number;
}

const MOTIF = /^(cemas|prepassage)-\d{8}-\d{6}(\d{3}-[0-9a-f]{6})?\.dump$/;

export function choisirDerniereSauvegarde(fichiers: FichierSauvegarde[]): FichierSauvegarde | null {
	return (
		fichiers
			.filter((f) => MOTIF.test(f.nom))
			.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] ?? null
	);
}

export function sauvegardeRecente(
	s: FichierSauvegarde | null,
	maintenant: Date,
	heures = 24,
): boolean {
	return !!s && maintenant.getTime() - s.mtime.getTime() < heures * 3600 * 1000;
}

/** « 1er août 2027 » */
export function libelleDateFr(iso: string): string {
	const [a, m, j] = iso.split("-").map(Number);
	return `${j === 1 ? "1er" : j} ${MOIS[m - 1]} ${a}`;
}
