# CEMAS — Système de Gestion Scolaire (Design Spec)

> **Projet :** Fork léger mono-école pour la gestion quotidienne par un directeur
> **École :** CEMAS — Complexe Educatif Mame Anta Sidibe
> **Niveaux :** Crèche, Préscolaire, Élémentaire
> **Date :** 2026-09-30

---

## 1. Vue d'ensemble

Application web de gestion scolaire destinée au directeur du CEMAS. Un seul utilisateur, une seule école, interface 100% français. L'objectif est de remplacer les processus papier/Excel par un outil numérique simple et efficace.

### 1.1 Périmètre MVP

| Module | Description |
|--------|-------------|
| **Académique** | Classes, niveaux, matières, années scolaires |
| **Élèves** | Inscriptions, fiches élèves, parents/tuteurs |
| **Finances** | Frais mensuels cash, reçus imprimables, dépenses/recettes |
| **Transport** | Véhicules, itinéraires, arrêts, affectations élèves |
| **Payroll** | Employés, bulletins de paie mensuels |

### 1.2 Périmètre V2 (hors scope)

- Gestion du personnel (affectations enseignants aux classes)
- Présences (suivi absences élèves et staff)
- Examens & Notes (bulletins, moyennes, classements)

### 1.3 Hors scope définitif

- Communication (annonces, notifications push)
- Cours en ligne
- Certificats & documents PDF avancés
- App mobile native
- Multi-utilisateur / RBAC

---

## 2. Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 15 (App Router, Server Components + Server Actions) |
| API | tRPC v11 (type-safe end-to-end) |
| ORM | Drizzle ORM |
| Base de données | PostgreSQL 16 |
| Auth | Auth.js v5 (NextAuth beta) — Credentials provider |
| UI | Tailwind CSS v4, lucide-react icons |
| Charts | Recharts |
| i18n | Français uniquement (pas de next-intl au MVP) |
| Validation | Zod (schemas partagés client/serveur) |
| Tests | Vitest (unit), Playwright (E2E) |
| Lint/Format | Biome |
| Package manager | pnpm |
| Déploiement | Docker (Next.js standalone + PostgreSQL 16 + Nginx) via Portainer |

---

## 3. Architecture — Monolithe modulaire

### 3.1 Structure du projet

```
cemas/
├── docker/
│   ├── Dockerfile              # Multi-stage build (node:20-alpine)
│   ├── docker-compose.yml      # 3 services: app, db, nginx
│   └── nginx.conf              # Reverse proxy
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx      # Sidebar + Header
│   │   │   ├── page.tsx        # Dashboard accueil
│   │   │   ├── academique/
│   │   │   ├── eleves/
│   │   │   ├── finances/
│   │   │   ├── transport/
│   │   │   └── payroll/
│   │   ├── api/
│   │   │   └── trpc/[trpc]/route.ts
│   │   └── layout.tsx          # Root layout
│   │
│   ├── modules/
│   │   ├── academic/
│   │   │   ├── schema.ts
│   │   │   ├── router.ts
│   │   │   └── components/
│   │   ├── students/
│   │   │   ├── schema.ts
│   │   │   ├── router.ts
│   │   │   └── components/
│   │   ├── finance/
│   │   │   ├── schema.ts
│   │   │   ├── router.ts
│   │   │   └── components/
│   │   ├── transport/
│   │   │   ├── schema.ts
│   │   │   ├── router.ts
│   │   │   └── components/
│   │   └── payroll/
│   │       ├── schema.ts
│   │       ├── router.ts
│   │       └── components/
│   │
│   ├── shared/
│   │   ├── ui/                 # Button, Card, DataTable, Modal, etc.
│   │   ├── hooks/              # useDebounce, usePagination
│   │   └── lib/
│   │       ├── db.ts           # Connexion Drizzle
│   │       ├── trpc.ts         # Config tRPC client + server
│   │       ├── auth.ts         # Config Auth.js
│   │       ├── seed.ts         # Seed initial
│   │       └── utils.ts        # formatCFA, formatDate, generateMatricule
│   │
│   └── middleware.ts           # Auth guard → /login si pas de session
│
├── drizzle/
│   └── migrations/
├── public/
│   └── logo-cemas.svg
├── .env.example
├── biome.json
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 3.2 Principes

- Chaque module est autonome : schema Drizzle + router tRPC + composants UI
- Le schema global est assemblé en important tous les schemas modules dans `db.ts`
- Le root tRPC router merge tous les routers modules
- Les composants UI partagés vivent dans `shared/ui/`
- Groupe de routes `(auth)` et `(dashboard)` avec layouts séparés

---

## 4. Schéma de base de données

Tous les IDs sont des `uuid` via `gen_random_uuid()`. Les montants sont en `integer` (FCFA, pas de centimes).

### 4.1 Module Academic

```sql
-- Années scolaires
CREATE TABLE annees_scolaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  libelle VARCHAR(20) NOT NULL,         -- "2025-2026"
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Niveaux (Crèche, Préscolaire, Élémentaire)
CREATE TABLE niveaux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(50) NOT NULL,
  ordre INTEGER NOT NULL                -- 1, 2, 3
);

