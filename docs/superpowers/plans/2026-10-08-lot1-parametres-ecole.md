# Lot 1 — Paramètres de l'école Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'identité de l'établissement éditable (table `parametres_ecole`), renommer le produit « Gestion Ecole », et faire utiliser ces paramètres par l'affichage, les PDF, les emails et la génération des identifiants.

**Architecture:** Nouveau module `src/modules/settings/` (schema, validation, service, router). Une ligne unique (`id = 1`) créée par la migration. Le client lit via `trpc.settings.get` (cache React Query partagé) ; le serveur via `getParametres()` qui retombe sur les valeurs CEMAS si la ligne manque. Les séquences d'identifiants sont calculées par préfixe via un helper SQL commun.

**Tech Stack:** Next.js 16 (App Router), tRPC 11, Drizzle 0.45 + PostgreSQL, zod 4, jsPDF, Playwright, Biome.

**Spec:** `docs/superpowers/specs/2026-10-08-lot1-parametres-ecole-design.md`

## Global Constraints

- Nom du produit (fixe) : « Gestion Ecole ».
- Valeurs initiales (migration ET seed ET fallback) : nom `Complexe Educatif Mame Anta Sidibe`, sigle `CEMAS`, adresse `Quartier Zac Ba, Thies, Senegal`, telephone1 `77 300 08 31`, telephone2 `null`, email `admin@cemas.online`, contacts_entete `DG: M. Ndiour 77 300 08 31 | Dir. Elem.: M. Bass 77 521 37 19 | Dir. Presc.: Mme Cissokho 77 649 03 75`, préfixes `CEMAS` / `REC` / `EMP`.
- Préfixes : regex `^[A-Z0-9]{2,10}$` (pas de tiret).
- Formats : matricule élève `{P}-{AAAA}-{NNNN}`, reçu `{P}-{AAAA}-{NNNN}`, employé `{P}-{NNN}` ; colonnes `varchar(20)`.
- Les identifiants existants ne sont jamais modifiés.
- Pas de logo.
- Montants FCFA entiers ; code en tabulations (Biome) ; libellés UI en français.
- **Ne jamais exécuter de commande d'écriture sur la base de production.** Tout se fait sur la base locale (`.env.local`, `localhost:5432/cemas`).

## Review Focus

1. Base où la migration `0005` n'est pas appliquée → l'app doit continuer à fonctionner avec les valeurs CEMAS (fallback `getParametres`), pas planter sur la sidebar ni sur l'inscription. Test : Task 1 Step 6.
2. Identifiants existants au format production (`CEMAS-2026-0105`, `REC-2026-0161`) → le suivant doit être `…-0106` / `…-0162`, pas `…-0001` ni une collision. Test : Task 3 Step 1 (script SQL de contrôle).
3. Préfixe saisi en minuscules ou avec tiret (`ab-c`) → refus avec message, rien n'est enregistré. Test : Task 2 e2e.
4. Champs optionnels vidés (adresse, téléphones, contacts) → stockés `null`, lignes omises dans le reçu PDF et l'en-tête d'impression (pas de ligne vide ni « null »). Test : Task 4 Step 4 (contrôle manuel du PDF) + validation `emptyToNull`.
5. Page de connexion non authentifiée → `settings.public` répond sans session et n'expose que `nom` et `sigle`. Test : Task 4 e2e (contexte non connecté).

---

## File Structure

| Fichier | Rôle |
|---|---|
| Create `src/modules/settings/schema.ts` | Table Drizzle `parametres_ecole` |
| Create `src/modules/settings/defaults.ts` | Constante `PARAMETRES_DEFAUT` (valeurs initiales, source unique) |
| Create `src/modules/settings/validation.ts` | `updateParametresSchema` (zod) |
| Create `src/modules/settings/service.ts` | `getParametres(db)` avec fallback |
| Create `src/modules/settings/router.ts` | `settingsRouter` : `get`, `public`, `update` |
| Create `src/shared/lib/sequence.ts` | `nextSequence(db, table, column, pattern)` |
| Create `drizzle/migrations/0005_*.sql` | Table + CHECK + INSERT initial |
| Create `e2e/07-parametres.spec.ts` | Parcours Paramètres |
| Modify `src/shared/lib/db.ts`, `root-router.ts`, `seed.ts`, `utils.ts`, `mail.ts`, `generate-recu-pdf.ts` | |
| Modify `src/modules/students/router.ts`, `finance/router.ts`, `payroll/router.ts` | Préfixes configurables |
| Modify `src/app/layout.tsx`, `(auth)/login/page.tsx`, `(dashboard)/parametres/page.tsx`, `finances/paiements/page.tsx` | |
| Modify `src/shared/ui/sidebar.tsx`, `print-layout.tsx` | |
| Modify `Dockerfile` | Copier `src/modules/settings/schema.ts` et `defaults.ts` pour le seed |
| Modify `docs/02_features.md`, `03_data_model.md`, `04_api_spec.md`, `16_decisions.md` | |

