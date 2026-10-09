# 06 - Décisions techniques (Tokens)

## DT-001 : Architecture monolithique modulaire

**Décision :** Pas de microservices. Un seul déploiement Next.js avec des modules par domaine métier.

**Contexte :** Application mono-utilisateur pour une seule école. La complexité des microservices n'est pas justifiée.

**Structure :**
```
src/modules/
├── academic/   (schema.ts, router.ts, validation.ts)
├── auth/       (schema.ts)
├── dashboard/  (router.ts)
├── finance/    (schema.ts, router.ts, validation.ts)
├── payroll/    (schema.ts, router.ts, validation.ts)
├── students/   (schema.ts, router.ts, validation.ts)
└── transport/  (schema.ts, router.ts, validation.ts)
```

---

## DT-002 : tRPC v11 pour l'API

**Décision :** Utiliser tRPC plutôt que REST ou GraphQL.

**Raisons :**
- Type-safety de bout en bout sans génération de code
- Intégration native avec React Query via `@trpc/react-query`
- Pas besoin de documenter des endpoints séparément (les types servent de documentation)
- Performance : pas de sérialisation/désérialisation de schéma GraphQL

---

## DT-003 : Drizzle ORM plutôt que Prisma

**Décision :** Drizzle ORM pour l'accès base de données.

**Raisons :**
- Schémas définis en TypeScript pur (pas de DSL spécifique)
- Requêtes SQL proches du métal quand nécessaire (`sql` template tag)
- Pas de génération de client nécessaire
- Meilleure performance que Prisma pour les requêtes complexes
- Support natif des relations avec `query.findMany({ with: {...} })`

---

## DT-004 : UUID v4 pour toutes les clés primaires

**Décision :** Utiliser `uuid` avec `gen_random_uuid()` au lieu de séquences auto-incrémentées.

**Raisons :**
- Pas de fuite d'information sur le nombre d'enregistrements
- Génération côté base de données (pas de collision)
- Compatibilité future si migration vers un système distribué

---

## DT-005 : Montants en integer (FCFA)

**Décision :** Stocker tous les montants financiers en integer PostgreSQL.

**Raisons :**
- Le FCFA n'a pas de centimes → pas besoin de décimales
- Évite les erreurs d'arrondi des float
- Calculs arithmétiques exacts
- Formatage avec `Intl.NumberFormat('fr-SN')` côté affichage

---

## DT-006 : Tailwind CSS v4 avec `@theme`

**Décision :** Utiliser Tailwind v4 avec la directive `@theme` pour les tokens de design.

**Raisons :**
- Variables CSS natives (pas de `tailwind.config.js`)
- Cohérence des couleurs à travers l'application
- Thème centralisé dans `globals.css`

---

## DT-007 : Auth.js v5 avec Credentials provider

**Décision :** Authentification par email/mot de passe uniquement, pas d'OAuth.

**Raisons :**
- Application mono-utilisateur (directeur)
- Pas besoin de SSO ou connexion sociale
- Sessions JWT (stateless, pas de table session en base)
- Compte par défaut : `directeur@cemas.sn`

---

## DT-008 : Zod v4 pour la validation partagée

**Décision :** Schémas Zod partagés entre client et serveur.

**Raisons :**
- Un seul fichier `validation.ts` par module
- Validation identique côté formulaire et côté API
- Intégration native avec tRPC (`.input(schema)`)

---

## DT-009 : Biome plutôt qu'ESLint + Prettier

**Décision :** Utiliser Biome comme linter et formatter unique.

**Raisons :**
- Outil unique remplaçant ESLint + Prettier
- Performance : écrit en Rust
- Configuration minimale

---

## DT-010 : Pas d'internationalisation (i18n)

**Décision :** Application en français uniquement, pas de framework i18n.

**Raisons :**
- Utilisateur unique francophone
- Pas de besoin multilingue identifié
- Réduit la complexité (pas de clés de traduction)

---

## DT-011 : Recharts pour les graphiques

**Décision :** Recharts pour le dashboard (BarChart, PieChart).

**Raisons :**
- Intégration React native
- API déclarative simple
- Responsive par défaut
- Suffisant pour les besoins (2 types de graphiques)

---

## DT-012 : pnpm comme package manager

**Décision :** pnpm plutôt que npm ou yarn.

**Raisons :**
- Gestion des dépendances stricte (pas de phantom dependencies)
- Espace disque optimisé via hard links
- Performance d'installation supérieure

---

> Ce fichier est la source de vérité pour les décisions techniques du projet CEMAS.
