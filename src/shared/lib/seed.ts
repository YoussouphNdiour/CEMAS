import { db } from "./db";
import { users } from "@/modules/auth/schema";
import { anneesScolaires, niveaux, classes, matieres } from "@/modules/academic/schema";
import { typesFrais, categoriesDepenses, categoriesRecettes } from "@/modules/finance/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function seed() {
	console.log("🌱 Seeding database...");

	// 1. Director account
	const existing = await db.select().from(users).where(eq(users.email, "directeur@cemas.sn"));
	if (existing.length === 0) {
		const hash = await bcrypt.hash("cemas2025", 10);
		await db.insert(users).values({
			email: "directeur@cemas.sn",
			passwordHash: hash,
			nom: "Directeur CEMAS",
		});
		console.log("✅ Compte directeur créé (directeur@cemas.sn / cemas2025)");
	}

	// 2. Année scolaire
	const existingAnnee = await db
		.select()
		.from(anneesScolaires)
		.where(eq(anneesScolaires.libelle, "2025-2026"));
	let anneeId: string;
	if (existingAnnee.length === 0) {
		const [annee] = await db
			.insert(anneesScolaires)
			.values({
				libelle: "2025-2026",
				dateDebut: "2025-10-01",
				dateFin: "2026-07-31",
				active: true,
			})
			.returning();
		anneeId = annee.id;
		console.log("✅ Année scolaire 2025-2026 créée");
	} else {
		anneeId = existingAnnee[0].id;
	}

	// 3. Niveaux
	const existingNiveaux = await db.select().from(niveaux);
	let niveauxMap: Record<string, string>;
	if (existingNiveaux.length === 0) {
		const inserted = await db
			.insert(niveaux)
			.values([
				{ nom: "Crèche", ordre: 1 },
				{ nom: "Préscolaire", ordre: 2 },
				{ nom: "Élémentaire", ordre: 3 },
			])
			.returning();
		niveauxMap = Object.fromEntries(inserted.map((n) => [n.nom, n.id]));
		console.log("✅ 3 niveaux créés");
	} else {
		niveauxMap = Object.fromEntries(existingNiveaux.map((n) => [n.nom, n.id]));
	}

	// 4. Classes
	const existingClasses = await db.select().from(classes);
	if (existingClasses.length === 0) {
		await db.insert(classes).values([
			{ nom: "Petite Section", niveauId: niveauxMap["Crèche"], capacite: 20, anneeScolaireId: anneeId },
			{ nom: "Moyenne Section", niveauId: niveauxMap["Crèche"], capacite: 20, anneeScolaireId: anneeId },
			{ nom: "Grande Section", niveauId: niveauxMap["Préscolaire"], capacite: 25, anneeScolaireId: anneeId },
			{ nom: "CI", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
			{ nom: "CP", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
			{ nom: "CE1", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
			{ nom: "CE2", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
			{ nom: "CM1", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
			{ nom: "CM2", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
		]);
		console.log("✅ 9 classes créées");
	}

	// 5. Matières
	const existingMatieres = await db.select().from(matieres);
	if (existingMatieres.length === 0) {
		await db.insert(matieres).values([
			{ nom: "Français", coefficient: 3, niveauId: niveauxMap["Élémentaire"] },
			{ nom: "Mathématiques", coefficient: 3, niveauId: niveauxMap["Élémentaire"] },
			{ nom: "Éveil", coefficient: 2, niveauId: niveauxMap["Élémentaire"] },
			{ nom: "Éducation physique", coefficient: 1, niveauId: niveauxMap["Élémentaire"] },
			{ nom: "Activités d'éveil", coefficient: 2, niveauId: niveauxMap["Préscolaire"] },
			{ nom: "Langage", coefficient: 2, niveauId: niveauxMap["Préscolaire"] },
			{ nom: "Psychomotricité", coefficient: 1, niveauId: niveauxMap["Crèche"] },
		]);
		console.log("✅ 7 matières créées");
	}

	// 6. Types de frais
	const existingFrais = await db.select().from(typesFrais);
	if (existingFrais.length === 0) {
		await db.insert(typesFrais).values([
			{ nom: "Scolarité", montantDefaut: 25000, obligatoire: true },
			{ nom: "Inscription", montantDefaut: 50000, obligatoire: true },
			{ nom: "Tenue", montantDefaut: 15000, obligatoire: false },
		]);
		console.log("✅ 3 types de frais créés");
	}

	// 7. Catégories de dépenses
	const existingCatDep = await db.select().from(categoriesDepenses);
	if (existingCatDep.length === 0) {
		await db.insert(categoriesDepenses).values([
			{ nom: "Fournitures" },
			{ nom: "Entretien" },
			{ nom: "Équipement" },
			{ nom: "Divers" },
		]);
		console.log("✅ 4 catégories de dépenses créées");
	}

	// 8. Catégories de recettes
	const existingCatRec = await db.select().from(categoriesRecettes);
	if (existingCatRec.length === 0) {
		await db.insert(categoriesRecettes).values([
			{ nom: "Location salle" },
			{ nom: "Événements" },
			{ nom: "Dons" },
			{ nom: "Divers" },
		]);
		console.log("✅ 4 catégories de recettes créées");
	}

	console.log("✅ Seed terminé !");
	process.exit(0);
}

seed().catch((err) => {
	console.error("❌ Seed échoué:", err);
	process.exit(1);
});
