import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

// Archive l'année active : uniquement sur une base jetable (CI).
test.skip(process.env.E2E_DESTRUCTIF !== "1", "test destructif : E2E_DESTRUCTIF=1 requis");
// Un nouvel essai tournerait sur une base déjà basculée et masquerait un échec
test.describe.configure({ retries: 0, mode: "serial" });

type Ctx = {
	source: { id: string; libelle: string };
	proposition: { libelle: string };
	classes: { id: string }[];
};

test("14 - Passage complet à l'année suivante", async ({ page }) => {
	test.setTimeout(120_000);
	await login(page);
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const source = annees.find((a) => a.active);
	if (!source) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const t = Date.now();
	const creerClasse = (nom: string) =>
		trpc<{ id: string; nom: string }>(
			page,
			"academic.classes.create",
			{ nom, niveauId: niveau.id, capacite: 30, anneeScolaireId: source.id },
			true,
		);
	const A = await creerClasse(`PAS-A-${t}`);
	const B = await creerClasse(`PAS-B-${t}`);
	const eleve = (prenom: string, classeId: string) =>
		trpc<{ id: string }>(
			page,
			"students.create",
			{
				prenom,
				nom: `Passage${t}`,
				dateNaissance: "2016-01-01",
				sexe: "M",
				classeId,
				anneeScolaireId: source.id,
				parent: { prenom: "P", nom: "Passage", telephone: "77 000 00 14", relation: "pere" },
			},
			true,
		);
	const promu = await eleve("Promu", A.id);
	const redoublant = await eleve("Redoublant", A.id);
	const sortant = await eleve("Sortant", B.id);
	const frais = await trpc<{ id: string; obligatoire: boolean; mensuel: boolean }[]>(
		page,
		"finance.typesFrais.list",
	);
	const sco = frais.find((f) => f.obligatoire && f.mensuel);
	if (!sco) throw new Error("Scolarité absente");
	await trpc(
		page,
		"finance.grilleFrais.upsertMany",
		{
			anneeScolaireId: source.id,
			cellules: [{ classeId: A.id, typeFraisId: sco.id, montant: 17_000 }],
		},
		true,
	);
	await trpc(
		page,
		"finance.paiements.create",
		{
			eleveId: promu.id,
			typeFraisId: sco.id,
			anneeScolaireId: source.id,
			mois: 10,
			montant: 17_000,
		},
		true,
	);

	// Toutes les autres classes en fin de cycle ; A → B ; B fin de cycle
	const ctx = await trpc<Ctx>(page, "academic.passage.contexte");

	// Année cible déjà créée à la main, avec une classe de même nom que A et un montant déjà saisi :
	// le passage doit la réutiliser sans doublon et sans écraser le montant
	const cibleExistante = await trpc<{ id: string }>(
		page,
		"academic.annees.create",
		{
			libelle: ctx.proposition.libelle,
			dateDebut: "2027-10-01",
			dateFin: "2028-07-31",
		},
		true,
	);
	const aExistante = await trpc<{ id: string }>(
		page,
		"academic.classes.create",
		{ nom: A.nom, niveauId: niveau.id, capacite: 30, anneeScolaireId: cibleExistante.id },
		true,
	);
	await trpc(
		page,
		"finance.grilleFrais.upsertMany",
		{
			anneeScolaireId: cibleExistante.id,
			cellules: [{ classeId: aExistante.id, typeFraisId: sco.id, montant: 99_000 }],
		},
		true,
	);
	await trpc(
		page,
		"academic.passage.configurerClasses",
		{
			classes: ctx.classes.map((c) =>
				c.id === A.id
					? { id: c.id, classeSuivanteId: B.id, finDeCycle: false }
					: { id: c.id, classeSuivanteId: null, finDeCycle: true },
			),
		},
		true,
	);

	// Assistant
	await page.goto("/academique/annees");
	await waitForLoad(page);
	await page.getByRole("link", { name: /Passer à l'année suivante|Préparer le passage/ }).click();
	await expect(page.getByRole("heading", { name: "1. Nouvelle année" })).toBeVisible();
	await expect(page.getByLabel("Libellé")).toHaveValue(ctx.proposition.libelle);
	await page.getByRole("button", { name: "Suivant" }).click();
	await expect(page.getByRole("heading", { name: "2. Classes" })).toBeVisible();
	await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
	await expect(page.getByRole("heading", { name: "3. Élèves" })).toBeVisible();
	await page
		.getByRole("row", { name: new RegExp(`Redoublant Passage${t}`) })
		.getByLabel("Redouble")
		.check();
	await page.getByRole("button", { name: "Suivant" }).click();
	await expect(page.getByRole("heading", { name: "4. Vérification" })).toBeVisible();
	await expect(page.getByRole("row", { name: new RegExp(A.nom) }).first()).toContainText("1");
	await page.getByRole("button", { name: "Suivant" }).click();
	await expect(page.getByRole("heading", { name: "5. Contrôles et lancement" })).toBeVisible();
	const lancer = page.getByRole("button", { name: "Lancer le passage" });
	await expect(lancer).toBeDisabled();
	await page.getByRole("button", { name: "Faire une sauvegarde maintenant" }).click();
	await expect(page.getByText(/Dernière sauvegarde : il y a/)).toBeVisible({ timeout: 30_000 });
	await page.getByLabel("Classes suivantes vérifiées").check();
	await page.getByLabel("Redoublants et départs décidés").check();
	await page.getByLabel("Grille tarifaire de la nouvelle année revue").check();
	await expect(lancer).toBeEnabled();
	await lancer.click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Confirmer le passage" }).click();
	await expect(page.getByText("Passage effectué")).toBeVisible({ timeout: 60_000 });
	await expect(page.getByText(/prepassage-\d{8}-\d{9}-[0-9a-f]{6}\.dump/)).toBeVisible();

	// Vérifications
	const apres = await trpc<{ id: string; libelle: string; active: boolean; archived: boolean }[]>(
		page,
		"academic.annees.list",
	);
	const cible = apres.find((a) => a.active);
	expect(cible?.libelle).toBe(ctx.proposition.libelle);
	expect(apres.find((a) => a.id === source.id)?.archived).toBe(true);

	const classesCible = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", {
		anneeScolaireId: cible?.id,
	});
	const A2 = classesCible.find((c) => c.nom === A.nom);
	const B2 = classesCible.find((c) => c.nom === B.nom);
	expect(A2 && B2).toBeTruthy();

	const detail = (id: string) =>
		trpc<{ classeId: string; statut: string }>(page, "students.getById", { id });
	expect((await detail(promu.id)).classeId).toBe(B2?.id);
	expect((await detail(redoublant.id)).classeId).toBe(A2?.id);
	expect((await detail(sortant.id)).statut).toBe("inactif");

	const grille = await trpc<{ classeId: string; montantMensuel: number }[]>(
		page,
		"finance.grilleFrais.list",
		{ anneeScolaireId: cible?.id },
	);
	expect(grille.find((g) => g.classeId === A2?.id)?.montantMensuel).toBe(99_000);
	// Tarifs par niveau recopiés vers la nouvelle année
	const totaux = async (anneeId: string) =>
		(
			await trpc<{ niveauNom: string; total: number }[]>(page, "finance.tarifs.list", {
				anneeScolaireId: anneeId,
			})
		)
			.map((t) => `${t.niveauNom}:${t.total}`)
			.sort();
	expect(await totaux(cible?.id ?? "")).toEqual(await totaux(source.id));
	expect(cible?.id).toBe(cibleExistante.id);
	expect(classesCible.filter((c) => c.nom === A.nom)).toHaveLength(1);
	expect(A2?.id).toBe(aExistante.id);

	const bilan = await trpc<{ totalPaiements: number }>(page, "finance.bilan.summary", {
		anneeScolaireId: source.id,
	});
	expect(bilan.totalPaiements).toBeGreaterThanOrEqual(17_000);
});

