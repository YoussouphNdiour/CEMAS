import { expect, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

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

	test("saisie : types de frais adaptés au niveau et montant du forfait proposé", async ({
		page,
	}) => {
		await login(page);
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const niveaux = await trpc<{ id: string; nom: string }[]>(page, "academic.niveaux.list");
		const elem = niveaux.find((n) => n.nom === "Élémentaire") ?? niveaux[0];
		const classe = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{ nom: `SAISIE-${Date.now()}`, niveauId: elem.id, capacite: 30, anneeScolaireId: annee.id },
			true,
		);
		const nom = `Saisie${Date.now()}`;
		const eleve = await trpc<{ id: string }>(
			page,
			"students.create",
			{
				prenom: "Forfait",
				nom,
				dateNaissance: "2016-01-01",
				sexe: "F",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "P", nom: "S", telephone: "77 000 00 17", relation: "mere" },
			},
			true,
		);
		const tarif = await trpc<{ forfait: number }>(page, "finance.tarifs.pourEleve", {
			eleveId: eleve.id,
		});

		await page.goto("/finances/paiements");
		await waitForLoad(page);
		const typeSelect = page.getByLabel("Type de frais");
		// Avant de choisir un élève : aucun montant par défaut trompeur
		await expect(typeSelect.locator("option", { hasText: "FCFA" })).toHaveCount(0);

		await page.getByPlaceholder("Tapez le nom de l'élève...").fill(nom);
		await page.locator("button").filter({ hasText: nom }).first().click();
		const optionInscription = typeSelect.locator("option", { hasText: /Inscription — forfait/ });
		await expect(optionInscription).toHaveCount(1);
		await typeSelect.selectOption((await optionInscription.getAttribute("value")) ?? "");
		await expect(page.getByLabel("Montant (FCFA)")).toHaveValue(String(tarif.forfait));

		// Un montant saisi à la main n'est pas écrasé quand on change le mois
		await page.getByLabel("Montant (FCFA)").fill("30000");
		const moisPaiement = page
			.locator("form")
			.filter({ has: page.locator("#paiement-type") })
			.locator("select")
			.nth(1);
		await moisPaiement.selectOption("11");
		await page.waitForTimeout(500);
		await expect(page.getByLabel("Montant (FCFA)")).toHaveValue("30000");
	});

	test("fiche élève : ajouter une réduction, la retrouver dans la page Réductions", async ({
		page,
	}) => {
		await login(page);
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const niveaux = await trpc<{ id: string; nom: string }[]>(page, "academic.niveaux.list");
		const classe = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{
				nom: `REDUI-${Date.now()}`,
				niveauId: niveaux[0].id,
				capacite: 30,
				anneeScolaireId: annee.id,
			},
			true,
		);
		const nom = `Fratrie${Date.now()}`;
		const eleve = await trpc<{ id: string }>(
			page,
			"students.create",
			{
				prenom: "Quatrieme",
				nom,
				dateNaissance: "2018-01-01",
				sexe: "M",
				classeId: classe.id,
				anneeScolaireId: annee.id,
				parent: { prenom: "P", nom: "F", telephone: "77 000 00 18", relation: "pere" },
			},
			true,
		);

		await page.goto(`/eleves/${eleve.id}`);
		await waitForLoad(page);
		await page.getByRole("button", { name: "Ajouter une réduction" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Type").selectOption("fratrie");
		await dialog.getByLabel("Porte sur").selectOption("mensualites");
		await dialog.getByLabel("Forme").selectOption("pourcentage");
		await dialog.getByLabel("Valeur").fill("50");
		await dialog.getByLabel("Motif").fill("4e enfant de la famille");
		await dialog.getByRole("button", { name: "Enregistrer" }).click();
		const section = page.getByRole("region", { name: "Réduction" });
		await expect(section).toContainText("Fratrie (4 enfants et plus)");
		await expect(section).toContainText("50 %");

		await page.goto("/finances/reductions");
		await waitForLoad(page);
		await expect(page.getByRole("row", { name: new RegExp(nom) })).toContainText(
			"4e enfant de la famille",
		);
	});
});
