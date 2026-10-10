# Forfait d'inscription et échéancier par niveau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modéliser le forfait d'inscription (composition par niveau) et l'échéancier mensuel par niveau, et les utiliser pour les impayés, le suivi, le montant proposé à la saisie et le reçu.

**Architecture:** Deux tables (`forfait_lignes`, `echeancier`) gérées par un sous-routeur `finance.tarifs` ; valeurs 2026-2027 insérées par le seed si absentes. `calculerImpayes` reçoit forfaits et échéanciers (repli sur la grille sinon). Page `/finances/tarifs`. Le passage d'année recopie les tarifs.

**Tech Stack:** Next.js 16, tRPC 11, Drizzle 0.45 / PostgreSQL 16, zod 4, jsPDF, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-forfait-echeancier-design.md`

## Global Constraints

- Valeurs 2026-2027 (spec § 3) — Crèche : FG 30 000 · Fournitures 10 000 (↔ type Fourniture) · Mensualité octobre 40 000 = 80 000 ; échéancier nov-mai 40 000. Préscolaire : FG 32 500 · Uniforme (2) 10 000 · Fournitures 7 000 (↔ Fourniture) · Mensualité octobre 17 500 = 67 000 ; nov-mai 20 000. Élémentaire : FG 32 500 · Uniforme (2) 12 500 · Mensualité octobre 20 000 = 65 000 ; nov-déc 20 000, janv-mai 24 000. Moyen : FG 30 000 · Uniforme (2) 15 000 · Mensualité octobre 25 000 = 70 000 ; nov-déc 25 000, janv-mai 30 000.
- Échéancier : mois absent = non dû ; octobre jamais dans l'échéancier (inclus dans le forfait).
- Forfait : dû = Σ lignes ; payé = Σ « Inscription » + Σ paiements des types associés ; reste = max(0, dû − payé).
- Scolarité : un mois payé est soldé (D-016) ; montant du mois = échéancier.
- Repli si niveau non configuré : règles actuelles (grille / défaut, signalement).
- Seed : n'insère que si le niveau n'a ni forfait ni échéancier pour l'année active.
- Montants entiers ≥ 0 ; libellés UI français ; Biome ; worktree `/Users/yusper/Downloads/CEMAS-forfait`. Tests locaux : `E2E_PORT=3100`. **Aucune écriture en production hors déploiement.**

## Review Focus

1. Élève du préscolaire ayant payé 60 000 (Inscription) + 7 000 (Fourniture) → à jour (forfait 67 000). Test : Task 2 Vitest.
2. Paiement « Inscription » supérieur au forfait (ex. ancienne saisie 65 000 pour 60 000) → reste 0, jamais négatif. Test : Task 2 Vitest.
3. Niveau sans configuration (nouveau niveau ajouté) → repli sur la grille, pas d'erreur. Test : Task 2 Vitest.
4. Enregistrement des tarifs avec un montant négatif ou un mois hors 1–12 / octobre → refus. Test : Task 1 e2e API.
5. Année active sans tarifs (nouvelle année créée à la main) → la page Tarifs affiche des cartes vides éditables, la saisie ne propose pas de montant. Test : Task 4 (affichage vide vérifié manuellement, consigné au ledger).

---

### Task 1: Tables, seed et routeur `finance.tarifs`

**Files:** Modify `src/modules/finance/schema.ts`, `src/modules/finance/validation.ts`, `src/modules/finance/router.ts`, `src/shared/lib/seed.ts` ; Create `src/modules/finance/tarifs-defaut.ts`, `drizzle/migrations/0009_*.sql`, `e2e/15-tarifs.spec.ts`

**Interfaces — Produces:**
- tables `forfaitLignes`, `echeancier`
- `TARIFS_DEFAUT: Record<string /* nom de niveau */, { lignes: { libelle: string; montant: number; typeFrais?: "Fourniture" | "Tenue" }[]; echeancier: Record<number, number> }>`
- tRPC `finance.tarifs.list({ anneeScolaireId }) → { niveauId, niveauNom, ordre, lignes: { libelle, montant, ordre, typeFraisId: string | null }[], total, echeancier: { mois, montant }[] }[]` (tous les niveaux, triés par ordre)
- `finance.tarifs.enregistrer({ anneeScolaireId, niveauId, lignes: { libelle, montant, typeFraisId: uuid | null }[], echeancier: { mois, montant }[] }) → { lignes: number; mois: number }` (remplacement transactionnel)
- `finance.tarifs.pourEleve({ eleveId }) → { forfait: number | null; echeancier: Record<number, number> }` (année active, niveau de la classe de l'élève)

- [ ] **Step 1: Failing e2e (API)** — `e2e/15-tarifs.spec.ts` :
```ts
import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Tarif = { niveauId: string; niveauNom: string; total: number; lignes: { libelle: string; montant: number; typeFraisId: string | null }[]; echeancier: { mois: number; montant: number }[] };