---

### Task 1: Module settings (données + API)

**Files:**
- Create: `src/modules/settings/schema.ts`, `defaults.ts`, `validation.ts`, `service.ts`, `router.ts`
- Create: `drizzle/migrations/0005_*.sql` (généré puis complété)
- Modify: `src/shared/lib/db.ts`, `src/shared/lib/root-router.ts`, `src/shared/lib/seed.ts`, `Dockerfile`

**Interfaces:**
- Produces:
  - `parametresEcole` (table Drizzle), type `ParametresEcole = typeof parametresEcole.$inferSelect`
  - `type Parametres = Omit<ParametresEcole, "id" | "updatedAt">` et `PARAMETRES_DEFAUT: Parametres` (dans `defaults.ts`, ré-exporté par `service.ts`)
  - `getParametres(database: Pick<typeof db, "select">): Promise<Parametres>`
  - `updateParametresSchema` (zod), type `UpdateParametresInput`
  - tRPC : `settings.get` → objet complet ; `settings.public` → `{ nom: string; sigle: string }` ; `settings.update(input)` → ligne

- [ ] **Step 1: Mettre la base locale à jour**

La base locale n'a que la migration `0000`. Appliquer les migrations existantes (base locale uniquement) :

Run: `pnpm db:migrate`
Expected: migrations 0001 → 0004 appliquées. Vérifier : `set -a; . ./.env.local; set +a; psql "$DATABASE_URL" -c "select count(*) from drizzle.__drizzle_migrations"` → `5`.

- [ ] **Step 2: Créer `defaults.ts` et `schema.ts`**

`src/modules/settings/defaults.ts` :
```ts
import type { ParametresEcole } from "./schema";

export type Parametres = Omit<ParametresEcole, "id" | "updatedAt">;

export const PARAMETRES_DEFAUT: Parametres = {
	nom: "Complexe Educatif Mame Anta Sidibe",
	sigle: "CEMAS",
	adresse: "Quartier Zac Ba, Thies, Senegal",
	telephone1: "77 300 08 31",
	telephone2: null,
	email: "admin@cemas.online",
	contactsEntete:
		"DG: M. Ndiour 77 300 08 31 | Dir. Elem.: M. Bass 77 521 37 19 | Dir. Presc.: Mme Cissokho 77 649 03 75",
	prefixeMatricule: "CEMAS",
	prefixeRecu: "REC",
	prefixeEmploye: "EMP",
};
```

`src/modules/settings/schema.ts` :
```ts
import { pgTable, integer, varchar, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const parametresEcole = pgTable(
	"parametres_ecole",
	{
		id: integer("id").primaryKey().default(1),
		nom: varchar("nom", { length: 150 }).notNull(),
		sigle: varchar("sigle", { length: 30 }).notNull(),
		adresse: varchar("adresse", { length: 255 }),
		telephone1: varchar("telephone1", { length: 30 }),
		telephone2: varchar("telephone2", { length: 30 }),
		email: varchar("email", { length: 150 }),
		contactsEntete: text("contacts_entete"),
		prefixeMatricule: varchar("prefixe_matricule", { length: 10 }).notNull(),
		prefixeRecu: varchar("prefixe_recu", { length: 10 }).notNull(),
		prefixeEmploye: varchar("prefixe_employe", { length: 10 }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
	},
	(t) => [check("parametres_ecole_single_row", sql`${t.id} = 1`)],
);

export type ParametresEcole = typeof parametresEcole.$inferSelect;
```

- [ ] **Step 3: Générer et compléter la migration**

Run: `pnpm db:generate`
Expected: nouveau fichier `drizzle/migrations/0005_<nom>.sql` contenant `CREATE TABLE "parametres_ecole"` et la contrainte CHECK. Si la CHECK manque, l'ajouter dans le CREATE TABLE : `CONSTRAINT "parametres_ecole_single_row" CHECK ("parametres_ecole"."id" = 1)`.

Ajouter à la fin du fichier :
```sql
--> statement-breakpoint
INSERT INTO "parametres_ecole" ("id", "nom", "sigle", "adresse", "telephone1", "telephone2", "email", "contacts_entete", "prefixe_matricule", "prefixe_recu", "prefixe_employe")
VALUES (1, 'Complexe Educatif Mame Anta Sidibe', 'CEMAS', 'Quartier Zac Ba, Thies, Senegal', '77 300 08 31', NULL, 'admin@cemas.online', 'DG: M. Ndiour 77 300 08 31 | Dir. Elem.: M. Bass 77 521 37 19 | Dir. Presc.: Mme Cissokho 77 649 03 75', 'CEMAS', 'REC', 'EMP')
ON CONFLICT ("id") DO NOTHING;
```

Run: `pnpm db:migrate && psql "$DATABASE_URL" -c "select sigle, prefixe_recu from parametres_ecole"` (avec `.env.local` chargé)
Expected: une ligne `CEMAS | REC`.