test("14b - Deux passages simultanés : un seul aboutit", async ({ page }) => {
	test.setTimeout(60_000);
	await login(page);
	const ctx = await trpc<Ctx>(page, "academic.passage.contexte");
	await trpc(
		page,
		"academic.passage.configurerClasses",
		{
			classes: ctx.classes.map((c) => ({ id: c.id, classeSuivanteId: null, finDeCycle: true })),
		},
		true,
	);
	const cible = {
		libelle: ctx.proposition.libelle,
		dateDebut: "2028-10-01",
		dateFin: "2029-07-31",
	};
	const dossier = process.env.BACKUP_DIR ?? "";
	const avant = new Set(dossier ? await readdir(dossier) : []);
	const resultats = await Promise.allSettled([
		trpc(
			page,
			"academic.passage.executer",
			{ cible, decisions: {}, confirmations: { classes: true, decisions: true, grille: true } },
			true,
		),
		trpc(
			page,
			"academic.passage.executer",
			{ cible, decisions: {}, confirmations: { classes: true, decisions: true, grille: true } },
			true,
		),
	]);
	expect(resultats.filter((r) => r.status === "fulfilled")).toHaveLength(1);
	// Le perdant est refusé avant toute sauvegarde : une seule sauvegarde prepassage, lisible
	const refus = resultats.find((r) => r.status === "rejected") as PromiseRejectedResult;
	expect(String(refus.reason)).toMatch(/déjà en cours|Aucune année scolaire active/);
	if (dossier) {
		const nouveaux = (await readdir(dossier)).filter(
			(f) => !avant.has(f) && f.startsWith("prepassage-"),
		);
		expect(nouveaux).toHaveLength(1);
		const pgRestore = process.env.PG_BIN_DIR
			? `${process.env.PG_BIN_DIR}/pg_restore`
			: "pg_restore";
		expect(() => execFileSync(pgRestore, ["-l", `${dossier}/${nouveaux[0]}`])).not.toThrow();
	}
	const annees = await trpc<{ libelle: string }[]>(page, "academic.annees.list");
	expect(annees.filter((a) => a.libelle === cible.libelle)).toHaveLength(1);
});

test("14c - Passage refusé avant la fin de l'année active", async ({ page }) => {
	await login(page);
	const ctx = await trpc<Ctx & { fenetre: { etat: string } }>(page, "academic.passage.contexte");
	expect(ctx.fenetre.etat).not.toBe("ouvert");
	await expect(
		trpc(
			page,
			"academic.passage.executer",
			{
				cible: { libelle: ctx.proposition.libelle, dateDebut: "2029-10-01", dateFin: "2030-07-31" },
				decisions: {},
				confirmations: { classes: true, decisions: true, grille: true },
			},
			true,
		),
	).rejects.toThrow(/disponible à partir du/i);
});
