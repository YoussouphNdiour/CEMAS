import type { jsPDF } from "jspdf";
import { PDF_COULEURS } from "./pdf-entete";

export const MARGE = 15;
const BAS = 18; // réserve pour le pied de page

export interface Colonne {
	titre: string;
	/** Largeur en mm ; la dernière colonne `0` prend le reste. */
	largeur: number;
	align?: "left" | "right";
}

const largeurUtile = (doc: jsPDF) => doc.internal.pageSize.getWidth() - 2 * MARGE;
const hauteurPage = (doc: jsPDF) => doc.internal.pageSize.getHeight();

/** Nouvelle page si `besoin` mm ne tiennent plus ; renvoie le y utilisable. */
export function assurerPlace(doc: jsPDF, y: number, besoin: number): number {
	if (y + besoin <= hauteurPage(doc) - BAS) return y;
	doc.addPage();
	return 20;
}

export function titreSection(doc: jsPDF, y: number, texte: string): number {
	const { primaire } = PDF_COULEURS;
	const yy = assurerPlace(doc, y, 18);
	doc.setFont("helvetica", "bold");
	doc.setFontSize(12);
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text(texte, MARGE, yy);
	doc.setTextColor(0, 0, 0);
	return yy + 7;
}

export function paragraphe(doc: jsPDF, y: number, texte: string): number {
	const yy = assurerPlace(doc, y, 6);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(9);
	doc.setTextColor(80, 80, 80);
	doc.text(texte, MARGE, yy);
	doc.setTextColor(0, 0, 0);
	return yy + 6;
}

function largeurs(doc: jsPDF, colonnes: Colonne[]): number[] {
	const fixes = colonnes.reduce((t, c) => t + c.largeur, 0);
	return colonnes.map((c) => (c.largeur === 0 ? largeurUtile(doc) - fixes : c.largeur));
}

function enTete(doc: jsPDF, y: number, colonnes: Colonne[], ls: number[]): number {
	const { primaire } = PDF_COULEURS;
	doc.setFillColor(primaire.r, primaire.g, primaire.b);
	doc.rect(MARGE, y - 4.5, largeurUtile(doc), 6.5, "F");
	doc.setFont("helvetica", "bold");
	doc.setFontSize(8.5);
	doc.setTextColor(255, 255, 255);
	let x = MARGE;
	colonnes.forEach((c, i) => {
		if (c.align === "right") doc.text(c.titre, x + ls[i] - 1.5, y, { align: "right" });
		else doc.text(c.titre, x + 1.5, y);
		x += ls[i];
	});
	doc.setTextColor(0, 0, 0);
	return y + 6;
}

/**
 * Tableau avec en-tête répété à chaque page ; le texte trop long passe à la ligne.
 * `total` (facultatif) est imprimé en gras en dernière ligne.
 */
export function tableau(
	doc: jsPDF,
	y: number,
	colonnes: Colonne[],
	lignes: string[][],
	total?: string[],
): number {
	const ls = largeurs(doc, colonnes);
	let yy = enTete(doc, assurerPlace(doc, y, 14), colonnes, ls);
	const imprimer = (cellules: string[], gras: boolean, fond: boolean) => {
		doc.setFont("helvetica", gras ? "bold" : "normal");
		doc.setFontSize(8.5);
		const morceaux = cellules.map((c, i) => doc.splitTextToSize(c, ls[i] - 3) as string[]);
		const h = Math.max(...morceaux.map((m) => m.length)) * 4 + 1.5;
		const avant = yy;
		yy = assurerPlace(doc, yy, h);
		if (yy !== avant) yy = enTete(doc, yy, colonnes, ls);
		if (fond) {
			doc.setFillColor(245, 245, 250);
			doc.rect(MARGE, yy - 3.5, largeurUtile(doc), h, "F");
		}
		doc.setFont("helvetica", gras ? "bold" : "normal");
		let x = MARGE;
		morceaux.forEach((m, i) => {
			if (colonnes[i].align === "right") doc.text(m, x + ls[i] - 1.5, yy, { align: "right" });
			else doc.text(m, x + 1.5, yy);
			x += ls[i];
		});
		yy += h;
	};
	lignes.forEach((l, i) => imprimer(l, false, i % 2 === 1));
	if (total) {
		doc.setDrawColor(150, 150, 150);
		doc.setLineWidth(0.3);
		doc.line(MARGE, yy - 3, MARGE + largeurUtile(doc), yy - 3);
		yy += 1;
		imprimer(total, true, false);
	}
	return yy + 4;
}

/** Pied de page « Page n / N » et date d'édition, sur toutes les pages. */
export function paginer(doc: jsPDF, mention: string) {
	const n = doc.getNumberOfPages();
	for (let i = 1; i <= n; i++) {
		doc.setPage(i);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(7.5);
		doc.setTextColor(120, 120, 120);
		const y = hauteurPage(doc) - 8;
		doc.text(mention, MARGE, y);
		doc.text(`Page ${i} / ${n}`, doc.internal.pageSize.getWidth() - MARGE, y, { align: "right" });
	}
	doc.setTextColor(0, 0, 0);
}

/** Titre principal et sous-titre centrés sous l'en-tête de l'école. */
export function titreRapport(doc: jsPDF, y: number, titre: string, sousTitre: string): number {
	const { primaire } = PDF_COULEURS;
	const centre = doc.internal.pageSize.getWidth() / 2;
	doc.setFont("helvetica", "bold");
	doc.setFontSize(15);
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text(titre, centre, y, { align: "center" });
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(60, 60, 60);
	doc.text(sousTitre, centre, y + 6, { align: "center" });
	doc.setTextColor(0, 0, 0);
	return y + 15;
}