Run: `psql "$DATABASE_URL" -c "insert into parametres_ecole (id,nom,sigle,prefixe_matricule,prefixe_recu,prefixe_employe) values (2,'x','x','AA','BB','CC')"`
Expected: ERROR violates check constraint `parametres_ecole_single_row`.

- [ ] **Step 4: `validation.ts` et `service.ts`**

`src/modules/settings/validation.ts` :
```ts
import { z } from "zod";

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.nullable()
		.transform((v) => (v ? v : null));

const prefixe = z
	.string()
	.trim()
	.regex(/^[A-Z0-9]{2,10}$/, "2 à 10 caractères : lettres majuscules et chiffres uniquement");

export const updateParametresSchema = z.object({
	nom: z.string().trim().min(2, "Nom requis").max(150),
	sigle: z.string().trim().min(1, "Sigle requis").max(30),
	adresse: optionalText(255),
	telephone1: optionalText(30),
	telephone2: optionalText(30),
	email: z
		.string()
		.trim()
		.optional()
		.nullable()
		.transform((v) => (v ? v : null))
		.pipe(z.email("Email invalide").nullable()),
	contactsEntete: optionalText(500),
	prefixeMatricule: prefixe,
	prefixeRecu: prefixe,
	prefixeEmploye: prefixe,
});

export type UpdateParametresInput = z.input<typeof updateParametresSchema>;
```

`src/modules/settings/service.ts` :
```ts
import { eq } from "drizzle-orm";
import type { db } from "@/shared/lib/db";
import { parametresEcole } from "./schema";
import { PARAMETRES_DEFAUT, type Parametres } from "./defaults";

export type { Parametres };

/** Lit la ligne unique ; retombe sur les valeurs par défaut si la table ou la ligne manque. */
export async function getParametres(database: Pick<typeof db, "select">): Promise<Parametres> {
	try {
		const [row] = await database.select().from(parametresEcole).where(eq(parametresEcole.id, 1));
		if (!row) return PARAMETRES_DEFAUT;
		const { id: _id, updatedAt: _u, ...rest } = row;
		return rest;
	} catch {
		return PARAMETRES_DEFAUT;
	}
}
```

- [ ] **Step 5: `router.ts`, enregistrement, `db.ts`, seed, Dockerfile**

`src/modules/settings/router.ts` :
```ts
import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/shared/lib/trpc";
import { parametresEcole } from "./schema";
import { updateParametresSchema } from "./validation";
import { getParametres } from "./service";

export const settingsRouter = createTRPCRouter({
	get: protectedProcedure.query(({ ctx }) => getParametres(ctx.db)),

	public: publicProcedure.query(async ({ ctx }) => {
		const { nom, sigle } = await getParametres(ctx.db);
		return { nom, sigle };
	}),

	update: protectedProcedure.input(updateParametresSchema).mutation(async ({ ctx, input }) => {
		const values = { ...input, updatedAt: new Date() };
		const [row] = await ctx.db
			.insert(parametresEcole)
			.values({ id: 1, ...values })
			.onConflictDoUpdate({ target: parametresEcole.id, set: values })
			.returning();
		return row;
	}),
});
```

`src/shared/lib/root-router.ts` : ajouter `import { settingsRouter } from "@/modules/settings/router";` et `settings: settingsRouter,` dans `appRouter`.

`src/shared/lib/db.ts` : ajouter `import * as settingsSchema from "@/modules/settings/schema";` et `...settingsSchema,` dans `schema`.

`src/shared/lib/seed.ts` : importer `parametresEcole` et `PARAMETRES_DEFAUT` (`@/modules/settings/defaults`), remplacer `nom: "Administrateur CEMAS"` par `nom: "Administrateur"`, et ajouter après l'étape 1 :
```ts
	// 1b. Paramètres de l'école (ligne unique)
	await db
		.insert(parametresEcole)
		.values({ id: 1, ...PARAMETRES_DEFAUT })
		.onConflictDoNothing();
```

`Dockerfile` : après la ligne qui copie `payroll/schema.ts`, ajouter :
```dockerfile
COPY --from=builder /app/src/modules/settings/schema.ts ./src/modules/settings/schema.ts
COPY --from=builder /app/src/modules/settings/defaults.ts ./src/modules/settings/defaults.ts
```

- [ ] **Step 6: Vérifier**

Run: `pnpm exec tsc --noEmit && pnpm db:seed`
Expected: aucune erreur TS ; seed sans erreur ; toujours une seule ligne dans `parametres_ecole`.

