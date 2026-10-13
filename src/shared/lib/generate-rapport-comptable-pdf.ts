import { jsPDF } from "jspdf";
import type { NatureOperation } from "@/modules/reports/comptabilite";
import type { RapportComptable } from "@/modules/reports/types";
import type { Parametres } from "@/modules/settings/service";
import { formatMontantPdf as cfa, dessinerEnTeteEcole } from "./pdf-entete";
import { paginer, paragraphe, tableau, titreRapport, titreSection } from "./pdf-tableau";

const NATURES: Record<NatureOperation, string> = {
	paiement: "Paiement",
	recette: "Recette",
	depense: "Dépense",
	salaire: "Salaire",
};
const dateCourte = (iso: string) => iso.split("-").reverse().join("/");
const aujourdhui = () => new Date().toLocaleDateString("fr-FR");

export function buildRapportComptablePdf(
	r: RapportComptable,
	libellePeriode: string,
	ecole: Parametres,
): jsPDF {
	const doc = new jsPDF({ unit: "mm", format: "a4" });
	let y = dessinerEnTeteEcole(doc, ecole);
	y = titreRapport(doc, y, "Rapport de comptabilité", libellePeriode);

	const rubriques = (
		titre: string,
		lignes: { rubrique: string; montant: number }[],
		total: number,
	) => {
		y = titreSection(doc, y, titre);
		y = lignes.length
			? tableau(
					doc,
					y,
					[
						{ titre: "Rubrique", largeur: 0 },
						{ titre: "Montant", largeur: 45, align: "right" },
					],
					lignes.map((l) => [l.rubrique, cfa(l.montant)]),
					["Total", cfa(total)],
				)
			: paragraphe(doc, y, "Aucun mouvement.");
	};
	rubriques("Encaissements élèves", r.encaissements, r.totalEncaissements);
	rubriques("Recettes diverses", r.recettes, r.totalRecettes);
	rubriques("Dépenses", r.depenses, r.totalDepenses);

	y = titreSection(doc, y, "Synthèse");
	y = tableau(
		doc,
		y,
		[
			{ titre: "Poste", largeur: 0 },
			{ titre: "Montant", largeur: 45, align: "right" },
		],
		[
			["Encaissements élèves", cfa(r.totalEncaissements)],
			["Recettes diverses", cfa(r.totalRecettes)],
			["Dépenses", `- ${cfa(r.totalDepenses)}`],
			[
				`Salaires payés (${r.salaires.nombre} bulletin${r.salaires.nombre > 1 ? "s" : ""})`,
				`- ${cfa(r.salaires.montant)}`,
			],
		],
		["Solde de la période", cfa(r.solde)],
	);

	y = titreSection(doc, y, "Détail des opérations");
	if (!r.operations.length) {
		paragraphe(doc, y, "Aucune opération sur la période.");
	} else {
		const entrees = r.totalEncaissements + r.totalRecettes;
		const sorties = r.totalDepenses + r.salaires.montant;
		const sortie = (n: NatureOperation) => n === "depense" || n === "salaire";
		tableau(
			doc,
			y,
			[
				{ titre: "Date", largeur: 20 },
				{ titre: "Nature", largeur: 20 },
				{ titre: "Référence", largeur: 32 },
				{ titre: "Libellé", largeur: 0 },
				{ titre: "Entrée", largeur: 27, align: "right" },
				{ titre: "Sortie", largeur: 27, align: "right" },
			],
			r.operations.map((o) => [
				dateCourte(o.date),
				NATURES[o.nature],
				o.reference,
				o.libelle,
				sortie(o.nature) ? "" : cfa(o.montant),
				sortie(o.nature) ? cfa(o.montant) : "",
			]),
			["", "", "", "Total", cfa(entrees), cfa(sorties)],
		);
	}
	paginer(doc, `${ecole.nom} — Rapport de comptabilité — édité le ${aujourdhui()}`);
	return doc;
}

export function telechargerRapportComptable(
	r: RapportComptable,
	libellePeriode: string,
	ecole: Parametres,
) {
	buildRapportComptablePdf(r, libellePeriode, ecole).save(`rapport-comptable-${r.du}-${r.au}.pdf`);
}
