# Lot 4b — Encadrement du passage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Autoriser le lancement du passage seulement après la fin de l'année active et après des contrôles (sauvegarde < 24 h, sauvegarde automatique juste avant, liste à cocher), conserver la préparation (décisions) entre juin et août, et afficher des bandeaux de rappel sur le tableau de bord.

**Architecture:** Fonctions pures (`fenetre.ts` : état de la fenêtre et choix de la dernière sauvegarde) testées par Vitest ; date du jour serveur surchargeable hors production (`PASSAGE_AUJOURDHUI`). Service `sauvegarde-service.ts` (lecture de `BACKUP_DIR`, `pg_dump` depuis l'application). Table `passage_decisions` pour la préparation. Gardes ajoutées en tête de `executerPassage`. Assistant à 5 étapes et bandeau tableau de bord.

**Tech Stack:** Next.js 16, tRPC 11, Drizzle 0.45 / PostgreSQL 16, zod 4, Node `child_process`, Vitest 5, Playwright, Docker (node:20-alpine + postgresql16-client).

**Spec:** `docs/superpowers/specs/2026-10-09-lot4b-encadrement-passage-design.md`

## Global Constraints

- États : `aucun` (J < 15 juin de l'année de `date_fin`), `preparation` (15 juin ≤ J ≤ `date_fin`), `ouvert` (J > `date_fin`) ; ouverture = `date_fin + 1 jour`.
- `PASSAGE_AUJOURDHUI` n'est lu que si `NODE_ENV !== "production"`.
- Lancement : fenêtre `ouvert` ET 3 confirmations `true` ET sauvegarde < 24 h ; puis `pg_dump` `prepassage-…` réussi ; sinon refus sans écriture.
- Sauvegardes : `BACKUP_DIR` (prod `/backups`), fichiers `cemas-AAAAMMJJ-HHMMSS.dump` et `prepassage-AAAAMMJJ-HHMMSS.dump`, format `-Fc`, vérifiés par `pg_restore -l`. `BACKUP_DIR` absent → aucune sauvegarde, lancement impossible.
- Binaire `pg_dump`/`pg_restore` : `PG_BIN_DIR` optionnel (dossier), sinon `PATH`.
- Décisions persistées : seulement `redouble` / `quitte` (absent = `passe`) ; supprimées après un passage réussi.
- Aucun email, aucune tâche planifiée.
- Worktree `/Users/yusper/Downloads/CEMAS-lot4b`, branche `feat/lot4b-encadrement-passage`. **Aucune écriture en production.**

## Review Focus

1. Dernier jour de l'année (`J = date_fin`) → encore `preparation`, lancement refusé ; lendemain → `ouvert`. Test : Task 1 (Vitest bornes).
2. Sauvegarde exactement de 24 h ou plus → bloquant ; dossier vide ou absent → bloquant avec message clair. Test : Task 1 (Vitest `sauvegardeRecente`) + Task 3 (e2e : contrôle rouge puis vert après « Faire une sauvegarde maintenant »).
3. `pg_dump` en échec (binaire absent, version) → aucun fichier partiel, passage non lancé, message lisible. Test : Task 3 (le service supprime le fichier `.tmp` ; e2e API avec `BACKUP_DIR` non inscriptible si possible, sinon vérification manuelle documentée dans le ledger).
4. Décisions enregistrées pour un élève devenu inactif → ignorées au rechargement (pas de blocage). Test : Task 2 (`chargerContexte` ne renvoie que les décisions d'élèves concernés).
5. Variable `PASSAGE_AUJOURDHUI` présente en production → ignorée. Test : Task 1 (Vitest `aujourdhuiServeur` avec `NODE_ENV=production`).

---

## File Structure

| Fichier | Rôle |
|---|---|
| Create `src/modules/academic/fenetre.ts` + `.test.ts` | `etatFenetrePassage`, `aujourdhuiServeur`, `sauvegardeRecente`, `choisirDerniereSauvegarde`, `libelleDateFr` |
| Modify `src/modules/academic/schema.ts` | table `passageDecisions` |
| Create `drizzle/migrations/0008_*.sql` | migration |
| Create `src/modules/academic/sauvegarde-service.ts` | `derniereSauvegarde`, `sauvegarder` |
| Modify `src/modules/academic/passage-service.ts` | décisions, contrôles, gardes d'exécution |
| Modify `src/modules/academic/validation.ts` | `executerPassageSchema` (+ confirmations), `enregistrerDecisionsSchema` |
| Modify `src/modules/academic/router.ts` | `passage.enregistrerDecisions`, `.controles`, `.sauvegarder` |
| Modify `src/modules/dashboard/router.ts` | `rappelPassage` |
| Modify `src/app/(dashboard)/academique/annees/passage/page.tsx` | étape 3 « Enregistrer », étape 5 |
| Modify `src/app/(dashboard)/academique/annees/page.tsx` | libellé du lien |
| Modify `src/app/(dashboard)/page.tsx` | bandeau |
| Modify `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` | client PG, volume, env CI |
| Modify `e2e/13-classe-suivante.spec.ts`, `e2e/14-passage.spec.ts` | tests |
| Modify `docs/02,03,04,05,16,19` | docs |

---

### Task 1: Fonctions pures de fenêtre et de sauvegarde

**Files:** Create `src/modules/academic/fenetre.ts`, `src/modules/academic/fenetre.test.ts`

**Interfaces — Produces:**
```ts
export type EtatFenetre = "aucun" | "preparation" | "ouvert";
export function etatFenetrePassage(dateFin: string, aujourdhui: string): { etat: EtatFenetre; ouverture: string; debutPreparation: string };
export function aujourdhuiServeur(env?: NodeJS.ProcessEnv, maintenant?: Date): string; // YYYY-MM-DD
export interface FichierSauvegarde { nom: string; mtime: Date; taille: number }
export function choisirDerniereSauvegarde(fichiers: FichierSauvegarde[]): FichierSauvegarde | null;
export function sauvegardeRecente(s: FichierSauvegarde | null, maintenant: Date, heures?: number): boolean; // < heures (défaut 24)
export function libelleDateFr(iso: string): string; // "1er août 2027"
```

- [ ] **Step 1: Failing tests** — `src/modules/academic/fenetre.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import {
	aujourdhuiServeur,
	choisirDerniereSauvegarde,
	etatFenetrePassage,
	libelleDateFr,
	sauvegardeRecente,
} from "./fenetre";

describe("etatFenetrePassage", () => {
	const fin = "2027-07-31";
	it("aucun avant le 15 juin", () => {
		expect(etatFenetrePassage(fin, "2027-06-14").etat).toBe("aucun");
	});
	it("préparation du 15 juin au dernier jour inclus", () => {
		expect(etatFenetrePassage(fin, "2027-06-15").etat).toBe("preparation");
		expect(etatFenetrePassage(fin, "2027-07-31").etat).toBe("preparation");
	});
	it("ouvert dès le lendemain de la fin", () => {
		expect(etatFenetrePassage(fin, "2027-08-01")).toEqual({
			etat: "ouvert",
			ouverture: "2027-08-01",
			debutPreparation: "2027-06-15",
		});
	});
	it("suit une date de fin différente", () => {
		expect(etatFenetrePassage("2027-06-30", "2027-07-01").etat).toBe("ouvert");
		expect(etatFenetrePassage("2027-06-30", "2027-06-30").etat).toBe("preparation");
	});
});

describe("aujourdhuiServeur", () => {
	const maintenant = new Date("2026-10-09T23:30:00Z");
	it("date UTC du jour", () => {
		expect(aujourdhuiServeur({ NODE_ENV: "development" }, maintenant)).toBe("2026-10-09");
	});
	it("PASSAGE_AUJOURDHUI hors production", () => {
		expect(aujourdhuiServeur({ NODE_ENV: "development", PASSAGE_AUJOURDHUI: "2027-08-01" }, maintenant)).toBe("2027-08-01");
	});
	it("PASSAGE_AUJOURDHUI ignoré en production", () => {
		expect(aujourdhuiServeur({ NODE_ENV: "production", PASSAGE_AUJOURDHUI: "2027-08-01" }, maintenant)).toBe("2026-10-09");
	});
	it("PASSAGE_AUJOURDHUI invalide ignoré", () => {
		expect(aujourdhuiServeur({ NODE_ENV: "test", PASSAGE_AUJOURDHUI: "demain" }, maintenant)).toBe("2026-10-09");
	});
});

describe("sauvegardes", () => {
	const f = (nom: string, iso: string) => ({ nom, mtime: new Date(iso), taille: 1000 });
	it("choisit la plus récente parmi cemas-* et prepassage-*", () => {
		expect(
			choisirDerniereSauvegarde([
				f("cemas-20271001-020000.dump", "2027-10-01T02:00:00Z"),
				f("prepassage-20271001-090000.dump", "2027-10-01T09:00:00Z"),
				f("autre.txt", "2027-10-02T00:00:00Z"),
				f("cemas-x.dump.tmp", "2027-10-02T00:00:00Z"),
			])?.nom,
		).toBe("prepassage-20271001-090000.dump");
	});
	it("aucune sauvegarde", () => {
		expect(choisirDerniereSauvegarde([])).toBeNull();
		expect(sauvegardeRecente(null, new Date())).toBe(false);
	});
	it("moins de 24 h : récente ; 24 h ou plus : non", () => {
		const maintenant = new Date("2027-08-02T02:00:00Z");
		expect(sauvegardeRecente(f("cemas-a.dump", "2027-08-01T02:00:01Z"), maintenant)).toBe(true);
		expect(sauvegardeRecente(f("cemas-a.dump", "2027-08-01T02:00:00Z"), maintenant)).toBe(false);
	});
});

describe("libelleDateFr", () => {
	it("1er et jours ordinaires", () => {
		expect(libelleDateFr("2027-08-01")).toBe("1er août 2027");
		expect(libelleDateFr("2027-06-15")).toBe("15 juin 2027");
	});
});
```
Run: `pnpm test` → FAIL (module absent).

- [ ] **Step 2: Implement** — `src/modules/academic/fenetre.ts` :
```ts
export type EtatFenetre = "aucun" | "preparation" | "ouvert";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function lendemain(iso: string): string {
	const d = new Date(`${iso}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + 1);
	return d.toISOString().slice(0, 10);
}

/** Fenêtre du passage d'année d'après la date de fin de l'année active. */
export function etatFenetrePassage(dateFin: string, aujourdhui: string) {
	const ouverture = lendemain(dateFin);
	const debutPreparation = `${dateFin.slice(0, 4)}-06-15`;
	const etat: EtatFenetre =
		aujourdhui >= ouverture ? "ouvert" : aujourdhui >= debutPreparation ? "preparation" : "aucun";
	return { etat, ouverture, debutPreparation };
}

/** Date du jour (UTC = Dakar). PASSAGE_AUJOURDHUI la remplace hors production (tests). */
export function aujourdhuiServeur(env: NodeJS.ProcessEnv = process.env, maintenant = new Date()): string {
	const forcee = env.PASSAGE_AUJOURDHUI;
	if (env.NODE_ENV !== "production" && forcee && /^\d{4}-\d{2}-\d{2}$/.test(forcee)) return forcee;
	return maintenant.toISOString().slice(0, 10);
}

export interface FichierSauvegarde {
	nom: string;
	mtime: Date;
	taille: number;
}

const MOTIF = /^(cemas|prepassage)-\d{8}-\d{6}\.dump$/;

export function choisirDerniereSauvegarde(fichiers: FichierSauvegarde[]): FichierSauvegarde | null {
	return (
		fichiers
			.filter((f) => MOTIF.test(f.nom))
			.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0] ?? null
	);
}

