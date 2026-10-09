# Lot 4 — Passage à l'année suivante Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configurer la classe suivante de chaque classe, puis faire passer l'école à l'année suivante via un assistant en 4 étapes, dans une transaction unique.

**Architecture:** Décisions calculées par une fonction pure `planifierPassage` (Vitest). Un service `passage-service.ts` charge le contexte, prévisualise et exécute le passage dans une transaction Drizzle. Routeur `academic.passage.*`. Assistant sur une page dédiée `/academique/annees/passage`.

**Tech Stack:** Next.js 16, tRPC 11 (sans transformer), Drizzle 0.45 / PostgreSQL 16, zod 4, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-09-lot4-passage-annee-design.md`

## Global Constraints

- Migration additive `0007` : `classes.classe_suivante_id` (uuid nullable, FK `classes.id` ON DELETE SET NULL), `classes.fin_de_cycle` (boolean NOT NULL default false).
- Classe configurée : `fin_de_cycle = true` OU `classe_suivante_id` = autre classe de la **même** année. `fin_de_cycle = true` ⇒ `classe_suivante_id = null`.
- Décision par élève : `passe` (défaut) | `redouble` | `quitte`. Fin de cycle + passe ⇒ sortant.
- Élèves concernés : `statut = 'actif'` et classe de l'année active.
- Qui reste : `eleves.classe_id` et `eleves.annee_scolaire_id` mis à jour ; inscription `(élève, classe, cible, 'confirmee', 0)` (upsert). Sortant/départ : `statut = 'inactif'`, classe et année inchangées.
- Classes recopiées par nom (pas de doublon) ; grille recopiée sans écraser une valeur existante ; `classe_suivante_id` remappé.
- Fin : cible active, source archivée. Tout dans **une** transaction ; toute erreur ⇒ aucune écriture.
- Libellés UI en français ; Biome ; tests Vitest dans `src/**/*.test.ts`.
- Le test e2e du passage complet est **destructif** : il ne tourne que si `E2E_DESTRUCTIF=1` (CI) et porte le numéro `14-` (dernier).
- Worktree `/Users/yusper/Downloads/CEMAS-lot4`, branche `feat/lot4-passage-annee`. **Aucune écriture en production.**

## Review Focus

1. Une classe non configurée (oubli) → le passage est refusé avec le nom de la classe ; rien n'est écrit. Test : Task 2 (Vitest « non configurée ») + Task 3 (e2e preview renvoie l'erreur).
2. La classe suivante désignée appartient à une autre année (donnée incohérente / API) → refus. Test : Task 2 (Vitest « classe suivante invalide ») + Task 1 (API `classes.update` refuse).
3. Une année cible de même libellé existe déjà (création manuelle préalable) → elle est réutilisée, ses classes existantes ne sont pas dupliquées. Test : Task 3 (le service réutilise par nom ; e2e 14 crée l'année cible avant de lancer l'assistant).
4. Un élève reçoit une décision mais n'est plus concerné (inactivé entre-temps) → refus. Test : Task 2 (Vitest « décision pour un élève non concerné »).
5. Effectif prévu supérieur à la capacité d'une nouvelle classe → avertissement en prévisualisation, pas de blocage. Test : Task 2 (Vitest effectifs prévus) + affichage Task 4.

---

## File Structure

| Fichier | Rôle |
|---|---|
| Modify `src/modules/academic/schema.ts` | colonnes `classeSuivanteId`, `finDeCycle` |
| Create `drizzle/migrations/0007_*.sql` | migration générée |
| Modify `src/modules/academic/validation.ts` | `updateClasseSchema` étendu, `configurerClassesSchema`, `decisionsSchema`, `executerPassageSchema` |
| Create `src/modules/academic/passage.ts` + `.test.ts` | `planifierPassage` (pur) |
| Create `src/modules/academic/passage-service.ts` | `verifierConfiguration`, `chargerContexte`, `previsualiserPassage`, `executerPassage` |
| Modify `src/modules/academic/router.ts` | `classes.update` étendu, `passage.*` |
| Modify `src/app/(dashboard)/academique/classes/page.tsx` | colonne + sélecteur « Classe suivante » |
| Create `src/app/(dashboard)/academique/annees/passage/page.tsx` | assistant |
| Modify `src/app/(dashboard)/academique/annees/page.tsx` | bouton « Passer à l'année suivante » |
| Create `e2e/13-classe-suivante.spec.ts` | non destructif |
| Create `e2e/14-passage.spec.ts` | destructif (gardé par `E2E_DESTRUCTIF`) |
| Modify `.github/workflows/ci.yml` | `E2E_DESTRUCTIF: "1"` dans le job e2e |
| Modify `docs/02,03,04,16` | docs |

---

### Task 1: Colonnes de configuration et page Classes

**Files:**
- Modify: `src/modules/academic/schema.ts`, `src/modules/academic/validation.ts`, `src/modules/academic/router.ts` (`classes.update`), `src/app/(dashboard)/academique/classes/page.tsx`
- Create: `drizzle/migrations/0007_*.sql`, `e2e/13-classe-suivante.spec.ts`

**Interfaces:**
- Produces: `classes.list` renvoie `classeSuivanteId: string | null`, `finDeCycle: boolean` ; `classes.update` accepte `classeSuivanteId?: string | null`, `finDeCycle?: boolean`.
- Produces (UI) : colonne « Classe suivante » (texte = nom de la classe suivante, « Fin de cycle » ou « À configurer ») ; dans la modale de modification, `<select aria-label="Classe suivante">` avec options `""` (À configurer), `"fin"` (Fin de cycle) et les autres classes de l'année.

- [ ] **Step 1: Failing e2e** — `e2e/13-classe-suivante.spec.ts` :
```ts
import { expect, type Page, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

async function deuxClasses(page: Page) {
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const annee = annees.find((a) => a.active);
	if (!annee) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const t = Date.now();
	const a = await trpc<{ id: string; nom: string }>(page, "academic.classes.create",
		{ nom: `SUIV-A-${t}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id }, true);
	const b = await trpc<{ id: string; nom: string }>(page, "academic.classes.create",
		{ nom: `SUIV-B-${t}`, niveauId: niveau.id, capacite: 30, anneeScolaireId: annee.id }, true);
	return { annee, a, b };
}

async function editer(page: Page, nom: string, valeur: string) {
	await page.getByPlaceholder("Rechercher une classe...").fill(nom);
	await page.getByRole("row", { name: new RegExp(nom) }).getByRole("button").first().click();
	await page.getByRole("dialog").getByLabel("Classe suivante").selectOption(valeur);
	await page.getByRole("dialog").getByRole("button", { name: "Modifier" }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("13 - Classe suivante", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test("configurer la classe suivante et la fin de cycle", async ({ page }) => {
		const { a, b } = await deuxClasses(page);
		await page.goto("/academique/classes");
		await waitForLoad(page);

		await page.getByPlaceholder("Rechercher une classe...").fill(a.nom);
		await expect(page.getByRole("row", { name: new RegExp(a.nom) })).toContainText("À configurer");

		await editer(page, a.nom, b.id);
		await page.getByPlaceholder("Rechercher une classe...").fill(a.nom);
		await expect(page.getByRole("row", { name: new RegExp(a.nom) })).toContainText(b.nom);

		await editer(page, b.nom, "fin");
		await page.getByPlaceholder("Rechercher une classe...").fill(b.nom);
		await expect(page.getByRole("row", { name: new RegExp(b.nom) })).toContainText("Fin de cycle");
	});

	test("l'API refuse une classe suivante qui est elle-même", async ({ page }) => {
		const { a } = await deuxClasses(page);
		await expect(
			trpc(page, "academic.classes.update", { id: a.id, classeSuivanteId: a.id }, true),
		).rejects.toThrow(/classe suivante/i);
	});
});
```
Vérifier que le premier bouton de la ligne est bien « Modifier » (crayon) : `grep -n "openEdit(row)" "src/app/(dashboard)/academique/classes/page.tsx"`.

Run: `pnpm exec playwright test e2e/13 --reporter=line` → FAIL (« À configurer » absent).

- [ ] **Step 2: Schema + migration** — dans `src/modules/academic/schema.ts`, table `classes`, après `capacite` :
```ts
	classeSuivanteId: uuid("classe_suivante_id").references((): AnyPgColumn => classes.id, {
		onDelete: "set null",
	}),
	finDeCycle: boolean("fin_de_cycle").notNull().default(false),
```
importer `type AnyPgColumn` depuis `drizzle-orm/pg-core`. Puis :
Run: `pnpm db:generate && pnpm db:migrate` (base locale) → `0007_*.sql` contient deux `ALTER TABLE "classes" ADD COLUMN …` et une contrainte FK `ON DELETE set null`.

- [ ] **Step 3: Validation** — `src/modules/academic/validation.ts`, remplacer `updateClasseSchema` :
```ts
export const updateClasseSchema = z.object({
	id: z.string().uuid(),
	nom: z.string().min(1).optional(),
	capacite: z.number().int().min(1).optional(),
	classeSuivanteId: z.string().uuid().nullable().optional(),
	finDeCycle: z.boolean().optional(),
});

export const configurerClassesSchema = z.object({
	classes: z
		.array(
			z.object({
				id: z.string().uuid(),
				classeSuivanteId: z.string().uuid().nullable(),
				finDeCycle: z.boolean(),
			}),
		)
		.min(1)
		.max(500),
});

export const decisionsSchema = z.record(z.string().uuid(), z.enum(["passe", "redouble", "quitte"]));

export const executerPassageSchema = z.object({
	cible: z.object({
		libelle: z.string().trim().min(1, "Libellé requis").max(20),
		dateDebut: z.string().min(1),
		dateFin: z.string().min(1),
	}),
	decisions: decisionsSchema,
});
```

- [ ] **Step 4: `classes.update`** — dans `src/modules/academic/router.ts`, remplacer le corps de `update` :
```ts
	update: protectedProcedure.input(updateClasseSchema).mutation(async ({ ctx, input }) => {
		const { id, ...data } = input;
		if (data.finDeCycle) data.classeSuivanteId = null;
		if (data.classeSuivanteId) {
			const [classe] = await ctx.db.select().from(classes).where(eq(classes.id, id));
			const [suivante] = await ctx.db
				.select()
				.from(classes)
				.where(eq(classes.id, data.classeSuivanteId));
			if (!classe || !suivante || suivante.id === classe.id || suivante.anneeScolaireId !== classe.anneeScolaireId) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "La classe suivante doit être une autre classe de la même année.",
				});
			}
			data.finDeCycle = false;
		}
		const [classe] = await ctx.db.update(classes).set(data).where(eq(classes.id, id)).returning();
		return classe;
	}),
```
importer `TRPCError` depuis `@trpc/server`.

- [ ] **Step 5: Page Classes** — dans `src/app/(dashboard)/academique/classes/page.tsx` :
  - type `Classe` : ajouter `classeSuivanteId: string | null; finDeCycle: boolean;`
  - état : `const [suivante, setSuivante] = useState("");` ; dans `openEdit` : `setSuivante(classe.finDeCycle ? "fin" : (classe.classeSuivanteId ?? ""));`
  - `handleSubmit` (édition) :
```ts
			updateMutation.mutate({
				id: editing.id,
				nom,
				capacite,
				finDeCycle: suivante === "fin",
				classeSuivanteId: suivante && suivante !== "fin" ? suivante : null,
			});
```
  - colonne, après « Places restantes » :
```tsx
		{
			key: "classeSuivanteId",
			label: "Classe suivante",
			render: (row) =>
				row.finDeCycle ? (
					<span className="text-sm text-muted">Fin de cycle</span>
				) : row.classeSuivanteId ? (
					(classesList as Classe[]).find((c) => c.id === row.classeSuivanteId)?.nom ?? "—"
				) : (
					<span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
						À configurer
					</span>
				),
		},
```
  - dans la modale, après « Capacité », visible seulement en édition :
```tsx
					{editing && (
						<div>
							<label htmlFor="classe-suivante" className="mb-1 block text-sm font-medium text-gray-700">
								Classe suivante
							</label>
							<select
								id="classe-suivante"
								value={suivante}
								onChange={(e) => setSuivante(e.target.value)}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="">À configurer</option>
								<option value="fin">Fin de cycle (les élèves sortent)</option>
								{(classesList as Classe[])
									.filter((c) => c.id !== editing.id)
									.map((c) => (
										<option key={c.id} value={c.id}>
											{c.nom}
										</option>
									))}
							</select>
						</div>
					)}
```
  (la liste `classesList` est filtrée par niveau si un filtre est actif : utiliser plutôt une requête dédiée non filtrée `trpc.academic.classes.list.useQuery({ anneeScolaireId: activeAnnee?.id }, { enabled: !!activeAnnee })` nommée `toutesClasses` pour la colonne et le sélecteur.)

- [ ] **Step 6: Run — expect PASS** : `pnpm typecheck && pnpm exec playwright test e2e/13 e2e/02 e2e/09 --reporter=line`.

- [ ] **Step 7: Commit**
```bash
git add src/modules/academic drizzle/migrations "src/app/(dashboard)/academique/classes" e2e/13-classe-suivante.spec.ts
git commit -m "feat(academic): next class / end of cycle configuration"
```

---

### Task 2: Planification pure du passage

**Files:**
- Create: `src/modules/academic/passage.ts`, `src/modules/academic/passage.test.ts`

**Interfaces:**
- Produces:
```ts
export type Decision = "passe" | "redouble" | "quitte";
export type Resultat = "promu" | "redouble" | "sortant" | "depart";
export interface ClassePassage { id: string; nom: string; capacite: number; classeSuivanteId: string | null; finDeCycle: boolean }
export interface Mouvement { eleveId: string; classeSourceId: string; resultat: Resultat; classeDestinationSourceId: string | null }
export interface PlanPassage {
	erreurs: string[];
	mouvements: Mouvement[];
	parClasse: { classeId: string; nom: string; promus: number; redoublants: number; sortants: number; departs: number }[];
	effectifsPrevus: { classeSourceId: string; nom: string; effectif: number; capacite: number }[];
}
export function planifierPassage(p: { classes: ClassePassage[]; eleves: { id: string; classeId: string }[]; decisions: Record<string, Decision> }): PlanPassage
```
(si `erreurs` non vide : `mouvements = []`, comptes à zéro.)

- [ ] **Step 1: Failing tests** — `src/modules/academic/passage.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { type ClassePassage, planifierPassage } from "./passage";

const A: ClassePassage = { id: "A", nom: "CP", capacite: 2, classeSuivanteId: "B", finDeCycle: false };
const B: ClassePassage = { id: "B", nom: "CE1", capacite: 30, classeSuivanteId: null, finDeCycle: true };
const eleves = [
	{ id: "e1", classeId: "A" },
	{ id: "e2", classeId: "A" },
	{ id: "e3", classeId: "B" },
	{ id: "e4", classeId: "A" },
];

describe("planifierPassage", () => {
	it("par défaut : passe en classe suivante ; fin de cycle → sortant", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: {} });
		expect(p.erreurs).toEqual([]);
		expect(p.mouvements.find((m) => m.eleveId === "e1")).toEqual({
			eleveId: "e1", classeSourceId: "A", resultat: "promu", classeDestinationSourceId: "B",
		});
		expect(p.mouvements.find((m) => m.eleveId === "e3")).toMatchObject({ resultat: "sortant", classeDestinationSourceId: null });
	});

	it("redouble → même classe ; quitte → départ", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: { e2: "redouble", e4: "quitte" } });
		expect(p.mouvements.find((m) => m.eleveId === "e2")).toMatchObject({ resultat: "redouble", classeDestinationSourceId: "A" });
		expect(p.mouvements.find((m) => m.eleveId === "e4")).toMatchObject({ resultat: "depart", classeDestinationSourceId: null });
	});

	it("compte par classe et calcule les effectifs prévus", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: { e2: "redouble", e4: "quitte" } });
		expect(p.parClasse).toEqual([
			{ classeId: "A", nom: "CP", promus: 1, redoublants: 1, sortants: 0, departs: 1 },
			{ classeId: "B", nom: "CE1", promus: 0, redoublants: 0, sortants: 1, departs: 0 },
		]);
		expect(p.effectifsPrevus).toEqual([
			{ classeSourceId: "A", nom: "CP", effectif: 1, capacite: 2 },
			{ classeSourceId: "B", nom: "CE1", effectif: 1, capacite: 30 },
		]);
	});

	it("effectif prévu au-delà de la capacité : signalé par les nombres, pas une erreur", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: { e1: "redouble", e2: "redouble", e4: "redouble" } });
		expect(p.erreurs).toEqual([]);
		expect(p.effectifsPrevus[0]).toMatchObject({ effectif: 3, capacite: 2 });
	});

	it("refuse une classe non configurée", () => {
		const p = planifierPassage({ classes: [{ ...A, classeSuivanteId: null }, B], eleves, decisions: {} });
		expect(p.erreurs).toEqual(["CP : classe suivante non configurée"]);
		expect(p.mouvements).toEqual([]);
	});

	it("refuse une classe suivante invalide (hors année ou elle-même)", () => {
		expect(planifierPassage({ classes: [{ ...A, classeSuivanteId: "X" }, B], eleves, decisions: {} }).erreurs)
			.toEqual(["CP : classe suivante invalide"]);
		expect(planifierPassage({ classes: [{ ...A, classeSuivanteId: "A" }, B], eleves, decisions: {} }).erreurs)
			.toEqual(["CP : classe suivante invalide"]);
	});

	it("refuse une décision pour un élève non concerné", () => {
		const p = planifierPassage({ classes: [A, B], eleves, decisions: { inconnu: "passe" } });
		expect(p.erreurs).toEqual(["Décision pour un élève non concerné : inconnu"]);
	});
});
```
Run: `pnpm test` → FAIL (module absent).

- [ ] **Step 2: Implement** — `src/modules/academic/passage.ts` :
```ts
export type Decision = "passe" | "redouble" | "quitte";
export type Resultat = "promu" | "redouble" | "sortant" | "depart";

export interface ClassePassage {
	id: string;
	nom: string;
	capacite: number;
	classeSuivanteId: string | null;
	finDeCycle: boolean;
}

export interface Mouvement {
	eleveId: string;
	classeSourceId: string;
	resultat: Resultat;
	/** Classe de l'année source dont la copie accueille l'élève (null = sort de l'école) */
	classeDestinationSourceId: string | null;
}

export interface PlanPassage {
	erreurs: string[];
	mouvements: Mouvement[];
	parClasse: { classeId: string; nom: string; promus: number; redoublants: number; sortants: number; departs: number }[];
	effectifsPrevus: { classeSourceId: string; nom: string; effectif: number; capacite: number }[];
}

export function planifierPassage(p: {
	classes: ClassePassage[];
	eleves: { id: string; classeId: string }[];
	decisions: Record<string, Decision>;
}): PlanPassage {
	const parId = new Map(p.classes.map((c) => [c.id, c]));
	const erreurs: string[] = [];
	for (const c of p.classes) {
		if (c.finDeCycle) continue;
		if (!c.classeSuivanteId) erreurs.push(`${c.nom} : classe suivante non configurée`);
		else if (c.classeSuivanteId === c.id || !parId.has(c.classeSuivanteId))
			erreurs.push(`${c.nom} : classe suivante invalide`);
	}
	const concernes = new Set(p.eleves.map((e) => e.id));
	for (const id of Object.keys(p.decisions)) {
		if (!concernes.has(id)) erreurs.push(`Décision pour un élève non concerné : ${id}`);
	}
	for (const e of p.eleves) {
		if (!parId.has(e.classeId)) erreurs.push(`Élève ${e.id} : classe hors de l'année`);
	}

	const parClasse = p.classes.map((c) => ({ classeId: c.id, nom: c.nom, promus: 0, redoublants: 0, sortants: 0, departs: 0 }));
	const effectifs = new Map(p.classes.map((c) => [c.id, 0]));
	const vide = (): PlanPassage => ({
		erreurs,
		mouvements: [],
		parClasse,
		effectifsPrevus: p.classes.map((c) => ({ classeSourceId: c.id, nom: c.nom, effectif: 0, capacite: c.capacite })),
	});
	if (erreurs.length) return vide();

	const compte = new Map(parClasse.map((l) => [l.classeId, l]));
	const mouvements: Mouvement[] = p.eleves.map((e) => {
		const classe = parId.get(e.classeId) as ClassePassage;
		const decision = p.decisions[e.id] ?? "passe";
		const ligne = compte.get(classe.id) as (typeof parClasse)[number];
		let resultat: Resultat;
		let destination: string | null;
		if (decision === "quitte") {
			resultat = "depart";
			destination = null;
			ligne.departs++;
		} else if (decision === "redouble") {
			resultat = "redouble";
			destination = classe.id;
			ligne.redoublants++;
		} else if (classe.finDeCycle) {
			resultat = "sortant";
			destination = null;
			ligne.sortants++;
		} else {
			resultat = "promu";
			destination = classe.classeSuivanteId;
			ligne.promus++;
		}
		if (destination) effectifs.set(destination, (effectifs.get(destination) ?? 0) + 1);
		return { eleveId: e.id, classeSourceId: classe.id, resultat, classeDestinationSourceId: destination };
	});

	return {
		erreurs,
		mouvements,
		parClasse,
		effectifsPrevus: p.classes.map((c) => ({
			classeSourceId: c.id,
			nom: c.nom,
			effectif: effectifs.get(c.id) ?? 0,
			capacite: c.capacite,
		})),
	};
}
```

- [ ] **Step 3: Run — expect PASS** : `pnpm test` ; `pnpm exec biome check --write src/modules/academic/passage*.ts`.

- [ ] **Step 4: Commit**
```bash
git add src/modules/academic/passage.ts src/modules/academic/passage.test.ts
git commit -m "feat(academic): pure school-year rollover planning"
```

---

### Task 3: Service et procédures `academic.passage.*`

**Files:**
- Create: `src/modules/academic/passage-service.ts`
- Modify: `src/modules/academic/router.ts`
- Test: `e2e/13-classe-suivante.spec.ts` (ajout, non destructif)

**Interfaces:**
- Consumes: `planifierPassage`, `Decision`, `PlanPassage` (Task 2) ; schémas Task 1.
- Produces:
  - `chargerContexte(db) → { source: { id, libelle, dateDebut, dateFin }; proposition: { libelle, dateDebut, dateFin }; classes: (ClassePassage & { niveauNom: string })[]; eleves: { id, prenom, nom, matricule, classeId }[] }`
  - `previsualiserPassage(db, decisions) → PlanPassage`
  - `executerPassage(db, { cible, decisions }) → { anneeId, promus, redoublants, sortants, departs, classesCreees, grilleCopiee }`
  - tRPC : `academic.passage.contexte` (query), `.configurerClasses` (mutation → `{ count }`), `.preview` (query `{ decisions }`), `.executer` (mutation)

- [ ] **Step 1: Failing e2e (non destructive)** — ajouter dans `describe` de `e2e/13-classe-suivante.spec.ts` :
```ts
	test("contexte et prévisualisation du passage", async ({ page }) => {
		const { a, b } = await deuxClasses(page);
		const ctx = await trpc<{ proposition: { libelle: string }; classes: { id: string }[] }>(page, "academic.passage.contexte");
		expect(ctx.proposition.libelle).toMatch(/^\d{4}-\d{4}$/);
		expect(ctx.classes.some((c) => c.id === a.id)).toBe(true);

		const r = await trpc<{ count: number }>(page, "academic.passage.configurerClasses", {
			classes: [
				{ id: a.id, classeSuivanteId: b.id, finDeCycle: false },
				{ id: b.id, classeSuivanteId: null, finDeCycle: true },
			],
		}, true);
		expect(r.count).toBe(2);

		await expect(trpc(page, "academic.passage.configurerClasses", {
			classes: [{ id: a.id, classeSuivanteId: a.id, finDeCycle: false }],
		}, true)).rejects.toThrow(/classe suivante/i);

		const plan = await trpc<{ erreurs: string[] }>(page, "academic.passage.preview", { decisions: {} });
		expect(plan.erreurs.some((e) => e.startsWith(a.nom))).toBe(false);
		expect(plan.erreurs.some((e) => e.startsWith(b.nom))).toBe(false);
	});
```
Run: `pnpm exec playwright test e2e/13 -g "contexte" --reporter=line` → FAIL (procédure inconnue).

- [ ] **Step 2: Service** — `src/modules/academic/passage-service.ts` :
```ts
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { grilleFrais } from "@/modules/finance/schema";
import { eleves, inscriptions } from "@/modules/students/schema";
import type { db } from "@/shared/lib/db";
import { type Decision, planifierPassage } from "./passage";
import { anneesScolaires, classes, niveaux } from "./schema";

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const plusUnAn = (date: string) => {
	const [a, m, j] = date.split("-");
	return `${Number(a) + 1}-${m}-${j}`;
};

async function anneeActive(database: Db | Tx) {
	const [source] = await database.select().from(anneesScolaires).where(eq(anneesScolaires.active, true));
	if (!source) throw new TRPCError({ code: "BAD_REQUEST", message: "Aucune année scolaire active." });
	return source;
}

async function chargerDonnees(database: Db | Tx, sourceId: string) {
	const classesS = await database
		.select({
			id: classes.id, nom: classes.nom, niveauId: classes.niveauId, capacite: classes.capacite,
			classeSuivanteId: classes.classeSuivanteId, finDeCycle: classes.finDeCycle, niveauNom: niveaux.nom,
			niveauOrdre: niveaux.ordre,
		})
		.from(classes)
		.innerJoin(niveaux, eq(classes.niveauId, niveaux.id))
		.where(eq(classes.anneeScolaireId, sourceId));
	classesS.sort((x, y) => x.niveauOrdre - y.niveauOrdre || x.nom.localeCompare(y.nom, "fr", { numeric: true }));
	const elevesS = await database
		.select({ id: eleves.id, prenom: eleves.prenom, nom: eleves.nom, matricule: eleves.matricule, classeId: eleves.classeId })
		.from(eleves)
		.innerJoin(classes, eq(eleves.classeId, classes.id))
		.where(and(eq(classes.anneeScolaireId, sourceId), eq(eleves.statut, "actif")))
		.orderBy(eleves.nom, eleves.prenom);
	return { classesS, elevesS };
}

export async function chargerContexte(database: Db) {
	const source = await anneeActive(database);
	const { classesS, elevesS } = await chargerDonnees(database, source.id);
	const m = source.libelle.match(/^(\d{4})\D+(\d{4})$/);
	const libelle = m
		? `${Number(m[1]) + 1}-${Number(m[2]) + 1}`
		: `${Number(source.dateDebut.slice(0, 4)) + 1}-${Number(source.dateFin.slice(0, 4)) + 1}`;
	return {
		source: { id: source.id, libelle: source.libelle, dateDebut: source.dateDebut, dateFin: source.dateFin },
		proposition: { libelle, dateDebut: plusUnAn(source.dateDebut), dateFin: plusUnAn(source.dateFin) },
		classes: classesS,
		eleves: elevesS,
	};
}

/** Vérifie et enregistre la configuration des classes de l'année active. */
export async function configurerClasses(
	database: Db,
	items: { id: string; classeSuivanteId: string | null; finDeCycle: boolean }[],
) {
	return database.transaction(async (tx) => {
		const source = await anneeActive(tx);
		const ids = new Set(
			(await tx.select({ id: classes.id }).from(classes).where(eq(classes.anneeScolaireId, source.id))).map((c) => c.id),
		);
		for (const it of items) {
			if (!ids.has(it.id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Classe hors de l'année active." });
			if (!it.finDeCycle && it.classeSuivanteId && (it.classeSuivanteId === it.id || !ids.has(it.classeSuivanteId))) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "La classe suivante doit être une autre classe de la même année." });
			}
			await tx
				.update(classes)
				.set({ finDeCycle: it.finDeCycle, classeSuivanteId: it.finDeCycle ? null : it.classeSuivanteId })
				.where(eq(classes.id, it.id));
		}
		return { count: items.length };
	});
}

export async function previsualiserPassage(database: Db, decisions: Record<string, Decision>) {
	const source = await anneeActive(database);
	const { classesS, elevesS } = await chargerDonnees(database, source.id);
	return planifierPassage({ classes: classesS, eleves: elevesS, decisions });
}

export async function executerPassage(
	database: Db,
	input: { cible: { libelle: string; dateDebut: string; dateFin: string }; decisions: Record<string, Decision> },
) {
	return database.transaction(async (tx) => {
		const source = await anneeActive(tx);
		const { classesS, elevesS } = await chargerDonnees(tx, source.id);
		const plan = planifierPassage({ classes: classesS, eleves: elevesS, decisions: input.decisions });
		if (plan.erreurs.length) throw new TRPCError({ code: "BAD_REQUEST", message: plan.erreurs.join(" ; ") });

		// 1. Année cible (réutilisée si même libellé non archivée)
		let [cible] = await tx
			.select()
			.from(anneesScolaires)
			.where(and(eq(anneesScolaires.libelle, input.cible.libelle), eq(anneesScolaires.archived, false)));
		if (cible?.id === source.id) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "L'année cible doit être différente de l'année active." });
		}
		if (cible) {
			[cible] = await tx
				.update(anneesScolaires)
				.set({ dateDebut: input.cible.dateDebut, dateFin: input.cible.dateFin, updatedAt: new Date() })
				.where(eq(anneesScolaires.id, cible.id))
				.returning();
		} else {
			[cible] = await tx.insert(anneesScolaires).values(input.cible).returning();
		}

		// 2. Classes (réutilisées par nom)
		const existantes = new Map(
			(await tx.select({ id: classes.id, nom: classes.nom }).from(classes).where(eq(classes.anneeScolaireId, cible.id)))
				.map((c) => [c.nom, c.id]),
		);
		const copie = new Map<string, string>();
		let classesCreees = 0;
		for (const c of classesS) {
			let id = existantes.get(c.nom);
			if (!id) {
				const [nouvelle] = await tx
					.insert(classes)
					.values({ nom: c.nom, niveauId: c.niveauId, capacite: c.capacite, anneeScolaireId: cible.id })
					.returning({ id: classes.id });
				id = nouvelle.id;
				classesCreees++;
			}
			copie.set(c.id, id);
		}
		for (const c of classesS) {
			await tx
				.update(classes)
				.set({
					finDeCycle: c.finDeCycle,
					classeSuivanteId: c.finDeCycle || !c.classeSuivanteId ? null : (copie.get(c.classeSuivanteId) ?? null),
				})
				.where(eq(classes.id, copie.get(c.id) as string));
		}

		// 3. Grille (sans écraser une valeur déjà saisie dans la cible)
		const grille = await tx.select().from(grilleFrais).where(eq(grilleFrais.anneeScolaireId, source.id));
		let grilleCopiee = 0;
		for (const g of grille) {
			const inseres = await tx
				.insert(grilleFrais)
				.values({
					classeId: copie.get(g.classeId) as string,
					typeFraisId: g.typeFraisId,
					anneeScolaireId: cible.id,
					montantMensuel: g.montantMensuel,
				})
				.onConflictDoNothing()
				.returning({ id: grilleFrais.id });
			grilleCopiee += inseres.length;
		}

		// 4. Élèves
		const sortants = plan.mouvements.filter((m) => m.classeDestinationSourceId === null).map((m) => m.eleveId);
		if (sortants.length) {
			await tx.update(eleves).set({ statut: "inactif", updatedAt: new Date() }).where(inArray(eleves.id, sortants));
		}
		for (const m of plan.mouvements) {
			if (!m.classeDestinationSourceId) continue;
			const destination = copie.get(m.classeDestinationSourceId) as string;
			await tx
				.update(eleves)
				.set({ classeId: destination, anneeScolaireId: cible.id, updatedAt: new Date() })
				.where(eq(eleves.id, m.eleveId));
			await tx
				.insert(inscriptions)
				.values({ eleveId: m.eleveId, classeId: destination, anneeScolaireId: cible.id, statut: "confirmee", montantInscription: 0 })
				.onConflictDoUpdate({ target: [inscriptions.eleveId, inscriptions.anneeScolaireId], set: { classeId: destination } });
		}

		// 5. Activer la cible, archiver la source
		await tx.update(anneesScolaires).set({ active: false });
		await tx.update(anneesScolaires).set({ active: true }).where(eq(anneesScolaires.id, cible.id));
		await tx
			.update(anneesScolaires)
			.set({ archived: true, updatedAt: new Date() })
			.where(eq(anneesScolaires.id, source.id));

		const n = (r: string) => plan.mouvements.filter((m) => m.resultat === r).length;
		return {
			anneeId: cible.id,
			promus: n("promu"),
			redoublants: n("redouble"),
			sortants: n("sortant"),
			departs: n("depart"),
			classesCreees,
			grilleCopiee,
		};
	});
}
```

- [ ] **Step 3: Router** — dans `src/modules/academic/router.ts`, importer `configurerClassesSchema, decisionsSchema, executerPassageSchema` et les fonctions du service, puis avant `academicRouter` :
```ts
const passageRouter = createTRPCRouter({
	contexte: protectedProcedure.query(({ ctx }) => chargerContexte(ctx.db)),
	configurerClasses: protectedProcedure
		.input(configurerClassesSchema)
		.mutation(({ ctx, input }) => configurerClasses(ctx.db, input.classes)),
	preview: protectedProcedure
		.input(z.object({ decisions: decisionsSchema }))
		.query(({ ctx, input }) => previsualiserPassage(ctx.db, input.decisions)),
	executer: protectedProcedure
		.input(executerPassageSchema)
		.mutation(({ ctx, input }) => executerPassage(ctx.db, input)),
});
```
et `passage: passageRouter,` dans `academicRouter`.

- [ ] **Step 4: Run — expect PASS** : `pnpm typecheck && pnpm exec playwright test e2e/13 --reporter=line` → 3 passed.

- [ ] **Step 5: Commit**
```bash
git add src/modules/academic e2e/13-classe-suivante.spec.ts
git commit -m "feat(academic): rollover service and passage procedures"
```

---

### Task 4: Assistant « Passer à l'année suivante »

**Files:**
- Create: `src/app/(dashboard)/academique/annees/passage/page.tsx`
- Modify: `src/app/(dashboard)/academique/annees/page.tsx`
- Create: `e2e/14-passage.spec.ts`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `academic.passage.contexte/configurerClasses/preview/executer` (Task 3).
- Produces (UI) : étapes titrées « 1. Nouvelle année », « 2. Classes », « 3. Élèves », « 4. Vérification » ; boutons « Suivant », « Précédent », « Enregistrer et continuer », « Lancer le passage » ; confirmation (`alertdialog`) bouton « Confirmer le passage » ; succès « Passage effectué » ; décision par élève via radios de libellés « Passe », « Redouble », « Quitte » dans une ligne `row` nommée par l'élève ; lien « Passer à l'année suivante » sur l'année active.

- [ ] **Step 1: Failing destructive e2e** — `e2e/14-passage.spec.ts` :
```ts
import { expect, test } from "@playwright/test";
import { login, trpc, waitForLoad } from "./helpers";