-- Classes
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,            -- "CE1", "Petite Section"
  niveau_id UUID NOT NULL REFERENCES niveaux(id),
  capacite INTEGER NOT NULL DEFAULT 30,
  annee_scolaire_id UUID NOT NULL REFERENCES annees_scolaires(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Matières
CREATE TABLE matieres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,            -- "Français", "Mathématiques"
  coefficient INTEGER NOT NULL DEFAULT 1,
  niveau_id UUID NOT NULL REFERENCES niveaux(id)
);
```

### 4.2 Module Students

```sql
-- Élèves
CREATE TABLE eleves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule VARCHAR(20) UNIQUE NOT NULL, -- "CEMAS-2025-0001"
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  date_naissance DATE NOT NULL,
  lieu_naissance VARCHAR(200),
  sexe VARCHAR(1) NOT NULL CHECK (sexe IN ('M', 'F')),
  adresse TEXT,
  photo_url TEXT,
  classe_id UUID NOT NULL REFERENCES classes(id),
  annee_scolaire_id UUID NOT NULL REFERENCES annees_scolaires(id),
  statut VARCHAR(20) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'transfere')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Parents / Tuteurs
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  telephone VARCHAR(20) NOT NULL,
  telephone_2 VARCHAR(20),
  profession VARCHAR(100),
  adresse TEXT,
  relation VARCHAR(10) NOT NULL CHECK (relation IN ('pere', 'mere', 'tuteur')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Liaison élève-parent (N-N)
CREATE TABLE eleve_parents (
  eleve_id UUID NOT NULL REFERENCES eleves(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  PRIMARY KEY (eleve_id, parent_id)
);

-- Inscriptions (historique par année)
CREATE TABLE inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES eleves(id),
  classe_id UUID NOT NULL REFERENCES classes(id),
  annee_scolaire_id UUID NOT NULL REFERENCES annees_scolaires(id),
  date_inscription DATE NOT NULL DEFAULT CURRENT_DATE,
  montant_inscription INTEGER NOT NULL DEFAULT 0,
  statut VARCHAR(20) NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('confirmee', 'en_attente')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (eleve_id, annee_scolaire_id)
);
```

### 4.3 Module Finance

```sql
-- Types de frais
CREATE TABLE types_frais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,            -- "Scolarité", "Tenue", "Cantine"
  montant_defaut INTEGER NOT NULL DEFAULT 0,
  obligatoire BOOLEAN NOT NULL DEFAULT true
);

-- Grille de frais par classe
CREATE TABLE grille_frais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classe_id UUID NOT NULL REFERENCES classes(id),
  type_frais_id UUID NOT NULL REFERENCES types_frais(id),
  annee_scolaire_id UUID NOT NULL REFERENCES annees_scolaires(id),
  montant_mensuel INTEGER NOT NULL,
  UNIQUE (classe_id, type_frais_id, annee_scolaire_id)
);

