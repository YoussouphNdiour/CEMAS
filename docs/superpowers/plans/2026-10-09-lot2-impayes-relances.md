# Lot 2 — Impayés et relances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grille tarifaire éditable, liste des impayés calculée côté serveur, lettres de relance PDF, KPI « Impayés » sur le tableau de bord.

**Architecture:** Calcul dans une fonction pure `calculerImpayes` (Vitest), alimentée par un service `getImpayes(db, anneeId, filtres)` réutilisé par `finance.impayes.list` et `dashboard.stats`. La grille s'édite via une nouvelle mutation `finance.grilleFrais.upsertMany`. Le PDF de relance est construit par `buildRelancesPdf` (testable sous Node) avec un en-tête école partagé extrait du reçu.

**Tech Stack:** Next.js 16 App Router, tRPC 11, Drizzle 0.45 / PostgreSQL 16, zod 4, jsPDF 4, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-lot2-impayes-relances-design.md`

## Global Constraints

- Montants FCFA entiers ; aucune migration.
- Seuls les frais `obligatoire = true` sont dus ; facultatifs jamais.
- Mois dus : du mois de `date_debut` au mois de `min(aujourd'hui, date_fin)` inclus ; aucun avant `date_debut`.
- Frais mensuel : mois avec un paiement = soldé quel que soit le montant. Frais unique (`mensuel = false`) : dû une fois, soldé par tout paiement de ce frais pour l'année.
- Montant de référence : `grille_frais.montant_mensuel` sinon `types_frais.montant_defaut` + classe signalée.
- Élèves : `statut = 'actif'` et classe de l'année (`classes.annee_scolaire_id`).
- Liste : seulement `reste > 0`, tri reste décroissant puis nom, prénom.
- PDF : texte Latin-1 uniquement (jsPDF helvetica) — pas de « → », « — », « … ».
- Libellés UI en français ; Biome (tabs, largeur 100) ; tests Vitest dans `src/**/*.test.ts`.
- Travail dans le worktree `/Users/yusper/Downloads/CEMAS-lot2`, branche `feat/lot2-impayes`. **Aucune écriture sur la base de production.**

## Review Focus

1. Année dont le mois courant est après `date_fin` (été) → mois dus plafonnés à juillet, pas d'août/septembre. Test : Task 1 « plafonné à date_fin ».
2. Classe sans grille pour un seul des deux frais → seul ce frais utilise le défaut, la classe listée avec ce frais uniquement. Test : Task 1 « grille partielle ».
3. Élève sans contact principal (données anciennes) → téléphone `null`, ligne affichée « — », lettre adressée « Aux parents de … ». Test : Task 1 (telephone null conservé) + Task 4 (lettre sans destinataire).
4. Grille : saisie non entière / négative → refus côté client et serveur, rien n'est enregistré. Test : Task 2 (zod `upsertMany` refuse -5) .
5. Filtre classe d'une autre année ou niveau sans élève → liste vide, totaux 0, pas d'erreur. Test : Task 2 (API avec niveau sans élève).

---

## File Structure

| Fichier | Rôle |
|---|---|
| Create `src/modules/finance/impayes.ts` | `calculerImpayes`, `moisDus`, `libelleMoisImpayes` (pur) |
| Create `src/modules/finance/impayes.test.ts` | Vitest |
| Create `src/modules/finance/impayes-service.ts` | `getImpayes(db, anneeId, filtres)` (requêtes + appel du calcul) |
| Modify `src/modules/finance/validation.ts` | `upsertGrilleSchema`, `impayesFiltersSchema` |
| Modify `src/modules/finance/router.ts` | `grilleFrais.upsertMany`, `impayes.list` |
| Modify `src/modules/dashboard/router.ts` | `stats.totalImpayes` |
| Create `src/shared/lib/pdf-entete.ts` | `PDF_COULEURS`, `dessinerEnTeteEcole`, `formatMontantPdf` |
| Modify `src/shared/lib/generate-recu-pdf.ts` | utilise `pdf-entete` |
| Create `src/shared/lib/generate-relance-pdf.ts` | `buildRelancesPdf`, `downloadRelancesPdf` |
| Create `src/shared/lib/generate-relance-pdf.test.ts` | Vitest |
| Create `src/app/(dashboard)/finances/grille/page.tsx` | Grille tarifaire |
| Create `src/app/(dashboard)/finances/impayes/page.tsx` | Impayés |
| Modify `src/shared/ui/sidebar.tsx` | liens Grille tarifaire, Impayés |
| Modify `src/app/(dashboard)/page.tsx` | carte Impayés |
| Create `e2e/11-impayes.spec.ts` | e2e |
| Modify `docs/02,03,04,16` | docs |

---

### Task 1: Calcul pur des impayés

**Files:**
- Create: `src/modules/finance/impayes.ts`
- Test: `src/modules/finance/impayes.test.ts`

**Interfaces:**
- Produces:
```ts
export interface EleveImpayeInput { id: string; matricule: string; prenom: string; nom: string; classeId: string; classeNom: string; niveauId: string; telephone: string | null; parentNom: string | null }
export interface FraisInput { id: string; nom: string; montantDefaut: number; mensuel: boolean }
export interface MoisImpaye { typeFraisId: string; typeFraisNom: string; mois: number | null; annee: number | null; montant: number }
export interface LigneImpaye extends EleveImpayeInput { du: number; paye: number; reste: number; moisImpayes: MoisImpaye[] }
export interface ResultatImpayes { lignes: LigneImpaye[]; totalDu: number; totalPaye: number; totalReste: number; classesMontantDefaut: { classeId: string; classeNom: string; frais: string[] }[] }
export function moisDus(dateDebut: string, dateFin: string, aujourdhui: string): { annee: number; mois: number }[]
export function calculerImpayes(p: { dateDebut: string; dateFin: string; aujourdhui: string; eleves: EleveImpayeInput[]; frais: FraisInput[]; grille: { classeId: string; typeFraisId: string; montant: number }[]; paiements: { eleveId: string; typeFraisId: string; mois: number; montant: number }[] }): ResultatImpayes
export function libelleMoisImpayes(moisImpayes: MoisImpaye[]): string // "Scolarité : Nov, Déc · Inscription"
```
(`totalDu`/`totalPaye` sont calculés sur les lignes retournées, c.-à-d. les élèves avec reste > 0.)

- [ ] **Step 1: Write the failing tests** — `src/modules/finance/impayes.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { calculerImpayes, libelleMoisImpayes, moisDus } from "./impayes";

const ANNEE = { dateDebut: "2026-10-01", dateFin: "2027-07-31" };
const SCO = { id: "sco", nom: "Scolarité", montantDefaut: 25_000, mensuel: true };
const INS = { id: "ins", nom: "Inscription", montantDefaut: 50_000, mensuel: false };
const eleve = (id: string, classeId = "c1", nom = "Diop") => ({
	id, matricule: `M-${id}`, prenom: "Awa", nom, classeId, classeNom: `Classe ${classeId}`, niveauId: "n1",
	telephone: "77 000 00 00", parentNom: "Moussa Diop",
});
const base = { ...ANNEE, frais: [SCO, INS], grille: [], paiements: [] };

describe("moisDus", () => {
	it("va du mois de début au mois courant inclus", () => {
		expect(moisDus(ANNEE.dateDebut, ANNEE.dateFin, "2026-12-15")).toEqual([
			{ annee: 2026, mois: 10 }, { annee: 2026, mois: 11 }, { annee: 2026, mois: 12 },
		]);
	});
	it("est vide avant le début de l'année", () => {
		expect(moisDus(ANNEE.dateDebut, ANNEE.dateFin, "2026-09-20")).toEqual([]);
	});
	it("est plafonné à date_fin", () => {
		expect(moisDus(ANNEE.dateDebut, ANNEE.dateFin, "2027-09-01")).toHaveLength(10);
	});
});

describe("calculerImpayes", () => {
	it("compte les mois dus et l'inscription unique d'un élève sans paiement (montants par défaut)", () => {
		const r = calculerImpayes({ ...base, aujourdhui: "2026-11-05", eleves: [eleve("e1")] });
		expect(r.lignes).toHaveLength(1);
		expect(r.lignes[0]).toMatchObject({ du: 2 * 25_000 + 50_000, paye: 0, reste: 100_000 });
		expect(r.lignes[0].moisImpayes.map((m) => [m.typeFraisNom, m.mois])).toEqual([
			["Scolarité", 10], ["Scolarité", 11], ["Inscription", null],
		]);
		expect(r.classesMontantDefaut).toEqual([{ classeId: "c1", classeNom: "Classe c1", frais: ["Scolarité", "Inscription"] }]);
	});

	it("utilise la grille et considère un mois payé partiellement comme soldé", () => {
		const r = calculerImpayes({
			...base, aujourdhui: "2026-11-05", eleves: [eleve("e1")],
			grille: [{ classeId: "c1", typeFraisId: "sco", montant: 24_000 }, { classeId: "c1", typeFraisId: "ins", montant: 65_000 }],
			paiements: [
				{ eleveId: "e1", typeFraisId: "sco", mois: 10, montant: 20_000 },
				{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 60_000 },
			],
		});
		expect(r.lignes[0]).toMatchObject({ du: 2 * 24_000 + 65_000, paye: 80_000, reste: 24_000 });
		expect(r.lignes[0].moisImpayes).toEqual([{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 24_000 }]);
		expect(r.classesMontantDefaut).toEqual([]);
	});

	it("ne réduit pas le reste avec une avance, mais la compte dans Payé", () => {
		const r = calculerImpayes({
			...base, aujourdhui: "2026-10-05", eleves: [eleve("e1")],
			paiements: [
				{ eleveId: "e1", typeFraisId: "ins", mois: 10, montant: 50_000 },
				{ eleveId: "e1", typeFraisId: "sco", mois: 1, montant: 25_000 },
			],
		});
		expect(r.lignes[0]).toMatchObject({ paye: 75_000, reste: 25_000 });
	});

	it("signale seulement le frais sans grille (grille partielle)", () => {
		const r = calculerImpayes({
			...base, aujourdhui: "2026-10-05", eleves: [eleve("e1")],
			grille: [{ classeId: "c1", typeFraisId: "sco", montant: 20_000 }],
		});
		expect(r.classesMontantDefaut).toEqual([{ classeId: "c1", classeNom: "Classe c1", frais: ["Inscription"] }]);
	});

	it("exclut l'élève à jour, trie par reste décroissant et totalise", () => {
		const r = calculerImpayes({
			...base, aujourdhui: "2026-11-05",
			eleves: [eleve("ajour", "c1", "Ba"), eleve("peu", "c1", "Sow"), eleve("beaucoup", "c1", "Fall")],
			paiements: [
				{ eleveId: "ajour", typeFraisId: "ins", mois: 10, montant: 50_000 },
				{ eleveId: "ajour", typeFraisId: "sco", mois: 10, montant: 25_000 },
				{ eleveId: "ajour", typeFraisId: "sco", mois: 11, montant: 25_000 },
				{ eleveId: "peu", typeFraisId: "ins", mois: 10, montant: 50_000 },
				{ eleveId: "peu", typeFraisId: "sco", mois: 10, montant: 25_000 },
			],
		});
		expect(r.lignes.map((l) => l.id)).toEqual(["beaucoup", "peu"]);
		expect(r.totalReste).toBe(100_000 + 25_000);
		expect(r.totalPaye).toBe(75_000);
		expect(r.totalDu).toBe(200_000);
	});

	it("conserve un téléphone absent", () => {
		const r = calculerImpayes({ ...base, aujourdhui: "2026-10-05", eleves: [{ ...eleve("e1"), telephone: null, parentNom: null }] });
		expect(r.lignes[0].telephone).toBeNull();
	});

	it("n'a aucun mois dû avant le début, mais l'inscription reste due", () => {
		const r = calculerImpayes({ ...base, aujourdhui: "2026-09-10", eleves: [eleve("e1")] });
		expect(r.lignes[0]).toMatchObject({ du: 50_000, reste: 50_000 });
	});
});

describe("libelleMoisImpayes", () => {
	it("regroupe par frais", () => {
		expect(libelleMoisImpayes([
			{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 1 },
			{ typeFraisId: "sco", typeFraisNom: "Scolarité", mois: 12, annee: 2026, montant: 1 },
			{ typeFraisId: "ins", typeFraisNom: "Inscription", mois: null, annee: null, montant: 1 },
		])).toBe("Scolarité : Nov, Déc · Inscription");
	});
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './impayes'`)

