import { MOIS_LABELS } from "@/shared/lib/utils";

const LIBELLES: Record<string, string> = {
	prenom: "Prénom",
	nom: "Nom",
	dateNaissance: "Date de naissance",
	lieuNaissance: "Lieu de naissance",
	sexe: "Sexe",
	adresse: "Adresse",
	statut: "Statut",
	classe: "Classe",
	telephone: "Téléphone",
	telephone2: "Téléphone 2",
	profession: "Profession",
	relation: "Lien",
	typeFrais: "Type de frais",
	mois: "Mois",
	montant: "Montant",
	datePaiement: "Date du paiement",
	poste: "Poste",
	type: "Type",
	salaireBase: "Salaire de base",
	dateEmbauche: "Date d'embauche",
	abonnement: "Abonnement",
	finAbonnement: "Fin d'abonnement",
};
const VALEURS: Record<string, string> = {
	actif: "Actif",
	inactif: "Inactif",
	transfere: "Transféré",
	M: "Masculin",
	F: "Féminin",
	pere: "Père",
	mere: "Mère",
	tuteur: "Tuteur",
};
const cfa = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;

function valeur(champ: string, v: unknown): string {
	if (v === null || v === undefined || v === "") return "—";
	if ((champ === "montant" || champ === "salaireBase") && typeof v === "number") return cfa(v);
	if (champ === "mois" && typeof v === "number") return MOIS_LABELS[v] ?? String(v);
	if (typeof v === "string" && VALEURS[v]) return VALEURS[v];
	return String(v);
}

/** Lignes lisibles d'une entrée du journal : « Champ : avant → après », ou résumé d'une suppression. */
export function detailModification(
	avant: Record<string, unknown> | null,
	apres: Record<string, unknown> | null,
): string[] {
	if (!avant) return [];
	if (!apres) {
		const morceaux = [
			avant.numeroRecu ?? avant.matricule,
			avant.typeFrais,
			typeof avant.mois === "number" ? MOIS_LABELS[avant.mois] : undefined,
			typeof avant.montant === "number" ? cfa(avant.montant) : undefined,
			avant.numeroRecu
				? undefined
				: [avant.prenom, avant.nom].filter(Boolean).join(" ") || undefined,
		].filter(Boolean);
		return [`Supprimé : ${morceaux.join(" · ")}`];
	}
	return Object.keys(apres).map(
		(c) => `${LIBELLES[c] ?? c} : ${valeur(c, avant[c])} → ${valeur(c, apres[c])}`,
	);
}
