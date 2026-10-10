import { expect, test } from "@playwright/test";
import { login, trpc } from "./helpers";

type Resultat = { lignes: { id: string; reste: number }[] };

test.describe("16 - Réductions par élève", () => {
	test("réduction sur le forfait : l'élève ayant payé le montant réduit est à jour", async ({
		page,
	}) => {
		await login(page);
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const niveaux = await trpc<{ id: string; nom: string }[]>(page, "academic.niveaux.list");
		const creche = niveaux.find((n) => n.nom === "Crèche") ?? niveaux[0];
		const classe = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{ nom: `RED-${Date.now()}`, niveauId: creche.id, capacite: 30, anneeScolaireId: annee.id },
			true,
		);
		const eleve = await trpc<{ id: string }>(
			page,
			"students.create",
			{
				prenom: "Reduction",
				nom: `Test${Date.now()}`,
				dateNaissance: "2023-01-01",
				sexe: "M",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "P", nom: "R", telephone: "77 000 00 16", relation: "pere" },
			},
			true,
		);
		const tarif = await trpc<{ forfait: number | null }>(page, "finance.tarifs.pourEleve", {
			eleveId: eleve.id,
		});
		const forfaitBrut = tarif.forfait ?? 0;
		expect(forfaitBrut).toBeGreaterThan(0);

		// Montant invalide : pourcentage > 100
		await expect(
			trpc(
				page,
				"finance.reductions.enregistrer",
				{
					eleveId: eleve.id,
					type: "negociee",
					portee: "forfait",
					mode: "pourcentage",
					valeur: 150,
				},
				true,
			),
		).rejects.toThrow();

		const moitie = Math.round(forfaitBrut / 2);
		await trpc(
			page,
			"finance.reductions.enregistrer",
			{
				eleveId: eleve.id,
				type: "negociee",
				portee: "forfait",
				mode: "montant",
				valeur: moitie,
				motif: "Accord direction",
			},
			true,
		);
		const apresReduction = await trpc<{
			forfait: number | null;
			reduction: { valeur: number } | null;
		}>(page, "finance.tarifs.pourEleve", { eleveId: eleve.id });
		expect(apresReduction.forfait).toBe(forfaitBrut - moitie);
		expect(apresReduction.reduction?.valeur).toBe(moitie);

		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		const ins = frais.find((f) => f.nom === "Inscription");
		if (!ins) throw new Error("Type Inscription absent");
		await trpc(
			page,
			"finance.paiements.create",
			{
				eleveId: eleve.id,
				typeFraisId: ins.id,
				anneeScolaireId: annee.id,
				mois: 10,
				montant: forfaitBrut - moitie,
			},
			true,
		);
		const imp = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: classe.id,
		});
		const ligne = imp.lignes.find((l) => l.id === eleve.id);
		// À jour sur le forfait ; il ne reste au plus que des mensualités échues
		expect(ligne?.reste ?? 0).toBeLessThan(forfaitBrut - moitie);

		const liste = await trpc<{ eleveId: string; montantAnnuel: number }[]>(
			page,
			"finance.reductions.list",
			{ anneeScolaireId: annee.id },
		);
		expect(liste.find((x) => x.eleveId === eleve.id)?.montantAnnuel).toBe(moitie);

		await trpc(page, "finance.reductions.supprimer", { eleveId: eleve.id }, true);
		const sans = await trpc<{ reduction: unknown }>(page, "finance.tarifs.pourEleve", {
			eleveId: eleve.id,
		});
		expect(sans.reduction).toBeNull();
	});
});
