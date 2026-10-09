import { jsPDF } from "jspdf";
import type { Parametres } from "@/modules/settings/service";
import { dessinerEnTeteEcole, formatMontantPdf, PDF_COULEURS } from "./pdf-entete";
import { MOIS_LABELS } from "./utils";

export interface FichePaie {
	employeMatricule: string;
	employePrenom: string;
	employeNom: string;
	employePoste: string;
	mois: number;
	annee: number;
	salaireBase: number;
	primes: number;
	retenues: number;
	netAPayer: number;
	paye: boolean;
	datePaiement: string | null;
	note: string | null;
}

const dateFr = (iso: string) =>
	new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

const periode = (f: Pick<FichePaie, "mois" | "annee">) => `${MOIS_LABELS[f.mois]} ${f.annee}`;

function pageFiche(doc: jsPDF, f: FichePaie, ecole: Parametres) {
	const { primaire, secondaire } = PDF_COULEURS;
	const largeur = doc.internal.pageSize.getWidth();
	const hauteur = doc.internal.pageSize.getHeight();
	const marge = 15;
	let y = dessinerEnTeteEcole(doc, ecole, { marge });

	// ── Titre ──
	doc.setFontSize(14);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text("BULLETIN DE PAIE", largeur / 2, y, { align: "center" });
	y += 6;
	doc.setFontSize(10);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(60, 60, 60);
	doc.text(`Période : ${periode(f)}`, largeur / 2, y, { align: "center" });
	y += 8;

	// ── Employé ──
	doc.setFillColor(232, 230, 240);
	doc.roundedRect(marge, y - 4, largeur - marge * 2, 18, 2, 2, "F");
	doc.setFont("helvetica", "bold");
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text(`${f.employePrenom} ${f.employeNom}`, marge + 4, y + 1);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(60, 60, 60);
	doc.text(`Matricule : ${f.employeMatricule}`, largeur - marge - 4, y + 1, { align: "right" });
	doc.text(`Poste : ${f.employePoste}`, marge + 4, y + 8);
	y += 24;

	// ── Montants ──
	const ligne = (libelle: string, montant: string) => {
		doc.setFont("helvetica", "normal");
		doc.setTextColor(0, 0, 0);
		doc.text(libelle, marge + 4, y);
		doc.text(montant, largeur - marge - 4, y, { align: "right" });
		y += 4;
		doc.setDrawColor(220, 220, 220);
		doc.setLineWidth(0.2);
		doc.line(marge, y, largeur - marge, y);
		y += 6;
	};
	doc.setFontSize(10);
	ligne("Salaire de base", formatMontantPdf(f.salaireBase));
	ligne("Primes", `+ ${formatMontantPdf(f.primes)}`);
	ligne("Retenues", `- ${formatMontantPdf(f.retenues)}`);
	y += 2;

	// ── Net à payer ──
	doc.setFillColor(primaire.r, primaire.g, primaire.b);
	doc.roundedRect(marge, y - 5, largeur - marge * 2, 12, 2, 2, "F");
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(12);
	doc.setFont("helvetica", "bold");
	doc.text("NET À PAYER", marge + 4, y + 2.5);
	doc.text(formatMontantPdf(f.netAPayer), largeur - marge - 4, y + 2.5, { align: "right" });
	y += 16;

	// ── Statut et note ──
	doc.setFontSize(10);
	doc.setFont("helvetica", "bold");
	if (f.paye) {
		doc.setTextColor(22, 163, 74);
		doc.text(f.datePaiement ? `Payé le ${dateFr(f.datePaiement)}` : "Payé", marge + 4, y);
	} else {
		doc.setTextColor(220, 38, 38);
		doc.text("Non payé", marge + 4, y);
	}
	y += 7;
	if (f.note) {
		doc.setFont("helvetica", "italic");
		doc.setFontSize(9);
		doc.setTextColor(80, 80, 80);
		const lignes = doc.splitTextToSize(`Note : ${f.note}`, largeur - marge * 2 - 8);
		doc.text(lignes, marge + 4, y);
		y += lignes.length * 4 + 3;
	}

	// ── Signatures ──
	y += 8;
	doc.setFont("helvetica", "normal");
	doc.setFontSize(9);
	doc.setTextColor(80, 80, 80);
	doc.text("L'employé(e)", marge + 20, y, { align: "center" });
	doc.text("La Direction", largeur - marge - 20, y, { align: "center" });
	doc.setDrawColor(180, 180, 180);
	doc.setLineDashPattern([2, 2], 0);
	doc.line(marge, y + 16, marge + 40, y + 16);
	doc.line(largeur - marge - 40, y + 16, largeur - marge, y + 16);
	doc.setLineDashPattern([], 0);

	// ── Pied de page ──
	doc.setFillColor(secondaire.r, secondaire.g, secondaire.b);
	doc.rect(0, hauteur - 4, largeur, 4, "F");
}

/** Une fiche A5 par bulletin. */
export function buildFichesPaiePdf(fiches: FichePaie[], ecole: Parametres): jsPDF {
	const doc = new jsPDF({ unit: "mm", format: "a5" });
	fiches.forEach((f, i) => {
		if (i > 0) doc.addPage();
		pageFiche(doc, f, ecole);
	});
	return doc;
}

export function downloadFichesPaiePdf(fiches: FichePaie[], ecole: Parametres) {
	if (fiches.length === 0) return;
	const p = `${fiches[0].annee}-${String(fiches[0].mois).padStart(2, "0")}`;
	const nom =
		fiches.length === 1
			? `fiche-paie-${fiches[0].employeMatricule}-${p}.pdf`
			: `fiches-paie-${p}.pdf`;
	buildFichesPaiePdf(fiches, ecole).save(nom);
}
