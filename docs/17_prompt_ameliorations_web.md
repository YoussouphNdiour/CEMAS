# Prompt — Reporter dans l'app web CEMAS les fonctionnalités et décisions de la version Excel

## État (2026-10-09)

| Lot | Statut | PR | Spec / plan |
|-----|--------|----|-------------|
| 1. Paramètres de l'école | ✅ en production | #1 | `superpowers/specs/2026-10-08-lot1-parametres-ecole-design.md` |
| 2. Impayés et relances | ✅ en production | #6 | `superpowers/specs/2026-10-09-lot2-impayes-relances-design.md` |
| 3. Fiche de paie imprimable | ✅ en production | #8 | (lot borné, design en conversation) |
| 4. Passage à l'année suivante | ✅ en production | #10 | `superpowers/specs/2026-10-09-lot4-passage-annee-design.md` |
| 4b. Encadrement du passage | 🟡 design validé | — | fenêtre après la fin d'année, contrôles avant passage, bandeaux (sans email) |
| 5. Sauvegarde automatique | ✅ en production | #9 | `docs/19_sauvegardes.md` |
| 6. Bilan incluant les salaires | ✅ en production | #3 | (lot borné) |
| 7. Capacité des classes | ✅ en production | #4 | (lot borné) |
| 8. Second contact parent | ✅ en production | #5 | (lot borné) |
| Hors prompt : CI/CD | ✅ | #2, #7 | `docs/18_ci_cd.md` |

Décisions : `16_decisions.md` (D-011 à D-019). Points reportés : `10_current_issues.md`.

---

> À coller tel quel dans une nouvelle session Claude Code ouverte sur ce dépôt.

---

## Contexte

Une version Excel autonome de l'application, appelée **Gestion Ecole**, a été conçue (spec : `docs/superpowers/specs/2026-10-08-gestion-ecole-excel-design.md`). Pendant sa conception, des fonctionnalités et des décisions ont été ajoutées qui n'existent pas dans l'app web CEMAS. Ta mission : les reporter dans l'app web.

Avant tout :
- Lis `AGENTS.md` : cette version de Next.js diffère de ce que tu connais ; consulte `node_modules/next/dist/docs/` avant d'écrire du code.
- Lis `docs/01_project_overview.md`, `docs/02_features.md`, `docs/03_data_model.md`, `docs/04_api_spec.md`, `docs/09_code_conventions.md`, `docs/16_decisions.md`.
- Stack : Next.js (App Router), tRPC (`src/modules/*/router.ts`), Drizzle + PostgreSQL (`src/modules/*/schema.ts`, migrations dans `drizzle/`), modules dans `src/modules/`, pages dans `src/app/(dashboard)/`.
- Montants en FCFA (integer). Année scolaire = octobre à juillet. Les vues sont filtrées sur l'année active.
- Utilise la skill de brainstorming pour valider le design avec moi avant de coder, et traite chaque fonctionnalité ci-dessous comme un lot séparé (spec → plan → implémentation → tests). Commence par me proposer l'ordre.

## État actuel constaté (à revérifier)

- Le nom « CEMAS » est codé en dur à ~11 endroits : `src/app/layout.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/parametres/page.tsx`, `src/shared/ui/print-layout.tsx`, `src/shared/ui/sidebar.tsx`, `src/shared/lib/generate-recu-pdf.ts`, `src/shared/lib/mail.ts`, `src/shared/lib/seed.ts`, `src/modules/students/router.ts` (préfixe matricule `CEMAS-`).
- Reçu PDF de paiement : existe (`src/shared/lib/generate-recu-pdf.ts`).
- Archivage d'année : existe (flag `archived`, procédure `archive` dans `src/modules/academic/router.ts`), mais pas de passage d'élèves à l'année suivante.
- Suivi des paiements : compte payé/non payé par mois, mais pas de liste des impayés avec montants.
- Bilan : paiements + recettes − dépenses (salaires non inclus).

## Fonctionnalités à ajouter

