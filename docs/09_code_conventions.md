# 09 - Conventions de code

## Langue

| Contexte | Langue |
|----------|--------|
| Variables, fonctions, noms de fichiers | Anglais |
| Labels UI, messages utilisateur, breadcrumbs | Français |
| Commentaires | Anglais (minimaux) |
| Noms de tables/colonnes PostgreSQL | Français (snake_case) |
| Noms des schémas Drizzle | Français camelCase |

### Exemples
```typescript
// Variable en anglais, label en français
const createMut = trpc.finance.depenses.create.useMutation();
<label>Montant (FCFA) *</label>

// Table en français snake_case, schéma en français camelCase
export const anneesScolaires = pgTable("annees_scolaires", { ... });
export const bulletinsPaie = pgTable("bulletins_paie", { ... });
```

---

## Structure des fichiers

### Organisation par module

Un module peut aussi contenir : `service.ts` / `*-service.ts` (accès base + appel des calculs), des fonctions **pures** de calcul (`bilan.ts`, `impayes.ts`, `capacite.ts`, `passage.ts`) avec leur `*.test.ts`, et `components/` (composants propres au module).
```
src/
├── app/                         # Routes Next.js (App Router)
│   ├── (auth)/                  # Route group : authentification
│   │   └── login/page.tsx
│   ├── (dashboard)/             # Route group : pages protégées
│   │   ├── page.tsx             # Dashboard
│   │   ├── academique/
│   │   ├── eleves/
│   │   ├── finances/
│   │   ├── payroll/
│   │   ├── transport/
│   │   └── parametres/
│   ├── globals.css
│   └── layout.tsx
├── modules/                     # Logique métier par domaine
│   ├── academic/
│   │   ├── schema.ts            # Tables Drizzle
│   │   ├── router.ts            # Procédures tRPC
│   │   └── validation.ts        # Schémas Zod
│   ├── auth/
│   │   └── schema.ts
│   ├── dashboard/
│   │   └── router.ts
│   ├── finance/
│   ├── payroll/
│   ├── settings/                # Paramètres de l'école (table à une ligne)
│   ├── students/
│   └── transport/
└── shared/                      # Code partagé
    ├── lib/
    │   ├── auth.ts              # Config Auth.js
    │   ├── db.ts                # Client Drizzle
    │   ├── root-router.ts       # Routeur tRPC racine
    │   ├── trpc.ts              # Init tRPC + contexte
    │   ├── trpc-client.ts       # Client tRPC React
    │   ├── utils.ts             # Utilitaires (formatCFA, formatDate, etc.)
    │   └── seed.ts              # Seed de la base
    ├── providers.tsx             # SessionProvider + TRPCProvider
    └── ui/                      # Composants UI réutilisables
        ├── button.tsx
        ├── confirm-dialog.tsx
        ├── data-table.tsx
        ├── empty-state.tsx
        ├── form-modal.tsx
        ├── index.ts
        ├── month-picker.tsx
        ├── page-header.tsx
        ├── print-layout.tsx
        ├── sidebar.tsx
        ├── stat-card.tsx
        └── status-badge.tsx
```

---

## Conventions TypeScript

### Types et interfaces
- Types préférés aux interfaces pour les objets simples
- Types en PascalCase avec suffixe contextuel : `RecetteRow`, `DepenseRow`
- Pas de préfixe `I` pour les interfaces

### Imports
- Alias `@/` pour `src/`
- Imports groupés : React, librairies externes, modules internes, UI

### Composants React
- Composants fonctionnels uniquement (pas de classes)
- `"use client"` explicite en haut de chaque page interactive
- Hooks au début du composant
- Pas de `useEffect` pour les données → tRPC `useQuery`

---

## Conventions tRPC

### Routeurs
- Un fichier `router.ts` par module
- Sous-routeurs pour les entités (ex: `finance.depenses`, `finance.recettes`)
- Toutes les procédures sont `protectedProcedure`, sauf `settings.public` (page de connexion)
- Logique métier non triviale : dans une fonction pure testée, appelée par un service ; le routeur reste mince
- Opération multi-tables : une seule transaction (`db.transaction`) ; ne pas appeler dans une transaction une lecture susceptible d'échouer (une erreur avorte la transaction)
- Erreurs volontaires : `TRPCError` avec message en français ; les erreurs zod remontent par champ (`data.zodError.fieldErrors`)
- Export nommé : `export const financeRouter = createTRPCRouter({...})`