async function anneeActive(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const a = annees.find((x) => x.active);
	if (!a) throw new Error("Aucune année active");
	return a;
}

test.describe("15 - Tarifs par niveau", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("valeurs des fiches 2026-2027 présentes et modifiables", async ({ page }) => {
		const annee = await anneeActive(page);
		const tarifs = await trpc<Tarif[]>(page, "finance.tarifs.list", { anneeScolaireId: annee.id });
		const elem = tarifs.find((t) => t.niveauNom === "Élémentaire");
		expect(elem?.total).toBe(65_000);
		expect(elem?.echeancier.find((e) => e.mois === 11)?.montant).toBe(20_000);
		expect(elem?.echeancier.find((e) => e.mois === 1)?.montant).toBe(24_000);
		expect(elem?.echeancier.some((e) => e.mois === 10 || e.mois === 6 || e.mois === 7)).toBe(false);
		expect(tarifs.find((t) => t.niveauNom === "Préscolaire")?.total).toBe(67_000);
		expect(tarifs.find((t) => t.niveauNom === "Crèche")?.total).toBe(80_000);
		expect(tarifs.find((t) => t.niveauNom === "Moyen")?.total).toBe(70_000);

		// Refus : montant négatif, octobre dans l'échéancier
		await expect(trpc(page, "finance.tarifs.enregistrer", {
			anneeScolaireId: annee.id, niveauId: elem?.niveauId,
			lignes: [{ libelle: "Frais", montant: -1, typeFraisId: null }], echeancier: [],
		}, true)).rejects.toThrow();
		await expect(trpc(page, "finance.tarifs.enregistrer", {
			anneeScolaireId: annee.id, niveauId: elem?.niveauId,
			lignes: [{ libelle: "Frais", montant: 1, typeFraisId: null }], echeancier: [{ mois: 10, montant: 1 }],
		}, true)).rejects.toThrow(/octobre/i);

		// Aller-retour : remettre les mêmes valeurs
		const r = await trpc<{ lignes: number; mois: number }>(page, "finance.tarifs.enregistrer", {
			anneeScolaireId: annee.id, niveauId: elem?.niveauId,
			lignes: elem?.lignes.map((l) => ({ libelle: l.libelle, montant: l.montant, typeFraisId: l.typeFraisId })),
			echeancier: elem?.echeancier,
		}, true);
		expect(r).toEqual({ lignes: 3, mois: 7 });
	});
});
```
Run: `E2E_PORT=3100 pnpm exec playwright test e2e/15 --reporter=line` → FAIL (procédure inconnue).

- [ ] **Step 2: Schema** — dans `src/modules/finance/schema.ts` (importer `niveaux` depuis academic) :
```ts
export const forfaitLignes = pgTable(
	"forfait_lignes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		niveauId: uuid("niveau_id").notNull().references(() => niveaux.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id, { onDelete: "cascade" }),
		libelle: varchar("libelle", { length: 60 }).notNull(),
		montant: integer("montant").notNull(),
		ordre: integer("ordre").notNull(),
		typeFraisId: uuid("type_frais_id").references(() => typesFrais.id),
	},
	(t) => [index("forfait_lignes_niveau_annee_idx").on(t.niveauId, t.anneeScolaireId)],
);

export const echeancier = pgTable(
	"echeancier",
	{
		niveauId: uuid("niveau_id").notNull().references(() => niveaux.id),
		anneeScolaireId: uuid("annee_scolaire_id")
			.notNull()
			.references(() => anneesScolaires.id, { onDelete: "cascade" }),
		mois: integer("mois").notNull(),
		montant: integer("montant").notNull(),
	},
	(t) => [primaryKey({ columns: [t.niveauId, t.anneeScolaireId, t.mois] })],
);
```
Run: `pnpm db:generate && pnpm db:migrate` → `0009_*.sql` (2 tables, FK, index, PK).

- [ ] **Step 3: Valeurs par défaut + seed** — `src/modules/finance/tarifs-defaut.ts` :
```ts
const nov_mai = (novDec: number, janMai: number) => ({ 11: novDec, 12: novDec, 1: janMai, 2: janMai, 3: janMai, 4: janMai, 5: janMai });

