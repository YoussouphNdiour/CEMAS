import type { jsPDF } from "jspdf";
import type { Parametres } from "@/modules/settings/service";

export const PDF_COULEURS = {
	primaire: { r: 102, g: 93, b: 157 }, // #665d9d
	secondaire: { r: 251, g: 198, b: 22 }, // #fbc616
};

export function formatMontantPdf(amount: number): string {
	return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

/** Bandeau, sigle, nom, adresse, coordonnées, ligne de contacts, séparateur. Renvoie le y suivant. */
export function dessinerEnTeteEcole(
	doc: jsPDF,
	ecole: Parametres,
	opts: { marge?: number } = {},
): number {
	const { primaire, secondaire } = PDF_COULEURS;
	const largeur = doc.internal.pageSize.getWidth();
	const marge = opts.marge ?? 15;
	const centre = largeur / 2;
	let y = 16;

	doc.setFillColor(secondaire.r, secondaire.g, secondaire.b);
	doc.rect(0, 0, largeur, 4, "F");

	doc.setFontSize(20);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text(ecole.sigle, centre, y, { align: "center" });
	y += 7;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80, 80, 80);
	doc.text(ecole.nom, centre, y, { align: "center" });
	y += 4;
	if (ecole.adresse) {
		doc.text(ecole.adresse, centre, y, { align: "center" });
		y += 4;
	}
	const coordonnees = [ecole.telephone1, ecole.telephone2, ecole.email].filter(Boolean).join(" | ");
	if (coordonnees) {
		doc.text(coordonnees, centre, y, { align: "center" });
		y += 4;
	}
	y += 2;
	if (ecole.contactsEntete) {
		doc.setFontSize(7);
		doc.setTextColor(100, 100, 100);
		doc.text(ecole.contactsEntete, centre, y, { align: "center", maxWidth: largeur - 2 * marge });
		y += 6;
	}
	doc.setDrawColor(primaire.r, primaire.g, primaire.b);
	doc.setLineWidth(0.8);
	doc.line(marge, y, largeur - marge, y);
	return y + 8;
}