export function sauvegardeRecente(s: FichierSauvegarde | null, maintenant: Date, heures = 24): boolean {
	return !!s && maintenant.getTime() - s.mtime.getTime() < heures * 3600 * 1000;
}

/** « 1er août 2027 » */
export function libelleDateFr(iso: string): string {
	const [a, m, j] = iso.split("-").map(Number);
	return `${j === 1 ? "1er" : j} ${MOIS[m - 1]} ${a}`;
}
```
Note : les comparaisons de dates se font sur des chaînes `YYYY-MM-DD` (ordre lexical = ordre chronologique). Le test « moins de 24 h » sur `cemas-a.dump` passe car `sauvegardeRecente` ne filtre pas le nom.

- [ ] **Step 3: Run — expect PASS** : `pnpm test` ; `pnpm exec biome check --write src/modules/academic/fenetre*.ts`.

- [ ] **Step 4: Commit**
```bash
git add src/modules/academic/fenetre.ts src/modules/academic/fenetre.test.ts
git commit -m "feat(academic): rollover window and backup freshness helpers"
```

---

### Task 2: Décisions persistantes

**Files:** Modify `src/modules/academic/schema.ts`, `validation.ts`, `passage-service.ts`, `router.ts` ; Create `drizzle/migrations/0008_*.sql` ; Test `e2e/13-classe-suivante.spec.ts`

**Interfaces:**
- Produces: table `passageDecisions` ; `enregistrerDecisions(db, decisions: Record<string, "redouble" | "quitte">) → { count }` ; `chargerContexte` renvoie en plus `decisions: Record<string, "redouble" | "quitte">` (élèves concernés uniquement) et `fenetre: { etat, ouverture, debutPreparation }` ; tRPC `academic.passage.enregistrerDecisions`.

- [ ] **Step 1: Failing e2e** — ajouter dans `e2e/13-classe-suivante.spec.ts` (dans `describe`) :
```ts
	test("enregistrer des décisions et les retrouver", async ({ page }) => {
		const annees = await trpc<{ id: string; active: boolean }[]>(page, "academic.annees.list");
		const annee = annees.find((a) => a.active);
		if (!annee) throw new Error("Aucune année active");
		const { a } = await deuxClasses(page);
		const eleve = await trpc<{ id: string }>(page, "students.create", {
			prenom: "Decision", nom: `Persist${Date.now()}`, dateNaissance: "2016-01-01", sexe: "F",
			classeId: a.id, anneeScolaireId: annee.id,
			parent: { prenom: "P", nom: "D", telephone: "77 000 00 13", relation: "mere" },
		}, true);
		const r = await trpc<{ count: number }>(page, "academic.passage.enregistrerDecisions",
			{ decisions: { [eleve.id]: "redouble" } }, true);
		expect(r.count).toBe(1);
		const ctx = await trpc<{ decisions: Record<string, string>; fenetre: { etat: string } }>(page, "academic.passage.contexte");
		expect(ctx.decisions[eleve.id]).toBe("redouble");
		expect(["aucun", "preparation", "ouvert"]).toContain(ctx.fenetre.etat);
		await trpc(page, "academic.passage.enregistrerDecisions", { decisions: {} }, true);
		const vide = await trpc<{ decisions: Record<string, string> }>(page, "academic.passage.contexte");
		expect(vide.decisions[eleve.id]).toBeUndefined();
	});
