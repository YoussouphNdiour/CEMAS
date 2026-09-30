# CEMAS School Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight single-school management app for the CEMAS director, covering academic setup, student enrollment, finances, transport, and payroll.

**Architecture:** Next.js 15 monolithic modular app with tRPC v11 API layer. Each domain module (academic, students, finance, transport, payroll) is self-contained with its own Drizzle schema, tRPC router, and React components. Auth.js v5 protects all dashboard routes with JWT-based single-user login.

**Tech Stack:** Next.js 15, tRPC v11, Drizzle ORM, PostgreSQL 16, Auth.js v5, Tailwind CSS v4, Recharts, Zod, Biome, pnpm, Docker

**Spec:** `docs/superpowers/specs/2026-09-30-cemas-school-management-design.md`

## Global Constraints

- Node.js 20+, PostgreSQL 16, pnpm 9+
- All code variables/functions in English, all UI labels in French
- Amounts stored as `integer` (FCFA, no decimals), formatted with `Intl.NumberFormat('fr-SN')`
- Dates stored as UTC `timestamptz`, displayed as `dd/MM/yyyy`
- All IDs are `uuid` via `gen_random_uuid()`
- Validation: Zod schemas shared between client and server, one per module
- Formatting: Biome with tabs and double quotes
- Colors: primary `#665d9d`, secondary `#fbc616`, bg `#f8f9fa`, text `#1a1a1a`
- Single user (directeur), no RBAC
- French only, no i18n framework

## Review Focus

1. **Empty database on first load:** Dashboard KPI queries must handle zero rows gracefully (no division by zero for recouvrement %, no NaN).
2. **Duplicate payment for same student/month/type:** The unique constraint `(eleve_id, type_frais_id, annee_scolaire_id, mois)` must produce a user-friendly French error, not a raw Postgres error.
3. **Year switch mid-session:** Changing the active `annee_scolaire` in the header must immediately scope all data (students, payments, classes) without stale cache.
4. **Receipt number sequence gaps:** `REC-{year}-{seq}` generation must be atomic (no race conditions) and monotonically increasing even after deletions.
5. **Net pay calculation:** `net_a_payer = salaire_base + primes - retenues` must be enforced server-side; client-sent values must be recomputed before insert.

---

### Task 1: Project Scaffolding & Configuration

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Create: `.env.local`
- Create: `.gitignore`
- Create: `src/app/layout.tsx` (minimal root layout)
- Create: `src/app/page.tsx` (redirect to /login)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a working `pnpm dev` that shows a blank page at localhost:3000

- [ ] **Step 1: Initialize project**

```bash
cd /Users/yusper/Downloads/CEMAS
pnpm init
pnpm add next@latest react@latest react-dom@latest
pnpm add -D typescript @types/react @types/react-dom @types/node
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Install all dependencies**

```bash
# Core
pnpm add @trpc/server@next @trpc/client@next @trpc/next@next @trpc/react-query@next @tanstack/react-query
pnpm add drizzle-orm postgres
pnpm add next-auth@beta @auth/drizzle-adapter
pnpm add zod
pnpm add lucide-react recharts
pnpm add bcrypt
pnpm add -D @types/bcrypt

# Dev
pnpm add -D drizzle-kit
pnpm add -D tailwindcss @tailwindcss/postcss postcss
pnpm add -D @biomejs/biome
pnpm add -D tsx
```

- [ ] **Step 4: Create `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["bcrypt"],
};

export default nextConfig;
```

- [ ] **Step 5: Create `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#665d9d",
          hover: "#554d87",
          light: "#e8e6f0",
        },
        secondary: {
          DEFAULT: "#fbc616",
          hover: "#e0b114",
          light: "#fef3cd",
        },
        success: "#16a34a",
        danger: "#dc2626",
        warning: "#fbc616",
        muted: "#6b7280",
        surface: "#ffffff",
        background: "#f8f9fa",
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-primary: #665d9d;
  --color-primary-hover: #554d87;
  --color-primary-light: #e8e6f0;
  --color-secondary: #fbc616;
  --color-secondary-hover: #e0b114;
  --color-secondary-light: #fef3cd;
  --color-success: #16a34a;
  --color-danger: #dc2626;
  --color-warning: #fbc616;
  --color-muted: #6b7280;
  --color-surface: #ffffff;
  --color-background: #f8f9fa;
}
```

- [ ] **Step 7: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "formatter": {
    "indentStyle": "tab",
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double"
    }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

- [ ] **Step 8: Create `.env.example` and `.env.local`**

`.env.example`:
```env
DATABASE_URL=postgresql://cemas:password@localhost:5432/cemas
AUTH_SECRET=change-me-to-a-random-string
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CEMAS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`.env.local` (same content with real values for local dev).

- [ ] **Step 9: Create `.gitignore`**

```
node_modules/
.next/
.env.local
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 10: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/modules/*/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 11: Create minimal root layout and page**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEMAS — Gestion Scolaire",
  description: "Complexe Educatif Mame Anta Sidibe",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-background text-[#1a1a1a] antialiased">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
```

- [ ] **Step 12: Add package.json scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/shared/lib/seed.ts",
    "db:studio": "drizzle-kit studio",
    "lint": "biome check src/",
    "format": "biome format --write src/"
  }
}
```

- [ ] **Step 13: Verify `pnpm dev` starts without errors**

Run: `pnpm dev`
Expected: Next.js starts on localhost:3000, visiting `/` redirects to `/login` (404 is OK — page not yet created).

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: scaffold CEMAS project with Next.js 15, Tailwind, tRPC, Drizzle configs"
```

---

### Task 2: Database Schemas, Connection & Seed

**Files:**
- Create: `src/shared/lib/db.ts`
- Create: `src/shared/lib/utils.ts`
- Create: `src/modules/auth/schema.ts`
- Create: `src/modules/academic/schema.ts`
- Create: `src/modules/students/schema.ts`
- Create: `src/modules/finance/schema.ts`
- Create: `src/modules/transport/schema.ts`
- Create: `src/modules/payroll/schema.ts`
- Create: `src/shared/lib/seed.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` env var, `drizzle.config.ts` from Task 1
- Produces:
  - `db` — Drizzle database client (`import { db } from "@/shared/lib/db"`)
  - All table exports per module (e.g. `import { eleves, parents } from "@/modules/students/schema"`)
  - `formatCFA(amount: number): string` — formats integer to "25 000 FCFA"
  - `formatDate(date: Date): string` — formats to "dd/MM/yyyy"
  - `generateMatricule(prefix: string, year: number, seq: number): string`
  - `generateRecuNumber(year: number, seq: number): string`
  - Seed script populates: 1 user, 1 annee_scolaire, 3 niveaux, 9 classes, matieres, categories, types_frais

- [ ] **Step 1: Create `src/shared/lib/db.ts`**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as authSchema from "@/modules/auth/schema";
import * as academicSchema from "@/modules/academic/schema";
import * as studentsSchema from "@/modules/students/schema";
import * as financeSchema from "@/modules/finance/schema";
import * as transportSchema from "@/modules/transport/schema";
import * as payrollSchema from "@/modules/payroll/schema";

const client = postgres(process.env.DATABASE_URL!);

