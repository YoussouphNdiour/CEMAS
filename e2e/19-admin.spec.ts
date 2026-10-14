import { expect, type Page, test } from "@playwright/test";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import { login, trpc, waitForLoad } from "./helpers";

/** Connexion SQL à la base de test (création d'un compte non administrateur, lecture du journal). */
function base() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL requis pour ce test");
	return postgres(url, { max: 1 });
}

async function anneeActive(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const a = annees.find((x) => x.active);
	if (!a) throw new Error("Aucune année active");
	return a;
}

async function classesParNom(page: Page, anneeId: string) {
	const cl = await trpc<{ id: string; nom: string; niveauId: string }[]>(
		page,
		"academic.classes.list",
		{ anneeScolaireId: anneeId },
	);
	return cl;
}

async function nouvelEleve(
	page: Page,
	classeId: string,
	anneeId: string,
	nom = `Admin${Date.now()}`,
) {
	return trpc<{ id: string; matricule: string; nom: string }>(
		page,
		"students.create",
		{
			prenom: "Test",
			nom,
			dateNaissance: "2016-02-02",
			sexe: "M",
			classeId,
			anneeScolaireId: anneeId,
			parent: { prenom: "P", nom, telephone: "77 000 00 30", relation: "pere" },
		},
		true,
	);
}