Run: `pnpm test`

- [ ] **Step 3: Implement** — `src/modules/finance/impayes.ts`:
```ts
export interface EleveImpayeInput {
	id: string; matricule: string; prenom: string; nom: string;
	classeId: string; classeNom: string; niveauId: string;
	telephone: string | null; parentNom: string | null;
}
export interface FraisInput { id: string; nom: string; montantDefaut: number; mensuel: boolean }
export interface MoisImpaye { typeFraisId: string; typeFraisNom: string; mois: number | null; annee: number | null; montant: number }
export interface LigneImpaye extends EleveImpayeInput { du: number; paye: number; reste: number; moisImpayes: MoisImpaye[] }
export interface ResultatImpayes {
	lignes: LigneImpaye[]; totalDu: number; totalPaye: number; totalReste: number;
	classesMontantDefaut: { classeId: string; classeNom: string; frais: string[] }[];
}

const MOIS_COURTS = ["", "Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const cle = (annee: number, mois: number) => annee * 100 + mois;
const anneeMois = (date: string) => date.split("-").slice(0, 2).map(Number) as [number, number];

/** Mois calendaires dus : du mois de début au mois de min(aujourd'hui, fin), inclus. */
export function moisDus(dateDebut: string, dateFin: string, aujourdhui: string) {
	let [annee, mois] = anneeMois(dateDebut);
	const fin = Math.min(cle(...anneeMois(dateFin)), cle(...anneeMois(aujourdhui)));
	const resultat: { annee: number; mois: number }[] = [];
	while (cle(annee, mois) <= fin) {
		resultat.push({ annee, mois });
		if (mois === 12) { annee++; mois = 1; } else { mois++; }
	}
	return resultat;
}

export function calculerImpayes(p: {
	dateDebut: string; dateFin: string; aujourdhui: string;
	eleves: EleveImpayeInput[]; frais: FraisInput[];
	grille: { classeId: string; typeFraisId: string; montant: number }[];
	paiements: { eleveId: string; typeFraisId: string; mois: number; montant: number }[];
}): ResultatImpayes {
	const dus = moisDus(p.dateDebut, p.dateFin, p.aujourdhui);
	const grille = new Map(p.grille.map((g) => [`${g.classeId}:${g.typeFraisId}`, g.montant]));
	const payes = new Map<string, Set<number>>(); // `${eleveId}:${typeFraisId}` -> mois payés
	const totalPayeEleve = new Map<string, number>();
	for (const pa of p.paiements) {
		const k = `${pa.eleveId}:${pa.typeFraisId}`;
		if (!payes.has(k)) payes.set(k, new Set());
		payes.get(k)?.add(pa.mois);
		totalPayeEleve.set(pa.eleveId, (totalPayeEleve.get(pa.eleveId) ?? 0) + pa.montant);
	}
	const defauts = new Map<string, { classeId: string; classeNom: string; frais: string[] }>();

	const lignes: LigneImpaye[] = [];
	for (const e of p.eleves) {
		let du = 0;
		let reste = 0;
		const moisImpayes: MoisImpaye[] = [];
		for (const f of p.frais) {
			const montantGrille = grille.get(`${e.classeId}:${f.id}`);
			const montant = montantGrille ?? f.montantDefaut;
			if (montantGrille === undefined) {
				const d = defauts.get(e.classeId) ?? { classeId: e.classeId, classeNom: e.classeNom, frais: [] };
				if (!d.frais.includes(f.nom)) d.frais.push(f.nom);
				defauts.set(e.classeId, d);
			}
			const moisPayes = payes.get(`${e.id}:${f.id}`);
			if (f.mensuel) {
				du += montant * dus.length;
				for (const { annee, mois } of dus) {
					if (!moisPayes?.has(mois)) {
						reste += montant;
						moisImpayes.push({ typeFraisId: f.id, typeFraisNom: f.nom, mois, annee, montant });
					}
				}
			} else {
				du += montant;
				if (!moisPayes?.size) {
					reste += montant;
					moisImpayes.push({ typeFraisId: f.id, typeFraisNom: f.nom, mois: null, annee: null, montant });
				}
			}
		}
		if (reste > 0) lignes.push({ ...e, du, paye: totalPayeEleve.get(e.id) ?? 0, reste, moisImpayes });
	}

	lignes.sort((a, b) => b.reste - a.reste || a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom));
	const somme = (k: "du" | "paye" | "reste") => lignes.reduce((t, l) => t + l[k], 0);
	return {
		lignes, totalDu: somme("du"), totalPaye: somme("paye"), totalReste: somme("reste"),
		classesMontantDefaut: [...defauts.values()],
	};
}

/** « Scolarité : Nov, Déc · Inscription » */
export function libelleMoisImpayes(moisImpayes: MoisImpaye[]): string {
	const parFrais = new Map<string, string[]>();
	for (const m of moisImpayes) {
		const liste = parFrais.get(m.typeFraisNom) ?? [];
		if (m.mois !== null) liste.push(MOIS_COURTS[m.mois]);
		parFrais.set(m.typeFraisNom, liste);
	}
	return [...parFrais.entries()]
		.map(([nom, mois]) => (mois.length ? `${nom} : ${mois.join(", ")}` : nom))
		.join(" · ");
}
```
Note : dans le test « exclut l'élève à jour », `totalPaye` = 75 000 car seuls « peu » (75 000) et « beaucoup » (0) sont listés ; « ajour » est exclu.