/** Fiches d'inscription 2026-2027 du CEMAS (octobre inclus dans le forfait, juin réparti sur janvier-mai). */
export const TARIFS_DEFAUT: Record<string, { lignes: { libelle: string; montant: number; typeFrais?: "Fourniture" | "Tenue" }[]; echeancier: Record<number, number> }> = {
	Crèche: {
		lignes: [
			{ libelle: "Frais généraux", montant: 30_000 },
			{ libelle: "Fournitures diverses", montant: 10_000, typeFrais: "Fourniture" },
			{ libelle: "Mensualité octobre", montant: 40_000 },
		],
		echeancier: nov_mai(40_000, 40_000),
	},
	Préscolaire: {
		lignes: [
			{ libelle: "Frais généraux", montant: 32_500 },
			{ libelle: "Uniforme (2)", montant: 10_000 },
			{ libelle: "Fournitures", montant: 7_000, typeFrais: "Fourniture" },
			{ libelle: "Mensualité octobre", montant: 17_500 },
		],
		echeancier: nov_mai(20_000, 20_000),
	},
	Élémentaire: {
		lignes: [
			{ libelle: "Frais généraux", montant: 32_500 },
			{ libelle: "Uniforme (2)", montant: 12_500 },
			{ libelle: "Mensualité octobre", montant: 20_000 },
		],
		echeancier: nov_mai(20_000, 24_000),
	},
	Moyen: {
		lignes: [
			{ libelle: "Frais généraux", montant: 30_000 },
			{ libelle: "Uniforme (2)", montant: 15_000 },
			{ libelle: "Mensualité octobre", montant: 25_000 },
		],
		echeancier: nov_mai(25_000, 30_000),
	},
};
```
Dans `seed.ts`, en fin de seed (année active et niveaux connus) :
```ts
	// Tarifs par niveau (fiches d'inscription) si absents pour l'année active
	const [anneeActive] = await db.select().from(anneesScolaires).where(eq(anneesScolaires.active, true));
	if (anneeActive) {
		const tf = await db.select().from(typesFrais);
		const typeParNom = new Map(tf.map((t) => [t.nom, t.id]));
		for (const n of await db.select().from(niveaux)) {
			const defaut = TARIFS_DEFAUT[n.nom];
			if (!defaut) continue;
			const deja = await db.select({ id: forfaitLignes.id }).from(forfaitLignes)
				.where(and(eq(forfaitLignes.niveauId, n.id), eq(forfaitLignes.anneeScolaireId, anneeActive.id))).limit(1);
			const dejaEch = await db.select({ mois: echeancier.mois }).from(echeancier)
				.where(and(eq(echeancier.niveauId, n.id), eq(echeancier.anneeScolaireId, anneeActive.id))).limit(1);
			if (deja.length || dejaEch.length) continue;
			await db.insert(forfaitLignes).values(defaut.lignes.map((l, i) => ({
				niveauId: n.id, anneeScolaireId: anneeActive.id, libelle: l.libelle, montant: l.montant, ordre: i,
				typeFraisId: l.typeFrais ? (typeParNom.get(l.typeFrais) ?? null) : null,
			})));
			await db.insert(echeancier).values(Object.entries(defaut.echeancier).map(([mois, montant]) => ({
				niveauId: n.id, anneeScolaireId: anneeActive.id, mois: Number(mois), montant,
			})));
			console.log(`✅ Tarifs ${n.nom} insérés`);
		}
	}