### 1. Paramètres de l'école configurables
- Nouvelle table (ex. `parametres_ecole`, une seule ligne) : nom, sigle, logo (URL/fichier), adresse, téléphone 1/2, email, préfixe matricule élève, préfixe reçu, préfixe employé.
- Page Paramètres : formulaire d'édition (aujourd'hui en lecture seule).
- Remplacer tous les « CEMAS » codés en dur par ces valeurs (titre, login, sidebar, reçus PDF, en-tête d'impression, expéditeur email, génération de matricule).
- Les matricules existants ne changent pas ; seuls les nouveaux utilisent le préfixe configuré.
- Question à me poser : le nom de l'app web devient-il aussi « Gestion Ecole » (produit), avec le nom de l'école en paramètre ?

### 2. Impayés et relances
- Nouvelle page `finances/impayes` : pour chaque élève actif de l'année active, dû = Σ types de frais obligatoires (montant mensuel de la grille de sa classe × mois écoulés d'octobre au mois courant inclus) ; payé ; reste. Colonnes : matricule, élève, classe, dû, payé, reste, mois impayés, téléphone du parent. Filtres classe / niveau, tri par reste décroissant, total en pied.
- Procédure tRPC dédiée (calcul côté serveur, pas dans le client).
- Lettre de relance PDF par élève (et en lot pour la sélection), avec l'en-tête de l'école, la liste des mois impayés et le montant restant.
- KPI « Total impayés » sur le tableau de bord.

### 3. Fiche de paie imprimable
- Bouton sur chaque ligne de `payroll/bulletins` : fiche PDF (en-tête école, employé, matricule, poste, mois, base, primes, retenues, net, payé/date). Réutiliser le style de `generate-recu-pdf.ts`.
- Impression en lot du mois.

### 4. Passage à l'année suivante
- Ajouter `classe_suivante_id` (nullable, FK → classes) sur les classes ; éditable dans `academique/classes`.
- Assistant « Nouvelle année » sur `academique/annees` (dans une transaction) :
  1. crée l'année suivante (ou utilise une existante non archivée) ;
  2. recopie les classes et la grille tarifaire vers la nouvelle année (les classes sont rattachées à une année dans le modèle actuel) ;
  3. réinscrit les élèves actifs dans la classe suivante (nouvelle ligne `inscriptions`) ; élèves de dernière classe → statut inactif (sortants) ;
  4. active la nouvelle année et archive l'ancienne (procédure existante).
- Écran de prévisualisation avant validation (nombre d'élèves promus / sortants par classe).

### 5. Sauvegarde automatique de la base
- Service de sauvegarde dans `docker-compose.yml` (ex. conteneur cron + `pg_dump` quotidien, rétention 30 jours) dans un volume dédié.
- Documenter la restauration dans `docs/`.

### 6. Bilan incluant les salaires
- Décision : solde = paiements + recettes − dépenses − **salaires payés** (bulletins `paye = true` de l'année active).
- Ajouter le détail par mois (octobre → juillet) en plus des 4 indicateurs ; ajouter l'indicateur « Salaires payés ».
- Mettre à jour `docs/02_features.md` et `docs/16_decisions.md`.

### 7. Capacité des classes
- Afficher effectif et places restantes dans la liste des classes.
- À l'inscription : avertissement si la classe est pleine (confirmation requise, pas de blocage strict).

### 8. Second contact parent à l'inscription
- Vérifier si le formulaire d'inscription permet déjà un 2e parent/tuteur (la table `eleve_parents` le permet). Sinon, ajouter un bloc optionnel « 2e contact ».

## Décisions de la version Excel à NE PAS reporter

Spécifiques à Excel, sans intérêt pour le web : parents stockés sur la ligne de l'élève, feuilles-formulaires au lieu de fenêtres, archive dans un fichier séparé, sauvegarde par copie du fichier, absence de protection.

## Critères de fin pour chaque lot

- Migration Drizzle générée et appliquée ; seed mis à jour si besoin.
- Procédures tRPC validées par schéma (zod) ; tests e2e Playwright dans `e2e/` pour le parcours principal.
- Lint/format Biome propres, build OK.
- `docs/` mis à jour (features, data model, API, décisions).