test.describe("19 - Administration : droits, modifications, journal", () => {
	test("droits : un compte non administrateur est refusé", async ({ page }) => {
		const sql = base();
		const email = `secretaire${Date.now()}@test.local`;
		try {
			const hash = await bcrypt.hash("secret-123", 10);
			await sql`insert into users (email, password_hash, nom, role) values (${email}, ${hash}, 'Secrétaire Test', 'secretaire')`;
		} finally {
			await sql.end();
		}
		// Directeur : administrateur
		await login(page);
		expect((await trpc<{ estAdmin: boolean }>(page, "settings.moi")).estAdmin).toBe(true);
		const annee = await anneeActive(page);
		const [classe] = await classesParNom(page, annee.id);
		const eleve = await nouvelEleve(page, classe.id, annee.id);
		await page.context().clearCookies();

		// Secrétaire : pas administrateur, l'API refuse
		await page.goto("/login");
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Mot de passe").fill("secret-123");
		await page.getByRole("button", { name: "Se connecter" }).click();
		await page.waitForURL("/", { timeout: 15_000 });
		expect((await trpc<{ estAdmin: boolean }>(page, "settings.moi")).estAdmin).toBe(false);
		await expect(
			trpc(page, "students.update", { id: eleve.id, prenom: "Pirate" }, true),
		).rejects.toThrow(/réservée à l'administrateur/);
	});
	test("élève : modifier nom et classe, doublon refusé, autre année refusée", async ({ page }) => {
		await login(page);
		const annee = await anneeActive(page);
		const classes = await classesParNom(page, annee.id);
		const cp = classes.find((c) => c.nom.trim() === "CP") ?? classes[0];
		const ce1 = classes.find((c) => c.nom.trim() === "CE1") ?? classes[1];
		const a = await nouvelEleve(page, cp.id, annee.id);
		const b = await nouvelEleve(page, cp.id, annee.id, `Autre${Date.now()}`);

		const r = await trpc<{ niveauChange: boolean }>(
			page,
			"students.update",
			{ id: a.id, prenom: "Fatma", classeId: ce1.id },
			true,
		);
		expect(r.niveauChange).toBe(cp.niveauId !== ce1.niveauId);
		const fiche = await trpc<{ prenom: string; classeId: string }>(page, "students.getById", {
			id: a.id,
		});
		expect(fiche).toMatchObject({ prenom: "Fatma", classeId: ce1.id });

		const sql = base();
		try {
			const [insc] = await sql`select classe_id from inscriptions where eleve_id = ${a.id}`;
			expect(insc.classe_id).toBe(ce1.id);
			const [j] =
				await sql`select avant, apres, user_nom from journal_modifications where entite_id = ${a.id} and entite = 'eleve' order by created_at desc limit 1`;
			expect(j.avant).toMatchObject({ prenom: "Test", classe: cp.nom });
			expect(j.apres).toMatchObject({ prenom: "Fatma", classe: ce1.nom });
		} finally {
			await sql.end();
		}

		// Même identité qu'une autre fiche de l'année : refusé ; sans changer le nom : accepté
		await expect(
			trpc(page, "students.update", { id: b.id, prenom: "Fatma", nom: a.nom }, true),
		).rejects.toThrow(new RegExp(`déjà inscrit.*${a.matricule}`));
		await expect(
			trpc(
				page,
				"students.update",
				{ id: a.id, prenom: "Fatma", nom: a.nom, adresse: "Thiès" },
				true,
			),
		).resolves.toBeTruthy();

		// Classe d'une autre année : refusée
		const autre = await trpc<{ id: string }>(
			page,
			"academic.annees.create",
			{ libelle: `T-${Date.now()}`, dateDebut: "2030-10-01", dateFin: "2031-07-31" },
			true,
		);
		const classeAutre = await trpc<{ id: string }>(
			page,
			"academic.classes.create",
			{ nom: `X-${Date.now()}`, niveauId: cp.niveauId, capacite: 30, anneeScolaireId: autre.id },
			true,
		);
		await expect(
			trpc(page, "students.update", { id: a.id, classeId: classeAutre.id }, true),
		).rejects.toThrow(/même année/);
	});

	test("élève : suppression refusée avec paiement, acceptée sans ; parent partagé conservé", async ({
		page,
	}) => {
		await login(page);
		const annee = await anneeActive(page);
		const [classe] = await classesParNom(page, annee.id);
		const paye = await nouvelEleve(page, classe.id, annee.id);
		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		await trpc(
			page,
			"finance.paiements.create",
			{
				eleveId: paye.id,
				typeFraisId: frais.find((f) => f.nom === "Scolarité")?.id,
				anneeScolaireId: annee.id,
				mois: 11,
				montant: 1_000,
			},
			true,
		);
		await expect(trpc(page, "students.delete", { id: paye.id }, true)).rejects.toThrow(
			/Retirer de l'école/,
		);

		// Frère et sœur partageant un parent
		const nom = `Fratrie${Date.now()}`;
		const aine = await nouvelEleve(page, classe.id, annee.id, nom);
		const cadet = await nouvelEleve(page, classe.id, annee.id, `${nom}B`);
		const sql = base();
		try {
			const [lien] = await sql`select parent_id from eleve_parents where eleve_id = ${aine.id}`;
			const [lienCadet] =
				await sql`select parent_id from eleve_parents where eleve_id = ${cadet.id}`;
			await sql`update eleve_parents set parent_id = ${lien.parent_id} where eleve_id = ${cadet.id}`;
			await sql`delete from parents where id = ${lienCadet.parent_id}`;
			await trpc(page, "students.delete", { id: aine.id }, true);
			const [{ n }] = await sql`select count(*)::int n from parents where id = ${lien.parent_id}`;
			expect(n).toBe(1);
			await trpc(page, "students.delete", { id: cadet.id }, true);
			// Le matricule de la fiche supprimée (la plus récente) n'est pas réattribué
			const suivant = await nouvelEleve(page, classe.id, annee.id, `${nom}C`);
			expect([aine.matricule, cadet.matricule]).not.toContain(suivant.matricule);
			const [{ m }] = await sql`select count(*)::int m from parents where id = ${lien.parent_id}`;
			expect(m).toBe(0);
			const [{ j }] =
				await sql`select count(*)::int j from journal_modifications where entite_id = ${aine.id} and action = 'suppression'`;
			expect(j).toBe(1);
		} finally {
			await sql.end();
		}
	});

	test("élève : retirer puis réintégrer depuis la fiche, modifier un contact", async ({ page }) => {
		await login(page);
		const annee = await anneeActive(page);
		const [classe] = await classesParNom(page, annee.id);
		const eleve = await nouvelEleve(page, classe.id, annee.id);
		await page.goto(`/eleves/${eleve.id}`);
		await waitForLoad(page);

		await page.getByRole("button", { name: "Retirer de l'école" }).click();
		const dialogue = page.getByRole("dialog");
		await dialogue.getByLabel("Transféré").check();
		await dialogue.getByRole("button", { name: "Retirer" }).click();
		await expect(page.getByRole("button", { name: "Réintégrer" })).toBeVisible();
		expect(
			(await trpc<{ statut: string }>(page, "students.getById", { id: eleve.id })).statut,
		).toBe("transfere");
		await page.getByRole("button", { name: "Réintégrer" }).click();
		await expect(page.getByRole("button", { name: "Retirer de l'école" })).toBeVisible();

		await page.getByRole("button", { name: "Modifier le contact" }).first().click();
		await page.getByRole("dialog").getByLabel("Nom *", { exact: true }).fill("DIOUF MBODJ");
		await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByTestId("contact").first()).toContainText("DIOUF MBODJ");

		await page.getByRole("button", { name: "Modifier l'élève" }).click();
		await page.getByRole("dialog").getByLabel("Prénom *", { exact: true }).fill("Renommé");
		await page.getByRole("dialog").getByRole("button", { name: "Enregistrer" }).click();
		await expect(
			page.getByRole("heading", { name: new RegExp(`Renommé ${eleve.nom}`) }),
		).toBeVisible();
	});
	test("paiement : modifier avec motif, mois déjà payé et octobre refusés, supprimer avec motif", async ({
		page,
	}) => {
		await login(page);
		const annee = await anneeActive(page);
		const classes = await classesParNom(page, annee.id);
		const ce1 = classes.find((c) => c.nom.trim() === "CE1") ?? classes[0];
		const eleve = await nouvelEleve(page, ce1.id, annee.id);
		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		const sco = frais.find((f) => f.nom === "Scolarité")?.id;
		const payer = (mois: number, montant: number) =>
			trpc<{ id: string; numeroRecu: string }>(
				page,
				"finance.paiements.create",
				{ eleveId: eleve.id, typeFraisId: sco, anneeScolaireId: annee.id, mois, montant },
				true,
			);
		const nov = await payer(11, 24_000);
		const dec = await payer(12, 20_000);
		const modif = (champs: Record<string, unknown>) =>
			trpc(
				page,
				"finance.paiements.update",
				{
					id: nov.id,
					typeFraisId: sco,
					mois: 11,
					montant: 24_000,
					datePaiement: "2026-10-08",
					...champs,
				},
				true,
			);

		await expect(modif({ montant: 20_000, motif: "" })).rejects.toThrow(/motif/i);
		await modif({ montant: 20_000, motif: "Montant de novembre corrigé" });
		const recu = await trpc<{ montant: number; numeroRecu: string }>(
			page,
			"finance.paiements.getRecuData",
			{ paiementId: nov.id },
		);
		expect(recu).toMatchObject({ montant: 20_000, numeroRecu: nov.numeroRecu });
		await expect(modif({ mois: 12, montant: 20_000, motif: "Erreur" })).rejects.toThrow(
			new RegExp(`déjà payé.*${dec.numeroRecu}`),
		);
		await expect(modif({ mois: 10, montant: 20_000, motif: "Erreur" })).rejects.toThrow(
			/comprise dans le forfait/,
		);

		await expect(
			trpc(page, "finance.paiements.delete", { id: dec.id, motif: "" }, true),
		).rejects.toThrow(/motif/i);
		await trpc(page, "finance.paiements.delete", { id: dec.id, motif: "Saisi deux fois" }, true);
		// Le numéro du reçu supprimé (le plus récent) n'est jamais réattribué
		const suivant = await payer(1, 24_000);
		expect(suivant.numeroRecu).not.toBe(dec.numeroRecu);

		const sql = base();
		try {
			const lignes =
				await sql`select action, motif, avant, apres from journal_modifications where entite = 'paiement' and entite_id in (${nov.id}, ${dec.id}) order by created_at`;
			expect(lignes.map((l) => l.action)).toEqual(["modification", "suppression"]);
			expect(lignes[0]).toMatchObject({
				motif: "Montant de novembre corrigé",
				avant: { montant: 24_000 },
				apres: { montant: 20_000 },
			});
			expect(lignes[1].motif).toBe("Saisi deux fois");
			const [{ n }] = await sql`select count(*)::int n from paiements where id = ${dec.id}`;
			expect(n).toBe(0);
		} finally {
			await sql.end();
		}
	});

	test("paiement : actions depuis la liste du mois et la fiche élève", async ({ page }) => {
		await login(page);
		const annee = await anneeActive(page);
		const classes = await classesParNom(page, annee.id);
		const ce1 = classes.find((c) => c.nom.trim() === "CE1") ?? classes[0];
		const eleve = await nouvelEleve(page, ce1.id, annee.id);
		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		const p = await trpc<{ id: string; numeroRecu: string }>(
			page,
			"finance.paiements.create",
			{
				eleveId: eleve.id,
				typeFraisId: frais.find((f) => f.nom === "Scolarité")?.id,
				anneeScolaireId: annee.id,
				mois: 11,
				montant: 21_000,
			},
			true,
		);
		// Fiche élève : section Paiements, modifier le montant
		await page.goto(`/eleves/${eleve.id}`);
		await waitForLoad(page);
		const section = page.getByRole("region", { name: "Paiements" });
		await expect(section).toContainText(p.numeroRecu);
		await section.getByRole("button", { name: "Modifier le paiement" }).click();
		const dialogue = page.getByRole("dialog");
		await dialogue.getByLabel("Montant (FCFA)").fill("20000");
		await dialogue.getByLabel("Motif *").fill("Correction");
		await dialogue.getByRole("button", { name: "Enregistrer" }).click();
		await expect(section).toContainText("20 000");

		// Liste du mois : supprimer
		await page.goto("/finances/paiements");
		await waitForLoad(page);
		// Liste des paiements du mois de novembre (filtre sous le formulaire)
		await page.getByLabel("Voir les paiements du mois").selectOption("11");
		await page.getByPlaceholder("Rechercher un paiement...").fill(p.numeroRecu);
		const ligne = page.getByRole("row", { name: new RegExp(p.numeroRecu) });
		await ligne.getByRole("button", { name: "Supprimer le paiement" }).click();
		await page.getByRole("dialog").getByLabel("Motif *").fill("Doublon");
		await page.getByRole("dialog").getByRole("button", { name: "Supprimer" }).click();
		await expect(
			page.getByRole("row", { name: new RegExp(`${p.numeroRecu} — Test ${eleve.nom}`) }),
		).toHaveCount(0);
	});
	test("employé : suppression refusée avec bulletins, désactiver / réactiver, suppression sans bulletin", async ({
		page,
	}) => {
		await login(page);
		const creer = (prenom: string) =>
			trpc<{ id: string; matricule: string }>(
				page,
				"payroll.employes.create",
				{
					prenom,
					nom: `Emp${Date.now()}`,
					poste: "Enseignant",
					type: "enseignant",
					salaireBase: 100_000,
					dateEmbauche: "2026-10-01",
				},
				true,
			);
		const avecBulletin = await creer("Paye");
		await trpc(page, "payroll.bulletins.generate", { mois: 1, annee: 2031 }, true);
		await expect(
			trpc(page, "payroll.employes.delete", { id: avecBulletin.id }, true),
		).rejects.toThrow(/désactivez-le/);

		await page.goto("/payroll/employes");
		await waitForLoad(page);
		const ligne = page.getByRole("row", { name: new RegExp(avecBulletin.matricule) });
		await ligne.getByRole("button", { name: "Désactiver" }).click();
		await expect(ligne.getByRole("button", { name: "Réactiver" })).toBeVisible();
		await ligne.getByRole("button", { name: "Réactiver" }).click();
		await expect(ligne.getByRole("button", { name: "Désactiver" })).toBeVisible();

		const sansBulletin = await creer("Nouveau");
		await trpc(page, "payroll.employes.delete", { id: sansBulletin.id }, true);

		const sql = base();
		try {
			const lignes =
				await sql`select action from journal_modifications where entite = 'employe' and entite_id in (${avecBulletin.id}, ${sansBulletin.id}) order by created_at`;
			expect(lignes.map((l) => l.action)).toEqual(["modification", "modification", "suppression"]);
		} finally {
			await sql.end();
		}
	});
	test("page Journal : actions listées avec détail et motif, filtre par type", async ({ page }) => {
		await login(page);
		const annee = await anneeActive(page);
		const classes = await classesParNom(page, annee.id);
		const ce1 = classes.find((c) => c.nom.trim() === "CE1") ?? classes[0];
		const eleve = await nouvelEleve(page, ce1.id, annee.id);
		const frais = await trpc<{ id: string; nom: string }[]>(page, "finance.typesFrais.list");
		const sco = frais.find((f) => f.nom === "Scolarité")?.id;
		const p = await trpc<{ id: string; numeroRecu: string }>(
			page,
			"finance.paiements.create",
			{ eleveId: eleve.id, typeFraisId: sco, anneeScolaireId: annee.id, mois: 11, montant: 24_000 },
			true,
		);
		await trpc(
			page,
			"finance.paiements.update",
			{
				id: p.id,
				typeFraisId: sco,
				mois: 11,
				montant: 20_000,
				datePaiement: "2026-10-08",
				motif: "Erreur de montant",
			},
			true,
		);
		await page.goto("/parametres");
		await waitForLoad(page);
		await page.getByRole("link", { name: "Journal des modifications" }).click();
		await expect(page).toHaveURL(/\/parametres\/journal$/);
		await page.getByLabel("Objet").selectOption("paiement");
		const ligne = page.getByRole("row", {
			name: new RegExp(`${p.numeroRecu} — Test ${eleve.nom}`),
		});
		await expect(ligne).toContainText("Montant : 24 000 FCFA → 20 000 FCFA");
		await expect(ligne).toContainText("Erreur de montant");
		await page.getByLabel("Objet").selectOption("employe");
		await expect(
			page.getByRole("row", { name: new RegExp(`${p.numeroRecu} — Test ${eleve.nom}`) }),
		).toHaveCount(0);
	});
});