```
Ajouter `src/modules/finance/tarifs-defaut.ts` aux `COPY` du `Dockerfile` (le seed tourne dans l'image).

- [ ] **Step 4: Validation + routeur** — `validation.ts` :
```ts
export const enregistrerTarifsSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	niveauId: z.string().uuid(),
	lignes: z.array(z.object({
		libelle: z.string().trim().min(1, "Libellé requis").max(60),
		montant: z.number().int().min(0, "Montant positif requis"),
		typeFraisId: z.string().uuid().nullable(),
	})).max(10),
	echeancier: z.array(z.object({
		mois: z.number().int().min(1).max(12).refine((m) => m !== 10, "Octobre est inclus dans le forfait d'inscription"),
		montant: z.number().int().min(0),
	})).max(11),
});
```
Routeur `tarifsRouter` (dans `finance/router.ts`) : `list` (niveaux triés + lignes triées par ordre + échéancier trié par ordre scolaire oct→juil), `enregistrer` (transaction : delete lignes et échéancier du niveau/année puis insert), `pourEleve` (classe de l'élève → niveau ; année active ; total des lignes ou null ; échéancier en objet). Enregistrer `tarifs: tarifsRouter` dans `financeRouter`.

- [ ] **Step 5: Run — expect PASS** : `pnpm db:seed` (base locale) puis `E2E_PORT=3100 pnpm exec playwright test e2e/15` ; `pnpm typecheck`.
- [ ] **Step 6: Commit** `feat(finance): enrolment package and monthly schedule per level (data + API)`.

---

### Task 2: Impayés avec forfait et échéancier

**Files:** Modify `src/modules/finance/impayes.ts`, `impayes.test.ts`, `impayes-service.ts`

**Interfaces:**
- `calculerImpayes` accepte en plus `forfaits?: { niveauId: string; total: number; typesAssocies: string[] }[]` et `echeanciers?: { niveauId: string; mois: number; montant: number }[]`. `paiements` peut contenir des paiements de types associés (non obligatoires).
- `moisImpayes` d'un forfait partiel : `{ typeFraisId: <Inscription>, typeFraisNom: "Inscription (forfait)", mois: null, annee: null, montant: reste }`.

- [ ] **Step 1: Failing tests** — ajouter à `impayes.test.ts` :
```ts
describe("forfait et échéancier", () => {
	const FOUR = "four";
	const forfaits = [{ niveauId: "n1", total: 67_000, typesAssocies: [FOUR] }];
	const echeanciers = [
		{ niveauId: "n1", mois: 11, montant: 20_000 }, { niveauId: "n1", mois: 12, montant: 20_000 },
		{ niveauId: "n1", mois: 1, montant: 24_000 }, { niveauId: "n1", mois: 5, montant: 24_000 },
	];
	const base2 = { ...ANNEE, frais: [SCO, INS], grille: [], forfaits, echeanciers };

	it("forfait payé en Inscription + Fourniture associée : à jour ; octobre non dû", () => {
		const r = calculerImpayes({ ...base2, aujourdhui: "2026-10-20", eleves: [eleve("e1")], paiements: [
			{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 60_000 },
			{ eleveId: "e1", typeFraisId: FOUR, mois: 10, montant: 7_000 },
		] });
		expect(r.lignes).toEqual([]);
	});

	it("forfait partiel : reste = forfait − payé", () => {
		const r = calculerImpayes({ ...base2, aujourdhui: "2026-10-20", eleves: [eleve("e1")], paiements: [
			{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 40_000 },
		] });
		expect(r.lignes[0]).toMatchObject({ du: 67_000, paye: 40_000, reste: 27_000 });
		expect(r.lignes[0].moisImpayes).toEqual([
			{ typeFraisId: "ins", typeFraisNom: "Inscription (forfait)", mois: null, annee: null, montant: 27_000 },
		]);
	});

	it("paiement supérieur au forfait : reste jamais négatif", () => {
		const r = calculerImpayes({ ...base2, aujourdhui: "2026-10-20", eleves: [eleve("e1")], paiements: [
			{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 70_000 },
		] });
		expect(r.lignes).toEqual([]);
	});

	it("scolarité selon l'échéancier : novembre 20 000, janvier 24 000 ; juin/juillet non dus", () => {
		const r = calculerImpayes({ ...base2, aujourdhui: "2027-07-15", eleves: [eleve("e1")], paiements: [
			{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 67_000 },
		] });
		expect(r.lignes[0].moisImpayes.map((m) => [m.mois, m.montant])).toEqual([[11, 20_000], [12, 20_000], [1, 24_000], [5, 24_000]]);
		expect(r.lignes[0].reste).toBe(88_000);
	});

	it("niveau non configuré : repli sur la grille / le défaut", () => {
		const r = calculerImpayes({ ...base2, aujourdhui: "2026-10-20", eleves: [{ ...eleve("e2"), niveauId: "autre" }] });
		expect(r.lignes[0]).toMatchObject({ reste: 25_000 + 50_000 });
	});
});
```
Run: `pnpm test` → FAIL.

- [ ] **Step 2: Implement** — dans `calculerImpayes` :
  - maps `forfaitParNiveau`, `echeancierParNiveau: Map<niveauId, Map<mois, montant>>` ;
  - `payeParType` : `Map<"${eleveId}:${typeFraisId}", somme>` ;
  - frais unique obligatoire (`!f.mensuel`) **et** forfait du niveau existant : `du += total ; const verse = somme(Inscription) + Σ somme(typesAssocies) ; const r = Math.max(0, total - verse) ; if (r > 0) { reste += r ; moisImpayes.push({ typeFraisId: f.id, typeFraisNom: \`${f.nom} (forfait)\`, mois: null, annee: null, montant: r }) }` — pas de signalement « montant par défaut » ;
  - frais mensuel obligatoire **et** échéancier du niveau existant : pour chaque `{annee, mois}` de `dus` présent dans l'échéancier : `du += montant` ; s'il n'est pas payé, `reste += montant` et ligne de mois impayé ; pas de signalement ;
  - sinon : code actuel inchangé ;
  - `paye` : somme des paiements de l'élève sur les types obligatoires **et** les types associés à son forfait.
- [ ] **Step 3: Service** — `impayes-service.ts` : charger `forfaitLignes` et `echeancier` de l'année ; construire `forfaits` (total, `typesAssocies` = typeFraisId non nuls) et `echeanciers` ; charger les paiements des types obligatoires **plus** les types associés ; passer à `calculerImpayes`.
- [ ] **Step 4: Run — expect PASS** : `pnpm test` ; `E2E_PORT=3100 pnpm exec playwright test e2e/11` (impayés existants toujours verts — ajuster les attentes de l'e2e 11 si elles supposaient un octobre dû pour un niveau désormais configuré ; consigner au ledger).
- [ ] **Step 5: Commit** `feat(finance): unpaid fees follow the enrolment package and monthly schedule`.

---

### Task 3: Montant proposé à la saisie et détail du forfait sur le reçu

**Files:** Modify `src/app/(dashboard)/finances/paiements/page.tsx`, `src/modules/finance/router.ts` (`getRecuData`), `src/shared/lib/generate-recu-pdf.ts` ; Create `src/shared/lib/generate-recu-pdf.test.ts`

- [ ] **Step 1: Failing Vitest** — `generate-recu-pdf.test.ts` : `buildRecuPdf(data, ecole)` (extraire la construction du document de `generateRecuPdf`, qui l'enregistre) ; avec `detailForfait: [{ libelle: "Frais généraux", montant: 32_500 }, …]` le contenu contient « Frais généraux », « 32 500 FCFA » et « Détail du forfait » ; sans détail, il ne contient pas « Détail du forfait ».
- [ ] **Step 2: Implement** — `RecuData.detailForfait?: { libelle: string; montant: number }[] | null` ; sous la ligne « Mois concerné », si détail : petit tableau (police 8, une ligne par élément, total) avant le bandeau MONTANT. Vérifier visuellement que tout tient sur l'A5 (rendu PNG).
  `getRecuData` : si le type est « Inscription », charger les lignes du forfait (niveau de la classe de l'élève, année du paiement) → `detailForfait`.
- [ ] **Step 3: Saisie** — dans la page Paiements : `const tarif = trpc.finance.tarifs.pourEleve.useQuery({ eleveId: selectedEleveId }, { enabled: !!selectedEleveId })` ; quand le type choisi est « Inscription » et `tarif.data?.forfait` existe → `setMontant(forfait)` ; type « Scolarité » → `setMontant(tarif.data.echeancier[paymentMois] ?? montant)` ; via `useEffect` sur `[selectedEleveId, selectedTypeFraisId, paymentMois, tarif.data]` (sans écraser une saisie manuelle déjà faite pour la même combinaison : mémoriser la dernière combinaison appliquée).
- [ ] **Step 4: Run** : `pnpm test` ; `E2E_PORT=3100 pnpm exec playwright test e2e/05` ; contrôle visuel du reçu.
- [ ] **Step 5: Commit** `feat(finance): suggested amounts and package detail on the receipt`.

---

### Task 4: Page Tarifs par niveau et suivi

**Files:** Create `src/app/(dashboard)/finances/tarifs/page.tsx` ; Modify `src/shared/ui/sidebar.tsx`, `src/modules/finance/router.ts` (`suivi.byClasse`), `src/app/(dashboard)/finances/suivi/page.tsx`, `src/app/(dashboard)/finances/grille/page.tsx`, `e2e/15-tarifs.spec.ts`

- [ ] **Step 1: Failing e2e (UI)** — ajouter dans `15-tarifs.spec.ts` :
```ts
	test("modifier un tarif depuis la page", async ({ page }) => {
		await page.goto("/finances/tarifs");
		await waitForLoad(page);
		const carte = page.getByRole("region", { name: "Moyen" });
		await expect(carte).toContainText("70 000");
		await carte.getByLabel("Janvier").fill("30500");
		await carte.getByRole("button", { name: "Enregistrer" }).click();
		await expect(carte.getByText("Tarifs enregistrés")).toBeVisible();
		await carte.getByLabel("Janvier").fill("30000");
		await carte.getByRole("button", { name: "Enregistrer" }).click();
		await expect(carte.getByText("Tarifs enregistrés")).toBeVisible();
	});
```
- [ ] **Step 2: Page** — une `<section aria-label={niveauNom}>` par niveau : tableau des lignes du forfait (inputs libellé/montant, sélecteur « Compte aussi les paiements de » : aucun / Fourniture / Tenue, bouton supprimer, « + Ajouter une ligne »), total ; échéancier : inputs `aria-label` = nom du mois pour novembre → juillet (octobre affiché « inclus dans le forfait ») ; boutons « Remplir nov-déc » / « Remplir janv-mai » (valeur saisie appliquée aux mois du groupe) ; « Enregistrer » (mutation `finance.tarifs.enregistrer`, mois vides exclus) ; message « Tarifs enregistrés ».
- [ ] **Step 3: Sidebar et grille** — « Grille tarifaire » → « Tarifs par niveau » (`/finances/tarifs`) ; en tête de la page grille, lien « Tarifs par niveau (méthode recommandée) » et note « utilisée seulement pour les niveaux sans tarifs ».
- [ ] **Step 4: Suivi** — `suivi.byClasse` : charger l'échéancier du niveau de la classe ; pour la scolarité (type mensuel obligatoire), chaque mois porte `statut: "paye" | "impaye" | "inclus" | "non_du"` (octobre = `inclus` si le niveau a un forfait ; mois absent de l'échéancier = `non_du`) ; la page affiche « Inclus » / « — » et ne compte que les mois dus dans les totaux.
- [ ] **Step 5: Run** : `E2E_PORT=3100 pnpm exec playwright test e2e/15 e2e/05 e2e/11` ; captures des pages Tarifs et Suivi.
- [ ] **Step 6: Commit** `feat(finance): tarifs page per level; suivi shows included/not-due months`.

---

### Task 5: Passage d'année, documentation, vérification

- [ ] **Step 1: Passage** — dans `executerPassage` (transaction), après la grille : recopier `forfaitLignes` et `echeancier` de la source vers la cible pour chaque niveau **qui n'a encore rien** dans la cible. Étendre `e2e/14-passage.spec.ts` : après le passage, `finance.tarifs.list(cible)` renvoie les mêmes totaux.
- [ ] **Step 2: Docs** — `02`, `03` (deux tables), `04` (`finance.tarifs.*`, `getRecuData.detailForfait`, `suivi` statuts), `05` (page Tarifs, suivi), `16` (D-021 ; précision D-016), `10` (faux impayés d'octobre résolus ; JOSHUA/EDOUARD = forfaits partiels réels), `17`.
- [ ] **Step 3: Vérification** — typecheck, lint, Vitest, build ; base jetable : suite e2e complète (`E2E_DESTRUCTIF=1 PASSAGE_AUJOURDHUI=2028-08-01 BACKUP_DIR=… PG_BIN_DIR=… E2E_PORT=3100`).
- [ ] **Step 4: Commit** `docs: enrolment package and schedule`.

## Après le plan
PR → CI → fusion → déploiement (sauvegarde préalable, seed des tarifs). Vérification production en lecture seule : 4 niveaux configurés ; impayés : plus d'octobre impayé pour les forfaits complets ; JOSHUA NGOMA reste 40 000, EDOUARD MICHEL NDIONE reste 5 000.
