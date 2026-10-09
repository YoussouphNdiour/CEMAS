# 01 - Vue d'ensemble du projet

## Vision

**Gestion Ecole** est une application web de gestion scolaire pour un établissement unique. Elle est déployée pour le **CEMAS** (Complexe Educatif Mame Anta Sidibe, Thiès, Sénégal) ; l'identité de l'établissement (nom, sigle, coordonnées, préfixes d'identifiants) est un paramètre (Paramètres → Établissement).

Elle couvre les niveaux Crèche, Préscolaire, Élémentaire et Moyen, et sert au directeur à gérer : configuration académique, inscriptions, paiements et impayés, dépenses/recettes, bilan, paie du personnel, transport scolaire, et passage à l'année suivante.

## Utilisateurs

| Rôle | Description | Accès |
|------|-------------|-------|
| Directeur | Utilisateur unique, administrateur de l'école | Toutes les fonctionnalités |

> Application mono-utilisateur (email / mot de passe). Production : compte créé par le seed (`admin@cemas.online`). Développement local : voir `docs/guide/README.md`.

## Contexte

- **Pays :** Sénégal · **Devise :** FCFA (entiers) · **Langue :** français (UI et contenu)
- **Année scolaire :** octobre à juillet ; une seule année active, les vues sont filtrées sur elle
- **Production :** https://cemas.online (Docker sur un VPS, stack Portainer construite depuis la branche `main`)

## Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Next.js (App Router) | 16.x |
| Runtime | React | 19.x |
| API | tRPC | 11.x |
| ORM | Drizzle ORM | 0.45.x |
| Base de données | PostgreSQL | 16 |
| Authentification | Auth.js (NextAuth v5) | 5.0.0-beta.32 |
| CSS | Tailwind CSS v4 | 4.x |
| Graphiques | Recharts | 3.x |
| PDF | jsPDF (reçus, relances, fiches de paie) | 4.x |
| Validation | Zod | 4.x |
| Tests | Vitest (unitaires), Playwright (e2e) | 5.x / 1.x |
| Linter/Formatter | Biome | 2.5.x |
| CI/CD | GitHub Actions + API Portainer | — |
| Package Manager | pnpm | 10.x |

## Principes architecturaux

1. **Monolithe modulaire** — un seul déploiement Next.js, code organisé en modules par domaine
2. **API typée de bout en bout** — tRPC entre client et serveur
3. **Validation partagée** — schémas Zod côté client et serveur
4. **Calculs métier purs et testés** — bilan, impayés, capacité, passage d'année : fonctions pures couvertes par Vitest, appelées par des services serveur
5. **Montants en entiers** — FCFA sans décimales
6. **UUID partout** — clés primaires `gen_random_uuid()`
7. **Production protégée** — CI verte obligatoire avant déploiement, sauvegarde avant chaque déploiement et sauvegarde quotidienne

## Métriques clés (2026-10-09)

| Métrique | Valeur |
|----------|--------|
| Modules | 8 (academic, students, finance, payroll, transport, dashboard, settings, auth) |
| Tables PostgreSQL | 23 |
| Pages | 24 |
| Procédures tRPC | ~80 |
| Migrations | 8 (`0000` → `0007`) |
| Tests | 35 Vitest, 47 Playwright |

## Documentation

| Fichier | Contenu |
|---------|---------|
| `02_features.md` | Fonctionnalités et règles métier |
| `03_data_model.md` | Tables et colonnes |
| `04_api_spec.md` | Procédures tRPC |
| `05_ui_spec.md` | Pages et composants |
| `09_code_conventions.md` | Conventions, tests, workflow git |
| `10_current_issues.md` | Problèmes connus et points reportés |
| `11_rebuild_plan.md` | Historique et suite du développement |
| `16_decisions.md` | Journal des décisions |
| `17_prompt_ameliorations_web.md` | Lots d'améliorations (état) |
| `18_ci_cd.md` | Pipeline CI/CD, déploiement, rollback |
| `19_sauvegardes.md` | Sauvegardes et restauration |
| `superpowers/specs`, `superpowers/plans` | Spec et plan de chaque lot |

---

> Ce fichier est la source de vérité pour la vue d'ensemble du projet.