// Archive l'année active : uniquement sur une base jetable (CI).
test.skip(process.env.E2E_DESTRUCTIF !== "1", "test destructif : E2E_DESTRUCTIF=1 requis");

type Ctx = { source: { id: string; libelle: string }; proposition: { libelle: string }; classes: { id: string }[] };

test("14 - Passage complet à l'année suivante", async ({ page }) => {
	test.setTimeout(120_000);
	await login(page);
	const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
	const source = annees.find((a) => a.active);
	if (!source) throw new Error("Aucune année active");
	const [niveau] = await trpc<{ id: string }[]>(page, "academic.niveaux.list");
	const t = Date.now();
	const creerClasse = (nom: string) => trpc<{ id: string; nom: string }>(page, "academic.classes.create",
		{ nom, niveauId: niveau.id, capacite: 30, anneeScolaireId: source.id }, true);
	const A = await creerClasse(`PAS-A-${t}`);
	const B = await creerClasse(`PAS-B-${t}`);
	const eleve = (prenom: string, classeId: string) => trpc<{ id: string }>(page, "students.create", {
		prenom, nom: `Passage${t}`, dateNaissance: "2016-01-01", sexe: "M", classeId, anneeScolaireId: source.id,
		parent: { prenom: "P", nom: "Passage", telephone: "77 000 00 14", relation: "pere" },
	}, true);
	const promu = await eleve("Promu", A.id);
	const redoublant = await eleve("Redoublant", A.id);
	const sortant = await eleve("Sortant", B.id);
	const frais = await trpc<{ id: string; obligatoire: boolean; mensuel: boolean }[]>(page, "finance.typesFrais.list");
	const sco = frais.find((f) => f.obligatoire && f.mensuel);
	if (!sco) throw new Error("Scolarité absente");
	await trpc(page, "finance.grilleFrais.upsertMany",
		{ anneeScolaireId: source.id, cellules: [{ classeId: A.id, typeFraisId: sco.id, montant: 17_000 }] }, true);
	await trpc(page, "finance.paiements.create",
		{ eleveId: promu.id, typeFraisId: sco.id, anneeScolaireId: source.id, mois: 10, montant: 17_000 }, true);

	// Toutes les autres classes en fin de cycle ; A → B ; B fin de cycle
	const ctx = await trpc<Ctx>(page, "academic.passage.contexte");
	await trpc(page, "academic.passage.configurerClasses", {
		classes: ctx.classes.map((c) =>
			c.id === A.id ? { id: c.id, classeSuivanteId: B.id, finDeCycle: false } : { id: c.id, classeSuivanteId: null, finDeCycle: true }),
	}, true);

	// Assistant
	await page.goto("/academique/annees");
	await waitForLoad(page);
	await page.getByRole("link", { name: "Passer à l'année suivante" }).click();
	await expect(page.getByRole("heading", { name: "1. Nouvelle année" })).toBeVisible();
	await expect(page.getByLabel("Libellé")).toHaveValue(ctx.proposition.libelle);
	await page.getByRole("button", { name: "Suivant" }).click();
	await expect(page.getByRole("heading", { name: "2. Classes" })).toBeVisible();
	await page.getByRole("button", { name: "Enregistrer et continuer" }).click();
	await expect(page.getByRole("heading", { name: "3. Élèves" })).toBeVisible();
	await page.getByRole("row", { name: new RegExp(`Redoublant Passage${t}`) }).getByLabel("Redouble").check();
	await page.getByRole("button", { name: "Suivant" }).click();
	await expect(page.getByRole("heading", { name: "4. Vérification" })).toBeVisible();
	await expect(page.getByRole("row", { name: new RegExp(A.nom) }).first()).toContainText("1");
	await page.getByRole("button", { name: "Lancer le passage" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "Confirmer le passage" }).click();
	await expect(page.getByText("Passage effectué")).toBeVisible({ timeout: 30_000 });

	// Vérifications
	const apres = await trpc<{ id: string; libelle: string; active: boolean; archived: boolean }[]>(page, "academic.annees.list");
	const cible = apres.find((a) => a.active);
	expect(cible?.libelle).toBe(ctx.proposition.libelle);
	expect(apres.find((a) => a.id === source.id)?.archived).toBe(true);

	const classesCible = await trpc<{ id: string; nom: string }[]>(page, "academic.classes.list", { anneeScolaireId: cible?.id });
	const A2 = classesCible.find((c) => c.nom === A.nom);
	const B2 = classesCible.find((c) => c.nom === B.nom);
	expect(A2 && B2).toBeTruthy();

	const detail = (id: string) => trpc<{ classeId: string; statut: string }>(page, "students.getById", { id });
	expect((await detail(promu.id)).classeId).toBe(B2?.id);
	expect((await detail(redoublant.id)).classeId).toBe(A2?.id);
	expect((await detail(sortant.id)).statut).toBe("inactif");

	const grille = await trpc<{ classeId: string; montantMensuel: number }[]>(page, "finance.grilleFrais.list", { anneeScolaireId: cible?.id });
	expect(grille.find((g) => g.classeId === A2?.id)?.montantMensuel).toBe(17_000);

	const bilan = await trpc<{ totalPaiements: number }>(page, "finance.bilan.summary", { anneeScolaireId: source.id });
	expect(bilan.totalPaiements).toBeGreaterThanOrEqual(17_000);
});
```
Run (base jetable `cemas_ci`, voir Task 5 Step 2) : `E2E_DESTRUCTIF=1 … pnpm exec playwright test e2e/14` → FAIL (lien absent). Sans la variable : `pnpm exec playwright test e2e/14` → 1 skipped.

- [ ] **Step 2: Bouton sur la page Années** — dans `src/app/(dashboard)/academique/annees/page.tsx`, colonne `actions`, pour `row.active && !row.archived`, ajouter avant le bouton Modifier :
```tsx
							{row.active && (
								<Link
									href="/academique/annees/passage"
									className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
								>
									Passer à l'année suivante
								</Link>
							)}
