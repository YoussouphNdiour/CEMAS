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
});
