import { jsPDF } from "jspdf";
import type { LigneImpaye } from "@/modules/finance/impayes";
import type { Parametres } from "@/modules/settings/service";
import { dessinerEnTeteEcole, formatMontantPdf, PDF_COULEURS } from "./pdf-entete";
import { MOIS_LABELS } from "./utils";

const dateFr = (iso: string) =>
	new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

function pageRelance(doc: jsPDF, l: LigneImpaye, ecole: Parametres, dateDuJour: string) {
	const largeur = doc.internal.pageSize.getWidth();
	const marge = 20;
	let y = dessinerEnTeteEcole(doc, ecole, { marge });
	const { primaire } = PDF_COULEURS;

	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(0, 0, 0);
	doc.text(`Le ${dateFr(dateDuJour)}`, largeur - marge, y, { align: "right" });
	y += 10;
	const eleve = `${l.prenom} ${l.nom}`;
	doc.text(l.parentNom ? `À l'attention de ${l.parentNom}` : `Aux parents de ${eleve}`, marge, y);
	y += 5;
	doc.text(`Parent / tuteur de ${eleve} - ${l.classeNom} - Matricule ${l.matricule}`, marge, y);
	y += 12;

	doc.setFont("helvetica", "bold");
	doc.setFontSize(13);
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text("Objet : rappel de paiement des frais de scolarité", marge, y);
	y += 10;

	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(0, 0, 0);
	const intro =
		"Madame, Monsieur, sauf erreur de notre part, les sommes suivantes restent dues à ce jour. " +
		"Nous vous remercions de bien vouloir régulariser la situation dans les meilleurs délais.";
	const lignesIntro = doc.splitTextToSize(intro, largeur - 2 * marge);
	doc.text(lignesIntro, marge, y);
	y += lignesIntro.length * 5 + 6;

	// Tableau
	doc.setFont("helvetica", "bold");
	doc.text("Frais", marge, y);
	doc.text("Période", marge + 60, y);
	doc.text("Montant", largeur - marge, y, { align: "right" });
	y += 2;
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.3);
	doc.line(marge, y, largeur - marge, y);
	y += 6;
	doc.setFont("helvetica", "normal");
	for (const m of l.moisImpayes) {
		const periode = m.mois === null ? "Une fois" : `${MOIS_LABELS[m.mois]} ${m.annee}`;
		doc.text(m.typeFraisNom, marge, y);
		doc.text(periode, marge + 60, y);
		doc.text(formatMontantPdf(m.montant), largeur - marge, y, { align: "right" });
		y += 6;
	}
	doc.line(marge, y - 2, largeur - marge, y - 2);
	y += 4;
	doc.setFont("helvetica", "bold");
	doc.text("Total restant dû", marge, y);
	doc.text(formatMontantPdf(l.reste), largeur - marge, y, { align: "right" });
	y += 14;

	doc.setFont("helvetica", "normal");
	doc.text(
		doc.splitTextToSize(
			"Si vous avez déjà effectué ce paiement, merci de ne pas tenir compte de ce courrier. " +
				"Veuillez agréer, Madame, Monsieur, nos salutations distinguées.",
			largeur - 2 * marge,
		),
		marge,
		y,
	);
	y += 20;
	doc.text("La Direction", largeur - marge, y, { align: "right" });
}

/** Une page A4 par élève. */
export function buildRelancesPdf(
	lignes: LigneImpaye[],
	ecole: Parametres,
	dateDuJour: string,
): jsPDF {
	const doc = new jsPDF({ unit: "mm", format: "a4" });
	lignes.forEach((l, i) => {
		if (i > 0) doc.addPage();
		pageRelance(doc, l, ecole, dateDuJour);
	});
	return doc;
}

export function downloadRelancesPdf(lignes: LigneImpaye[], ecole: Parametres) {
	const aujourdhui = new Date().toISOString().slice(0, 10);
	const nom =
		lignes.length === 1 ? `relance-${lignes[0].matricule}.pdf` : `relances-${aujourdhui}.pdf`;
	buildRelancesPdf(lignes, ecole, aujourdhui).save(nom);
}