-- Paiements cash
CREATE TABLE paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES eleves(id),
  type_frais_id UUID NOT NULL REFERENCES types_frais(id),
  annee_scolaire_id UUID NOT NULL REFERENCES annees_scolaires(id),
  mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  montant INTEGER NOT NULL,
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_recu VARCHAR(20) UNIQUE NOT NULL, -- "REC-2025-0042"
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (eleve_id, type_frais_id, annee_scolaire_id, mois)
);

-- Catégories de dépenses
CREATE TABLE categories_depenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL
);

-- Dépenses
CREATE TABLE depenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id UUID NOT NULL REFERENCES categories_depenses(id),
  libelle VARCHAR(200) NOT NULL,
  montant INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Catégories de recettes
CREATE TABLE categories_recettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL
);

-- Recettes hors scolarité
CREATE TABLE recettes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categorie_id UUID NOT NULL REFERENCES categories_recettes(id),
  libelle VARCHAR(200) NOT NULL,
  montant INTEGER NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 Module Transport

```sql
-- Véhicules
CREATE TABLE vehicules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  immatriculation VARCHAR(20) UNIQUE NOT NULL,
  marque VARCHAR(100),
  capacite INTEGER NOT NULL,
  chauffeur_nom VARCHAR(100) NOT NULL,
  chauffeur_tel VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Itinéraires
CREATE TABLE itineraires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  vehicule_id UUID REFERENCES vehicules(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Arrêts
CREATE TABLE arrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itineraire_id UUID NOT NULL REFERENCES itineraires(id) ON DELETE CASCADE,
  nom VARCHAR(100) NOT NULL,
  ordre INTEGER NOT NULL,
  heure_passage TIME
);

-- Affectations élève → itinéraire
CREATE TABLE affectations_transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES eleves(id),
  itineraire_id UUID NOT NULL REFERENCES itineraires(id),
  arret_id UUID NOT NULL REFERENCES arrets(id),
  annee_scolaire_id UUID NOT NULL REFERENCES annees_scolaires(id),
  UNIQUE (eleve_id, annee_scolaire_id)
);
```

### 4.5 Module Payroll

```sql
-- Employés
CREATE TABLE employes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matricule VARCHAR(20) UNIQUE NOT NULL, -- "EMP-001"
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  telephone VARCHAR(20),
  poste VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('enseignant', 'administratif', 'entretien')),
  salaire_base INTEGER NOT NULL,
  date_embauche DATE NOT NULL,
  statut VARCHAR(10) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bulletins de paie
CREATE TABLE bulletins_paie (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id UUID NOT NULL REFERENCES employes(id),
  mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee INTEGER NOT NULL,
  salaire_base INTEGER NOT NULL,
  primes INTEGER NOT NULL DEFAULT 0,
  retenues INTEGER NOT NULL DEFAULT 0,
  net_a_payer INTEGER NOT NULL,
  date_paiement DATE,
  paye BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (employe_id, mois, annee)
);
```

### 4.6 Auth (Auth.js)

