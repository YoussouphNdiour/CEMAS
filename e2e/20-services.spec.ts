import bcrypt from "bcryptjs";
import { expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { login, trpc, waitForLoad } from "./helpers";

type Service = { id: string; nom: string; montantDefaut: number };
type Impayes = { lignes: { id: string; moisImpayes: { typeFraisNom: string; mois: number | null }[] }[] };

function base() {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL requis pour ce test");
	return postgres(url, { max: 1 });
}

async function contexte(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	const classes = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", {
		anneeScolaireId: annee.id,
	});
	const classe = await trpc<{ id: string; nom: string }>(
		page,
		"academic.classes.create",
		{
			nom: `SERV-${Date.now()}`,
			niveauId: (await trpc<{ id: string; nom: string }[]>(page, "academic.niveaux.list")).find(
				(n) => n.nom === "Élémentaire",
			)?.id,
			capacite: 30,
			anneeScolaireId: annee.id,
		},
		true,
	);
	expect(classes.length).toBeGreaterThan(0);
	const services = await trpc<Service[]>(page, "finance.services.list");
	const cantine = services.find((s) => s.nom === "Cantine");
	if (!cantine) throw new Error("Service Cantine absent");
	return { annee, classe, services, cantine };
}

async function nouvelEleve(page: Page, classeId: string, anneeId: string) {
	const nom = `Cantine${Date.now()}${Math.floor(Math.random() * 1000)}`;
	return trpc<{ id: string; matricule: string; nom: string }>(
		page,
		"students.create",
		{
			prenom: "Repas",
			nom,
			dateNaissance: "2016-03-03",
			sexe: "F",
			classeId,
			anneeScolaireId: anneeId,
			parent: { prenom: "P", nom, telephone: "77 000 00 40", relation: "mere" },
		},
		true,
	);
}

const moisCourant = () => new Date().getMonth() + 1;

test.describe("20 - Services mensuels (garderie, renforcement, cantine)", () => {
	test("API : abonner, impayés, payer, arrêter, reprendre, supprimer, montant, droits", async ({
		page,
	}) => {
		await login(page);
		const { annee, classe, services, cantine } = await contexte(page);
		expect(services.map((s) => s.nom).sort()).toEqual(["Cantine", "Cours de renforcement", "Garderie"]);
		expect(services.every((s) => s.montantDefaut === 10_000)).toBe(true);

		const eleve = await nouvelEleve(page, classe.id, annee.id);
		const m = moisCourant();
		await trpc(page, "finance.abonnements.abonner", { eleveId: eleve.id, typeFraisId: cantine.id, moisDebut: m }, true);
		const impayesCantine = async () =>
			(
				await trpc<Impayes>(page, "finance.impayes.list", { anneeScolaireId: annee.id, classeId: classe.id })
			).lignes
				.find((l) => l.id === eleve.id)
				?.moisImpayes.filter((x) => x.typeFraisNom === "Cantine") ?? [];
		expect((await impayesCantine()).map((x) => x.mois)).toEqual([m]);

		await trpc(
			page,
			"finance.paiements.create",
			{ eleveId: eleve.id, typeFraisId: cantine.id, anneeScolaireId: annee.id, mois: m, montant: 10_000 },
			true,
		);
		expect(await impayesCantine()).toEqual([]);

		// Mois de fin antérieur au début : refusé
		const avant = m === 10 ? 9 : m === 1 ? 12 : m - 1;
		await expect(
			trpc(page, "finance.abonnements.arreter", { eleveId: eleve.id, typeFraisId: cantine.id, moisFin: avant }, true),
		).rejects.toThrow(/mois de fin/i);
		await trpc(page, "finance.abonnements.arreter", { eleveId: eleve.id, typeFraisId: cantine.id, moisFin: m }, true);
		await trpc(page, "finance.abonnements.reprendre", { eleveId: eleve.id, typeFraisId: cantine.id }, true);
		await expect(
			trpc(page, "finance.abonnements.supprimer", { eleveId: eleve.id, typeFraisId: cantine.id }, true),
		).rejects.toThrow(/paiement/i);

		// Montant modifié → proposé à la saisie
		await trpc(page, "finance.services.modifierMontant", { typeFraisId: cantine.id, montant: 12_000 }, true);
		const tarif = await trpc<{ services: { typeFraisId: string; montant: number; abonne: boolean }[] }>(
			page,
			"finance.tarifs.pourEleve",
			{ eleveId: eleve.id },
		);
		expect(tarif.services.find((s) => s.typeFraisId === cantine.id)).toMatchObject({ montant: 12_000, abonne: true });
		await trpc(page, "finance.services.modifierMontant", { typeFraisId: cantine.id, montant: 10_000 }, true);

		const sql = base();
		const email = `secr-serv${Date.now()}@test.local`;
		try {
			const [{ n }] = await sql`select count(*)::int n from journal_modifications where entite in ('abonnement', 'service') and (entite_id = ${cantine.id} or libelle like ${`%${eleve.nom}%`})`;
			expect(n).toBeGreaterThanOrEqual(5);
			await sql`insert into users (email, password_hash, nom) values (${email}, ${await bcrypt.hash("secret-123", 10)}, 'Secrétaire')`;
		} finally {
			await sql.end();
		}
		await page.context().clearCookies();
		await page.goto("/login");
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Mot de passe").fill("secret-123");
		await page.getByRole("button", { name: "Se connecter" }).click();
		await page.waitForURL("/", { timeout: 15_000 });
		await expect(
			trpc(page, "finance.abonnements.abonner", { eleveId: eleve.id, typeFraisId: cantine.id, moisDebut: m }, true),
		).rejects.toThrow(/réservée à l'administrateur/);
	});
});
