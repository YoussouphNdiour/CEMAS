import { jsPDF } from "jspdf";
import { MOIS_LABELS, formatCFA } from "./utils";

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

export function generateRecuPdf(data: RecuData) {
	const doc = new jsPDF({ unit: "mm", format: "a5" });
	const pageWidth = doc.internal.pageSize.getWidth();
	const margin = 15;
	let y = 15;

	// ── Header ──
	doc.setFontSize(18);
	doc.setFont("helvetica", "bold");
	doc.text("CEMAS", pageWidth / 2, y, { align: "center" });
	y += 6;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.text("Complexe Educatif Mame Anta Sidibe", pageWidth / 2, y, { align: "center" });
	y += 4;
	doc.text("cemas.online | admin@cemas.online", pageWidth / 2, y, { align: "center" });
	y += 8;

	// ── Divider ──
	doc.setDrawColor(34, 87, 122);
	doc.setLineWidth(0.8);
	doc.line(margin, y, pageWidth - margin, y);
	y += 8;

	// ── Title ──
	doc.setFontSize(14);
	doc.setFont("helvetica", "bold");
	doc.text("RECU DE PAIEMENT", pageWidth / 2, y, { align: "center" });
	y += 10;

	// ── Receipt info box ──
	doc.setFillColor(240, 245, 250);
	doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 14, 2, 2, "F");
	doc.setFontSize(10);
	doc.setFont("helvetica", "bold");
	doc.text(`N° ${data.numeroRecu}`, margin + 4, y + 2);
	doc.setFont("helvetica", "normal");
	doc.text(`Date: ${formatDateFr(data.datePaiement)}`, pageWidth - margin - 4, y + 2, { align: "right" });
	y += 18;

	// ── Student info ──
	const labelX = margin + 4;
	const valueX = margin + 45;

	function addRow(label: string, value: string) {
		doc.setFont("helvetica", "bold");
		doc.setFontSize(9);
		doc.text(label, labelX, y);
		doc.setFont("helvetica", "normal");
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

	// ── Amount highlight ──
	y += 4;
	doc.setFillColor(34, 87, 122);
	doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 12, 2, 2, "F");
	doc.setTextColor(255, 255, 255);
	doc.setFontSize(12);
	doc.setFont("helvetica", "bold");
	doc.text(`MONTANT : ${formatCFA(data.montant)}`, pageWidth / 2, y + 3, { align: "center" });
	doc.setTextColor(0, 0, 0);
	y += 20;

	// ── Signature area ──
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");

	const sigY = y;
	doc.text("Signature du parent", margin + 10, sigY);
	doc.text("Cachet de l'ecole", pageWidth - margin - 30, sigY);

	doc.setDrawColor(180, 180, 180);
	doc.setLineDashPattern([2, 2], 0);
	doc.line(margin, sigY + 15, margin + 50, sigY + 15);
	doc.line(pageWidth - margin - 55, sigY + 15, pageWidth - margin, sigY + 15);

	// ── Footer ──
	doc.setLineDashPattern([], 0);
	const footerY = doc.internal.pageSize.getHeight() - 10;
	doc.setFontSize(7);
	doc.setTextColor(150, 150, 150);
	doc.text(
		"Ce recu fait foi de paiement. Conservez-le precieusement.",
		pageWidth / 2,
		footerY,
		{ align: "center" },
	);

	doc.save(`recu-${data.numeroRecu}.pdf`);
}

function formatDateFr(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
}