- [ ] **Step 4: Run — expect PASS** : `pnpm test` → tous les tests verts. Puis `pnpm exec biome check --write src/modules/finance/impayes*.ts`.

- [ ] **Step 5: Commit**
```bash
git add src/modules/finance/impayes.ts src/modules/finance/impayes.test.ts
git commit -m "feat(finance): pure unpaid-fees calculation"
```

---

### Task 2: Service, procédures (impayes.list, grilleFrais.upsertMany) et KPI serveur

**Files:**
- Create: `src/modules/finance/impayes-service.ts`
- Modify: `src/modules/finance/validation.ts`, `src/modules/finance/router.ts`, `src/modules/dashboard/router.ts`
- Test: `e2e/11-impayes.spec.ts` (partie API)

**Interfaces:**
- Consumes: `calculerImpayes`, `ResultatImpayes` (Task 1)
- Produces:
  - `getImpayes(database: typeof db, anneeScolaireId: string, filtres?: { classeId?: string; niveauId?: string }, aujourdhui?: string): Promise<ResultatImpayes>`
  - `finance.impayes.list({ anneeScolaireId, classeId?, niveauId? }) → ResultatImpayes`
  - `finance.grilleFrais.upsertMany({ anneeScolaireId, cellules: { classeId, typeFraisId, montant }[] }) → { count: number }`
  - `dashboard.stats` → `+ totalImpayes: number`

- [ ] **Step 1: Write the failing e2e (API)** — `e2e/11-impayes.spec.ts`:
```ts
import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

type Resultat = {
	lignes: { id: string; reste: number; du: number; paye: number; moisImpayes: { typeFraisNom: string; mois: number | null }[] }[];
	totalReste: number;
	classesMontantDefaut: { classeId: string }[];
};

async function contexte(page: Page) {
	const annees = await trpc<{ id: string; active: boolean; dateDebut: string }[]>(page, "academic.annees.list");
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const frais = await trpc<{ id: string; nom: string; obligatoire: boolean; mensuel: boolean }[]>(page, "finance.typesFrais.list");
	const sco = frais.find((f) => f.obligatoire && f.mensuel);
	const ins = frais.find((f) => f.obligatoire && !f.mensuel);
	if (!sco || !ins) throw new Error("Frais obligatoires manquants");
	const classe = await trpc<{ id: string }>(page, "academic.classes.create",
		{ nom: `IMP-${Date.now()}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id }, true);
	const eleve = await trpc<{ id: string }>(page, "students.create", {
		prenom: "Impaye", nom: `Test${Date.now()}`, dateNaissance: "2016-01-01", sexe: "F",
		classeId: classe.id, anneeScolaireId: annee.id,
		parent: { prenom: "Parent", nom: "Impaye", telephone: "77 999 99 99", relation: "mere" },
	}, true);
	return { annee, niveau, sco, ins, classe, eleve };
}

/** Nombre de mois dus à la date du jour (mêmes règles que le serveur). */
function nbMoisDus(dateDebut: string): number {
	const [a0, m0] = dateDebut.split("-").map(Number);
	const now = new Date();
	const n = (now.getUTCFullYear() - a0) * 12 + (now.getUTCMonth() + 1 - m0) + 1;
	return Math.max(0, Math.min(10, n));
}

test.describe("11 - Impayés et relances", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("API : grille, reste calculé, paiement de l'inscription", async ({ page }) => {
		const { annee, sco, ins, classe, eleve } = await contexte(page);
		await expect(trpc(page, "finance.grilleFrais.upsertMany", {
			anneeScolaireId: annee.id, cellules: [{ classeId: classe.id, typeFraisId: sco.id, montant: -5 }],
		}, true)).rejects.toThrow();

		const r0 = await trpc<{ count: number }>(page, "finance.grilleFrais.upsertMany", {
			anneeScolaireId: annee.id,
			cellules: [
				{ classeId: classe.id, typeFraisId: sco.id, montant: 21_000 },
				{ classeId: classe.id, typeFraisId: ins.id, montant: 61_000 },
			],
		}, true);
		expect(r0.count).toBe(2);

		const avant = await trpc<Resultat>(page, "finance.impayes.list", { anneeScolaireId: annee.id, classeId: classe.id });
		const n = nbMoisDus(annee.dateDebut);
		expect(avant.lignes).toHaveLength(1);
		expect(avant.lignes[0]).toMatchObject({ id: eleve.id, reste: 21_000 * n + 61_000, paye: 0 });
		expect(avant.classesMontantDefaut).toEqual([]);

		await trpc(page, "finance.paiements.create", {
			eleveId: eleve.id, typeFraisId: ins.id, anneeScolaireId: annee.id, mois: 10, montant: 55_000,
		}, true);
		const apres = await trpc<Resultat>(page, "finance.impayes.list", { anneeScolaireId: annee.id, classeId: classe.id });
		if (n === 0) expect(apres.lignes).toHaveLength(0);
		else expect(apres.lignes[0]).toMatchObject({ reste: 21_000 * n, paye: 55_000 });

		// Filtre sans élève : liste vide, totaux à zéro
		const vide = await trpc<Resultat>(page, "finance.impayes.list", { anneeScolaireId: annee.id, classeId: "00000000-0000-4000-8000-000000000000" });
		expect(vide).toMatchObject({ lignes: [], totalReste: 0 });

		const stats = await trpc<{ totalImpayes: number }>(page, "dashboard.stats", { anneeScolaireId: annee.id });
		expect(stats.totalImpayes).toBeGreaterThanOrEqual(apres.totalReste);
	});
});
```
Vérifier que `finance.typesFrais.list` existe et renvoie `obligatoire`/`mensuel` (`grep -n "typesFraisRouter" -A8 src/modules/finance/router.ts`).

- [ ] **Step 2: Run — expect FAIL** : `pnpm exec playwright test e2e/11 --reporter=line` → erreur sur `finance.grilleFrais.upsertMany` (procédure inconnue).

- [ ] **Step 3: Validation** — ajouter dans `src/modules/finance/validation.ts` :
```ts
export const upsertGrilleSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	cellules: z
		.array(
			z.object({
				classeId: z.string().uuid(),
				typeFraisId: z.string().uuid(),
				montant: z.number().int("Montant entier requis").min(0, "Le montant doit être positif"),
			}),
		)
		.min(1)
		.max(200),
});