### Nommage des procédures
| Action | Convention | Exemple |
|--------|-----------|---------|
| Liste | `list` | `employes.list` |
| Détail | `getById` | `students.getById` |
| Création | `create` | `depenses.create` |
| Mise à jour | `update` | `employes.update` |
| Suppression | `delete` | `vehicules.delete` |
| Spécial | verbe descriptif | `annees.setActive`, `bulletins.generate`, `bulletins.markPaid` |

---

## Conventions Drizzle

### Schémas
- Fichier `schema.ts` par module
- Tables en camelCase français : `anneesScolaires`, `bulletinsPaie`
- Colonnes en camelCase, mappées en snake_case SQL
- Relations définies dans le même fichier

### Requêtes
- `ctx.db.query.xxx.findMany()` pour les requêtes simples avec relations
- `ctx.db.select().from().where()` pour les requêtes complexes avec jointures
- Template tag `sql` pour les agrégations et sous-requêtes
- `COALESCE(SUM(...), 0)` pour les agrégations nullable

---

## Conventions Zod

- Un fichier `validation.ts` par module
- Schémas nommés : `create{Entity}Schema`, `update{Entity}Schema`
- Messages d'erreur en français
- UUID validés avec `z.string().uuid()`
- Montants : `z.number().int().positive()`

---

## Conventions CSS / Tailwind

- Classes Tailwind inline (pas de fichiers CSS séparés)
- Utilitaire `cn()` pour les classes conditionnelles
- Pas de `className` interpolé dynamiquement
- Classes d'impression : `no-print`, `print-only`

---

## Formatage et linting

- **Outil :** Biome 2.5 (`biome.json`) ; `pnpm lint` couvre `src/` et `e2e/`, `pnpm format` corrige
- Règles historiques en avertissement (dette) ; toute autre erreur bloque la CI
- Pas de config ESLint ni Prettier

---

## Tests

| Type | Outil | Emplacement | Commande |
|------|-------|-------------|----------|
| Unitaires (calculs purs, PDF) | Vitest | `src/**/*.test.ts` | `pnpm test` |
| Bout en bout | Playwright | `e2e/NN-*.spec.ts` | `pnpm exec playwright test "e2e/(0[1-9]\|[1-9][0-9])-"` |
| Typage | tsc | — | `pnpm typecheck` |

- **TDD** : écrire le test, le voir échouer pour la bonne raison, puis implémenter
- e2e : identifiants via `E2E_EMAIL` / `E2E_PASSWORD` (défaut : base locale) ; helper `trpc()` dans `e2e/helpers.ts` pour préparer les données par l'API
- e2e : cibler les champs dans la modale (`getByRole("dialog")`), utiliser la recherche des tableaux paginés, tolérer les doublons d'exécutions locales répétées (`.first()`)
- `e2e/00-*` : génération du guide (hors CI)
- Test **destructif** (`14-passage`) : uniquement si `E2E_DESTRUCTIF=1` (base jetable, CI)
- Avant une PR : reproduire la CI sur une base neuve (`cemas_ci` : migrate + seed + suite e2e complète)

---

## Git

- Messages de commit en anglais avec préfixe conventionnel : `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`, `style:`
- Une branche par lot (`feat/…`, `fix/…`, `docs/…`), de préférence dans un worktree séparé ; PR vers `main`
- La CI (typecheck, lint, Vitest, build, e2e sur base neuve) doit être verte avant la fusion
- La fusion dans `main` déclenche le déploiement automatique (sauvegarde, redéploiement Portainer, vérification) : voir `18_ci_cd.md`
- Ne jamais écrire dans la base de production en dehors du déploiement ; consultations en lecture seule

---

> Ce fichier est la source de vérité pour les conventions de code du projet CEMAS.
