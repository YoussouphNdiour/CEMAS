import { describe, expect, it } from "vitest";
import type { LigneImpaye } from "@/modules/finance/impayes";
import { PARAMETRES_DEFAUT } from "@/modules/settings/defaults";
import { buildRelancesPdf } from "./generate-relance-pdf";

const ligne = (id: string, overrides: Partial<LigneImpaye> = {}): LigneImpaye => ({
	id,
	matricule: `CEMAS-2026-${id}`,
	prenom: "Awa",
	nom: "Diop",
	classeId: "c",
	classeNom: "CP",
	niveauId: "n",
	telephone: "77 000 00 00",
	parentNom: "Moussa Diop",
	du: 74_000,
	paye: 0,
	reste: 74_000,
	moisImpayes: [
		{ typeFraisId: "s", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 24_000 },
		{ typeFraisId: "i", typeFraisNom: "Inscription", mois: null, annee: null, montant: 50_000 },
	],
	...overrides,
});

describe("buildRelancesPdf", () => {
	it("produit une page par élève avec l'en-tête, le détail et le total", () => {
		const doc = buildRelancesPdf([ligne("0001"), ligne("0002")], PARAMETRES_DEFAUT, "2026-11-05");
		expect(doc.getNumberOfPages()).toBe(2);
		const contenu = doc.output();
		expect(contenu).toContain("CEMAS-2026-0001");
		expect(contenu).toContain("CEMAS-2026-0002");
		expect(contenu).toContain("Moussa Diop");
		expect(contenu).toContain("Novembre 2026");
		expect(contenu).toContain("74 000 FCFA");
		expect(contenu).toContain(PARAMETRES_DEFAUT.nom);
	});

	it("s'adresse aux parents quand aucun contact n'est connu", () => {
		const doc = buildRelancesPdf(
			[ligne("0003", { parentNom: null, telephone: null })],
			PARAMETRES_DEFAUT,
			"2026-11-05",
		);
		expect(doc.output()).toContain("Aux parents de Awa Diop");
	});
});