Fallback (Review Focus 1) — sur la base locale uniquement : `psql "$DATABASE_URL" -c "alter table parametres_ecole rename to parametres_ecole_tmp"`, lancer `pnpm dev`, se connecter, vérifier que le tableau de bord s'affiche sans erreur (les tâches suivantes afficheront le sigle « CEMAS » par fallback), puis `alter table parametres_ecole_tmp rename to parametres_ecole`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/settings drizzle/migrations src/shared/lib/db.ts src/shared/lib/root-router.ts src/shared/lib/seed.ts Dockerfile
git commit -m "feat(settings): add parametres_ecole table, API and seed"
```

---

### Task 2: Page Paramètres éditable

**Files:**
- Modify: `src/app/(dashboard)/parametres/page.tsx`
- Create: `src/modules/settings/components/parametres-form.tsx`
- Test: `e2e/07-parametres.spec.ts`

**Interfaces:**
- Consumes: `trpc.settings.get`, `trpc.settings.update`, `trpc.settings.public` (Task 1)
- Produces: formulaire dont les champs ont des `<label htmlFor>` : « Nom de l'établissement », « Sigle », « Adresse », « Téléphone 1 », « Téléphone 2 », « Email », « Ligne de contacts (en-têtes) », « Préfixe matricule élève », « Préfixe reçu », « Préfixe matricule employé » ; bouton « Enregistrer » ; message « Paramètres enregistrés ».

- [ ] **Step 1: Écrire le test e2e (échoue)**

`e2e/07-parametres.spec.ts` :
```ts
import { test, expect, type Page } from "@playwright/test";
import { login, waitForLoad } from "./helpers";

const ORIGINAL = { sigle: "CEMAS", prefixe: "CEMAS" };

async function setParametres(page: Page, sigle: string, prefixe: string) {
	await page.goto("/parametres");
	await waitForLoad(page);
	await page.getByLabel("Sigle").fill(sigle);
	await page.getByLabel("Préfixe matricule élève").fill(prefixe);
	await page.getByRole("button", { name: "Enregistrer" }).click();
	await expect(page.getByText("Paramètres enregistrés")).toBeVisible();
}

test.describe("07 - Paramètres de l'école", () => {
	test.beforeEach(async ({ page }) => {
		await login(page);
	});

	test.afterAll(async ({ browser }) => {
		const page = await browser.newPage();
		await login(page);
		await setParametres(page, ORIGINAL.sigle, ORIGINAL.prefixe);
		await page.close();
	});

	test("modifier le sigle met à jour la sidebar", async ({ page }) => {
		await setParametres(page, "ECOLETEST", "CEMAS");
		await expect(page.locator("aside").getByText("ECOLETEST")).toBeVisible();
	});

	test("refuser un préfixe invalide", async ({ page }) => {
		await page.goto("/parametres");
		await waitForLoad(page);
		await page.getByLabel("Préfixe matricule élève").fill("ab-c");
		await page.getByRole("button", { name: "Enregistrer" }).click();
		await expect(page.getByText(/majuscules et chiffres/)).toBeVisible();
		await page.reload();
		await waitForLoad(page);
		await expect(page.getByLabel("Préfixe matricule élève")).not.toHaveValue("ab-c");
	});
});
```

Vérifier que la sidebar est bien rendue dans un `<aside>` (`grep -n "<aside" src/shared/ui/sidebar.tsx`) ; sinon adapter le locator au conteneur réel.

- [ ] **Step 2: Lancer le test — échec attendu**

Run: `pnpm exec playwright test e2e/07-parametres.spec.ts`
Expected: FAIL (champ « Sigle » introuvable).

- [ ] **Step 3: Composant formulaire**

`src/modules/settings/components/parametres-form.tsx` :
```tsx
"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/shared/lib/trpc-client";
import { Button } from "@/shared/ui";

const INPUT =
	"w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type FormState = {
	nom: string;
	sigle: string;
	adresse: string;
	telephone1: string;
	telephone2: string;
	email: string;
	contactsEntete: string;
	prefixeMatricule: string;
	prefixeRecu: string;
	prefixeEmploye: string;
};

const FIELDS: { key: keyof FormState; label: string; type?: string; upper?: boolean }[] = [
	{ key: "nom", label: "Nom de l'établissement" },
	{ key: "sigle", label: "Sigle" },
	{ key: "adresse", label: "Adresse" },
	{ key: "telephone1", label: "Téléphone 1", type: "tel" },
	{ key: "telephone2", label: "Téléphone 2", type: "tel" },
	{ key: "email", label: "Email", type: "email" },
	{ key: "contactsEntete", label: "Ligne de contacts (en-têtes)" },
	{ key: "prefixeMatricule", label: "Préfixe matricule élève" },
	{ key: "prefixeRecu", label: "Préfixe reçu" },
	{ key: "prefixeEmploye", label: "Préfixe matricule employé" },
];