```sql
-- Utilisateur directeur (unique)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  nom VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'directeur',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 5. Authentification

### 5.1 Stratégie

- **Provider** : Credentials (email + mot de passe bcrypt)
- **Session** : JWT (pas de table sessions DB)
- **Middleware** : Protège toutes les routes `(dashboard)/*`, redirige vers `/login`
- **Seed** : Le script `db:seed` crée le compte directeur initial

### 5.2 Flux

1. L'utilisateur accède à `/` → redirigé vers `/login`
2. Saisie email + mot de passe → validation credentials → JWT signé
3. Accès au dashboard → le middleware vérifie le JWT à chaque requête
4. Déconnexion → suppression du cookie JWT

---

## 6. Interface utilisateur

### 6.1 Palette CEMAS

| Rôle | Couleur | CSS variable |
|------|---------|--------------|
| Primary | `#665d9d` | `--color-primary` |
| Primary hover | `#554d87` | `--color-primary-hover` |
| Secondary | `#fbc616` | `--color-secondary` |
| Secondary hover | `#e0b114` | `--color-secondary-hover` |
| Background | `#f8f9fa` | `--color-bg` |
| Surface | `#ffffff` | `--color-surface` |
| Text | `#1a1a1a` | `--color-text` |
| Muted | `#6b7280` | `--color-muted` |
| Success | `#16a34a` | `--color-success` |
| Danger | `#dc2626` | `--color-danger` |
| Warning | `#fbc616` | `--color-warning` |

### 6.2 Layout

- **Sidebar** fixe 260px, fond `#665d9d`, texte blanc, icônes lucide-react
- **Header** sticky, fond blanc, contient : sélecteur année scolaire, nom directeur, déconnexion
- **Content area** fond `#f8f9fa`, padding 24px
- **Responsive** : sidebar collapse en hamburger menu sous 1024px

### 6.3 Dashboard (page d'accueil)

**KPI Cards (4 colonnes) :**

| Card | Donnée | Icône lucide |
|------|--------|--------------|
| Total Élèves | Compteur élèves actifs | `Users` |
| Classes | Nombre total | `GraduationCap` |
| Recouvrement | % frais payés mois courant | `BadgePercent` |
| Masse salariale | Total net du mois | `Banknote` |

**Graphiques Recharts :**
1. Bar chart — Recettes vs Dépenses par mois (12 mois)
2. Pie chart — Répartition élèves par niveau
3. Table — 5 derniers paiements reçus

### 6.4 Pages par module

**Académique :**
- `/academique/annees` — CRUD années scolaires + toggle année active
- `/academique/classes` — Liste classes par niveau, créer/éditer, voir effectif
- `/academique/matieres` — CRUD matières avec coefficient par niveau

**Élèves :**
- `/eleves` — DataTable paginée, filtres (classe, niveau, statut), recherche texte
- `/eleves/[id]` — Fiche élève : infos personnelles, parent(s), historique paiements, transport
- `/eleves/nouveau` — Formulaire multi-step : info élève → info parent → choix classe

**Finances :**
- `/finances/paiements` — Enregistrer paiement cash, sélection élève + mois + type, impression reçu
- `/finances/suivi` — Tableau croisé élèves × mois (12 colonnes), cellules vert/rouge
- `/finances/depenses` — CRUD dépenses avec catégorie
- `/finances/recettes` — CRUD recettes hors scolarité
- `/finances/bilan` — Résumé mensuel et annuel (total entrées - total sorties)

**Transport :**
- `/transport/vehicules` — CRUD véhicules avec info chauffeur
- `/transport/itineraires` — CRUD itinéraires + arrêts ordonnés (drag & drop)
- `/transport/affectations` — Affecter élèves aux itinéraires/arrêts

**Payroll :**
- `/payroll/employes` — CRUD employés (enseignants + staff)
- `/payroll/bulletins` — Générer bulletins du mois, saisir primes/retenues, marquer payé
- `/payroll/historique` — Vue par mois avec totaux

### 6.5 Composants UI partagés

| Composant | Description |
|-----------|-------------|
| `DataTable` | Table paginée, triable, filtrable avec recherche |
| `StatCard` | Card KPI (icône, valeur, label, tendance) |
| `FormModal` | Modal pour création/édition (formulaire Zod) |
| `ConfirmDialog` | Dialog de confirmation suppression |
| `PrintLayout` | Layout impression (reçus, bulletins de paie) |
| `PageHeader` | Titre page + breadcrumb + bouton action principal |
| `EmptyState` | État vide avec illustration et CTA |
| `StatusBadge` | Badge coloré (payé/impayé, actif/inactif) |
| `MonthPicker` | Sélecteur de mois pour paiements et payroll |
| `YearSwitcher` | Sélecteur d'année scolaire (dans le header) |

### 6.6 Impression reçu de paiement

Format A5 portrait, CSS `@media print` :
- En-tête : Logo + nom CEMAS + adresse
- Numéro de reçu auto-généré (`REC-{année}-{séquence}`)
- Infos élève (nom, classe)
- Détail paiement (type, mois, montant en FCFA)
- Date et espace signature

---

## 7. Configuration technique

### 7.1 Docker Compose

3 services :
- **app** : Next.js standalone (node:20-alpine), port 3000
- **db** : PostgreSQL 16 Alpine, volume persistant `pgdata`
- **nginx** : Reverse proxy, ports 80/443, SSL optionnel

Compatible Portainer. Requis : ~1 Go RAM.

### 7.2 next.config.ts

- `output: "standalone"` pour Docker
- `serverExternalPackages: ["bcrypt"]`

### 7.3 Seed initial (`db:seed`)

Données créées au premier lancement :
1. Compte directeur (email + mot de passe bcrypt)
2. Année scolaire 2025-2026 (active)
3. 3 niveaux : Crèche (ordre 1), Préscolaire (ordre 2), Élémentaire (ordre 3)
4. 9 classes par défaut : Petite Section, Moyenne Section, Grande Section, CI, CP, CE1, CE2, CM1, CM2
5. Matières de base par niveau : Français, Mathématiques, Éveil, Éducation physique
6. Catégories de dépenses par défaut : Fournitures, Entretien, Équipement, Divers
7. Catégories de recettes par défaut : Location salle, Événements, Dons, Divers
8. Types de frais par défaut : Scolarité, Inscription, Tenue

### 7.4 Conventions

| Aspect | Convention |
|--------|-----------|
| Langue du code | Variables/fonctions en anglais, labels UI en français |
| Dates | Stockées UTC (`timestamptz`), affichées `dd/MM/yyyy` |
| Montants | `integer` FCFA, formatés `Intl.NumberFormat('fr-SN')` |
| IDs | `uuid` via `gen_random_uuid()` |
| Matricules élèves | `CEMAS-{année}-{seq 4 chiffres}` |
| Matricules employés | `EMP-{seq 3 chiffres}` |
| Numéros reçus | `REC-{année}-{seq 4 chiffres}` |
| Validation | Zod partagé (un schema par module, importé client + serveur) |
| Formatage | Biome (tabs, double quotes) |

### 7.5 Variables d'environnement

```env
DATABASE_URL=postgresql://cemas:password@db:5432/cemas
AUTH_SECRET=<generated>
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CEMAS
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 8. Résumé des routes

| Route | Page | Module |
|-------|------|--------|
| `/login` | Connexion | Auth |
| `/` | Dashboard | — |
| `/academique/annees` | Années scolaires | Academic |
| `/academique/classes` | Classes | Academic |
| `/academique/matieres` | Matières | Academic |
| `/eleves` | Liste élèves | Students |
| `/eleves/[id]` | Fiche élève | Students |
| `/eleves/nouveau` | Inscription | Students |
| `/finances/paiements` | Enregistrer paiement | Finance |
| `/finances/suivi` | Suivi paiements (grille) | Finance |
| `/finances/depenses` | Dépenses | Finance |
| `/finances/recettes` | Recettes | Finance |
| `/finances/bilan` | Bilan financier | Finance |
| `/transport/vehicules` | Véhicules | Transport |
| `/transport/itineraires` | Itinéraires + arrêts | Transport |
| `/transport/affectations` | Affectations transport | Transport |
| `/payroll/employes` | Employés | Payroll |
| `/payroll/bulletins` | Bulletins de paie | Payroll |
| `/payroll/historique` | Historique paie | Payroll |
| `/parametres` | Paramètres école | Settings |

---

## 9. Page Paramètres

Page simple permettant au directeur de :
- Modifier son mot de passe
- Voir/éditer les infos de l'école (nom, adresse, téléphone) affichées sur les reçus
- Voir l'année scolaire active et en créer une nouvelle (avec bascule)