```
Run: `pnpm exec playwright test e2e/13 -g "enregistrer des décisions" --reporter=line` → FAIL.

- [ ] **Step 2: Schema + migration** — `src/modules/academic/schema.ts` (importer `eleves` créerait une dépendance circulaire avec `students/schema.ts` qui importe `classes` : définir la FK par référence paresseuse) :
```ts
import { eleves } from "@/modules/students/schema";
// …
export const passageDecisions = pgTable("passage_decisions", {
	eleveId: uuid("eleve_id")
		.primaryKey()
		.references((): AnyPgColumn => eleves.id, { onDelete: "cascade" }),
	anneeScolaireId: uuid("annee_scolaire_id")
		.notNull()
		.references(() => anneesScolaires.id, { onDelete: "cascade" }),
	decision: varchar("decision", { length: 10 }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
```
Si l'import circulaire pose problème au chargement (`eleves` indéfini), placer la table dans `src/modules/students/schema.ts` (qui importe déjà `classes` et `anneesScolaires`) et l'exporter de là ; consigner le choix.
Run: `pnpm db:generate && pnpm db:migrate` → `0008_*.sql` crée `passage_decisions` avec 2 FK.

- [ ] **Step 3: Validation** — `validation.ts` :
```ts
export const enregistrerDecisionsSchema = z.object({
	decisions: z.record(z.string().uuid(), z.enum(["redouble", "quitte"])),
});
```

- [ ] **Step 4: Service** — dans `passage-service.ts` :
```ts
export async function enregistrerDecisions(database: Db, decisions: Record<string, "redouble" | "quitte">) {
	return database.transaction(async (tx) => {
		const source = await anneeActive(tx);
		const { elevesS } = await chargerDonnees(tx, source.id);
		const concernes = new Set(elevesS.map((e) => e.id));
		const lignes = Object.entries(decisions).filter(([id]) => concernes.has(id));
		await tx.delete(passageDecisions).where(eq(passageDecisions.anneeScolaireId, source.id));
		if (lignes.length) {
			await tx.insert(passageDecisions).values(
				lignes.map(([eleveId, decision]) => ({ eleveId, anneeScolaireId: source.id, decision })),
			);
		}
		return { count: lignes.length };
	});
}
```
Dans `chargerContexte`, après `chargerDonnees` :
```ts
	const concernes = new Set(elevesS.map((e) => e.id));
	const decisions = Object.fromEntries(
		(await database.select().from(passageDecisions).where(eq(passageDecisions.anneeScolaireId, source.id)))
			.filter((d) => concernes.has(d.eleveId))
			.map((d) => [d.eleveId, d.decision as "redouble" | "quitte"]),
	);
	const fenetre = etatFenetrePassage(source.dateFin, aujourdhuiServeur());
```
et ajouter `decisions, fenetre` à l'objet retourné. Dans `executerPassage`, juste avant l'activation de la cible :
```ts
		await tx.delete(passageDecisions).where(eq(passageDecisions.anneeScolaireId, source.id));
```

- [ ] **Step 5: Router** — `passage.enregistrerDecisions: protectedProcedure.input(enregistrerDecisionsSchema).mutation(({ ctx, input }) => enregistrerDecisions(ctx.db, input.decisions))`.

- [ ] **Step 6: Run — expect PASS** : `pnpm typecheck && pnpm exec playwright test e2e/13 --reporter=line`.

- [ ] **Step 7: Commit**
```bash
git add src/modules/academic drizzle/migrations e2e/13-classe-suivante.spec.ts
git commit -m "feat(academic): persist rollover decisions between June and August"
```

---

### Task 3: Sauvegardes depuis l'application et gardes d'exécution

**Files:** Create `src/modules/academic/sauvegarde-service.ts` ; Modify `passage-service.ts`, `validation.ts`, `router.ts`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `e2e/14-passage.spec.ts`

**Interfaces:**
- Consumes: `etatFenetrePassage`, `aujourdhuiServeur`, `choisirDerniereSauvegarde`, `sauvegardeRecente`, `libelleDateFr` (Task 1).
- Produces:
  - `derniereSauvegarde(): Promise<{ nom: string; date: string; taille: number } | null>` ; `sauvegarder(prefixe: "cemas" | "prepassage"): Promise<{ nom: string; taille: number }>`
  - `controlesPassage(db) → { fenetre, sauvegarde: {nom,date,taille}|null, sauvegardeRecente: boolean, totalImpayes: number, sauvegardesConfigurees: boolean }`
  - `executerPassage` exige `confirmations: { classes: true; decisions: true; grille: true }` et renvoie `+ sauvegardeAvantPassage: string`
  - tRPC `academic.passage.controles` (query), `academic.passage.sauvegarder` (mutation)

- [ ] **Step 1: Failing e2e** — dans `e2e/14-passage.spec.ts` (destructif) :
  - dans le test principal, remplacer l'étape « 4. Vérification → Lancer » par :
```ts
	await expect(page.getByRole("heading", { name: "4. Vérification" })).toBeVisible();
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
	await expect(page.getByText(/prepassage-\d{8}-\d{6}\.dump/)).toBeVisible();
```
  - dans `14b`, ajouter `confirmations: { classes: true, decisions: true, grille: true }` aux deux appels `executer`.
  - ajouter à la fin :
```ts
test("14c - Passage refusé avant la fin de l'année active", async ({ page }) => {
	await login(page);
	const ctx = await trpc<Ctx & { fenetre: { etat: string } }>(page, "academic.passage.contexte");
	expect(ctx.fenetre.etat).not.toBe("ouvert");
	await expect(
		trpc(page, "academic.passage.executer", {
			cible: { libelle: ctx.proposition.libelle, dateDebut: "2029-10-01", dateFin: "2030-07-31" },
			decisions: {},
			confirmations: { classes: true, decisions: true, grille: true },
		}, true),
	).rejects.toThrow(/disponible à partir du/i);
});
```
  (CI : `PASSAGE_AUJOURDHUI=2028-08-01` → 2026-2027 et 2027-2028 terminées ; après 14b l'année active finit le 31/07/2029 → 14c refusé.)
Run (base jetable, `BACKUP_DIR=$(mktemp -d)`, `PASSAGE_AUJOURDHUI=2028-08-01`, `PG_BIN_DIR` = client PG 17 local) → FAIL (étape 5 absente).

- [ ] **Step 2: Service sauvegarde** — `src/modules/academic/sauvegarde-service.ts` :
```ts
import { execFile } from "node:child_process";
import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { TRPCError } from "@trpc/server";
import { choisirDerniereSauvegarde } from "./fenetre";

const executer = promisify(execFile);
const bin = (nom: string) => (process.env.PG_BIN_DIR ? path.join(process.env.PG_BIN_DIR, nom) : nom);
const horodatage = (d = new Date()) => d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

export async function derniereSauvegarde() {
	const dossier = process.env.BACKUP_DIR;
	if (!dossier) return null;
	let noms: string[];
	try {
		noms = await readdir(dossier);
	} catch {
		return null;
	}
	const fichiers = await Promise.all(
		noms.map(async (nom) => {
			const s = await stat(path.join(dossier, nom));
			return { nom, mtime: s.mtime, taille: s.size };
		}),
	);
	const d = choisirDerniereSauvegarde(fichiers);
	return d ? { nom: d.nom, date: d.mtime.toISOString(), taille: d.taille } : null;
}

/** pg_dump -Fc de la base vers BACKUP_DIR, vérifié par pg_restore -l. */
export async function sauvegarder(prefixe: "cemas" | "prepassage") {
	const dossier = process.env.BACKUP_DIR;
	const url = process.env.DATABASE_URL;
	if (!dossier || !url) {
		throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Sauvegardes non configurées sur ce serveur." });
	}
	const fichier = path.join(dossier, `${prefixe}-${horodatage()}.dump`);
	const tmp = `${fichier}.tmp`;
	try {
		await executer(bin("pg_dump"), ["-Fc", "-f", tmp, url], { timeout: 300_000 });
		await executer(bin("pg_restore"), ["-l", tmp], { timeout: 60_000 });
		await rename(tmp, fichier);
	} catch (e) {
		await rm(tmp, { force: true });
		const detail = e instanceof Error ? e.message.split("\n")[0] : String(e);
		throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Échec de la sauvegarde : ${detail}` });
	}
	const s = await stat(fichier);
	return { nom: path.basename(fichier), taille: s.size };
}
```
Note : l'`errorFormatter` remplace les messages des erreurs `INTERNAL_SERVER_ERROR` qui ont une `cause` ; ici `TRPCError` est levée sans `cause`, le message est conservé. Vérifier en e2e (message « Échec de la sauvegarde » visible si `pg_dump` manque).

- [ ] **Step 3: Contrôles et gardes** — `validation.ts` :
```ts
export const executerPassageSchema = z.object({
	cible: z.object({
		libelle: z.string().trim().min(1, "Libellé requis").max(20),
		dateDebut: z.string().min(1),
		dateFin: z.string().min(1),
	}),
	decisions: decisionsSchema,
	confirmations: z.object({ classes: z.literal(true), decisions: z.literal(true), grille: z.literal(true) }),
});
```
`passage-service.ts` :
```ts
export async function controlesPassage(database: Db) {
	const source = await anneeActive(database);
	const fenetre = etatFenetrePassage(source.dateFin, aujourdhuiServeur());
	const sauvegarde = await derniereSauvegarde();
	const impayes = await getImpayes(database, source.id);
	return {
		fenetre,
		sauvegarde,
		sauvegardeRecente: sauvegardeRecente(
			sauvegarde ? { nom: sauvegarde.nom, mtime: new Date(sauvegarde.date), taille: sauvegarde.taille } : null,
			new Date(),
		),
		sauvegardesConfigurees: !!process.env.BACKUP_DIR,
		totalImpayes: impayes.totalReste,
	};
}
```
En tête de `executerPassage`, **avant** la transaction :
```ts
	const avant = await controlesPassage(database);
	if (avant.fenetre.etat !== "ouvert") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: `Passage disponible à partir du ${libelleDateFr(avant.fenetre.ouverture)}.`,
		});
	}
	if (!avant.sauvegardeRecente) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Aucune sauvegarde de moins de 24 h : faites une sauvegarde avant le passage." });
	}
	const sauvegardeAvantPassage = (await sauvegarder("prepassage")).nom;
```
puis la transaction existante, et ajouter `sauvegardeAvantPassage` à l'objet retourné. (Les confirmations sont garanties par zod.) Importer `getImpayes` depuis `@/modules/finance/impayes-service`.
Router :
```ts
	controles: protectedProcedure.query(({ ctx }) => controlesPassage(ctx.db)),
	sauvegarder: protectedProcedure.mutation(() => sauvegarder("cemas")),
```

- [ ] **Step 4: Infra** —
  - `Dockerfile`, stage `runner`, après `ENV NODE_ENV=production` : `RUN apk add --no-cache postgresql16-client`
  - `docker-compose.yml`, service `app` : sous `environment:` ajouter `BACKUP_DIR: /backups` ; ajouter
```yaml
    volumes:
      - cemas_backups:/backups
```
  - `.github/workflows/ci.yml`, job `e2e`, `env` : `PASSAGE_AUJOURDHUI: "2028-08-01"` et `BACKUP_DIR: /tmp/cemas-backups` ; step avant les tests : `- run: mkdir -p /tmp/cemas-backups && pg_dump --version`.

- [ ] **Step 5: UI minimale pour le test** — implémentée en Task 4 ; ce Step se termine par `pnpm typecheck` vert (le test e2e passera à la fin de Task 4).

- [ ] **Step 6: Commit**
```bash
git add src/modules/academic Dockerfile docker-compose.yml .github/workflows/ci.yml e2e/14-passage.spec.ts
git commit -m "feat(academic): backups from the app and rollover guards"
```

---

### Task 4: Assistant à 5 étapes, lien et bandeau

**Files:** Modify `src/app/(dashboard)/academique/annees/passage/page.tsx`, `src/app/(dashboard)/academique/annees/page.tsx`, `src/app/(dashboard)/page.tsx`, `src/modules/dashboard/router.ts`

**Interfaces:**
- Consumes: `passage.contexte` (`decisions`, `fenetre`), `passage.enregistrerDecisions`, `passage.controles`, `passage.sauvegarder`, `passage.executer` (avec `confirmations`) ; `libelleDateFr`.
- Produces: `dashboard.rappelPassage → { etat: EtatFenetre; ouverture: string; libelleSource: string; libelleCible: string; dateFin: string; classesAConfigurer: number } | null`.

- [ ] **Step 1: Assistant** — dans `passage/page.tsx` :
  - préchargement : dans l'initialisation unique (`initialise.current`), ajouter `setDecisions(ctx.data.decisions);`.
  - `Étape {etape} sur 4` → `sur 5`.
  - étape 3 : avant « Suivant », bouton
```tsx
							<Button
								variant="outline"
								disabled={enregistrer.isPending}
								onClick={() =>
									enregistrer.mutate({
										decisions: Object.fromEntries(
											Object.entries(decisions).filter(([, d]) => d !== "passe"),
										) as Record<string, "redouble" | "quitte">,
									})
								}
							>
								{enregistrer.isPending ? "Enregistrement..." : "Enregistrer les décisions"}
							</Button>
							{enregistrer.isSuccess && <span className="text-sm text-green-700">Décisions enregistrées</span>}
```
    avec `const enregistrer = trpc.academic.passage.enregistrerDecisions.useMutation({ onSuccess: () => utils.academic.passage.contexte.invalidate() });`
  - étape 4 : remplacer la note « Opération définitive… docs/19… » par rien, et le bouton « Lancer le passage » par `<Button disabled={!plan || plan.erreurs.length > 0} onClick={() => setEtape(5)}>Suivant</Button>`.
  - nouvelle étape 5 :
```tsx
				{etape === 5 && (
					<div className="space-y-6">
						<h2 className="text-lg font-semibold">5. Contrôles et lancement</h2>
						{controles.data && (
							<ul className="space-y-3 text-sm">
								<li className={controles.data.fenetre.etat === "ouvert" ? "text-green-700" : "text-red-700"}>
									{controles.data.fenetre.etat === "ouvert"
										? "Année terminée : le passage est possible."
										: `Passage disponible à partir du ${libelleDateFr(controles.data.fenetre.ouverture)}.`}
								</li>
								<li className={controles.data.sauvegardeRecente ? "text-green-700" : "text-red-700"}>
									{controles.data.sauvegarde
										? `Dernière sauvegarde : il y a ${ageLisible(controles.data.sauvegarde.date)} (${controles.data.sauvegarde.nom}, ${Math.round(controles.data.sauvegarde.taille / 1024)} Ko)`
										: controles.data.sauvegardesConfigurees
											? "Aucune sauvegarde trouvée."
											: "Sauvegardes non configurées sur ce serveur."}
									{!controles.data.sauvegardeRecente && " — une sauvegarde de moins de 24 h est requise."}{" "}
									<Button variant="ghost" size="sm" disabled={sauver.isPending} onClick={() => sauver.mutate()}>
										{sauver.isPending ? "Sauvegarde..." : "Faire une sauvegarde maintenant"}
									</Button>
									{sauver.error && <span className="ml-2 text-danger">{sauver.error.message}</span>}
								</li>
								<li className="text-gray-700">
									Impayés restants sur {ctx.data.source.libelle} : {formatCFA(controles.data.totalImpayes)}
								</li>
							</ul>
						)}
						<fieldset className="space-y-2 text-sm">
							<legend className="mb-1 font-medium">Avant de lancer</legend>
							{(
								[
									["classes", "Classes suivantes vérifiées"],
									["decisions", "Redoublants et départs décidés"],
									["grille", "Grille tarifaire de la nouvelle année revue"],
								] as const
							).map(([cle, libelle]) => (
								<label key={cle} className="flex items-center gap-2">
									<input type="checkbox" className="accent-primary" checked={coches[cle]}
										onChange={(e) => setCoches({ ...coches, [cle]: e.target.checked })} />
									{libelle}
								</label>
							))}
						</fieldset>
						<p className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-800">
							Opération définitive : l'année {ctx.data.source.libelle} sera archivée. Une sauvegarde est faite
							automatiquement juste avant le passage.
						</p>
						{executer.error && <p className="text-sm text-danger">{executer.error.message}</p>}
						<div className="flex gap-2">
							<Button variant="ghost" onClick={() => setEtape(4)}>Précédent</Button>
							<Button disabled={!pret} onClick={() => setConfirmer(true)}>Lancer le passage</Button>
						</div>
					</div>
				)}
```
    avec :
```tsx
	const controles = trpc.academic.passage.controles.useQuery(undefined, { enabled: etape === 5 });
	const sauver = trpc.academic.passage.sauvegarder.useMutation({ onSuccess: () => controles.refetch() });
	const [coches, setCoches] = useState({ classes: false, decisions: false, grille: false });
	const pret =
		!!controles.data &&
		controles.data.fenetre.etat === "ouvert" &&
		controles.data.sauvegardeRecente &&
		coches.classes && coches.decisions && coches.grille &&
		!!plan && plan.erreurs.length === 0;
	const ageLisible = (iso: string) => {
		const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
		return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
	};
```
    imports : `formatCFA` (`@/shared/lib/utils`), `libelleDateFr` (`@/modules/academic/fenetre`).
    `onConfirm` : `executer.mutate({ cible, decisions, confirmations: { classes: true, decisions: true, grille: true } })`.
    `preview` : `enabled: etape >= 4`.
  - écran de succès : ajouter « Sauvegarde avant passage : {r.sauvegardeAvantPassage} ».
  - en tête de page, si `ctx.data.fenetre.etat !== "ouvert"`, bandeau : « Préparation : le passage pourra être lancé à partir du {libelleDateFr(ouverture)}. Vous pouvez dès maintenant configurer les classes et enregistrer les décisions. »

- [ ] **Step 2: Lien de la page Années** — dans `annees/page.tsx`, requête `const fenetre = trpc.academic.passage.contexte.useQuery(undefined, { enabled: annees.some(a => a.active) });` et libellé du lien :
```tsx
{fenetre.data?.fenetre.etat === "ouvert"
	? "Passer à l'année suivante"
	: `Préparer le passage (ouverture le ${fenetre.data ? libelleDateFr(fenetre.data.fenetre.ouverture) : "…"})`}
```
  Le test 14 clique sur `getByRole("link", { name: /Passer à l'année suivante|Préparer le passage/ })` : mettre à jour cette ligne du test.

- [ ] **Step 3: `dashboard.rappelPassage`** — dans `src/modules/dashboard/router.ts` :
```ts
	rappelPassage: protectedProcedure.query(async ({ ctx }) => {
		const [annee] = await ctx.db.select().from(anneesScolaires).where(eq(anneesScolaires.active, true));
		if (!annee) return null;
		const { etat, ouverture } = etatFenetrePassage(annee.dateFin, aujourdhuiServeur());
		if (etat === "aucun") return null;
		const [{ total }] = await ctx.db
			.select({ total: count() })
			.from(classes)
			.where(and(eq(classes.anneeScolaireId, annee.id), eq(classes.finDeCycle, false), isNull(classes.classeSuivanteId)));
		const m = annee.libelle.match(/^(\d{4})\D+(\d{4})$/);
		return {
			etat,
			ouverture,
			dateFin: annee.dateFin,
			libelleSource: annee.libelle,
			libelleCible: m ? `${Number(m[1]) + 1}-${Number(m[2]) + 1}` : "l'année suivante",
			classesAConfigurer: total,
		};
	}),
```
  imports : `anneesScolaires` (academic/schema), `isNull` (drizzle-orm), `etatFenetrePassage, aujourdhuiServeur` (`@/modules/academic/fenetre`).

- [ ] **Step 4: Bandeau** — dans `src/app/(dashboard)/page.tsx`, après le bloc « Aucune année scolaire active » :
```tsx
			{rappel.data && (
				<div
					className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm ${
						rappel.data.etat === "ouvert" ? "bg-primary/10 text-primary" : "bg-orange-50 text-orange-800"
					}`}
				>
					<span>
						{rappel.data.etat === "ouvert"
							? `L'année ${rappel.data.libelleSource} est terminée : passez à l'année ${rappel.data.libelleCible}.`
							: `Fin d'année le ${libelleDateFr(rappel.data.dateFin)} : préparez le passage à ${rappel.data.libelleCible}${
									rappel.data.classesAConfigurer ? ` (${rappel.data.classesAConfigurer} classe(s) sans classe suivante)` : ""
								}, et saisissez les redoublants.`}
					</span>
					<Link href="/academique/annees/passage" className="font-medium underline">
						{rappel.data.etat === "ouvert" ? "Lancer le passage" : "Préparer"}
					</Link>
				</div>
			)}
```
  avec `const rappel = trpc.dashboard.rappelPassage.useQuery();` et import `libelleDateFr`.

- [ ] **Step 5: Run — expect PASS** : `pnpm typecheck && pnpm lint && pnpm test` ; e2e 13 ; e2e 14 sur base jetable (`CI=1 E2E_DESTRUCTIF=1 PASSAGE_AUJOURDHUI=2028-08-01 BACKUP_DIR=$(mktemp -d) PG_BIN_DIR=/usr/local/opt/postgresql@17/bin …`) → 3 passed ; un fichier `prepassage-*.dump` existe dans `BACKUP_DIR`.
  Vérifier aussi en dev (sans `PASSAGE_AUJOURDHUI`) : bandeau absent en octobre ; avec `PASSAGE_AUJOURDHUI=2027-06-20` : bandeau « Préparez ».

- [ ] **Step 6: Commit**
```bash
git add "src/app/(dashboard)" src/modules/dashboard e2e/14-passage.spec.ts
git commit -m "feat(academic): 5-step wizard with pre-flight checks, dashboard reminders"
```

---

### Task 5: Documentation et vérification complète

- [ ] **Step 1: Docs** — `02_features.md` (fenêtre, préparation persistante, contrôles, bandeaux) ; `03_data_model.md` (`passage_decisions`) ; `04_api_spec.md` (`passage.enregistrerDecisions|controles|sauvegarder`, `executer.confirmations`, `dashboard.rappelPassage`) ; `05_ui_spec.md` (étape 5, bandeau) ; `16_decisions.md` (D-020 : fenêtre après la fin d'année, contrôles bloquants, sauvegarde `prepassage`, pas d'email) ; `19_sauvegardes.md` (`prepassage-*`, volume monté dans l'application, bouton « Faire une sauvegarde maintenant ») ; `10_current_issues.md` / `11_rebuild_plan.md` / `17` (lot 4b livré).
- [ ] **Step 2: Vérification** — typecheck, lint, Vitest, build ; base jetable : suite e2e complète avec `E2E_DESTRUCTIF=1 PASSAGE_AUJOURDHUI=2028-08-01 BACKUP_DIR=… PG_BIN_DIR=…` → tout vert.
- [ ] **Step 3: Commit** `docs: rollover guard rails (lot 4b)`.

## Après le plan
PR → CI → fusion → déploiement. Vérifier en production (lecture seule) : `cemas-app-1` voit `/backups` (`ls /backups` dans la console de l'app), `pg_dump --version` = 16, migration 0008 appliquée, aucun bandeau sur le tableau de bord (octobre).
