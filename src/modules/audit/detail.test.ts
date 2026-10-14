import { describe, expect, it } from "vitest";
import { detailModification } from "./detail";

describe("detailModification", () => {
	it("affiche chaque champ modifié en clair", () => {
		expect(
			detailModification(
				{ montant: 24_000, mois: 11, classe: "CP" },
				{ montant: 20_000, mois: 2, classe: "CE1" },
			),
		).toEqual([
			"Montant : 24 000 FCFA → 20 000 FCFA",
			"Mois : Novembre → Février",
			"Classe : CP → CE1",
		]);
	});
	it("suppression : résumé de la ligne supprimée", () => {
		expect(
			detailModification(
				{ montant: 70_000, mois: 10, typeFrais: "Scolarité", numeroRecu: "REC-2026-0227" },
				null,
			),
		).toEqual(["Supprimé : REC-2026-0227 · Scolarité · Octobre · 70 000 FCFA"]);
	});
	it("valeurs vides et statuts lisibles", () => {
		expect(
			detailModification(
				{ adresse: null, statut: "actif" },
				{ adresse: "Thiès", statut: "transfere" },
			),
		).toEqual(["Adresse : — → Thiès", "Statut : Actif → Transféré"]);
	});
});
