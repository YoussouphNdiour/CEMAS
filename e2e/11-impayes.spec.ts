import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Resultat = {
	lignes: {
		id: string;
		reste: number;
		du: number;
		paye: number;
		moisImpayes: { typeFraisNom: string; mois: number | null }[];
	}[];
	totalReste: number;
	classesMontantDefaut: { classeId: string }[];
};

async function contexte(page: Page) {
	const annees = await trpc<{ id: string; active: boolean; dateDebut: string }[]>(
		page,
		"academic.annees.list",
	);
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const frais = await trpc<{ id: string; nom: string; obligatoire: boolean; mensuel: boolean }[]>(
		page,
		"finance.typesFrais.list",
	);
	const sco = frais.find((f) => f.obligatoire && f.mensuel);
	const ins = frais.find((f) => f.obligatoire && !f.mensuel);
	if (!sco || !ins) throw new Error("Frais obligatoires manquants");
	const classe = await trpc<{ id: string }>(
		page,
		"academic.classes.create",
		{ nom: `IMP-${Date.now()}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id },
		true,
	);
	const eleve = await trpc<{ id: string }>(
		page,
		"students.create",
		{
			prenom: "Impaye",
			nom: `Test${Date.now()}`,
			dateNaissance: "2016-01-01",
			sexe: "F",
			classeId: classe.id,
			anneeScolaireId: annee.id,
			parent: { prenom: "Parent", nom: "Impaye", telephone: "77 999 99 99", relation: "mere" },
		},
		true,
	);
	return { annee, niveau, sco, ins, classe, eleve };
}

/** Dû selon les tarifs du niveau : forfait + mois de l'échéancier écoulés (mêmes règles que le serveur). */
async function duSelonTarifs(page: Page, anneeId: string, niveauId: string, dateDebut: string) {
	const tarifs = await trpc<
		{ niveauId: string; total: number; echeancier: { mois: number; montant: number }[] }[]
	>(page, "finance.tarifs.list", { anneeScolaireId: anneeId });
	const t = tarifs.find((x) => x.niveauId === niveauId);
	if (!t) throw new Error("Tarifs du niveau absents");
	const ech = new Map(t.echeancier.map((e) => [e.mois, e.montant]));
	let [a, m] = dateDebut.split("-").map(Number);
	const fin = new Date().getUTCFullYear() * 100 + new Date().getUTCMonth() + 1;
	let mensualites = 0;
	while (a * 100 + m <= fin) {
		mensualites += ech.get(m) ?? 0;
		if (m === 12) {
			a++;
			m = 1;
		} else m++;
	}
	return { forfait: t.total, mensualites };
}

test.describe("11 - Impayés et relances", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("API : grille, reste calculé, paiement de l'inscription", async ({ page }) => {
		const { annee, niveau, sco, ins, classe, eleve } = await contexte(page);
		await expect(
			trpc(
				page,
				"finance.grilleFrais.upsertMany",
				{
					anneeScolaireId: annee.id,
					cellules: [{ classeId: classe.id, typeFraisId: sco.id, montant: -5 }],
				},
				true,
			),
		).rejects.toThrow();

		const r0 = await trpc<{ count: number }>(
			page,
			"finance.grilleFrais.upsertMany",
			{
				anneeScolaireId: annee.id,
				cellules: [
					{ classeId: classe.id, typeFraisId: sco.id, montant: 21_000 },
					{ classeId: classe.id, typeFraisId: ins.id, montant: 61_000 },
				],
			},
			true,
		);
		expect(r0.count).toBe(2);

		const avant = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: classe.id,
		});
		// Le niveau a des tarifs (forfait + échéancier) : ils priment sur la grille de la classe
		const { forfait, mensualites } = await duSelonTarifs(
			page,
			annee.id,
			niveau.id,
			annee.dateDebut,
		);
		expect(avant.lignes).toHaveLength(1);
		expect(avant.lignes[0]).toMatchObject({ id: eleve.id, reste: forfait + mensualites, paye: 0 });
		expect(avant.classesMontantDefaut).toEqual([]);

		await trpc(
			page,
			"finance.paiements.create",
			{
				eleveId: eleve.id,
				typeFraisId: ins.id,
				anneeScolaireId: annee.id,
				mois: 10,
				montant: 55_000,
			},
			true,
		);
		const apres = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: classe.id,
		});
		expect(apres.lignes[0]).toMatchObject({
			reste: Math.max(0, forfait - 55_000) + mensualites,
			paye: 55_000,
		});

		// Filtre sans élève : liste vide, totaux à zéro
		const vide = await trpc<Resultat>(page, "finance.impayes.list", {
			anneeScolaireId: annee.id,
			classeId: "00000000-0000-4000-8000-000000000000",
		});
		expect(vide).toMatchObject({ lignes: [], totalReste: 0 });

		const stats = await trpc<{ totalImpayes: number }>(page, "dashboard.stats", {
			anneeScolaireId: annee.id,
		});
		expect(stats.totalImpayes).toBeGreaterThanOrEqual(apres.totalReste);
	});

	test("UI : saisir la grille d'une classe et l'appliquer au niveau", async ({ page }) => {
		const { annee, niveau, classe } = await contexte(page);
		const classe2 = await trpc<{ id: string; nom: string }>(
			page,
			"academic.classes.create",
			{ nom: `IMP2-${Date.now()}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id },
			true,
		);
		const classes = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", {
			anneeScolaireId: annee.id,
		});
		const nom1 = classes.find((c) => c.id === classe.id)?.nom ?? "";

		await page.goto("/finances/grille");
		await waitForLoad(page);
		await page.getByLabel(`${nom1} — Scolarité`).fill("23000");
		await page.getByLabel(`${nom1} — Inscription`).fill("62000");
		await page
			.getByRole("row", { name: new RegExp(nom1) })
			.getByRole("button", { name: "Appliquer au niveau" })
			.click();
		await expect(page.getByLabel(`${classe2.nom} — Scolarité`)).toHaveValue("23000");
		await page.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByText("Grille enregistrée")).toBeVisible();

		const grille = await trpc<{ classeId: string; typeFraisNom: string; montantMensuel: number }[]>(
			page,
			"finance.grilleFrais.list",
			{ anneeScolaireId: annee.id },
		);
		expect(
			grille.find((g) => g.classeId === classe2.id && g.typeFraisNom === "Scolarité")
				?.montantMensuel,
		).toBe(23_000);
	});

	test("UI : liste des impayés, lettre de relance et carte du tableau de bord", async ({
		page,
	}) => {
		const { classe, eleve } = await contexte(page);
		const classes = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list");
		const nomClasse = classes.find((c) => c.id === classe.id)?.nom ?? "";

		await page.goto("/finances/impayes");
		await waitForLoad(page);
		await page.getByLabel("Classe").selectOption(classe.id);
		const ligne = page.getByRole("row", { name: new RegExp(nomClasse) }).first();
		await expect(ligne).toContainText("Inscription");
		await expect(ligne).toContainText("77 999 99 99");
		await expect(ligne).toContainText("Inscription (forfait)");

		const download = page.waitForEvent("download");
		await ligne.getByRole("button", { name: "Lettre" }).click();
		const fichier = await download;
		expect(fichier.suggestedFilename()).toMatch(/^relance-.+\.pdf$/);

		await ligne.getByRole("checkbox").check();
		const lot = page.waitForEvent("download");
		await page.getByRole("button", { name: /Lettres de relance \(1\)/ }).click();
		// Sélection d'un seul élève : même nom de fichier que la lettre individuelle (spec)
		expect((await lot).suggestedFilename()).toBe(fichier.suggestedFilename());

		await page.goto("/");
		await waitForLoad(page);
		await expect(page.getByText("Impayés").first()).toBeVisible();
		expect(eleve.id).toBeTruthy();
	});

	test("UI : une saisie non enregistrée survit au rechargement des données de la grille", async ({
		page,
	}) => {
		test.setTimeout(90_000);
		const { annee, sco, classe } = await contexte(page);
		const autre = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{
				nom: `IMP3-${Date.now()}`,
				niveauId: (await trpc<{ id: string }[]>(page, "academic.niveaux.list"))[0].id,
				capacite: 30,
				anneeScolaireId: annee.id,
			},
			true,
		);
		const classes = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", {
			anneeScolaireId: annee.id,
		});
		const nom = classes.find((c) => c.id === classe.id)?.nom ?? "";

		await page.goto("/finances/grille");
		await waitForLoad(page);
		await page.getByLabel(`${nom} — Scolarité`).fill("19500");

		// Une autre modification arrive côté serveur, puis la page recharge ses données (retour sur l'onglet)
		await trpc(
			page,
			"finance.grilleFrais.upsertMany",
			{
				anneeScolaireId: annee.id,
				cellules: [{ classeId: autre.id, typeFraisId: sco.id, montant: 11_000 }],
			},
			true,
		);
		await page.waitForTimeout(31_000);
		await page.evaluate(() => {
			Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
			window.dispatchEvent(new Event("visibilitychange"));
			Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
			window.dispatchEvent(new Event("visibilitychange"));
		});
		const autreNom =
			(
				await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", {
					anneeScolaireId: annee.id,
				})
			).find((c) => c.id === autre.id)?.nom ?? "";
		await expect(page.getByLabel(`${autreNom} — Scolarité`)).toHaveValue("11000");
		await expect(page.getByLabel(`${nom} — Scolarité`)).toHaveValue("19500");
	});
});
