import { expect, test } from "@playwright/test";
import { login, trpc } from "./helpers";

test.describe("18 - Doublons d'élèves", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("un élève déjà inscrit cette année (mêmes prénom, nom, date de naissance) est refusé", async ({
		page,
	}) => {
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const [classe] = await trpc<{ id: string }[]>(page, "academic.classes.list", {
			anneeScolaireId: annee.id,
		});
		const nom = `Kebe${Date.now()}`;
		const eleve = (prenom: string, nomEleve: string, dateNaissance = "2018-11-24") =>
			trpc<{ id: string; matricule: string }>(
				page,
				"students.create",
				{
					prenom,
					nom: nomEleve,
					dateNaissance,
					sexe: "F",
					classeId: classe.id,
					anneeScolaireId: annee.id,
					parent: { prenom: "Macouta", nom: "Kante", telephone: "77 245 50 78", relation: "mere" },
				},
				true,
			);
		const premier = await eleve("Khadija Marieme", nom);
		// Casse et espaces différents : même élève
		await expect(eleve("  khadija   MARIEME ", nom.toUpperCase())).rejects.toThrow(
			new RegExp(`déjà inscrit.*${premier.matricule}`),
		);
		// Homonyme né un autre jour : accepté
		await expect(eleve("Khadija Marieme", nom, "2019-01-01")).resolves.toBeTruthy();
	});

	test("deux inscriptions identiques envoyées en même temps : une seule fiche", async ({
		page,
	}) => {
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const [classe] = await trpc<{ id: string }[]>(page, "academic.classes.list", {
			anneeScolaireId: annee.id,
		});
		const nom = `Simultane${Date.now()}`;
		const inscrire = () =>
			trpc(
				page,
				"students.create",
				{
					prenom: "Double",
					nom,
					dateNaissance: "2017-05-05",
					sexe: "M",
					classeId: classe.id,
					anneeScolaireId: annee.id,
					parent: { prenom: "P", nom, telephone: "77 000 00 24", relation: "pere" },
				},
				true,
			).then(
				() => "ok",
				() => "refus",
			);
		const resultats = await Promise.all([inscrire(), inscrire(), inscrire()]);
		expect(resultats.filter((r) => r === "ok")).toHaveLength(1);
		const liste = await trpc<{ nom: string }[]>(page, "students.list", {
			anneeScolaireId: annee.id,
			search: nom,
		});
		expect(liste.filter((e) => e.nom === nom)).toHaveLength(1);
	});
});