export const db = drizzle(client, {
  schema: {
    ...authSchema,
    ...academicSchema,
    ...studentsSchema,
    ...financeSchema,
    ...transportSchema,
    ...payrollSchema,
  },
});
```

- [ ] **Step 2: Create `src/shared/lib/utils.ts`**

```typescript
export function formatCFA(amount: number): string {
  return new Intl.NumberFormat("fr-SN", {
    style: "decimal",
    minimumFractionDigits: 0,
  }).format(amount) + " FCFA";
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function generateMatricule(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

export function generateRecuNumber(year: number, seq: number): string {
  return `REC-${year}-${String(seq).padStart(4, "0")}`;
}

export const MOIS_LABELS: Record<number, string> = {
  1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
  5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
  9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
};
```

- [ ] **Step 3: Create `src/modules/auth/schema.ts`**

```typescript
import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  nom: varchar("nom", { length: 200 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("directeur"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
```

- [ ] **Step 4: Create `src/modules/academic/schema.ts`**

```typescript
import { pgTable, uuid, varchar, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const anneesScolaires = pgTable("annees_scolaires", {
  id: uuid("id").defaultRandom().primaryKey(),
  libelle: varchar("libelle", { length: 20 }).notNull(),
  dateDebut: date("date_debut").notNull(),
  dateFin: date("date_fin").notNull(),
  active: boolean("active").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const niveaux = pgTable("niveaux", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 50 }).notNull(),
  ordre: integer("ordre").notNull(),
});

export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
  niveauId: uuid("niveau_id").notNull().references(() => niveaux.id),
  capacite: integer("capacite").notNull().default(30),
  anneeScolaireId: uuid("annee_scolaire_id").notNull().references(() => anneesScolaires.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const matieres = pgTable("matieres", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
  coefficient: integer("coefficient").notNull().default(1),
  niveauId: uuid("niveau_id").notNull().references(() => niveaux.id),
});

// Relations
export const niveauxRelations = relations(niveaux, ({ many }) => ({
  classes: many(classes),
  matieres: many(matieres),
}));

export const classesRelations = relations(classes, ({ one }) => ({
  niveau: one(niveaux, { fields: [classes.niveauId], references: [niveaux.id] }),
  anneeScolaire: one(anneesScolaires, { fields: [classes.anneeScolaireId], references: [anneesScolaires.id] }),
}));

export const matieresRelations = relations(matieres, ({ one }) => ({
  niveau: one(niveaux, { fields: [matieres.niveauId], references: [niveaux.id] }),
}));
```

- [ ] **Step 5: Create `src/modules/students/schema.ts`**

```typescript
import { pgTable, uuid, varchar, text, date, integer, timestamp, primaryKey, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { classes, anneesScolaires } from "@/modules/academic/schema";

export const eleves = pgTable("eleves", {
  id: uuid("id").defaultRandom().primaryKey(),
  matricule: varchar("matricule", { length: 20 }).unique().notNull(),
  prenom: varchar("prenom", { length: 100 }).notNull(),
  nom: varchar("nom", { length: 100 }).notNull(),
  dateNaissance: date("date_naissance").notNull(),
  lieuNaissance: varchar("lieu_naissance", { length: 200 }),
  sexe: varchar("sexe", { length: 1 }).notNull(), // 'M' | 'F'
  adresse: text("adresse"),
  photoUrl: text("photo_url"),
  classeId: uuid("classe_id").notNull().references(() => classes.id),
  anneeScolaireId: uuid("annee_scolaire_id").notNull().references(() => anneesScolaires.id),
  statut: varchar("statut", { length: 20 }).notNull().default("actif"), // 'actif' | 'inactif' | 'transfere'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const parents = pgTable("parents", {
  id: uuid("id").defaultRandom().primaryKey(),
  prenom: varchar("prenom", { length: 100 }).notNull(),
  nom: varchar("nom", { length: 100 }).notNull(),
  telephone: varchar("telephone", { length: 20 }).notNull(),
  telephone2: varchar("telephone_2", { length: 20 }),
  profession: varchar("profession", { length: 100 }),
  adresse: text("adresse"),
  relation: varchar("relation", { length: 10 }).notNull(), // 'pere' | 'mere' | 'tuteur'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const eleveParents = pgTable("eleve_parents", {
  eleveId: uuid("eleve_id").notNull().references(() => eleves.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").notNull().references(() => parents.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.eleveId, t.parentId] }),
]);

export const inscriptions = pgTable("inscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  eleveId: uuid("eleve_id").notNull().references(() => eleves.id),
  classeId: uuid("classe_id").notNull().references(() => classes.id),
  anneeScolaireId: uuid("annee_scolaire_id").notNull().references(() => anneesScolaires.id),
  dateInscription: date("date_inscription").notNull().defaultNow(),
  montantInscription: integer("montant_inscription").notNull().default(0),
  statut: varchar("statut", { length: 20 }).notNull().default("en_attente"), // 'confirmee' | 'en_attente'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("inscriptions_eleve_annee_idx").on(t.eleveId, t.anneeScolaireId),
]);

// Relations
export const elevesRelations = relations(eleves, ({ one, many }) => ({
  classe: one(classes, { fields: [eleves.classeId], references: [classes.id] }),
  anneeScolaire: one(anneesScolaires, { fields: [eleves.anneeScolaireId], references: [anneesScolaires.id] }),
  eleveParents: many(eleveParents),
  inscriptions: many(inscriptions),
}));

export const parentsRelations = relations(parents, ({ many }) => ({
  eleveParents: many(eleveParents),
}));

export const eleveParentsRelations = relations(eleveParents, ({ one }) => ({
  eleve: one(eleves, { fields: [eleveParents.eleveId], references: [eleves.id] }),
  parent: one(parents, { fields: [eleveParents.parentId], references: [parents.id] }),
}));
```

- [ ] **Step 6: Create `src/modules/finance/schema.ts`**

```typescript
import { pgTable, uuid, varchar, text, integer, boolean, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { classes, anneesScolaires } from "@/modules/academic/schema";
import { eleves } from "@/modules/students/schema";

export const typesFrais = pgTable("types_frais", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
  montantDefaut: integer("montant_defaut").notNull().default(0),
  obligatoire: boolean("obligatoire").notNull().default(true),
});

export const grilleFrais = pgTable("grille_frais", {
  id: uuid("id").defaultRandom().primaryKey(),
  classeId: uuid("classe_id").notNull().references(() => classes.id),
  typeFraisId: uuid("type_frais_id").notNull().references(() => typesFrais.id),
  anneeScolaireId: uuid("annee_scolaire_id").notNull().references(() => anneesScolaires.id),
  montantMensuel: integer("montant_mensuel").notNull(),
}, (t) => [
  uniqueIndex("grille_frais_unique_idx").on(t.classeId, t.typeFraisId, t.anneeScolaireId),
]);

export const paiements = pgTable("paiements", {
  id: uuid("id").defaultRandom().primaryKey(),
  eleveId: uuid("eleve_id").notNull().references(() => eleves.id),
  typeFraisId: uuid("type_frais_id").notNull().references(() => typesFrais.id),
  anneeScolaireId: uuid("annee_scolaire_id").notNull().references(() => anneesScolaires.id),
  mois: integer("mois").notNull(), // 1-12
  montant: integer("montant").notNull(),
  datePaiement: date("date_paiement").notNull().defaultNow(),
  numeroRecu: varchar("numero_recu", { length: 20 }).unique().notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("paiements_unique_idx").on(t.eleveId, t.typeFraisId, t.anneeScolaireId, t.mois),
]);

export const categoriesDepenses = pgTable("categories_depenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
});

export const depenses = pgTable("depenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  categorieId: uuid("categorie_id").notNull().references(() => categoriesDepenses.id),
  libelle: varchar("libelle", { length: 200 }).notNull(),
  montant: integer("montant").notNull(),
  date: date("date").notNull().defaultNow(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const categoriesRecettes = pgTable("categories_recettes", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
});

export const recettes = pgTable("recettes", {
  id: uuid("id").defaultRandom().primaryKey(),
  categorieId: uuid("categorie_id").notNull().references(() => categoriesRecettes.id),
  libelle: varchar("libelle", { length: 200 }).notNull(),
  montant: integer("montant").notNull(),
  date: date("date").notNull().defaultNow(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// Relations
export const paiementsRelations = relations(paiements, ({ one }) => ({
  eleve: one(eleves, { fields: [paiements.eleveId], references: [eleves.id] }),
  typeFrais: one(typesFrais, { fields: [paiements.typeFraisId], references: [typesFrais.id] }),
  anneeScolaire: one(anneesScolaires, { fields: [paiements.anneeScolaireId], references: [anneesScolaires.id] }),
}));

export const depensesRelations = relations(depenses, ({ one }) => ({
  categorie: one(categoriesDepenses, { fields: [depenses.categorieId], references: [categoriesDepenses.id] }),
}));

export const recettesRelations = relations(recettes, ({ one }) => ({
  categorie: one(categoriesRecettes, { fields: [recettes.categorieId], references: [categoriesRecettes.id] }),
}));
```

- [ ] **Step 7: Create `src/modules/transport/schema.ts`**

```typescript
import { pgTable, uuid, varchar, text, integer, time, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { eleves } from "@/modules/students/schema";
import { anneesScolaires } from "@/modules/academic/schema";

export const vehicules = pgTable("vehicules", {
  id: uuid("id").defaultRandom().primaryKey(),
  immatriculation: varchar("immatriculation", { length: 20 }).unique().notNull(),
  marque: varchar("marque", { length: 100 }),
  capacite: integer("capacite").notNull(),
  chauffeurNom: varchar("chauffeur_nom", { length: 100 }).notNull(),
  chauffeurTel: varchar("chauffeur_tel", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const itineraires = pgTable("itineraires", {
  id: uuid("id").defaultRandom().primaryKey(),
  nom: varchar("nom", { length: 100 }).notNull(),
  vehiculeId: uuid("vehicule_id").references(() => vehicules.id),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const arrets = pgTable("arrets", {
  id: uuid("id").defaultRandom().primaryKey(),
  itineraireId: uuid("itineraire_id").notNull().references(() => itineraires.id, { onDelete: "cascade" }),
  nom: varchar("nom", { length: 100 }).notNull(),
  ordre: integer("ordre").notNull(),
  heurePassage: time("heure_passage"),
});

export const affectationsTransport = pgTable("affectations_transport", {
  id: uuid("id").defaultRandom().primaryKey(),
  eleveId: uuid("eleve_id").notNull().references(() => eleves.id),
  itineraireId: uuid("itineraire_id").notNull().references(() => itineraires.id),
  arretId: uuid("arret_id").notNull().references(() => arrets.id),
  anneeScolaireId: uuid("annee_scolaire_id").notNull().references(() => anneesScolaires.id),
}, (t) => [
  uniqueIndex("affectations_transport_unique_idx").on(t.eleveId, t.anneeScolaireId),
]);

// Relations
export const itinerairesRelations = relations(itineraires, ({ one, many }) => ({
  vehicule: one(vehicules, { fields: [itineraires.vehiculeId], references: [vehicules.id] }),
  arrets: many(arrets),
  affectations: many(affectationsTransport),
}));

export const arretsRelations = relations(arrets, ({ one }) => ({
  itineraire: one(itineraires, { fields: [arrets.itineraireId], references: [itineraires.id] }),
}));

export const affectationsTransportRelations = relations(affectationsTransport, ({ one }) => ({
  eleve: one(eleves, { fields: [affectationsTransport.eleveId], references: [eleves.id] }),
  itineraire: one(itineraires, { fields: [affectationsTransport.itineraireId], references: [itineraires.id] }),
  arret: one(arrets, { fields: [affectationsTransport.arretId], references: [arrets.id] }),
}));
```

- [ ] **Step 8: Create `src/modules/payroll/schema.ts`**

```typescript
import { pgTable, uuid, varchar, text, integer, boolean, date, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const employes = pgTable("employes", {
  id: uuid("id").defaultRandom().primaryKey(),
  matricule: varchar("matricule", { length: 20 }).unique().notNull(),
  prenom: varchar("prenom", { length: 100 }).notNull(),
  nom: varchar("nom", { length: 100 }).notNull(),
  telephone: varchar("telephone", { length: 20 }),
  poste: varchar("poste", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'enseignant' | 'administratif' | 'entretien'
  salaireBase: integer("salaire_base").notNull(),
  dateEmbauche: date("date_embauche").notNull(),
  statut: varchar("statut", { length: 10 }).notNull().default("actif"), // 'actif' | 'inactif'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const bulletinsPaie = pgTable("bulletins_paie", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeId: uuid("employe_id").notNull().references(() => employes.id),
  mois: integer("mois").notNull(), // 1-12
  annee: integer("annee").notNull(),
  salaireBase: integer("salaire_base").notNull(),
  primes: integer("primes").notNull().default(0),
  retenues: integer("retenues").notNull().default(0),
  netAPayer: integer("net_a_payer").notNull(),
  datePaiement: date("date_paiement"),
  paye: boolean("paye").notNull().default(false),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex("bulletins_paie_unique_idx").on(t.employeId, t.mois, t.annee),
]);

// Relations
export const employesRelations = relations(employes, ({ many }) => ({
  bulletins: many(bulletinsPaie),
}));

export const bulletinsPaieRelations = relations(bulletinsPaie, ({ one }) => ({
  employe: one(employes, { fields: [bulletinsPaie.employeId], references: [employes.id] }),
}));
```

- [ ] **Step 9: Create seed script `src/shared/lib/seed.ts`**

```typescript
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
  const [annee] = await db.insert(anneesScolaires).values({
    libelle: "2025-2026",
    dateDebut: "2025-10-01",
    dateFin: "2026-07-31",
    active: true,
  }).onConflictDoNothing().returning();

  const anneeId = annee?.id ?? (await db.select().from(anneesScolaires).where(eq(anneesScolaires.active, true)))[0].id;

  // 3. Niveaux
  const niveauxData = [
    { nom: "Crèche", ordre: 1 },
    { nom: "Préscolaire", ordre: 2 },
    { nom: "Élémentaire", ordre: 3 },
  ];
  const insertedNiveaux = await db.insert(niveaux).values(niveauxData).onConflictDoNothing().returning();
  const niveauxMap = insertedNiveaux.length > 0
    ? Object.fromEntries(insertedNiveaux.map((n) => [n.nom, n.id]))
    : Object.fromEntries((await db.select().from(niveaux)).map((n) => [n.nom, n.id]));

  // 4. Classes
  const classesData = [
    { nom: "Petite Section", niveauId: niveauxMap["Crèche"], capacite: 20, anneeScolaireId: anneeId },
    { nom: "Moyenne Section", niveauId: niveauxMap["Crèche"], capacite: 20, anneeScolaireId: anneeId },
    { nom: "Grande Section", niveauId: niveauxMap["Préscolaire"], capacite: 25, anneeScolaireId: anneeId },
    { nom: "CI", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
    { nom: "CP", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
    { nom: "CE1", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
    { nom: "CE2", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
    { nom: "CM1", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
    { nom: "CM2", niveauId: niveauxMap["Élémentaire"], capacite: 35, anneeScolaireId: anneeId },
  ];
  await db.insert(classes).values(classesData).onConflictDoNothing();

  // 5. Matières
  const matieresData = [
    { nom: "Français", coefficient: 3, niveauId: niveauxMap["Élémentaire"] },
    { nom: "Mathématiques", coefficient: 3, niveauId: niveauxMap["Élémentaire"] },
    { nom: "Éveil", coefficient: 2, niveauId: niveauxMap["Élémentaire"] },
    { nom: "Éducation physique", coefficient: 1, niveauId: niveauxMap["Élémentaire"] },
    { nom: "Activités d'éveil", coefficient: 2, niveauId: niveauxMap["Préscolaire"] },
    { nom: "Langage", coefficient: 2, niveauId: niveauxMap["Préscolaire"] },
    { nom: "Psychomotricité", coefficient: 1, niveauId: niveauxMap["Crèche"] },
  ];
  await db.insert(matieres).values(matieresData).onConflictDoNothing();

  // 6. Types de frais
  await db.insert(typesFrais).values([
    { nom: "Scolarité", montantDefaut: 25000, obligatoire: true },
    { nom: "Inscription", montantDefaut: 50000, obligatoire: true },
    { nom: "Tenue", montantDefaut: 15000, obligatoire: false },
  ]).onConflictDoNothing();

  // 7. Catégories de dépenses
  await db.insert(categoriesDepenses).values([
    { nom: "Fournitures" }, { nom: "Entretien" }, { nom: "Équipement" }, { nom: "Divers" },
  ]).onConflictDoNothing();

  // 8. Catégories de recettes
  await db.insert(categoriesRecettes).values([
    { nom: "Location salle" }, { nom: "Événements" }, { nom: "Dons" }, { nom: "Divers" },
  ]).onConflictDoNothing();

  console.log("✅ Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
```

- [ ] **Step 10: Generate migrations and run seed**

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Verify: connect to PostgreSQL and confirm tables exist and seed data is present.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add all Drizzle schemas, migrations, and seed script"
```

---

### Task 3: tRPC Setup & Auth System

**Files:**
- Create: `src/shared/lib/trpc.ts` (server context + router init)
- Create: `src/shared/lib/trpc-client.ts` (client-side hooks)
- Create: `src/shared/lib/auth.ts` (Auth.js config)
- Create: `src/app/api/trpc/[trpc]/route.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/middleware.ts`
- Create: `src/shared/providers.tsx` (QueryClient + tRPC provider)

**Interfaces:**
- Consumes: `db` from Task 2, `users` table from auth schema, `AUTH_SECRET` env
- Produces:
  - `createTRPCRouter`, `publicProcedure`, `protectedProcedure` — tRPC router builder and procedures
  - `appRouter` type export for client inference
  - `trpc` client hooks — `trpc.academic.list.useQuery()` etc.
  - Auth.js session with `{ user: { id, email, nom } }`
  - Middleware that protects all `/(dashboard)` routes
  - Working login page at `/login`

- [ ] **Step 1: Create `src/shared/lib/trpc.ts`**

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "./auth";
import { db } from "./db";

export const createTRPCContext = async () => {
  const session = await auth();
  return { db, session };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Non autorisé" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

- [ ] **Step 2: Create `src/shared/lib/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import { users } from "@/modules/auth/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string));

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.nom };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
```

- [ ] **Step 3: Create auth API route `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/shared/lib/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create root tRPC router `src/shared/lib/root-router.ts`**

```typescript
import { createTRPCRouter } from "./trpc";

// Module routers will be added here as they are created
export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 5: Create tRPC HTTP handler `src/app/api/trpc/[trpc]/route.ts`**

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/shared/lib/root-router";
import { createTRPCContext } from "@/shared/lib/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

- [ ] **Step 6: Create tRPC client `src/shared/lib/trpc-client.ts`**

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./root-router";

export const trpc = createTRPCReact<AppRouter>();
```

- [ ] **Step 7: Create providers `src/shared/providers.tsx`**

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/shared/lib/trpc-client";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }));

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: "/api/trpc" })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

- [ ] **Step 8: Update root layout to include providers**

Update `src/app/layout.tsx` to wrap children with `<Providers>`.

- [ ] **Step 9: Create auth layout `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-primary">
      {children}
    </div>
  );
}
```

- [ ] **Step 10: Create login page `src/app/(auth)/login/page.tsx`**

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou mot de passe incorrect");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-surface p-8 shadow-xl">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-primary">CEMAS</h1>
        <p className="text-sm text-muted">Complexe Educatif Mame Anta Sidibe</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-danger">{error}</div>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="directeur@cemas.sn"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2.5 font-medium text-white transition hover:bg-primary-hover disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 11: Create middleware `src/middleware.ts`**

```typescript
export { auth as middleware } from "@/shared/lib/auth";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
```

- [ ] **Step 12: Verify auth flow**

Run: `pnpm dev`
1. Visit `/` → should redirect to `/login`
2. Login with `directeur@cemas.sn` / `cemas2025` → should redirect to `/` (which will be the dashboard)
3. Invalid credentials → should show French error message

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add tRPC setup, Auth.js login, and middleware protection"
```

---

### Task 4: Shared UI Components & Dashboard Layout

**Files:**
- Create: `src/shared/ui/button.tsx`
- Create: `src/shared/ui/stat-card.tsx`
- Create: `src/shared/ui/data-table.tsx`
- Create: `src/shared/ui/page-header.tsx`
- Create: `src/shared/ui/form-modal.tsx`
- Create: `src/shared/ui/confirm-dialog.tsx`
- Create: `src/shared/ui/status-badge.tsx`
- Create: `src/shared/ui/empty-state.tsx`
- Create: `src/shared/ui/month-picker.tsx`
- Create: `src/shared/ui/print-layout.tsx`
- Create: `src/shared/ui/index.ts` (barrel export)
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/shared/ui/sidebar.tsx`
- Create: `src/shared/ui/header.tsx`

**Interfaces:**
- Consumes: Tailwind theme from Task 1
- Produces:
  - `<Button variant="primary"|"secondary"|"danger"|"ghost" size="sm"|"md"|"lg">` — styled button
  - `<StatCard title label value icon trend>` — KPI card
  - `<DataTable columns data searchPlaceholder onSearch pagination>` — paginated table
  - `<PageHeader title breadcrumbs action>` — page header with breadcrumb and action button
  - `<FormModal open onClose title children>` — modal wrapper for forms
  - `<ConfirmDialog open onClose onConfirm title message>` — deletion confirmation
  - `<StatusBadge status>` — colored badge (payé/impayé/actif/inactif)
  - `<EmptyState title description action>` — empty state placeholder
  - `<MonthPicker value onChange>` — month selector (1-12)
  - `<PrintLayout schoolName children>` — print-only wrapper with school header
  - `<Sidebar>` and `<Header>` — dashboard chrome

- [ ] **Step 1: Create `src/shared/ui/button.tsx`**

```tsx
import { type ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "bg-secondary text-[#1a1a1a] hover:bg-secondary-hover",
  danger: "bg-danger text-white hover:bg-red-700",
  ghost: "bg-transparent text-muted hover:bg-gray-100",
  outline: "border border-gray-300 bg-white text-[#1a1a1a] hover:bg-gray-50",
} as const;

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
} as const;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = "Button";
```

- [ ] **Step 2: Create `src/shared/ui/stat-card.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="rounded-xl bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {trend && (
            <p className={`mt-1 text-sm ${trendUp ? "text-success" : "text-danger"}`}>
              {trend}
            </p>
          )}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/shared/ui/data-table.tsx`**

A client component with:
- Column definitions `{ key, label, render? }`
- Pagination (page, pageSize)
- Search input
- Sort by column click
- Empty state when no rows

```tsx
"use client";

import { useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "./empty-state";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchPlaceholder = "Rechercher...",
  pageSize = 10,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = data.filter((row) =>
    Object.values(row).some((v) =>
      String(v ?? "").toLowerCase().includes(search.toLowerCase()),
    ),
  );

  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const aVal = String(a[sortKey] ?? "");
        const bVal = String(b[sortKey] ?? "");
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      })
    : filtered;

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) {
    return <EmptyState title="Aucune donnée" description="Commencez par ajouter un élément." />;
  }

  return (
    <div className="rounded-xl bg-surface shadow-sm">
      <div className="border-b p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-sm text-muted">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 font-medium cursor-pointer select-none"
                  onClick={() => {
                    if (col.sortable !== false) {
                      setSortAsc(sortKey === col.key ? !sortAsc : true);
                      setSortKey(col.key);
                    }
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={i}
                className={`border-b text-sm last:border-0 ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted">
          <span>{sorted.length} résultat(s)</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>Page {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create remaining shared UI components**

Create these files with the interfaces specified above:
- `src/shared/ui/page-header.tsx` — title, breadcrumbs array `{label, href?}[]`, optional action ReactNode
- `src/shared/ui/form-modal.tsx` — dialog overlay with title, close button, children slot for form content
- `src/shared/ui/confirm-dialog.tsx` — "Êtes-vous sûr ?" dialog with cancel/confirm buttons, red confirm
- `src/shared/ui/status-badge.tsx` — maps status strings to colored badges: `actif`→green, `inactif`→gray, `paye`→green, `impaye`→red, `en_attente`→yellow, `confirmee`→green, `transfere`→blue
- `src/shared/ui/empty-state.tsx` — centered icon, title, description, optional action button
- `src/shared/ui/month-picker.tsx` — select dropdown with months Janvier-Décembre, value 1-12
- `src/shared/ui/print-layout.tsx` — hidden on screen (`print:block`), shows school header + children on print

- [ ] **Step 5: Create barrel export `src/shared/ui/index.ts`**

```typescript
export { Button } from "./button";
export { StatCard } from "./stat-card";
export { DataTable } from "./data-table";
export type { Column } from "./data-table";
export { PageHeader } from "./page-header";
export { FormModal } from "./form-modal";
export { ConfirmDialog } from "./confirm-dialog";
export { StatusBadge } from "./status-badge";
export { EmptyState } from "./empty-state";
export { MonthPicker } from "./month-picker";
export { PrintLayout } from "./print-layout";
```

- [ ] **Step 6: Create sidebar `src/shared/ui/sidebar.tsx`**

Client component with:
- Logo CEMAS at top (GraduationCap icon + "CEMAS" text)
- Navigation links grouped: Tableau de bord, then each module (Académique with submenu, Élèves, Finances with submenu, Transport with submenu, Payroll with submenu, Paramètres)
- Active state highlighted with `bg-white/10` and left border
- Icons from lucide-react: `LayoutDashboard`, `BookOpen`, `Users`, `Banknote`, `Bus`, `Briefcase`, `Settings`
- Collapsible on mobile via state prop

- [ ] **Step 7: Create header `src/shared/ui/header.tsx`**

Client component with:
- Hamburger menu button (mobile only, toggles sidebar)
- Year switcher dropdown showing active `annee_scolaire` (fetched via tRPC later — stub for now)
- User name "Directeur" + signOut button

- [ ] **Step 8: Create dashboard layout `src/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from "@/shared/ui/sidebar";
import { Header } from "@/shared/ui/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:ml-[260px]">
        <Header />
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Create placeholder dashboard page `src/app/(dashboard)/page.tsx`**

```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Tableau de bord</h1>
      <p className="text-muted">Bienvenue sur CEMAS</p>
    </div>
  );
}
```

- [ ] **Step 10: Verify layout renders correctly**

Run: `pnpm dev`
1. Login → should see sidebar (violet) + header + "Tableau de bord" content
2. Sidebar links should be visible with correct icons
3. Mobile: sidebar should collapse

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add shared UI components and dashboard layout with sidebar/header"
```

---

### Task 5: Academic Module (router + pages)

**Files:**
- Create: `src/modules/academic/router.ts`
- Create: `src/modules/academic/validation.ts`
- Create: `src/app/(dashboard)/academique/annees/page.tsx`
- Create: `src/app/(dashboard)/academique/classes/page.tsx`
- Create: `src/app/(dashboard)/academique/matieres/page.tsx`
- Modify: `src/shared/lib/root-router.ts` — merge academic router

**Interfaces:**
- Consumes: `protectedProcedure`, `createTRPCRouter` from Task 3; `anneesScolaires`, `niveaux`, `classes`, `matieres` schemas from Task 2; shared UI from Task 4
- Produces:
  - `trpc.academic.annees.list.useQuery()` → `AnneeScolaire[]`
  - `trpc.academic.annees.create.useMutation({ libelle, dateDebut, dateFin })`
  - `trpc.academic.annees.setActive.useMutation({ id })` — toggles active, deactivates others
  - `trpc.academic.classes.list.useQuery({ anneeScolaireId })` → `Classe[]` with niveau relation
  - `trpc.academic.classes.create.useMutation({ nom, niveauId, capacite, anneeScolaireId })`
  - `trpc.academic.classes.update.useMutation({ id, nom, capacite })`
  - `trpc.academic.classes.delete.useMutation({ id })`
  - `trpc.academic.matieres.list.useQuery({ niveauId? })` → `Matiere[]` with niveau
  - `trpc.academic.matieres.create/update/delete` — standard CRUD
  - `trpc.academic.niveaux.list.useQuery()` → `Niveau[]`

- [ ] **Step 1: Create `src/modules/academic/validation.ts`**

Zod schemas for all academic inputs:

```typescript
import { z } from "zod";

export const createAnneeSchema = z.object({
  libelle: z.string().min(1, "Libellé requis"),
  dateDebut: z.string().min(1, "Date de début requise"),
  dateFin: z.string().min(1, "Date de fin requise"),
});

export const createClasseSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  niveauId: z.string().uuid(),
  capacite: z.number().int().min(1, "Capacité minimum 1"),
  anneeScolaireId: z.string().uuid(),
});

export const updateClasseSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).optional(),
  capacite: z.number().int().min(1).optional(),
});

export const createMatiereSchema = z.object({
  nom: z.string().min(1, "Nom requis"),
  coefficient: z.number().int().min(1),
  niveauId: z.string().uuid(),
});

export const updateMatiereSchema = z.object({
  id: z.string().uuid(),
  nom: z.string().min(1).optional(),
  coefficient: z.number().int().min(1).optional(),
});
```

- [ ] **Step 2: Create `src/modules/academic/router.ts`**

Full tRPC router with nested routers for `annees`, `classes`, `matieres`, `niveaux`. Each sub-router has `list`, `create`, `update`, `delete` procedures using `protectedProcedure` and the Zod schemas above. Key logic:
- `annees.setActive` must set all others to `active: false` first
- `classes.list` joins `niveaux` for display
- `classes.delete` must check no students are assigned before deleting
- All mutations use the validation schemas

- [ ] **Step 3: Register academic router in `src/shared/lib/root-router.ts`**

```typescript
import { createTRPCRouter } from "./trpc";
import { academicRouter } from "@/modules/academic/router";

export const appRouter = createTRPCRouter({
  academic: academicRouter,
});

export type AppRouter = typeof appRouter;
```

- [ ] **Step 4: Create `/academique/annees/page.tsx`**

Page with:
- `PageHeader` title "Années scolaires" with "Nouvelle année" button
- DataTable showing all years with columns: Libellé, Début, Fin, Statut (badge actif/inactif)
- Toggle active button per row
- FormModal for create/edit with the 3 fields
- ConfirmDialog for delete

- [ ] **Step 5: Create `/academique/classes/page.tsx`**

Page with:
- `PageHeader` title "Classes"
- Filter by niveau (tabs or dropdown: Tous, Crèche, Préscolaire, Élémentaire)
- DataTable: Nom, Niveau, Capacité, Effectif (count of students — placeholder 0 until students module)
- CRUD with FormModal (nom, niveau dropdown, capacité)

- [ ] **Step 6: Create `/academique/matieres/page.tsx`**

Page with:
- `PageHeader` title "Matières"
- Filter by niveau
- DataTable: Nom, Coefficient, Niveau
- CRUD with FormModal

- [ ] **Step 7: Verify all 3 pages work**

Run: `pnpm dev`
1. Navigate to each page via sidebar
2. Create/edit/delete operations work
3. Year switch works
4. Data persists in database

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add academic module with CRUD for years, classes, subjects"
```

---

### Task 6: Students Module (router + pages)

**Files:**
- Create: `src/modules/students/router.ts`
- Create: `src/modules/students/validation.ts`
- Create: `src/app/(dashboard)/eleves/page.tsx`
- Create: `src/app/(dashboard)/eleves/[id]/page.tsx`
- Create: `src/app/(dashboard)/eleves/nouveau/page.tsx`
- Modify: `src/shared/lib/root-router.ts` — merge students router

**Interfaces:**
- Consumes: `protectedProcedure` from Task 3; `eleves`, `parents`, `eleveParents`, `inscriptions` schemas from Task 2; `classes`, `niveaux`, `anneesScolaires` from academic schema; shared UI from Task 4
- Produces:
  - `trpc.students.list.useQuery({ anneeScolaireId, classeId?, niveauId?, statut?, search? })` → paginated `Eleve[]` with classe+niveau
  - `trpc.students.getById.useQuery({ id })` → full student with parents, inscriptions, payments
  - `trpc.students.create.useMutation(...)` — creates eleve + parent + inscription in one transaction
  - `trpc.students.update.useMutation({ id, ... })`
  - `trpc.students.delete.useMutation({ id })`
  - `trpc.students.count.useQuery({ anneeScolaireId })` → `{ total, byNiveau: { creche, prescolaire, elementaire } }`

- [ ] **Step 1: Create `src/modules/students/validation.ts`**

Zod schemas for student creation (includes parent data), update, and filters.
- `createStudentSchema`: prenom, nom, dateNaissance, lieuNaissance, sexe ('M'|'F'), classeId, parent info (prenom, nom, telephone, relation)
- Matricule is auto-generated server-side, not in the schema

- [ ] **Step 2: Create `src/modules/students/router.ts`**

Key implementation details:
- `create` procedure: wraps in `db.transaction` — insert parent, insert eleve with generated matricule (`CEMAS-{year}-{nextSeq}`), insert `eleveParents` link, insert `inscriptions` row
- `list` procedure: joins classe and niveau, supports filtering/search, returns paginated results
- `getById`: joins everything — parents via eleveParents, inscriptions, classe, niveau
- `count`: `COUNT(*)` grouped by niveau for dashboard

- [ ] **Step 3: Register in root-router**

Add `students: studentsRouter` to `appRouter`.

- [ ] **Step 4: Create `/eleves/page.tsx`**

- `PageHeader` "Élèves" with "Nouvelle inscription" button → navigates to `/eleves/nouveau`
- Filter bar: classe dropdown, niveau dropdown, statut dropdown, search input
- DataTable: Matricule, Nom complet, Classe, Niveau, Statut (badge)
- Row click → navigates to `/eleves/[id]`

- [ ] **Step 5: Create `/eleves/nouveau/page.tsx`**

Multi-step form:
1. Step 1 — Info élève: prenom, nom, dateNaissance, lieuNaissance, sexe (radio M/F)
2. Step 2 — Info parent: prenom, nom, telephone, telephone2, profession, relation (radio pere/mere/tuteur)
3. Step 3 — Classe: dropdown by niveau → classe, shows recap before submit

On submit → `trpc.students.create.useMutation` → redirect to `/eleves/[newId]`

- [ ] **Step 6: Create `/eleves/[id]/page.tsx`**

- Student profile header: photo placeholder, name, matricule, StatusBadge
- Info cards: Date naissance, Lieu, Sexe, Adresse, Classe, Niveau
- Parent section: name, telephone(s), profession, relation
- Payment history table (stub — will be populated when finance module connects)
- Transport info (stub — will be populated when transport module connects)
- Edit button → FormModal with current student data

- [ ] **Step 7: Verify student flow**

Run: `pnpm dev`
1. Create a student with parent → matricule auto-generated
2. See student in list → filters work
3. Click student → detail page with all info
4. Edit student → changes persist

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add students module with enrollment, list, and detail pages"
```

---

### Task 7: Finance Module (router + pages)

**Files:**
- Create: `src/modules/finance/router.ts`
- Create: `src/modules/finance/validation.ts`
- Create: `src/app/(dashboard)/finances/paiements/page.tsx`
- Create: `src/app/(dashboard)/finances/suivi/page.tsx`
- Create: `src/app/(dashboard)/finances/depenses/page.tsx`
- Create: `src/app/(dashboard)/finances/recettes/page.tsx`
- Create: `src/app/(dashboard)/finances/bilan/page.tsx`
- Modify: `src/shared/lib/root-router.ts` — merge finance router

**Interfaces:**
- Consumes: all finance schemas from Task 2, student/academic schemas for joins, shared UI
- Produces:
  - `trpc.finance.paiements.create.useMutation({ eleveId, typeFraisId, anneeScolaireId, mois, montant, note? })` — auto-generates `numero_recu`, returns receipt data
  - `trpc.finance.paiements.list.useQuery({ anneeScolaireId, mois? })` → with eleve name, type_frais name
  - `trpc.finance.suivi.useQuery({ classeId, anneeScolaireId })` → grid data: `{ eleve, moisPayes: number[] }`
  - `trpc.finance.depenses.list/create/update/delete` — standard CRUD
  - `trpc.finance.recettes.list/create/update/delete` — standard CRUD
  - `trpc.finance.bilan.useQuery({ anneeScolaireId, mois? })` → `{ totalRecettes, totalDepenses, totalPaiements, solde }`
  - `trpc.finance.stats.useQuery({ anneeScolaireId })` → recouvrement % for dashboard

- [ ] **Step 1: Create validation schemas**

- `createPaiementSchema`: eleveId, typeFraisId, anneeScolaireId, mois (1-12), montant (positive int), note optional
- `createDepenseSchema`: categorieId, libelle, montant, date, note optional
- `createRecetteSchema`: same structure as depense

- [ ] **Step 2: Create `src/modules/finance/router.ts`**

Key logic:
- `paiements.create`: generate `numero_recu` atomically — query max existing recu number for year, increment. Wrap in transaction. On unique constraint violation (duplicate month), throw user-friendly error: "Ce mois est déjà payé pour cet élève"
- `suivi`: for a given class, return each student with an array of 12 booleans (paid/unpaid per month)
- `bilan`: aggregate SUM of paiements + recettes as income, SUM of depenses as expenses
- `stats.recouvrement`: count(paid) / count(expected) for current month across all students

- [ ] **Step 3: Register in root-router**

Add `finance: financeRouter`.

- [ ] **Step 4: Create `/finances/paiements/page.tsx`**

- `PageHeader` "Paiements"
- Form at top: search/select élève → auto-fill classe, select type de frais, select mois (MonthPicker), montant pre-filled from grille_frais, note
- "Enregistrer & Imprimer" button → creates payment, opens print dialog
- Below: table of recent payments (5 derniers)
- PrintLayout component renders receipt format from spec (A5, school header, receipt number, student info, amount in FCFA)

- [ ] **Step 5: Create `/finances/suivi/page.tsx`**

- `PageHeader` "Suivi des paiements"
- Class filter dropdown
- Grid table: rows = students, columns = Jan-Dec (or school months Oct-Jul)
- Cells: green check if paid, red X if unpaid
- Summary row at bottom with totals per month

- [ ] **Step 6: Create `/finances/depenses/page.tsx`**

Standard CRUD page:
- DataTable: Date, Catégorie, Libellé, Montant (formatCFA)
- FormModal for create/edit: categorie dropdown, libelle, montant, date, note
- ConfirmDialog for delete

- [ ] **Step 7: Create `/finances/recettes/page.tsx`**

Same structure as depenses page but with `categoriesRecettes`.

- [ ] **Step 8: Create `/finances/bilan/page.tsx`**

- `PageHeader` "Bilan financier"
- MonthPicker filter (or "Annuel" toggle)
- 3 StatCards: Total Entrées (paiements + recettes), Total Sorties (dépenses), Solde
- Bar chart (Recharts): Entrées vs Sorties par mois, 12 bars

- [ ] **Step 9: Verify finance flow**

1. Register a payment → receipt prints correctly
2. Suivi grid shows green/red correctly
3. Bilan totals match manual calculation
4. Duplicate payment for same month → French error message

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add finance module with payments, tracking grid, expenses, income, and balance"
```

---

### Task 8: Transport Module (router + pages)

**Files:**
- Create: `src/modules/transport/router.ts`
- Create: `src/modules/transport/validation.ts`
- Create: `src/app/(dashboard)/transport/vehicules/page.tsx`
- Create: `src/app/(dashboard)/transport/itineraires/page.tsx`
- Create: `src/app/(dashboard)/transport/affectations/page.tsx`
- Modify: `src/shared/lib/root-router.ts` — merge transport router

**Interfaces:**
- Consumes: transport schemas from Task 2, student/academic schemas for affectations
- Produces:
  - `trpc.transport.vehicules.list/create/update/delete` — standard CRUD
  - `trpc.transport.itineraires.list.useQuery()` → with arrets and vehicule
  - `trpc.transport.itineraires.create.useMutation({ nom, vehiculeId, description, arrets: { nom, ordre, heurePassage }[] })` — creates itineraire + arrets in one transaction
  - `trpc.transport.itineraires.update/delete`
  - `trpc.transport.affectations.list.useQuery({ anneeScolaireId })` → with eleve, itineraire, arret
  - `trpc.transport.affectations.create.useMutation({ eleveId, itineraireId, arretId, anneeScolaireId })`
  - `trpc.transport.affectations.delete.useMutation({ id })`

- [ ] **Step 1: Create validation schemas and router**

Standard CRUD with one special case: `itineraires.create` accepts nested `arrets[]` array and inserts all in a transaction.

- [ ] **Step 2: Create `/transport/vehicules/page.tsx`**

DataTable: Immatriculation, Marque, Capacité, Chauffeur (nom + tel)
CRUD with FormModal.

- [ ] **Step 3: Create `/transport/itineraires/page.tsx`**

- DataTable showing itineraires with vehicule name and number of arrets
- Create/edit opens a FormModal with itineraire fields + an arrêts editor (add/remove/reorder stops with nom, heure_passage)
- Arrêts displayed as ordered list

- [ ] **Step 4: Create `/transport/affectations/page.tsx`**

- DataTable: Élève (nom), Classe, Itinéraire, Arrêt
- "Affecter un élève" button → FormModal: search élève, select itinéraire → auto-populate arrêts dropdown
- Delete affectation

- [ ] **Step 5: Verify transport flow**

1. Create vehicle, itineraire with 3 arrets
2. Assign a student to the itineraire
3. Student detail page now shows transport info

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add transport module with vehicles, routes, stops, and student assignments"
```

---

### Task 9: Payroll Module (router + pages)

**Files:**
- Create: `src/modules/payroll/router.ts`
- Create: `src/modules/payroll/validation.ts`
- Create: `src/app/(dashboard)/payroll/employes/page.tsx`
- Create: `src/app/(dashboard)/payroll/bulletins/page.tsx`
- Create: `src/app/(dashboard)/payroll/historique/page.tsx`
- Modify: `src/shared/lib/root-router.ts` — merge payroll router

**Interfaces:**
- Consumes: payroll schemas from Task 2, shared UI
- Produces:
  - `trpc.payroll.employes.list/create/update/delete` — CRUD with matricule auto-gen (`EMP-{seq}`)
  - `trpc.payroll.bulletins.generate.useMutation({ mois, annee })` — creates bulletins for all active employees with their salaire_base, 0 primes, 0 retenues
  - `trpc.payroll.bulletins.list.useQuery({ mois, annee })` → with employe info
  - `trpc.payroll.bulletins.update.useMutation({ id, primes, retenues, note })` — recomputes `net_a_payer` server-side
  - `trpc.payroll.bulletins.markPaid.useMutation({ id, datePaiement })` — sets paye=true
  - `trpc.payroll.historique.useQuery({ annee })` → monthly summary: total salaires, total primes, total retenues, total net
  - `trpc.payroll.stats.useQuery({ mois, annee })` → total net for dashboard

- [ ] **Step 1: Create validation schemas and router**

Key logic:
- `bulletins.generate`: for each active employe, insert bulletin with `net_a_payer = salaire_base + primes - retenues`. Skip if bulletin already exists for that month/year (idempotent).
- `bulletins.update`: **always recompute** `net_a_payer = salaire_base + primes - retenues` server-side regardless of what client sends.
- `employes.create`: auto-generate matricule `EMP-{next seq padded to 3 digits}`

- [ ] **Step 2: Create `/payroll/employes/page.tsx`**

DataTable: Matricule, Nom, Poste, Type (badge), Salaire base (formatCFA), Statut
CRUD with FormModal.

- [ ] **Step 3: Create `/payroll/bulletins/page.tsx`**

- MonthPicker + year selector at top
- "Générer les bulletins" button → creates bulletins for all active employees
- DataTable: Employé, Salaire base, Primes, Retenues, Net à payer, Statut (payé/impayé)
- Inline edit for primes/retenues per employee → auto-calculates net
- "Marquer payé" button per row or bulk action
- Print button per bulletin → PrintLayout with payslip format

- [ ] **Step 4: Create `/payroll/historique/page.tsx`**

- Year selector
- Table: 12 rows (months), columns: Total salaires, Total primes, Total retenues, Total net, Nb employés payés
- Summary row at bottom with annual totals

- [ ] **Step 5: Verify payroll flow**

1. Create 3 employees
2. Generate October 2025 bulletins → 3 bulletins appear
3. Add prime to one → net recalculated
4. Mark all paid → statut changes
5. Historique shows the month data

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add payroll module with employees, payslip generation, and history"
```

---

### Task 10: Dashboard KPIs, Charts & Settings Page

**Files:**
- Create: `src/modules/dashboard/router.ts`
- Modify: `src/app/(dashboard)/page.tsx` — full dashboard with KPIs and charts
- Create: `src/app/(dashboard)/parametres/page.tsx`
- Modify: `src/shared/lib/root-router.ts` — merge dashboard router

**Interfaces:**
- Consumes: all module routers for aggregated stats, Recharts library
- Produces: complete dashboard page and settings page

- [ ] **Step 1: Create `src/modules/dashboard/router.ts`**

```typescript
// Aggregates data from all modules for the dashboard
// Procedures:
// - stats.useQuery({ anneeScolaireId }) → { totalEleves, totalClasses, recouvrement, masseSalariale }
// - chartRecetteDepenses.useQuery({ anneeScolaireId }) → { mois, recettes, depenses }[]
// - chartElevesParNiveau.useQuery({ anneeScolaireId }) → { niveau, count }[]
// - derniersPaiements.useQuery({ anneeScolaireId, limit: 5 }) → Paiement[] with eleve name
```

Key: handle empty database gracefully — `recouvrement` defaults to 0 (not NaN), `masseSalariale` defaults to 0.

- [ ] **Step 2: Build full dashboard page**

- 4 `StatCard` components in a 4-column grid
- `BarChart` (Recharts) showing Recettes vs Dépenses per month — purple bars for recettes, gold for dépenses
- `PieChart` (Recharts) showing students per niveau — 3 slices colored per level
- Table of 5 derniers paiements: Date, Élève, Type, Montant

All wrapped in tRPC queries with loading skeletons.

- [ ] **Step 3: Create `/parametres/page.tsx`**

- PageHeader "Paramètres"
- Card "Informations de l'école": form with nom, adresse, telephone (stored in a `school_settings` table or localStorage for MVP — keep simple)
- Card "Mot de passe": current password, new password, confirm → calls `trpc.auth.changePassword`
- Card "Année scolaire": shows active year, button to create new year (links to `/academique/annees`)

- [ ] **Step 4: Add `auth.changePassword` to auth or a settings router**

Protected procedure: validates current password, hashes new password, updates `users` row.

- [ ] **Step 5: Verify dashboard and settings**

1. Dashboard shows correct KPIs (or zeros if empty)
2. Charts render with data
3. Settings page allows password change
4. All pages responsive on mobile

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add dashboard with KPIs and charts, and settings page"
```

---

### Task 11: Docker Deployment

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker/docker-compose.yml`
- Create: `docker/nginx.conf`
- Create: `docker/.env.example`

**Interfaces:**
- Consumes: Next.js standalone build from Task 1 config
- Produces: `docker compose up -d` starts the full app at port 80

- [ ] **Step 1: Create `docker/Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

- [ ] **Step 2: Create `docker/docker-compose.yml`**

```yaml
services:
  app:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    environment:
      - DATABASE_URL=postgresql://cemas:${DB_PASSWORD}@db:5432/cemas
      - AUTH_SECRET=${AUTH_SECRET}
      - AUTH_URL=${AUTH_URL}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=cemas
      - POSTGRES_USER=cemas
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cemas"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
    restart: unless-stopped

volumes:
  pgdata:
```

- [ ] **Step 3: Create `docker/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

- [ ] **Step 4: Create `docker/.env.example`**

```env
DB_PASSWORD=change-me-strong-password
AUTH_SECRET=generate-with-openssl-rand-base64-32
AUTH_URL=https://cemas.your-domain.com
```

- [ ] **Step 5: Test Docker build locally**

```bash
cd docker
cp .env.example .env  # fill in values
docker compose build
docker compose up -d
# Run migrations and seed against the Docker postgres
docker compose exec app node -e "..." # or run drizzle-kit against Docker DB
```

Verify: app accessible at `http://localhost`, login works, data persists across restarts.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Docker deployment with Dockerfile, docker-compose, and nginx"
```

---

## File Map Summary

| File | Responsibility |
|------|----------------|
| `src/shared/lib/db.ts` | Drizzle client + combined schema |
| `src/shared/lib/trpc.ts` | tRPC context, router builder, procedures |
| `src/shared/lib/trpc-client.ts` | tRPC React hooks |
| `src/shared/lib/auth.ts` | Auth.js config (credentials, JWT, callbacks) |
| `src/shared/lib/root-router.ts` | Merged tRPC app router |
| `src/shared/lib/utils.ts` | formatCFA, formatDate, generateMatricule |
| `src/shared/lib/seed.ts` | Database seed script |
| `src/shared/providers.tsx` | React Query + tRPC provider |
| `src/shared/ui/*.tsx` | Reusable UI components (10 components) |
| `src/modules/auth/schema.ts` | Users table |
| `src/modules/academic/schema.ts` | annees_scolaires, niveaux, classes, matieres |
| `src/modules/academic/router.ts` | Academic CRUD procedures |
| `src/modules/academic/validation.ts` | Zod schemas |
| `src/modules/students/schema.ts` | eleves, parents, eleve_parents, inscriptions |
| `src/modules/students/router.ts` | Students CRUD + enrollment |
| `src/modules/finance/schema.ts` | types_frais, grille_frais, paiements, depenses, recettes |
| `src/modules/finance/router.ts` | Payments, tracking grid, expenses, income, balance |
| `src/modules/transport/schema.ts` | vehicules, itineraires, arrets, affectations |
| `src/modules/transport/router.ts` | Transport CRUD + assignments |
| `src/modules/payroll/schema.ts` | employes, bulletins_paie |
| `src/modules/payroll/router.ts` | Employee CRUD, payslip generation |
| `src/modules/dashboard/router.ts` | Aggregated KPI queries |
| `src/app/(auth)/*` | Login page + auth layout |
| `src/app/(dashboard)/*` | All dashboard pages (19 pages) |
| `src/middleware.ts` | Auth protection |
| `docker/*` | Dockerfile, compose, nginx |