export function ParametresForm() {
	const utils = trpc.useUtils();
	const parametres = trpc.settings.get.useQuery();
	const [form, setForm] = useState<FormState | null>(null);
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		if (parametres.data && !form) {
			const d = parametres.data;
			setForm({
				nom: d.nom,
				sigle: d.sigle,
				adresse: d.adresse ?? "",
				telephone1: d.telephone1 ?? "",
				telephone2: d.telephone2 ?? "",
				email: d.email ?? "",
				contactsEntete: d.contactsEntete ?? "",
				prefixeMatricule: d.prefixeMatricule,
				prefixeRecu: d.prefixeRecu,
				prefixeEmploye: d.prefixeEmploye,
			});
		}
	}, [parametres.data, form]);

	const update = trpc.settings.update.useMutation({
		onSuccess: () => {
			setSaved(true);
			utils.settings.get.invalidate();
			utils.settings.public.invalidate();
		},
	});

	if (!form) return <p className="text-sm text-muted">Chargement...</p>;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!form) return;
		setSaved(false);
		update.mutate(form);
	}

	const fieldErrors = update.error?.data?.zodError?.fieldErrors as
		| Record<string, string[] | undefined>
		| undefined;

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				{FIELDS.map((f) => (
					<div key={f.key} className={f.key === "nom" || f.key === "contactsEntete" ? "sm:col-span-2" : ""}>
						<label htmlFor={`param-${f.key}`} className="mb-1 block text-sm font-medium">
							{f.label}
						</label>
						<input
							id={`param-${f.key}`}
							type={f.type ?? "text"}
							value={form[f.key]}
							onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
							className={INPUT}
						/>
						{fieldErrors?.[f.key]?.[0] && (
							<p className="mt-1 text-xs text-danger">{fieldErrors[f.key]?.[0]}</p>
						)}
					</div>
				))}
			</div>
			<p className="text-xs text-muted">
				Les préfixes s'appliquent aux nouveaux identifiants uniquement ; les identifiants existants ne changent pas.
			</p>
			{update.error && !fieldErrors && <p className="text-sm text-danger">{update.error.message}</p>}
			{saved && <p className="text-sm text-success">Paramètres enregistrés</p>}
			<Button type="submit" disabled={update.isPending}>
				{update.isPending ? "Enregistrement..." : "Enregistrer"}
			</Button>
		</form>
	);
}
```

Vérifier la forme des erreurs zod dans l'`errorFormatter` (`src/shared/lib/trpc.ts`) : il ne renvoie pas `zodError`. Ajouter dans la branche par défaut de `errorFormatter` :
```ts
			data: {
				...shape.data,
				stack: undefined,
				zodError:
					error.code === "BAD_REQUEST" && error.cause instanceof ZodError
						? z.flattenError(error.cause)
						: null,
			},
```
avec `import { ZodError, z } from "zod";`. Si `text-success` n'existe pas dans `globals.css`, utiliser `text-green-600`.

- [ ] **Step 4: Intégrer dans la page**

Dans `src/app/(dashboard)/parametres/page.tsx` :
- ajouter `const parametres = trpc.settings.get.useQuery();` ;
- StatCard « École » : `value={parametres.data?.sigle ?? "—"}` ;
- insérer en tête de la colonne `max-w-2xl` :
```tsx
				<div className="rounded-xl bg-surface p-6 shadow-sm">
					<h2 className="mb-4 text-lg font-semibold">Établissement</h2>
					<ParametresForm />
				</div>
