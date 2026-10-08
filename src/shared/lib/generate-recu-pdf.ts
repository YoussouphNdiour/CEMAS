import { jsPDF } from "jspdf";
import { MOIS_LABELS } from "./utils";
import type { Parametres } from "@/modules/settings/service";

interface RecuData {
	numeroRecu: string;
	elevePrenom: string;
	eleveNom: string;
	eleveMatricule: string;
	classeNom: string;
	typeFraisNom: string;
	montant: number;
	mois: number;
	datePaiement: string;
	parentPrenom: string | null;
	parentNom: string | null;
	parentTel: string | null;
}

// School colors
const PRIMARY = { r: 102, g: 93, b: 157 }; // #665d9d
const SECONDARY = { r: 251, g: 198, b: 22 }; // #fbc616

function formatMontantPdf(amount: number): string {
	return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function formatDateFr(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}

export function generateRecuPdf(data: RecuData, ecole: Parametres) {
	const doc = new jsPDF({ unit: "mm", format: "a5" });
	const pageWidth = doc.internal.pageSize.getWidth();
	const margin = 15;
	let y = 12;

	// ── Yellow accent bar at top ──
	doc.setFillColor(SECONDARY.r, SECONDARY.g, SECONDARY.b);
	doc.rect(0, 0, pageWidth, 4, "F");

	y += 4;

	// ── Header ──
	doc.setFontSize(20);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
	doc.text(ecole.sigle, pageWidth / 2, y, { align: "center" });
	y += 7;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80, 80, 80);
	doc.text(ecole.nom, pageWidth / 2, y, { align: "center" });
	y += 4;
	if (ecole.adresse) {
		doc.text(ecole.adresse, pageWidth / 2, y, { align: "center" });
		y += 4;
	}
	const coordonnees = [ecole.telephone1, ecole.telephone2, ecole.email].filter(Boolean).join(" | ");
	if (coordonnees) {
		doc.text(coordonnees, pageWidth / 2, y, { align: "center" });
		y += 4;
	}
	y += 2;

	// ── Contacts ──
	if (ecole.contactsEntete) {
		doc.setFontSize(7);
		doc.setTextColor(100, 100, 100);
		doc.text(ecole.contactsEntete, pageWidth / 2, y, {
			align: "center",
			maxWidth: pageWidth - 2 * margin,
		});
		y += 6;
	}

	// ── Divider ──
	doc.setDrawColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
	doc.setLineWidth(0.8);
	doc.line(margin, y, pageWidth - margin, y);
	y += 8;

	// ── Title ──
	doc.setFontSize(14);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
	doc.text("RECU DE PAIEMENT", pageWidth / 2, y, { align: "center" });
	y += 10;

	// ── Receipt info box ──
	doc.setFillColor(232, 230, 240); // primary-light
	doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 14, 2, 2, "F");
	doc.setFontSize(10);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
	doc.text(`N° ${data.numeroRecu}`, margin + 4, y + 2);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(60, 60, 60);
	doc.text(`Date: ${formatDateFr(data.datePaiement)}`, pageWidth - margin - 4, y + 2, { align: "right" });
	y += 18;

	// ── Student info ──
	doc.setTextColor(0, 0, 0);
	const labelX = margin + 4;
	const valueX = margin + 45;

	function addRow(label: string, value: string) {
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.setTextColor(80, 80, 80);
		doc.text(label, labelX, y);
		doc.setFont("helvetica", "normal");
		doc.setTextColor(0, 0, 0);
		doc.text(value, valueX, y);
		y += 6;
	}

	addRow("Eleve :", `${data.elevePrenom} ${data.eleveNom}`);
	addRow("Matricule :", data.eleveMatricule);
	addRow("Classe :", data.classeNom);

	if (data.parentPrenom && data.parentNom) {
		addRow("Parent/Tuteur :", `${data.parentPrenom} ${data.parentNom}`);
	}
	if (data.parentTel) {
		addRow("Tel. parent :", data.parentTel);
	}

	y += 4;

	// ── Payment details box ──
	doc.setDrawColor(200, 200, 200);
	doc.setFillColor(255, 255, 255);
	doc.roundedRect(margin, y - 2, pageWidth - margin * 2, 24, 2, 2, "S");

	y += 5;
	addRow("Type de frais :", data.typeFraisNom);
	addRow("Mois concerne :", MOIS_LABELS[data.mois] ?? String(data.mois));

	// ── Amount highlight (primary color) ──
	y += 4;
	doc.setFillColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
	doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 12, 2, 2, "F");
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(12);
	doc.setFont("helvetica", "bold");
	doc.text(`MONTANT : ${formatMontantPdf(data.montant)}`, pageWidth / 2, y + 3, { align: "center" });
	doc.setTextColor(0, 0, 0);
	y += 20;

	// ── Cachet de l'ecole only ──
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80, 80, 80);
	doc.text("Cachet de l'ecole", pageWidth / 2, y, { align: "center" });

	doc.setDrawColor(180, 180, 180);
	doc.setLineDashPattern([2, 2], 0);
	const lineLeft = pageWidth / 2 - 30;
	const lineRight = pageWidth / 2 + 30;
	doc.line(lineLeft, y + 18, lineRight, y + 18);

	// ── Footer with yellow accent ──
	doc.setLineDashPattern([], 0);
	const pageHeight = doc.internal.pageSize.getHeight();

	doc.setFillColor(SECONDARY.r, SECONDARY.g, SECONDARY.b);
	doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

	doc.setFontSize(7);
	doc.setTextColor(150, 150, 150);
	doc.text(
		"Ce recu fait foi de paiement. Conservez-le precieusement.",
		pageWidth / 2,
		pageHeight - 8,
		{ align: "center" },
	);

	doc.save(`recu-${data.numeroRecu}.pdf`);
}