```
importer `Link` depuis `next/link`.

- [ ] **Step 3: Assistant** — `src/app/(dashboard)/academique/annees/passage/page.tsx` :
```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Decision } from "@/modules/academic/passage";
import { trpc } from "@/shared/lib/trpc-client";
import { Button, ConfirmDialog, PageHeader } from "@/shared/ui";

const INPUT =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const DECISIONS: { valeur: Decision; libelle: string }[] = [
	{ valeur: "passe", libelle: "Passe" },
	{ valeur: "redouble", libelle: "Redouble" },
	{ valeur: "quitte", libelle: "Quitte" },
];

export default function PassagePage() {
	const utils = trpc.useUtils();
	const ctx = trpc.academic.passage.contexte.useQuery();
	const [etape, setEtape] = useState(1);
	const [cible, setCible] = useState({ libelle: "", dateDebut: "", dateFin: "" });
	const [suivantes, setSuivantes] = useState<Record<string, string>>({});
	const [decisions, setDecisions] = useState<Record<string, Decision>>({});
	const [confirmer, setConfirmer] = useState(false);

	useEffect(() => {
		if (!ctx.data) return;
		setCible((c) => (c.libelle ? c : ctx.data.proposition));
		setSuivantes((s) =>
			Object.keys(s).length
				? s
				: Object.fromEntries(ctx.data.classes.map((c) => [c.id, c.finDeCycle ? "fin" : (c.classeSuivanteId ?? "")])),
		);
	}, [ctx.data]);

	const configurer = trpc.academic.passage.configurerClasses.useMutation({
		onSuccess: async () => {
			await utils.academic.passage.contexte.invalidate();
			setEtape(3);
		},
	});
	const preview = trpc.academic.passage.preview.useQuery({ decisions }, { enabled: etape === 4 });
	const executer = trpc.academic.passage.executer.useMutation({
		onSuccess: () => {
			setConfirmer(false);
			utils.invalidate();
		},
	});

	const classes = ctx.data?.classes ?? [];
	const toutesConfigurees = classes.every((c) => suivantes[c.id]);
	const elevesParClasse = useMemo(() => {
		const m = new Map<string, NonNullable<typeof ctx.data>["eleves"]>();
		for (const e of ctx.data?.eleves ?? []) m.set(e.classeId, [...(m.get(e.classeId) ?? []), e]);
		return m;
	}, [ctx.data]);
	const plan = preview.data;
	const depassements = plan?.effectifsPrevus.filter((e) => e.effectif > e.capacite) ?? [];

	if (ctx.isLoading) return <p className="text-sm text-muted">Chargement...</p>;
	if (ctx.error) return <p className="text-sm text-danger">{ctx.error.message}</p>;
	if (!ctx.data) return null;

	if (executer.data) {
		const r = executer.data;
		return (
			<div>
				<PageHeader title="Passage à l'année suivante" breadcrumbs={[{ label: "Académique" }, { label: "Années scolaires", href: "/academique/annees" }, { label: "Passage" }]} />
				<div className="rounded-xl bg-green-50 p-6 text-green-800">
					<h2 className="mb-2 text-lg font-semibold">Passage effectué</h2>
					<p>
						Année {cible.libelle} active. {r.promus} promus, {r.redoublants} redoublants, {r.sortants} sortants,{" "}
						{r.departs} départs. {r.classesCreees} classes créées, {r.grilleCopiee} montants de grille recopiés.
					</p>
					<Link href="/eleves" className="mt-3 inline-block font-medium underline">Voir les élèves</Link>
				</div>
			</div>
		);
	}

	return (
		<div>
			<PageHeader
				title="Passage à l'année suivante"
				breadcrumbs={[{ label: "Académique" }, { label: "Années scolaires", href: "/academique/annees" }, { label: "Passage" }]}
			/>
			<p className="mb-6 text-sm text-muted">Année en cours : {ctx.data.source.libelle}. Étape {etape} sur 4.</p>

			<div className="rounded-xl bg-surface p-6 shadow-sm">
				{etape === 1 && (
					<div className="max-w-md space-y-4">
						<h2 className="text-lg font-semibold">1. Nouvelle année</h2>
						<div>
							<label htmlFor="cible-libelle" className="mb-1 block text-sm font-medium">Libellé</label>
							<input id="cible-libelle" className={INPUT} value={cible.libelle}
								onChange={(e) => setCible({ ...cible, libelle: e.target.value })} />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="cible-debut" className="mb-1 block text-sm font-medium">Date de début</label>
								<input id="cible-debut" type="date" className={INPUT} value={cible.dateDebut}
									onChange={(e) => setCible({ ...cible, dateDebut: e.target.value })} />
							</div>
							<div>
								<label htmlFor="cible-fin" className="mb-1 block text-sm font-medium">Date de fin</label>
								<input id="cible-fin" type="date" className={INPUT} value={cible.dateFin}
									onChange={(e) => setCible({ ...cible, dateFin: e.target.value })} />
							</div>
						</div>
						<Button disabled={!cible.libelle || !cible.dateDebut || !cible.dateFin} onClick={() => setEtape(2)}>Suivant</Button>
					</div>
				)}

				{etape === 2 && (
					<div className="space-y-4">
						<h2 className="text-lg font-semibold">2. Classes</h2>
						<p className="text-sm text-muted">Pour chaque classe, choisissez la classe suivante ou « Fin de cycle » (les élèves qui passent quittent l'école).</p>
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b text-left text-xs uppercase text-muted">
									<th className="px-3 py-2">Classe</th><th className="px-3 py-2">Niveau</th><th className="px-3 py-2">Classe suivante</th>
								</tr>
							</thead>
							<tbody>
								{classes.map((c) => (
									<tr key={c.id} className="border-b last:border-0">
										<td className="px-3 py-2 font-medium">{c.nom}</td>
										<td className="px-3 py-2 text-muted">{c.niveauNom}</td>
										<td className="px-3 py-2">
											<select aria-label={`Classe suivante de ${c.nom}`} className={INPUT} value={suivantes[c.id] ?? ""}
												onChange={(e) => setSuivantes({ ...suivantes, [c.id]: e.target.value })}>
												<option value="">À configurer</option>
												<option value="fin">Fin de cycle</option>
												{classes.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
											</select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{configurer.error && <p className="text-sm text-danger">{configurer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(1)}>Précédent</Button>
							<Button disabled={!toutesConfigurees || configurer.isPending}
								onClick={() => configurer.mutate({
									classes: classes.map((c) => ({
										id: c.id,
										finDeCycle: suivantes[c.id] === "fin",
										classeSuivanteId: suivantes[c.id] && suivantes[c.id] !== "fin" ? suivantes[c.id] : null,
									})),
								})}>
								Enregistrer et continuer
							</Button>
						</div>
					</div>
				)}

				{etape === 3 && (
					<div className="space-y-6">
						<h2 className="text-lg font-semibold">3. Élèves</h2>
						{classes.map((c) => {
							const liste = elevesParClasse.get(c.id) ?? [];
							if (liste.length === 0) return null;
							return (
								<div key={c.id}>
									<div className="mb-2 flex items-center justify-between">
										<h3 className="font-medium">{c.nom} <span className="text-sm text-muted">({liste.length})</span></h3>
										<Button variant="ghost" size="sm" onClick={() => {
											const d = { ...decisions };
											for (const e of liste) delete d[e.id];
											setDecisions(d);
										}}>Tous passent</Button>
									</div>
									<table className="w-full text-sm">
										<tbody>
											{liste.map((e) => (
												<tr key={e.id} className="border-b last:border-0">
													<td className="px-3 py-1.5">{e.prenom} {e.nom}</td>
													<td className="px-3 py-1.5 text-muted">{e.matricule}</td>
													<td className="px-3 py-1.5">
														<div className="flex gap-4">
															{DECISIONS.map((d) => (
																<label key={d.valeur} className="flex items-center gap-1">
																	<input type="radio" name={`decision-${e.id}`} className="accent-primary"
																		checked={(decisions[e.id] ?? "passe") === d.valeur}
																		onChange={() => {
																			const suivant = { ...decisions };
																			if (d.valeur === "passe") delete suivant[e.id];
																			else suivant[e.id] = d.valeur;
																			setDecisions(suivant);
																		}} />
																	{d.libelle}
																</label>
															))}
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							);
						})}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(2)}>Précédent</Button>
							<Button onClick={() => setEtape(4)}>Suivant</Button>
						</div>
					</div>
				)}

				{etape === 4 && (
					<div className="space-y-6">
						<h2 className="text-lg font-semibold">4. Vérification</h2>
						{preview.isLoading && <p className="text-sm text-muted">Calcul...</p>}
						{plan && plan.erreurs.length > 0 && (
							<div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{plan.erreurs.join(" ; ")}</div>
						)}
						{plan && (
							<>
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b text-left text-xs uppercase text-muted">
											<th className="px-3 py-2">Classe</th><th className="px-3 py-2 text-right">Promus</th>
											<th className="px-3 py-2 text-right">Redoublants</th><th className="px-3 py-2 text-right">Sortants</th>
											<th className="px-3 py-2 text-right">Départs</th>
										</tr>
									</thead>
									<tbody>
										{plan.parClasse.map((l) => (
											<tr key={l.classeId} className="border-b last:border-0">
												<td className="px-3 py-2">{l.nom}</td>
												<td className="px-3 py-2 text-right">{l.promus}</td>
												<td className="px-3 py-2 text-right">{l.redoublants}</td>
												<td className="px-3 py-2 text-right">{l.sortants}</td>
												<td className="px-3 py-2 text-right">{l.departs}</td>
											</tr>
										))}
									</tbody>
								</table>
								<div>
									<h3 className="mb-2 font-medium">Effectifs prévus en {cible.libelle}</h3>
									<ul className="grid gap-1 text-sm sm:grid-cols-3">
										{plan.effectifsPrevus.map((e) => (
											<li key={e.classeSourceId} className={e.effectif > e.capacite ? "font-medium text-orange-700" : ""}>
												{e.nom} : {e.effectif} / {e.capacite}
											</li>
										))}
									</ul>
									{depassements.length > 0 && (
										<p className="mt-2 text-sm text-orange-700">{depassements.length} classe(s) dépasseront leur capacité.</p>
									)}
								</div>
								<p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
									Opération définitive : l'année {ctx.data.source.libelle} sera archivée. Vérifiez qu'une sauvegarde récente existe
									(voir docs/19_sauvegardes.md).
								</p>
							</>
						)}
						{executer.error && <p className="text-sm text-danger">{executer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(3)}>Précédent</Button>
							<Button disabled={!plan || plan.erreurs.length > 0} onClick={() => setConfirmer(true)}>Lancer le passage</Button>
						</div>
					</div>
				)}
			</div>

			<ConfirmDialog
				open={confirmer}
				onClose={() => setConfirmer(false)}
				onConfirm={() => executer.mutate({ cible, decisions })}
				title={`Passer à l'année ${cible.libelle} ?`}
				message={`L'année ${ctx.data.source.libelle} sera archivée et les élèves répartis selon vos choix. Cette opération ne peut pas être annulée.`}
				confirmLabel="Confirmer le passage"
				loadingLabel="Passage en cours..."
				confirmVariant="primary"
				loading={executer.isPending}
			/>
		</div>
	);
}
```
Formater avec `pnpm exec biome check --write`. Les titres d'étape sont des `<h2>` (rôle `heading`) : le test les cible par nom exact.

- [ ] **Step 4: CI** — dans `.github/workflows/ci.yml`, job `e2e`, bloc `env`, ajouter :
```yaml
      # Autorise le test destructif 14-passage (base jetable)
      E2E_DESTRUCTIF: "1"
```

- [ ] **Step 5: Run — expect PASS** : sur base jetable (Task 5 Step 2) `E2E_DESTRUCTIF=1 … pnpm exec playwright test e2e/14` → 1 passed ; sans la variable → skipped.

- [ ] **Step 6: Commit**
```bash
git add "src/app/(dashboard)/academique/annees" e2e/14-passage.spec.ts .github/workflows/ci.yml
git commit -m "feat(academic): next-year rollover wizard"
```

---

### Task 5: Documentation et vérification complète

**Files:** `docs/02_features.md`, `docs/03_data_model.md`, `docs/04_api_spec.md`, `docs/16_decisions.md`

- [ ] **Step 1: Docs**
  - `02_features.md` : section Classes (classe suivante / fin de cycle) ; section Années scolaires « Passage à l'année suivante » reprenant les règles de la spec § 4.
  - `03_data_model.md` : `classes.classe_suivante_id`, `classes.fin_de_cycle`.
  - `04_api_spec.md` : `academic.classes.update` (nouveaux champs) ; `academic.passage.contexte|configurerClasses|preview|executer`.
  - `16_decisions.md` : D-019 « Passage atomique, décisions par élève ; sortants/départs inactifs rattachés à l'ancienne année ; classes et grille recopiées par nom sans doublon ».

- [ ] **Step 2: Full verification**
Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (build avec `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci AUTH_SECRET=x`).
Run (base jetable) :
```bash
psql -d postgres -c "drop database if exists cemas_ci" -c "create database cemas_ci owner cemas"
DATABASE_URL=…/cemas_ci pnpm db:migrate && DATABASE_URL=…/cemas_ci pnpm db:seed
CI=1 E2E_DESTRUCTIF=1 E2E_EMAIL=admin@cemas.online E2E_PASSWORD='cemas2025!' DATABASE_URL=…/cemas_ci \
  pnpm exec playwright test "e2e/(0[1-9]|[1-9][0-9])-"
psql -d postgres -c "drop database if exists cemas_ci"
```
Expected : tous verts (14 en dernier).

- [ ] **Step 3: Commit**
```bash
git add docs
git commit -m "docs: school year rollover (lot 4)"
```

---

## Après le plan
PR → CI (avec `E2E_DESTRUCTIF=1`) → fusion → déploiement (migration 0007 additive, sauvegarde préalable). En production, ne rien lancer : l'assistant sera utilisé en juillet 2027, après configuration des classes suivantes.