```
avec `import { ParametresForm } from "@/modules/settings/components/parametres-form";` ;
- « À propos » : Application → `Gestion Ecole` ; Établissement → `{parametres.data?.nom ?? "—"}`.

- [ ] **Step 5: Lancer le test — le cas « préfixe invalide » doit passer**

Run: `pnpm exec playwright test e2e/07-parametres.spec.ts`
Expected: « refuser un préfixe invalide » PASS ; « modifier le sigle met à jour la sidebar » FAIL (sidebar encore en dur — corrigé en Task 4).

- [ ] **Step 6: Commit**

```bash
git add src/modules/settings/components "src/app/(dashboard)/parametres/page.tsx" src/shared/lib/trpc.ts e2e/07-parametres.spec.ts
git commit -m "feat(settings): editable school settings form"
```

---

### Task 3: Préfixes configurables pour les identifiants

**Files:**
- Create: `src/shared/lib/sequence.ts`
- Modify: `src/shared/lib/utils.ts:23-29`, `src/modules/students/router.ts:100-121`, `src/modules/finance/router.ts:89-109`, `src/modules/payroll/router.ts:39-57`
- Test: `e2e/07-parametres.spec.ts` (ajout), script SQL de contrôle

**Interfaces:**
- Consumes: `getParametres` (Task 1)
- Produces:
  - `nextSequence(database: Pick<typeof db, "select">, table: PgTable, column: AnyPgColumn, pattern: string): Promise<number>`
  - `generateRecuNumber(prefix: string, year: number, seq: number): string`
  - `generateEmployeMatricule(prefix: string, seq: number): string`

- [ ] **Step 1: Contrôle de non-régression (Review Focus 2) — écrire la vérification**

Sur la base locale, insérer des identifiants au format production pour contrôler la reprise de séquence (dans une transaction annulée à la fin du test manuel ; on utilise seulement des `SELECT` sur la fonction SQL) :
```bash
psql "$DATABASE_URL" -c "select max(substring(v from '^CEMAS-2026-(\d+)\$')::int) from (values ('CEMAS-2026-0105'),('CEMAS-2026-0099'),('REC-2026-0161'),('CEMASX-2026-0999')) t(v)"
```
Expected: `105` (le préfixe `CEMASX` et `REC` sont ignorés ; tri numérique, pas lexical).

- [ ] **Step 2: Ajouter le test e2e matricule (échoue)**

Dans `e2e/07-parametres.spec.ts`, ajouter dans le `describe` :
```ts
	test("un nouvel élève utilise le préfixe configuré", async ({ page }) => {
		await setParametres(page, "CEMAS", "TSTE2E");

		await page.goto("/eleves/nouveau");
		await waitForLoad(page);
		await page.locator('input[type="text"]').first().fill("Prefixe");
		await page.locator('input[type="text"]').nth(1).fill("Test");
		await page.locator('input[type="date"]').first().fill("2016-01-10");
		await page.getByLabel("Masculin").check();
		await page.getByRole("button", { name: /Suivant/i }).click();

		await page.locator('input[type="text"]').first().fill("Parent");
		await page.locator('input[type="text"]').nth(1).fill("Test");
		await page.locator('input[type="tel"]').first().fill("77 000 00 00");
		await page.getByRole("button", { name: /Suivant/i }).click();

		await page.locator("select").first().selectOption({ index: 1 });
		await page.waitForTimeout(500);
		await page.locator("select").nth(1).selectOption({ index: 1 });
		await page.getByRole("button", { name: /Inscrire/i }).click();
		await page.waitForURL(/\/eleves\//, { timeout: 15_000 });

		await expect(page.getByText(/TSTE2E-\d{4}-\d{4}/)).toBeVisible();
	});
```
Vérifier que le libellé du radio est bien « Masculin » (`grep -n "Masculin" "src/app/(dashboard)/eleves/nouveau/page.tsx"`) et que la page profil affiche le matricule (`grep -n matricule "src/app/(dashboard)/eleves/[id]/page.tsx"`).

Run: `pnpm exec playwright test e2e/07-parametres.spec.ts -g "préfixe configuré"`
Expected: FAIL (matricule `CEMAS-…`).

- [ ] **Step 3: Helper de séquence et générateurs**

`src/shared/lib/sequence.ts` :
```ts
import { sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { db } from "./db";

/**
 * Prochain numéro de séquence parmi les valeurs de `column` qui correspondent à `pattern`
 * (regex PostgreSQL avec un groupe capturant les chiffres). Comparaison numérique.
 */
export async function nextSequence(
	database: Pick<typeof db, "select">,
	table: PgTable,
	column: AnyPgColumn,
	pattern: string,
): Promise<number> {
	const [row] = await database
		.select({ max: sql<number | null>`MAX(substring(${column} from ${pattern})::int)` })
		.from(table);
	return Number(row?.max ?? 0) + 1;
}
```

`src/shared/lib/utils.ts` : remplacer les deux fonctions par
```ts
export function generateRecuNumber(prefix: string, year: number, seq: number): string {
	return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateEmployeMatricule(prefix: string, seq: number): string {
	return `${prefix}-${String(seq).padStart(3, "0")}`;
}
```

- [ ] **Step 4: Utiliser les préfixes dans les trois routeurs**

`src/modules/students/router.ts` (dans `create`, transaction `tx`) — remplacer le bloc « Get next sequence number » jusqu'à `generateMatricule("CEMAS", …)` par :
```ts
			const { prefixeMatricule } = await getParametres(tx);
			const seq = await nextSequence(tx, eleves, eleves.matricule, `^${prefixeMatricule}-${year}-(\\d+)$`);
			const matricule = generateMatricule(prefixeMatricule, year, seq);
```
Imports : `getParametres` (`@/modules/settings/service`), `nextSequence` (`@/shared/lib/sequence`) ; retirer `ilike` s'il n'est plus utilisé.

`src/modules/finance/router.ts` `paiements.create` — remplacer les lignes 92-109 par :
```ts
			const year = new Date().getFullYear();
			const { prefixeRecu } = await getParametres(ctx.db);
			const seq = await nextSequence(ctx.db, paiements, paiements.numeroRecu, `^${prefixeRecu}-${year}-(\\d+)$`);
			const numeroRecu = generateRecuNumber(prefixeRecu, year, seq);
```

`src/modules/payroll/router.ts` `create` — remplacer lignes 42-57 par :
```ts
			const { prefixeEmploye } = await getParametres(ctx.db);
			const seq = await nextSequence(ctx.db, employes, employes.matricule, `^${prefixeEmploye}-(\\d+)$`);
			const matricule = generateEmployeMatricule(prefixeEmploye, seq);
```
Retirer `desc` des imports s'il n'est plus utilisé.

- [ ] **Step 5: Vérifier**

Run: `pnpm exec tsc --noEmit && pnpm exec playwright test e2e/07-parametres.spec.ts -g "préfixe configuré"`
Expected: PASS.

Puis créer un paiement et un employé via l'UI locale avec les préfixes par défaut : le reçu suit le plus grand `REC-{année}-NNNN` existant, l'employé `EMP-001` (ou suivant).

Run: `pnpm exec playwright test e2e/03-eleves.spec.ts e2e/04-payroll.spec.ts e2e/05-finances.spec.ts`
Expected: pas de nouvel échec par rapport à `main` (noter les échecs préexistants s'il y en a).

- [ ] **Step 6: Commit**

```bash
git add src/shared/lib/sequence.ts src/shared/lib/utils.ts src/modules/students/router.ts src/modules/finance/router.ts src/modules/payroll/router.ts e2e/07-parametres.spec.ts
git commit -m "feat(settings): configurable prefixes for matricules and receipts"
```

---

### Task 4: Affichage — produit « Gestion Ecole » et identité de l'école

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/shared/ui/sidebar.tsx`, `src/shared/ui/print-layout.tsx`, `src/shared/lib/generate-recu-pdf.ts`, `src/app/(dashboard)/finances/paiements/page.tsx`, `src/shared/lib/mail.ts`
- Test: `e2e/07-parametres.spec.ts`

**Interfaces:**
- Consumes: `trpc.settings.get`, `trpc.settings.public`, `getParametres`, type `Parametres` (Task 1)
- Produces: `generateRecuPdf(data: RecuData, ecole: Parametres)` — réutilisé par les lots 2 et 3 (en-tête PDF).

- [ ] **Step 1: Test page de connexion (échoue)**

Ajouter dans `e2e/07-parametres.spec.ts`, **hors** du `describe` (pas de `beforeEach` login) :
```ts
test("page de connexion : produit Gestion Ecole et nom de l'école", async ({ page }) => {
	await page.goto("/login");
	await expect(page).toHaveTitle(/Gestion Ecole/);
	await expect(page.getByRole("heading", { name: "Gestion Ecole" })).toBeVisible();
	await expect(page.getByText("Complexe Educatif Mame Anta Sidibe")).toBeVisible();
});
```
Run: `pnpm exec playwright test e2e/07-parametres.spec.ts -g "connexion"`
Expected: FAIL (titre « CEMAS — Gestion Scolaire »).

- [ ] **Step 2: Titre, login, sidebar, impression**

`src/app/layout.tsx` :
```ts
export const metadata: Metadata = {
	title: "Gestion Ecole",
	description: "Gestion scolaire",
};
```

`src/app/(auth)/login/page.tsx` : ajouter `import { trpc } from "@/shared/lib/trpc-client";`, `const ecole = trpc.settings.public.useQuery();` dans le composant, et remplacer les lignes 41-42 par :
```tsx
				<h1 className="text-2xl font-bold text-primary">Gestion Ecole</h1>
				<p className="text-sm text-muted">{ecole.data?.nom ?? " "}</p>
```
Vérifier que `Providers` (tRPC) englobe bien la route `(auth)` : `src/app/layout.tsx` l'applique à tout l'arbre — OK.

`src/shared/ui/sidebar.tsx` : ajouter `import { trpc } from "@/shared/lib/trpc-client";`, `const parametres = trpc.settings.get.useQuery();` dans le composant, et remplacer lignes 129-130 par :
```tsx
							<h1 className="text-lg font-bold">{parametres.data?.sigle ?? " "}</h1>
							<p className="text-xs text-white/60">Gestion Ecole</p>
```

`src/shared/ui/print-layout.tsx` :
```tsx
"use client";

import { trpc } from "@/shared/lib/trpc-client";

interface PrintLayoutProps {
	children: React.ReactNode;
}

export function PrintLayout({ children }: PrintLayoutProps) {
	const { data: ecole } = trpc.settings.get.useQuery();
	const telephones = [ecole?.telephone1, ecole?.telephone2].filter(Boolean).join(" / ");
	return (
		<div className="print-only">
			<div className="mb-6 border-b pb-4 text-center">
				<h1 className="text-xl font-bold">
					{ecole ? `${ecole.sigle} - ${ecole.nom}` : ""}
				</h1>
				{ecole?.adresse && <p className="text-sm">{ecole.adresse}</p>}
				{telephones && <p className="text-sm">Tél. : {telephones}</p>}
			</div>
			{children}
		</div>
	);
}
```

- [ ] **Step 3: Reçu PDF et email**

`src/shared/lib/generate-recu-pdf.ts` : ajouter `import type { Parametres } from "@/modules/settings/service";`, changer la signature en `export function generateRecuPdf(data: RecuData, ecole: Parametres)` et remplacer le bloc « Header » + « Contacts » (lignes ~49-64) par :
```ts
	// ── Header ──
	doc.setFontSize(20);
	doc.setFont("helvetica", "bold");
	doc.setTextColor(PRIMARY.r, PRIMARY.g, PRIMARY.b);
	doc.text(ecole.sigle, pageWidth / 2, y, { align: "center" });
	y += 7;
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	doc.setTextColor(80, 80, 80);
	doc.text(ecole.nom, pageWidth / 2, y, { align: "center" });
	y += 4;
	if (ecole.adresse) {
		doc.text(ecole.adresse, pageWidth / 2, y, { align: "center" });
		y += 4;
	}
	const coordonnees = [ecole.telephone1, ecole.telephone2, ecole.email].filter(Boolean).join(" | ");
	if (coordonnees) {
		doc.text(coordonnees, pageWidth / 2, y, { align: "center" });
		y += 4;
	}
	y += 2;

	// ── Contacts ──
	if (ecole.contactsEntete) {
		doc.setFontSize(7);
		doc.setTextColor(100, 100, 100);
		doc.text(ecole.contactsEntete, pageWidth / 2, y, { align: "center", maxWidth: pageWidth - 2 * margin });
		y += 6;
	}
```
Rechercher d'autres textes en dur dans le fichier (`grep -n "CEMAS\|Mame\|Thies" src/shared/lib/generate-recu-pdf.ts`) et les remplacer par `ecole.*`.

`src/app/(dashboard)/finances/paiements/page.tsx` : ajouter `const parametres = trpc.settings.get.useQuery();` ; dans `handleDownloadRecu`, remplacer `if (data) {` par `if (data && parametres.data) {` et `generateRecuPdf(data);` par `generateRecuPdf(data, parametres.data);`.

`src/shared/lib/mail.ts` :
```ts
import { db } from "./db";
import { getParametres } from "@/modules/settings/service";
// …
export async function sendMail({ to, subject, html }: SendMailOptions) {
	const { sigle } = await getParametres(db);
	return transporter.sendMail({
		from: `"${sigle.replace(/"/g, "")}" <${process.env.SMTP_USER}>`,
		to,
		subject,
		html,
	});
}
```

- [ ] **Step 4: Vérifier**

Run: `grep -rn "CEMAS" src --include=*.ts --include=*.tsx`
Expected: seulement `src/modules/settings/defaults.ts` (et aucune autre occurrence).

Run: `pnpm exec tsc --noEmit && pnpm exec playwright test e2e/07-parametres.spec.ts`
Expected: les 4 tests PASS ; après le run, `select sigle, prefixe_matricule from parametres_ecole` → `CEMAS | CEMAS`.

Manuel (Review Focus 4) : dans Paramètres, vider Adresse, Téléphone 2 et Ligne de contacts, enregistrer ; télécharger un reçu depuis Finances → Paiements : pas de ligne vide ni « null » dans l'en-tête ; restaurer les valeurs.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx "src/app/(auth)/login/page.tsx" src/shared/ui/sidebar.tsx src/shared/ui/print-layout.tsx src/shared/lib/generate-recu-pdf.ts "src/app/(dashboard)/finances/paiements/page.tsx" src/shared/lib/mail.ts e2e/07-parametres.spec.ts
git commit -m "feat(settings): rename product to Gestion Ecole and use school settings everywhere"
```