export const impayesFiltersSchema = z.object({
	anneeScolaireId: z.string().uuid(),
	classeId: z.string().uuid().optional(),
	niveauId: z.string().uuid().optional(),
});
```

- [ ] **Step 4: Service** — `src/modules/finance/impayes-service.ts` :
```ts
import { and, eq, inArray } from "drizzle-orm";
import { anneesScolaires, classes } from "@/modules/academic/schema";
import { eleveParents, eleves, parents } from "@/modules/students/schema";
import type { db } from "@/shared/lib/db";
import { calculerImpayes, type ResultatImpayes } from "./impayes";
import { grilleFrais, paiements, typesFrais } from "./schema";

const VIDE: ResultatImpayes = { lignes: [], totalDu: 0, totalPaye: 0, totalReste: 0, classesMontantDefaut: [] };

/** Impayés de l'année scolaire (élèves actifs des classes de l'année, frais obligatoires). */
export async function getImpayes(
	database: typeof db,
	anneeScolaireId: string,
	filtres: { classeId?: string; niveauId?: string } = {},
	aujourdhui: string = new Date().toISOString().slice(0, 10),
): Promise<ResultatImpayes> {
	const [annee] = await database
		.select({ dateDebut: anneesScolaires.dateDebut, dateFin: anneesScolaires.dateFin })
		.from(anneesScolaires)
		.where(eq(anneesScolaires.id, anneeScolaireId));
	if (!annee) return VIDE;

	const conditions = [eq(classes.anneeScolaireId, anneeScolaireId), eq(eleves.statut, "actif")];
	if (filtres.classeId) conditions.push(eq(eleves.classeId, filtres.classeId));
	if (filtres.niveauId) conditions.push(eq(classes.niveauId, filtres.niveauId));

	const elevesRows = await database
		.select({
			id: eleves.id, matricule: eleves.matricule, prenom: eleves.prenom, nom: eleves.nom,
			classeId: classes.id, classeNom: classes.nom, niveauId: classes.niveauId,
			telephone: parents.telephone, parentPrenom: parents.prenom, parentNomFamille: parents.nom,
		})
		.from(eleves)
		.innerJoin(classes, eq(eleves.classeId, classes.id))
		.leftJoin(eleveParents, and(eq(eleveParents.eleveId, eleves.id), eq(eleveParents.principal, true)))
		.leftJoin(parents, eq(eleveParents.parentId, parents.id))
		.where(and(...conditions));
	if (elevesRows.length === 0) return VIDE;

	const frais = await database
		.select({ id: typesFrais.id, nom: typesFrais.nom, montantDefaut: typesFrais.montantDefaut, mensuel: typesFrais.mensuel })
		.from(typesFrais)
		.where(eq(typesFrais.obligatoire, true))
		.orderBy(typesFrais.mensuel, typesFrais.nom);
	if (frais.length === 0) return VIDE;
	const fraisIds = frais.map((f) => f.id);

	const grille = await database
		.select({ classeId: grilleFrais.classeId, typeFraisId: grilleFrais.typeFraisId, montant: grilleFrais.montantMensuel })
		.from(grilleFrais)
		.where(eq(grilleFrais.anneeScolaireId, anneeScolaireId));

	const paiementsRows = await database
		.select({ eleveId: paiements.eleveId, typeFraisId: paiements.typeFraisId, mois: paiements.mois, montant: paiements.montant })
		.from(paiements)
		.where(and(eq(paiements.anneeScolaireId, anneeScolaireId), inArray(paiements.typeFraisId, fraisIds)));

	return calculerImpayes({
		dateDebut: annee.dateDebut,
		dateFin: annee.dateFin,
		aujourdhui,
		eleves: elevesRows.map(({ parentPrenom, parentNomFamille, ...e }) => ({
			...e,
			parentNom: parentPrenom ? `${parentPrenom} ${parentNomFamille}` : null,
		})),
		frais,
		grille,
		paiements: paiementsRows,
	});
}
```
Ordre des frais : `orderBy(typesFrais.mensuel, typesFrais.nom)` place les frais uniques (false) avant les mensuels. Les tests de Task 1 passent les frais dans l'ordre [Scolarité, Inscription] explicitement, donc indépendants de cet ordre.

- [ ] **Step 5: Procédures** — dans `src/modules/finance/router.ts` :
  - importer `upsertGrilleSchema, impayesFiltersSchema` depuis `./validation` et `getImpayes` depuis `./impayes-service` ;
  - dans `grilleFraisRouter`, ajouter :
```ts
	upsertMany: protectedProcedure.input(upsertGrilleSchema).mutation(async ({ ctx, input }) => {
		await ctx.db.transaction(async (tx) => {
			for (const c of input.cellules) {
				await tx
					.insert(grilleFrais)
					.values({ classeId: c.classeId, typeFraisId: c.typeFraisId, anneeScolaireId: input.anneeScolaireId, montantMensuel: c.montant })
					.onConflictDoUpdate({
						target: [grilleFrais.classeId, grilleFrais.typeFraisId, grilleFrais.anneeScolaireId],
						set: { montantMensuel: c.montant },
					});
			}
		});
		return { count: input.cellules.length };
	}),
```
  - avant `export const financeRouter`, ajouter :
```ts
const impayesRouter = createTRPCRouter({
	list: protectedProcedure.input(impayesFiltersSchema).query(({ ctx, input }) =>
		getImpayes(ctx.db, input.anneeScolaireId, { classeId: input.classeId, niveauId: input.niveauId }),
	),
});
```
  et `impayes: impayesRouter,` dans `financeRouter`.

- [ ] **Step 6: KPI serveur** — dans `src/modules/dashboard/router.ts` `stats` : `import { getImpayes } from "@/modules/finance/impayes-service";`, puis avant le `return` :
```ts
			const impayes = await getImpayes(ctx.db, input.anneeScolaireId);
