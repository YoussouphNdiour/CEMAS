export type TypePeriode = "jour" | "semaine" | "mois" | "annee";

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
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

const versDate = (iso: string) => {
	const [a, m, j] = iso.split("-").map(Number);
	return new Date(Date.UTC(a, m - 1, j));
};
const versIso = (d: Date) => d.toISOString().slice(0, 10);
const ajouterJours = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const numeroJour = (d: Date) => (d.getUTCDate() === 1 ? "1er" : String(d.getUTCDate()));
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Bornes incluses (AAAA-MM-JJ) et libellé d'une période contenant la date de référence. Semaine : lundi → dimanche. */
export function bornesPeriode(
	type: Exclude<TypePeriode, "annee">,
	reference: string,
): { du: string; au: string; libelle: string } {
	const ref = versDate(reference);
	if (type === "jour") {
		return {
			du: reference,
			au: reference,
			libelle: `${JOURS[ref.getUTCDay()]} ${numeroJour(ref)} ${MOIS[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`,
		};
	}
	if (type === "semaine") {
		const debut = ajouterJours(ref, -((ref.getUTCDay() + 6) % 7));
		const fin = ajouterJours(debut, 6);
		const memeAnnee = debut.getUTCFullYear() === fin.getUTCFullYear();
		const memeMois = memeAnnee && debut.getUTCMonth() === fin.getUTCMonth();
		const gauche = memeMois
			? numeroJour(debut)
			: `${numeroJour(debut)} ${MOIS[debut.getUTCMonth()]}${memeAnnee ? "" : ` ${debut.getUTCFullYear()}`}`;
		return {
			du: versIso(debut),
			au: versIso(fin),
			libelle: `Semaine du ${gauche} au ${numeroJour(fin)} ${MOIS[fin.getUTCMonth()]} ${fin.getUTCFullYear()}`,
		};
	}
	const debut = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
	const fin = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
	return {
		du: versIso(debut),
		au: versIso(fin),
		libelle: `${majuscule(MOIS[ref.getUTCMonth()])} ${ref.getUTCFullYear()}`,
	};
}

/** Libellé lisible d'une date AAAA-MM-JJ (« 13 octobre 2026 »). */
export function dateLongue(iso: string): string {
	const d = versDate(iso);
	return `${numeroJour(d)} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