---

### Task 5: Documentation, lint, build

**Files:**
- Modify: `docs/02_features.md`, `docs/03_data_model.md`, `docs/04_api_spec.md`, `docs/16_decisions.md`

- [ ] **Step 1: Docs**

- `02_features.md` : section Paramètres → « Édition des informations de l'établissement (nom, sigle, adresse, téléphones, email, ligne de contacts) et des préfixes d'identifiants. Produit : Gestion Ecole. »
- `03_data_model.md` : table `parametres_ecole` (colonnes et contraintes de la spec § 3).
- `04_api_spec.md` : routeur `settings` (`get` protected, `public` public → `{nom, sigle}`, `update` protected + règles zod).
- `16_decisions.md` : ajouter, au format des entrées existantes, les décisions datées 2026-10-08 : nom de produit « Gestion Ecole » ; pas de logo pour l'instant ; séquences d'identifiants calculées par préfixe (et par année pour matricules/reçus) ; fallback des paramètres sur les valeurs CEMAS si la ligne manque.

- [ ] **Step 2: Lint et build**

Run: `pnpm lint && pnpm build`
Expected: aucune erreur. Corriger avec `pnpm format` si besoin (uniquement les fichiers de ce lot).

- [ ] **Step 3: Commit**

```bash
git add docs/02_features.md docs/03_data_model.md docs/04_api_spec.md docs/16_decisions.md
git commit -m "docs: document school settings (lot 1)"
```

(Les fichiers `docs/0x` sont actuellement non suivis par git ; `git add` les ajoute — normal.)

---

## Après le plan (hors exécution automatique)

Déploiement en production **uniquement sur accord explicite de l'utilisateur**. Vérification post-déploiement en lecture seule : `select * from parametres_ecole;` → ligne CEMAS ; prochain reçu `REC-2026-0162`, prochain matricule `CEMAS-2026-0106`.