```
  et ajouter `totalImpayes: impayes.totalReste,` à l'objet retourné.

- [ ] **Step 7: Run — expect PASS** : `pnpm typecheck && pnpm exec playwright test e2e/11 --reporter=line` → 1 passed.

- [ ] **Step 8: Commit**
```bash
git add src/modules/finance src/modules/dashboard e2e/11-impayes.spec.ts
git commit -m "feat(finance): impayes.list, grilleFrais.upsertMany, dashboard totalImpayes"
```

---

### Task 3: Page Grille tarifaire

**Files:**
- Create: `src/app/(dashboard)/finances/grille/page.tsx`
- Modify: `src/shared/ui/sidebar.tsx`
- Test: `e2e/11-impayes.spec.ts` (ajout)

**Interfaces:**
- Consumes: `finance.grilleFrais.list`, `finance.grilleFrais.upsertMany`, `finance.typesFrais.list`, `academic.classes.list`
- Produces: champs avec `aria-label="<classe> — <frais>"` (ex. `IMP-123 — Scolarité`), bouton « Enregistrer », message « Grille enregistrée », bouton de ligne « Appliquer au niveau ».

- [ ] **Step 1: Failing e2e** — ajouter dans le `describe` :
```ts
	test("UI : saisir la grille d'une classe et l'appliquer au niveau", async ({ page }) => {
		const { annee, niveau, classe } = await contexte(page);
		const classe2 = await trpc<{ id: string; nom: string }>(page, "academic.classes.create",
			{ nom: `IMP2-${Date.now()}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id }, true);
		const classes = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", { anneeScolaireId: annee.id });
		const nom1 = classes.find((c) => c.id === classe.id)?.nom ?? "";

		await page.goto("/finances/grille");
		await waitForLoad(page);
		await page.getByLabel(`${nom1} — Scolarité`).fill("23000");
		await page.getByLabel(`${nom1} — Inscription`).fill("62000");
		await page.getByRole("row", { name: new RegExp(nom1) }).getByRole("button", { name: "Appliquer au niveau" }).click();
		await expect(page.getByLabel(`${classe2.nom} — Scolarité`)).toHaveValue("23000");
		await page.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByText("Grille enregistrée")).toBeVisible();

		const grille = await trpc<{ classeId: string; typeFraisNom: string; montantMensuel: number }[]>(
			page, "finance.grilleFrais.list", { anneeScolaireId: annee.id });
		expect(grille.find((g) => g.classeId === classe2.id && g.typeFraisNom === "Scolarité")?.montantMensuel).toBe(23_000);
	});
```
Run: `pnpm exec playwright test e2e/11 -g "UI : saisir" --reporter=line` → FAIL (page 404 / champ introuvable).

- [ ] **Step 2: Implement the page** — `src/app/(dashboard)/finances/grille/page.tsx` :
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
import { Button, PageHeader } from "@/shared/ui";

const cle = (classeId: string, fraisId: string) => `${classeId}:${fraisId}`;
const INPUT =
	"w-32 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function GrillePage() {
	const utils = trpc.useUtils();
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const classes = trpc.academic.classes.list.useQuery({ anneeScolaireId: annee?.id ?? "" }, { enabled: !!annee });
	const typesFrais = trpc.finance.typesFrais.list.useQuery();
	const grille = trpc.finance.grilleFrais.list.useQuery({ anneeScolaireId: annee?.id ?? "" }, { enabled: !!annee });

	const frais = useMemo(() => (typesFrais.data ?? []).filter((f) => f.obligatoire), [typesFrais.data]);
	const lignes = useMemo(
		() =>
			[...(classes.data ?? [])].sort(
				(a, b) => (a.niveau?.ordre ?? 0) - (b.niveau?.ordre ?? 0) || a.nom.localeCompare(b.nom),
			),
		[classes.data],
	);

	const enregistre = useMemo(
		() => new Map((grille.data ?? []).map((g) => [cle(g.classeId, g.typeFraisId), g.montantMensuel])),
		[grille.data],
	);
	const [valeurs, setValeurs] = useState<Record<string, string>>({});
	const [message, setMessage] = useState("");
	useEffect(() => {
		setValeurs(Object.fromEntries([...enregistre].map(([k, v]) => [k, String(v)])));
	}, [enregistre]);

	const save = trpc.finance.grilleFrais.upsertMany.useMutation({
		onSuccess: () => {
			setMessage("Grille enregistrée");
			utils.finance.grilleFrais.list.invalidate();
			utils.finance.impayes.list.invalidate();
		},
	});

	function appliquerAuNiveau(classeId: string, niveauId: string) {
		const suivantes = { ...valeurs };
		for (const c of lignes.filter((l) => l.niveauId === niveauId && l.id !== classeId)) {
			for (const f of frais) {
				const v = valeurs[cle(classeId, f.id)];
				if (v) suivantes[cle(c.id, f.id)] = v;
			}
		}
		setValeurs(suivantes);
	}

	function enregistrer() {
		if (!annee) return;
		setMessage("");
		const cellules = Object.entries(valeurs)
			.filter(([k, v]) => v !== "" && Number(v) !== enregistre.get(k))
			.map(([k, v]) => {
				const [classeId, typeFraisId] = k.split(":");
				return { classeId, typeFraisId, montant: Number(v) };
			});
		if (cellules.some((c) => !Number.isInteger(c.montant) || c.montant < 0)) {
			setMessage("Les montants doivent être des nombres entiers positifs.");
			return;
		}
		if (cellules.length === 0) {
			setMessage("Aucune modification.");
			return;
		}
		save.mutate({ anneeScolaireId: annee.id, cellules });
	}

	return (
		<div>
			<PageHeader
				title="Grille tarifaire"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Grille tarifaire" }]}
			/>
			<p className="mb-4 text-sm text-muted">
				Montant par classe pour chaque frais obligatoire de l'année {annee?.libelle ?? ""}. Une case vide
				utilise le montant par défaut (affiché en gris) et est signalée sur la page Impayés.
			</p>
			<div className="overflow-x-auto rounded-xl bg-surface p-4 shadow-sm">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs uppercase text-muted">
							<th className="px-3 py-2">Classe</th>
							<th className="px-3 py-2">Niveau</th>
							{frais.map((f) => (
								<th key={f.id} className="px-3 py-2">
									{f.nom} <span className="normal-case">({f.mensuel ? "par mois" : "une fois"})</span>
								</th>
							))}
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						{lignes.map((c) => (
							<tr key={c.id} className="border-b last:border-0">
								<td className="px-3 py-2 font-medium">{c.nom}</td>
								<td className="px-3 py-2 text-muted">{c.niveau?.nom}</td>
								{frais.map((f) => {
									const k = cle(c.id, f.id);
									return (
										<td key={f.id} className="px-3 py-2">
											<input
												type="number"
												min={0}
												step={500}
												aria-label={`${c.nom} — ${f.nom}`}
												value={valeurs[k] ?? ""}
												placeholder={String(f.montantDefaut)}
												onChange={(e) => setValeurs({ ...valeurs, [k]: e.target.value })}
												className={INPUT}
											/>
											{!enregistre.has(k) && (
												<span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
													à renseigner
												</span>
											)}
										</td>
									);
								})}
								<td className="px-3 py-2 text-right">
									<Button variant="ghost" size="sm" onClick={() => appliquerAuNiveau(c.id, c.niveauId)}>
										Appliquer au niveau
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="mt-4 flex items-center gap-4">
				<Button onClick={enregistrer} disabled={save.isPending}>
					{save.isPending ? "Enregistrement..." : "Enregistrer"}
				</Button>
				{message && <span className="text-sm text-muted">{message}</span>}
				{save.error && <span className="text-sm text-danger">{save.error.message}</span>}
			</div>
			<p className="mt-2 text-xs text-muted">
				Montants par défaut : {frais.map((f) => `${f.nom} ${formatCFA(f.montantDefaut)}`).join(" · ")}
			</p>
		</div>
	);
}
```
Vérifier les champs renvoyés par `finance.typesFrais.list` (`obligatoire`, `mensuel`, `montantDefaut`) et `academic.classes.list` (`niveauId`, `niveau.ordre`, `niveau.nom`).

- [ ] **Step 3: Sidebar** — dans `src/shared/ui/sidebar.tsx`, sous Finances, après « Suivi » :
```ts
			{ label: "Impayés", href: "/finances/impayes", icon: AlertTriangle },
			{ label: "Grille tarifaire", href: "/finances/grille", icon: Table },
```
et importer `AlertTriangle, Table` depuis `lucide-react` (vérifier leur existence : `grep -c "AlertTriangle\|Table" node_modules/lucide-react/dist/lucide-react.d.ts`, sinon `TriangleAlert` / `Table2`).

- [ ] **Step 4: Run — expect PASS** : `pnpm typecheck && pnpm exec playwright test e2e/11 --reporter=line` → 2 passed.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(dashboard)/finances/grille" src/shared/ui/sidebar.tsx e2e/11-impayes.spec.ts
git commit -m "feat(finance): editable fee grid page"
```

---

### Task 4: En-tête PDF partagé et lettres de relance

**Files:**
- Create: `src/shared/lib/pdf-entete.ts`, `src/shared/lib/generate-relance-pdf.ts`
- Modify: `src/shared/lib/generate-recu-pdf.ts`
- Test: `src/shared/lib/generate-relance-pdf.test.ts`

**Interfaces:**
- Consumes: `Parametres` (`@/modules/settings/service`), `LigneImpaye`, `MoisImpaye` (Task 1)
- Produces:
  - `PDF_COULEURS`, `formatMontantPdf(n: number): string`, `dessinerEnTeteEcole(doc: jsPDF, ecole: Parametres, opts?: { marge?: number; yDepart?: number }): number` (renvoie le y sous le séparateur)
  - `buildRelancesPdf(lignes: LigneImpaye[], ecole: Parametres, dateDuJour: string): jsPDF`
  - `downloadRelancesPdf(lignes: LigneImpaye[], ecole: Parametres): void`

- [ ] **Step 1: Failing test** — `src/shared/lib/generate-relance-pdf.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { PARAMETRES_DEFAUT } from "@/modules/settings/defaults";
import type { LigneImpaye } from "@/modules/finance/impayes";
import { buildRelancesPdf } from "./generate-relance-pdf";

const ligne = (id: string, overrides: Partial<LigneImpaye> = {}): LigneImpaye => ({
	id, matricule: `CEMAS-2026-${id}`, prenom: "Awa", nom: "Diop", classeId: "c", classeNom: "CP", niveauId: "n",
	telephone: "77 000 00 00", parentNom: "Moussa Diop", du: 74_000, paye: 0, reste: 74_000,
	moisImpayes: [
		{ typeFraisId: "s", typeFraisNom: "Scolarité", mois: 11, annee: 2026, montant: 24_000 },
		{ typeFraisId: "i", typeFraisNom: "Inscription", mois: null, annee: null, montant: 50_000 },
	],
	...overrides,
});

describe("buildRelancesPdf", () => {
	it("produit une page par élève avec l'en-tête, le détail et le total", () => {
		const doc = buildRelancesPdf([ligne("0001"), ligne("0002")], PARAMETRES_DEFAUT, "2026-11-05");
		expect(doc.getNumberOfPages()).toBe(2);
		const contenu = doc.output();
		expect(contenu).toContain("CEMAS-2026-0001");
		expect(contenu).toContain("CEMAS-2026-0002");
		expect(contenu).toContain("Moussa Diop");
		expect(contenu).toContain("Novembre 2026");
		expect(contenu).toContain("74 000 FCFA");
		expect(contenu).toContain(PARAMETRES_DEFAUT.nom);
	});

	it("s'adresse aux parents quand aucun contact n'est connu", () => {
		const doc = buildRelancesPdf([ligne("0003", { parentNom: null, telephone: null })], PARAMETRES_DEFAUT, "2026-11-05");
		expect(doc.output()).toContain("Aux parents de Awa Diop");
	});
});
```
Run: `pnpm test` → FAIL (module introuvable).

- [ ] **Step 2: Shared header** — `src/shared/lib/pdf-entete.ts` (déplacer depuis `generate-recu-pdf.ts` : couleurs, `formatMontantPdf`, et le bloc « Yellow accent bar » → « Divider ») :
```ts
import type { jsPDF } from "jspdf";
import type { Parametres } from "@/modules/settings/service";

export const PDF_COULEURS = {
	primaire: { r: 102, g: 93, b: 157 }, // #665d9d
	secondaire: { r: 251, g: 198, b: 22 }, // #fbc616
};

export function formatMontantPdf(amount: number): string {
	return `${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
}

/** Bandeau, sigle, nom, adresse, coordonnées, ligne de contacts, séparateur. Renvoie le y suivant. */
export function dessinerEnTeteEcole(doc: jsPDF, ecole: Parametres, opts: { marge?: number } = {}): number {
	const { primaire, secondaire } = PDF_COULEURS;
	const largeur = doc.internal.pageSize.getWidth();
	const marge = opts.marge ?? 15;
	const centre = largeur / 2;
	let y = 16;

	doc.setFillColor(secondaire.r, secondaire.g, secondaire.b);
	doc.rect(0, 0, largeur, 4, "F");

	doc.setFontSize(20);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text(ecole.sigle, centre, y, { align: "center" });
	y += 7;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80, 80, 80);
	doc.text(ecole.nom, centre, y, { align: "center" });
	y += 4;
	if (ecole.adresse) {
		doc.text(ecole.adresse, centre, y, { align: "center" });
		y += 4;
	}
	const coordonnees = [ecole.telephone1, ecole.telephone2, ecole.email].filter(Boolean).join(" | ");
	if (coordonnees) {
		doc.text(coordonnees, centre, y, { align: "center" });
		y += 4;
	}
	y += 2;
	if (ecole.contactsEntete) {
		doc.setFontSize(7);
		doc.setTextColor(100, 100, 100);
		doc.text(ecole.contactsEntete, centre, y, { align: "center", maxWidth: largeur - 2 * marge });
		y += 6;
	}
	doc.setDrawColor(primaire.r, primaire.g, primaire.b);
	doc.setLineWidth(0.8);
	doc.line(marge, y, largeur - marge, y);
	return y + 8;
}
```
Dans `generate-recu-pdf.ts` : supprimer `PRIMARY`/`SECONDARY`/`formatMontantPdf` locaux et les blocs « Yellow accent bar », « Header », « Contacts », « Divider » ; les remplacer par
```ts
	let y = dessinerEnTeteEcole(doc, ecole, { marge: margin });
```
et définir `const PRIMARY = PDF_COULEURS.primaire; const SECONDARY = PDF_COULEURS.secondaire;` pour le reste du fichier (barre de pied, titre). Le rendu du reçu doit rester identique (même y de départ 16 = 12 + 4).

- [ ] **Step 3: Relance generator** — `src/shared/lib/generate-relance-pdf.ts` :
```ts
import { jsPDF } from "jspdf";
import type { LigneImpaye } from "@/modules/finance/impayes";
import type { Parametres } from "@/modules/settings/service";
import { dessinerEnTeteEcole, formatMontantPdf, PDF_COULEURS } from "./pdf-entete";
import { MOIS_LABELS } from "./utils";

const dateFr = (iso: string) =>
	new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

function pageRelance(doc: jsPDF, l: LigneImpaye, ecole: Parametres, dateDuJour: string) {
	const largeur = doc.internal.pageSize.getWidth();
	const marge = 20;
	let y = dessinerEnTeteEcole(doc, ecole, { marge });
	const { primaire } = PDF_COULEURS;

	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(0, 0, 0);
	doc.text(`Le ${dateFr(dateDuJour)}`, largeur - marge, y, { align: "right" });
	y += 10;
	const eleve = `${l.prenom} ${l.nom}`;
	doc.text(l.parentNom ? `A l'attention de ${l.parentNom}` : `Aux parents de ${eleve}`, marge, y);
	y += 5;
	doc.text(`Parent / tuteur de ${eleve} - ${l.classeNom} - Matricule ${l.matricule}`, marge, y);
	y += 12;

	doc.setFont("helvetica", "bold");
	doc.setFontSize(13);
	doc.setTextColor(primaire.r, primaire.g, primaire.b);
	doc.text("Objet : rappel de paiement des frais de scolarite", marge, y);
	y += 10;

	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	doc.setTextColor(0, 0, 0);
	const intro =
		"Madame, Monsieur, sauf erreur de notre part, les sommes suivantes restent dues a ce jour. " +
		"Nous vous remercions de bien vouloir regulariser la situation dans les meilleurs delais.";
	const lignesIntro = doc.splitTextToSize(intro, largeur - 2 * marge);
	doc.text(lignesIntro, marge, y);
	y += lignesIntro.length * 5 + 6;

	// Tableau
	doc.setFont("helvetica", "bold");
	doc.text("Frais", marge, y);
	doc.text("Periode", marge + 60, y);
	doc.text("Montant", largeur - marge, y, { align: "right" });
	y += 2;
	doc.setDrawColor(200, 200, 200);
	doc.setLineWidth(0.3);
	doc.line(marge, y, largeur - marge, y);
	y += 6;
	doc.setFont("helvetica", "normal");
	for (const m of l.moisImpayes) {
		const periode = m.mois === null ? "Une fois" : `${MOIS_LABELS[m.mois]} ${m.annee}`;
		doc.text(m.typeFraisNom, marge, y);
		doc.text(periode, marge + 60, y);
		doc.text(formatMontantPdf(m.montant), largeur - marge, y, { align: "right" });
		y += 6;
	}
	doc.line(marge, y - 2, largeur - marge, y - 2);
	y += 4;
	doc.setFont("helvetica", "bold");
	doc.text("Total restant du", marge, y);
	doc.text(formatMontantPdf(l.reste), largeur - marge, y, { align: "right" });
	y += 14;

	doc.setFont("helvetica", "normal");
	doc.text(
		doc.splitTextToSize(
			"Si vous avez deja effectue ce paiement, merci de ne pas tenir compte de ce courrier. " +
				"Veuillez agreer, Madame, Monsieur, nos salutations distinguees.",
			largeur - 2 * marge,
		),
		marge,
		y,
	);
	y += 20;
	doc.text("La Direction", largeur - marge, y, { align: "right" });
}

/** Une page A4 par élève. */
export function buildRelancesPdf(lignes: LigneImpaye[], ecole: Parametres, dateDuJour: string): jsPDF {
	const doc = new jsPDF({ unit: "mm", format: "a4" });
	lignes.forEach((l, i) => {
		if (i > 0) doc.addPage();
		pageRelance(doc, l, ecole, dateDuJour);
	});
	return doc;
}

export function downloadRelancesPdf(lignes: LigneImpaye[], ecole: Parametres) {
	const aujourdhui = new Date().toISOString().slice(0, 10);
	const nom = lignes.length === 1 ? `relance-${lignes[0].matricule}.pdf` : `relances-${aujourdhui}.pdf`;
	buildRelancesPdf(lignes, ecole, aujourdhui).save(nom);
}
```
Les textes de la lettre sont sans accents (WinAnsi) sauf les données (noms, mois via `MOIS_LABELS`, nom de l'école) que helvetica WinAnsi affiche correctement (é, è, û…).

- [ ] **Step 4: Run — expect PASS** : `pnpm test` (nouveaux tests + existants) ; `pnpm typecheck`.

- [ ] **Step 5: Vérifier le reçu** : `pnpm exec playwright test e2e/05 --reporter=line` (le téléchargement de reçu ne doit pas régresser) ; ouvrir un reçu en dev et comparer visuellement à l'ancien (en-tête identique).

- [ ] **Step 6: Commit**
```bash
git add src/shared/lib/pdf-entete.ts src/shared/lib/generate-recu-pdf.ts src/shared/lib/generate-relance-pdf.ts src/shared/lib/generate-relance-pdf.test.ts
git commit -m "feat(finance): reminder letters PDF with shared school header"
```

---

### Task 5: Page Impayés et carte du tableau de bord

**Files:**
- Create: `src/app/(dashboard)/finances/impayes/page.tsx`
- Modify: `src/app/(dashboard)/page.tsx`
- Test: `e2e/11-impayes.spec.ts` (ajout)

**Interfaces:**
- Consumes: `finance.impayes.list`, `libelleMoisImpayes` (Task 1), `downloadRelancesPdf` (Task 4), `settings.get`, `academic.niveaux.list`, `academic.classes.list`, `dashboard.stats.totalImpayes`

- [ ] **Step 1: Failing e2e** — ajouter :
```ts
	test("UI : liste des impayés, lettre de relance et carte du tableau de bord", async ({ page }) => {
		const { classe, eleve } = await contexte(page);
		const classes = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list");
		const nomClasse = classes.find((c) => c.id === classe.id)?.nom ?? "";

		await page.goto("/finances/impayes");
		await waitForLoad(page);
		await page.getByLabel("Classe").selectOption(classe.id);
		const ligne = page.getByRole("row", { name: new RegExp(nomClasse) }).first();
		await expect(ligne).toContainText("Inscription");
		await expect(ligne).toContainText("77 999 99 99");
		await expect(page.getByText(/montant par défaut/)).toBeVisible();

		const download = page.waitForEvent("download");
		await ligne.getByRole("button", { name: "Lettre" }).click();
		const fichier = await download;
		expect(fichier.suggestedFilename()).toMatch(/^relance-.+\.pdf$/);

		await ligne.getByRole("checkbox").check();
		const lot = page.waitForEvent("download");
		await page.getByRole("button", { name: /Lettres de relance \(1\)/ }).click();
		expect((await lot).suggestedFilename()).toMatch(/^relances-\d{4}-\d{2}-\d{2}\.pdf$/);

		await page.goto("/");
		await waitForLoad(page);
		await expect(page.getByText("Impayés").first()).toBeVisible();
		expect(eleve.id).toBeTruthy();
	});
```
Run: `pnpm exec playwright test e2e/11 -g "UI : liste" --reporter=line` → FAIL.

- [ ] **Step 2: Page** — `src/app/(dashboard)/finances/impayes/page.tsx` :
```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { libelleMoisImpayes } from "@/modules/finance/impayes";
import { downloadRelancesPdf } from "@/shared/lib/generate-relance-pdf";
import { trpc } from "@/shared/lib/trpc-client";
import { formatCFA } from "@/shared/lib/utils";
import { Button, PageHeader } from "@/shared/ui";

const SELECT =
	"rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function ImpayesPage() {
	const annees = trpc.academic.annees.list.useQuery();
	const annee = annees.data?.find((a) => a.active);
	const niveaux = trpc.academic.niveaux.list.useQuery();
	const classes = trpc.academic.classes.list.useQuery({ anneeScolaireId: annee?.id ?? "" }, { enabled: !!annee });
	const parametres = trpc.settings.get.useQuery();

	const [niveauId, setNiveauId] = useState("");
	const [classeId, setClasseId] = useState("");
	const [selection, setSelection] = useState<Set<string>>(new Set());

	const impayes = trpc.finance.impayes.list.useQuery(
		{ anneeScolaireId: annee?.id ?? "", niveauId: niveauId || undefined, classeId: classeId || undefined },
		{ enabled: !!annee },
	);
	const lignes = impayes.data?.lignes ?? [];
	const classesFiltrees = (classes.data ?? []).filter((c) => !niveauId || c.niveauId === niveauId);
	const selectionnees = useMemo(() => lignes.filter((l) => selection.has(l.id)), [lignes, selection]);

	function basculer(id: string) {
		const s = new Set(selection);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		setSelection(s);
	}

	function lettres(ls: typeof lignes) {
		if (parametres.data && ls.length > 0) downloadRelancesPdf(ls, parametres.data);
	}

	const defauts = impayes.data?.classesMontantDefaut ?? [];

	return (
		<div>
			<PageHeader
				title="Impayés"
				breadcrumbs={[{ label: "Finances", href: "/finances/paiements" }, { label: "Impayés" }]}
			/>

			{defauts.length > 0 && (
				<div className="mb-4 rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
					{defauts.length} classe{defauts.length > 1 ? "s utilisent" : " utilise"} le montant par défaut (
					{defauts.map((d) => `${d.classeNom} : ${d.frais.join(", ")}`).join(" ; ")}).{" "}
					<Link href="/finances/grille" className="font-medium underline">
						Compléter la grille tarifaire
					</Link>
				</div>
			)}

			<div className="mb-4 flex flex-wrap items-end gap-3">
				<div>
					<label htmlFor="filtre-niveau" className="mb-1 block text-sm font-medium">Niveau</label>
					<select id="filtre-niveau" value={niveauId} className={SELECT}
						onChange={(e) => { setNiveauId(e.target.value); setClasseId(""); setSelection(new Set()); }}>
						<option value="">Tous les niveaux</option>
						{niveaux.data?.map((n) => <option key={n.id} value={n.id}>{n.nom}</option>)}
					</select>
				</div>
				<div>
					<label htmlFor="filtre-classe" className="mb-1 block text-sm font-medium">Classe</label>
					<select id="filtre-classe" value={classeId} className={SELECT}
						onChange={(e) => { setClasseId(e.target.value); setSelection(new Set()); }}>
						<option value="">Toutes les classes</option>
						{classesFiltrees.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
					</select>
				</div>
				<Button className="ml-auto" disabled={selectionnees.length === 0 || !parametres.data}
					onClick={() => lettres(selectionnees)}>
					Lettres de relance ({selectionnees.length})
				</Button>
			</div>

			<div className="overflow-x-auto rounded-xl bg-surface shadow-sm">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b text-left text-xs uppercase text-muted">
							<th className="px-3 py-2">
								<input type="checkbox" aria-label="Tout sélectionner"
									checked={lignes.length > 0 && selection.size === lignes.length}
									onChange={(e) => setSelection(e.target.checked ? new Set(lignes.map((l) => l.id)) : new Set())} />
							</th>
							<th className="px-3 py-2">Matricule</th>
							<th className="px-3 py-2">Élève</th>
							<th className="px-3 py-2">Classe</th>
							<th className="px-3 py-2 text-right">Dû</th>
							<th className="px-3 py-2 text-right">Payé</th>
							<th className="px-3 py-2 text-right">Reste</th>
							<th className="px-3 py-2">Mois impayés</th>
							<th className="px-3 py-2">Téléphone</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody>
						{impayes.isLoading && (
							<tr><td colSpan={10} className="px-3 py-6 text-center text-muted">Chargement...</td></tr>
						)}
						{!impayes.isLoading && lignes.length === 0 && (
							<tr><td colSpan={10} className="px-3 py-6 text-center text-muted">Aucun impayé.</td></tr>
						)}
						{lignes.map((l) => (
							<tr key={l.id} className="border-b last:border-0">
								<td className="px-3 py-2">
									<input type="checkbox" aria-label={`Sélectionner ${l.prenom} ${l.nom}`}
										checked={selection.has(l.id)} onChange={() => basculer(l.id)} />
								</td>
								<td className="whitespace-nowrap px-3 py-2">{l.matricule}</td>
								<td className="px-3 py-2">
									<Link href={`/eleves/${l.id}`} className="hover:underline">{l.prenom} {l.nom}</Link>
								</td>
								<td className="px-3 py-2">{l.classeNom}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right">{formatCFA(l.du)}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right">{formatCFA(l.paye)}</td>
								<td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-red-600">{formatCFA(l.reste)}</td>
								<td className="px-3 py-2 text-xs">{libelleMoisImpayes(l.moisImpayes)}</td>
								<td className="whitespace-nowrap px-3 py-2">{l.telephone ?? "—"}</td>
								<td className="px-3 py-2">
									<Button variant="ghost" size="sm" disabled={!parametres.data} onClick={() => lettres([l])}>
										Lettre
									</Button>
								</td>
							</tr>
						))}
					</tbody>
					{lignes.length > 0 && impayes.data && (
						<tfoot>
							<tr className="border-t-2 font-semibold">
								<td colSpan={4} className="px-3 py-2">Total ({lignes.length} élève{lignes.length > 1 ? "s" : ""})</td>
								<td className="px-3 py-2 text-right">{formatCFA(impayes.data.totalDu)}</td>
								<td className="px-3 py-2 text-right">{formatCFA(impayes.data.totalPaye)}</td>
								<td className="px-3 py-2 text-right text-red-600">{formatCFA(impayes.data.totalReste)}</td>
								<td colSpan={3} />
							</tr>
						</tfoot>
					)}
				</table>
			</div>
			<p className="mt-3 text-xs text-muted">
				Un mois pour lequel un paiement est enregistré est considéré comme soldé, quel que soit le
				montant (remises). « Payé » inclut les avances ; c'est pourquoi Dû − Payé peut différer du Reste.
			</p>
		</div>
	);
}
```
Formater ensuite avec `pnpm exec biome check --write`.

- [ ] **Step 3: Carte du tableau de bord** — dans `src/app/(dashboard)/page.tsx`, ajouter après la carte « Dépenses » :
```tsx
				<Link href="/finances/impayes">
					<StatCard title="Impayés" value={formatCFA(d?.totalImpayes ?? 0)} icon={AlertTriangle} />
				</Link>
```
importer `Link` (`next/link`) et `AlertTriangle` (même nom que Task 3), et passer la grille des cartes à `lg:grid-cols-4 xl:grid-cols-4` (7 cartes sur 2 lignes).

- [ ] **Step 4: Run — expect PASS** : `pnpm typecheck && pnpm lint && pnpm exec playwright test e2e/11 --reporter=line` → 3 passed.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(dashboard)/finances/impayes" "src/app/(dashboard)/page.tsx" e2e/11-impayes.spec.ts
git commit -m "feat(finance): unpaid fees page with reminder letters and dashboard KPI"
```

---

### Task 6: Documentation et vérification complète

**Files:** `docs/02_features.md`, `docs/03_data_model.md`, `docs/04_api_spec.md`, `docs/16_decisions.md`

- [ ] **Step 1: Docs**
  - `02_features.md`, module Finances : lignes « Grille tarifaire », « Impayés », « Relances » + section « Détail : Impayés » reprenant les règles de la spec § 3 ; module Tableau de bord : carte « Impayés ».
  - `03_data_model.md`, `grille_frais` : « pour un frais unique (`mensuel = false`), `montant_mensuel` contient le montant unique ».
  - `04_api_spec.md` : `finance.grilleFrais.upsertMany`, `finance.impayes.list`, `dashboard.stats.totalImpayes`.
  - `16_decisions.md` : D-016 « Mois payé = soldé (remises) », D-017 « Montant par défaut signalé si la grille est absente ».

- [ ] **Step 2: Full verification**
Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Run (base neuve, comme la CI) : créer `cemas_ci` (`psql -d postgres -c "create database cemas_ci owner cemas"`), `DATABASE_URL=…/cemas_ci pnpm db:migrate && pnpm db:seed`, puis `CI=1 E2E_EMAIL=admin@cemas.online E2E_PASSWORD='cemas2025!' DATABASE_URL=…/cemas_ci pnpm exec playwright test e2e/0 e2e/1` → tous verts ; supprimer `cemas_ci`.

- [ ] **Step 3: Commit**
```bash
git add docs
git commit -m "docs: unpaid fees, fee grid and reminders (lot 2)"
```

---

## Après le plan
PR → CI → fusion → déploiement automatique (sauvegarde préalable). En production : remplir la grille tarifaire pour que les impayés soient exacts.
