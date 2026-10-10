import { describe, expect, it } from "vitest";
import { PARAMETRES_DEFAUT } from "@/modules/settings/defaults";
import { buildRecuPdf } from "./generate-recu-pdf";

const base = {
	numeroRecu: "REC-2026-0300",
	elevePrenom: "Awa",
	eleveNom: "Diop",
	eleveMatricule: "CEMAS-2026-0300",
	classeNom: "CP",
	typeFraisNom: "Inscription",
	montant: 65_000,
	mois: 10,
	datePaiement: "2026-10-10",
	parentPrenom: "Moussa",
	parentNom: "Diop",
	parentTel: "77",
};

describe("buildRecuPdf", () => {
	it("affiche le détail du forfait et la réduction", () => {
		const contenu = buildRecuPdf(
			{
				...base,
				montant: 40_000,
				detailForfait: [
					{ libelle: "Frais généraux", montant: 30_000 },
					{ libelle: "Fournitures diverses", montant: 10_000 },
					{ libelle: "Mensualité octobre", montant: 40_000 },
				],
				reduction: { libelle: "Réduction négociée", montant: 40_000 },
			},
			PARAMETRES_DEFAUT,
		).output();
		for (const t of [
			"Détail du forfait",
			"Frais généraux",
			"30 000 FCFA",
			"Mensualité octobre",
			"Réduction négociée",
			"- 40 000 FCFA",
			"80 000 FCFA",
		]) {
			expect(contenu).toContain(t);
		}
	});

	it("sans forfait : pas de détail", () => {
		expect(buildRecuPdf(base, PARAMETRES_DEFAUT).output()).not.toContain("Détail du forfait");
	});
});
