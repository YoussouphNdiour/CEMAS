# 12 - Annexe : Inventaire des fichiers sources

## Modules métier (17 fichiers .ts)

### Module Académique
| Fichier | Description |
|---------|-------------|
| `src/modules/academic/schema.ts` | Tables : annees_scolaires, niveaux, classes, matieres + relations |
| `src/modules/academic/router.ts` | Routeurs : niveaux, annees, classes, matieres (14 procédures) |
| `src/modules/academic/validation.ts` | Schémas : create/update pour annee, classe, matiere |

### Module Auth
| Fichier | Description |
|---------|-------------|
| `src/modules/auth/schema.ts` | Table : users |

### Module Dashboard
| Fichier | Description |
|---------|-------------|
| `src/modules/dashboard/router.ts` | Procédures : stats, studentsByNiveau, recentPayments, monthlyRevenue |

### Module Finance
| Fichier | Description |
|---------|-------------|
| `src/modules/finance/schema.ts` | Tables : types_frais, grille_frais, paiements, categories_depenses, depenses, categories_recettes, recettes + relations |
| `src/modules/finance/router.ts` | Routeurs : typesFrais, grilleFrais, paiements, suivi, depenses, recettes, bilan (14 procédures) |
| `src/modules/finance/validation.ts` | Schémas : createPaiement, createDepense, createRecette, bilanFilters, grilleFrais |

### Module Paie
| Fichier | Description |
|---------|-------------|
| `src/modules/payroll/schema.ts` | Tables : employes, bulletins_paie + relations |
| `src/modules/payroll/router.ts` | Routeurs : employes, bulletins, historique (10 procédures) |
| `src/modules/payroll/validation.ts` | Schémas : createEmploye, updateEmploye, generateBulletins, updateBulletin |

### Module Élèves
| Fichier | Description |
|---------|-------------|
| `src/modules/students/schema.ts` | Tables : eleves, parents, eleve_parents, inscriptions + relations |
| `src/modules/students/router.ts` | Procédures : list, getById, create, update, delete, count |
| `src/modules/students/validation.ts` | Schémas : createStudent, updateStudent, studentFilters |

### Module Transport
| Fichier | Description |
|---------|-------------|
| `src/modules/transport/schema.ts` | Tables : vehicules, itineraires, arrets, affectations_transport + relations |
| `src/modules/transport/router.ts` | Routeurs : vehicules, itineraires, arrets, affectations (11 procédures) |
| `src/modules/transport/validation.ts` | Schémas : create/update pour vehicule, itineraire, arret, affectation |

---

## Shared (infrastructure partagée)

| Fichier | Description |
|---------|-------------|
| `src/shared/lib/auth.ts` | Configuration Auth.js v5, Credentials provider |
| `src/shared/lib/db.ts` | Client Drizzle connecté à PostgreSQL |
| `src/shared/lib/root-router.ts` | Routeur tRPC racine, intègre les 6 modules |
| `src/shared/lib/trpc.ts` | Init tRPC, contexte, publicProcedure, protectedProcedure |
| `src/shared/lib/trpc-client.ts` | Client tRPC React avec React Query |
| `src/shared/lib/utils.ts` | formatCFA, formatDate, generateMatricule, cn, MOIS_LABELS |
| `src/shared/lib/seed.ts` | Script de seed pour niveaux + utilisateur par défaut |
| `src/shared/providers.tsx` | SessionProvider + TRPCProvider wrapper |

---

## Composants UI (12 fichiers)

| Fichier | Export | Description |
|---------|--------|-------------|
| `src/shared/ui/button.tsx` | `Button`, `ButtonProps` | Bouton avec variantes |
| `src/shared/ui/stat-card.tsx` | `StatCard` | Carte indicateur KPI |
| `src/shared/ui/page-header.tsx` | `PageHeader` | En-tête de page |
| `src/shared/ui/form-modal.tsx` | `FormModal` | Modal formulaire |
| `src/shared/ui/confirm-dialog.tsx` | `ConfirmDialog` | Dialog de confirmation |
| `src/shared/ui/status-badge.tsx` | `StatusBadge` | Badge de statut |
| `src/shared/ui/empty-state.tsx` | `EmptyState` | État vide |
| `src/shared/ui/month-picker.tsx` | `MonthPicker` | Sélecteur mois/année |
| `src/shared/ui/print-layout.tsx` | `PrintLayout` | Layout d'impression |
| `src/shared/ui/data-table.tsx` | `DataTable`, `Column` | Tableau de données |
| `src/shared/ui/sidebar.tsx` | `Sidebar` | Navigation latérale |
| `src/shared/ui/index.ts` | Barrel exports | Index des exports |

---

## Pages frontend (21 fichiers page.tsx)

| Route | Fichier | Description |
|-------|---------|-------------|
| `/` | `app/(dashboard)/page.tsx` | Tableau de bord |
| `/login` | `app/(auth)/login/page.tsx` | Connexion |
| `/parametres` | `app/(dashboard)/parametres/page.tsx` | Paramètres |
| `/academique/annees` | `app/(dashboard)/academique/annees/page.tsx` | Années scolaires |
| `/academique/classes` | `app/(dashboard)/academique/classes/page.tsx` | Classes |
| `/academique/matieres` | `app/(dashboard)/academique/matieres/page.tsx` | Matières |
| `/eleves` | `app/(dashboard)/eleves/page.tsx` | Liste élèves |
| `/eleves/nouveau` | `app/(dashboard)/eleves/nouveau/page.tsx` | Inscription |
| `/eleves/[id]` | `app/(dashboard)/eleves/[id]/page.tsx` | Fiche élève |
| `/finances/paiements` | `app/(dashboard)/finances/paiements/page.tsx` | Paiements |
| `/finances/suivi` | `app/(dashboard)/finances/suivi/page.tsx` | Suivi paiements |
| `/finances/depenses` | `app/(dashboard)/finances/depenses/page.tsx` | Dépenses |
| `/finances/recettes` | `app/(dashboard)/finances/recettes/page.tsx` | Recettes |
| `/finances/bilan` | `app/(dashboard)/finances/bilan/page.tsx` | Bilan financier |
| `/payroll/employes` | `app/(dashboard)/payroll/employes/page.tsx` | Employés |
| `/payroll/bulletins` | `app/(dashboard)/payroll/bulletins/page.tsx` | Bulletins de paie |
| `/payroll/historique` | `app/(dashboard)/payroll/historique/page.tsx` | Historique paie |
| `/transport/vehicules` | `app/(dashboard)/transport/vehicules/page.tsx` | Véhicules |
| `/transport/itineraires` | `app/(dashboard)/transport/itineraires/page.tsx` | Itinéraires |
| `/transport/affectations` | `app/(dashboard)/transport/affectations/page.tsx` | Affectations |

---

## Fichiers de configuration

| Fichier | Description |
|---------|-------------|
| `package.json` | Dépendances et scripts npm |
| `tsconfig.json` | Configuration TypeScript |
| `next.config.ts` | Configuration Next.js |
| `drizzle.config.ts` | Configuration Drizzle Kit |
| `postcss.config.mjs` | Configuration PostCSS (Tailwind) |
| `.env` | Variables d'environnement (local) |
| `.env.example` | Template des variables d'environnement |
| `biome.json` | Configuration Biome (linter/formatter) |

---

> Ce fichier est la source de vérité pour l'inventaire des fichiers sources du projet CEMAS.
