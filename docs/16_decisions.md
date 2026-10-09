# 16 - Journal des décisions

## Format

Chaque décision est numérotée chronologiquement avec date, contexte, décision prise et conséquences.

---

### D-001 — Architecture monolithique modulaire
- **Date :** 2026-09-30
- **Contexte :** Choix d'architecture pour une application de gestion scolaire mono-utilisateur
- **Décision :** Architecture monolithique avec modules par domaine métier plutôt que microservices
- **Conséquences :** Déploiement simple, pas de communication inter-services, code organisé par domaine

### D-002 — tRPC v11 comme couche API
- **Date :** 2026-09-30
- **Contexte :** Besoin d'une API typée entre le frontend Next.js et le backend
- **Décision :** tRPC v11 avec React Query plutôt que REST ou GraphQL
- **Conséquences :** Type-safety de bout en bout, pas de documentation API séparée nécessaire

### D-003 — Drizzle ORM plutôt que Prisma
- **Date :** 2026-09-30
- **Contexte :** Choix d'ORM pour PostgreSQL
- **Décision :** Drizzle ORM pour ses schémas TypeScript natifs et ses performances
- **Conséquences :** Schémas en .ts (pas de DSL), accès SQL brut facile, pas de génération de client

### D-004 — Noms de tables et colonnes en français
- **Date :** 2026-09-30
- **Contexte :** Convention de nommage pour la base de données
- **Décision :** Tables et colonnes en français snake_case (annees_scolaires, bulletins_paie)
- **Conséquences :** Cohérence avec le domaine métier, mapping Drizzle camelCase ↔ snake_case

### D-005 — Auth.js Credentials uniquement
- **Date :** 2026-09-30
- **Contexte :** Application mono-utilisateur, pas besoin d'OAuth
- **Décision :** Auth.js v5 avec provider Credentials et sessions JWT
- **Conséquences :** Pas de table session en base, authentification simple par email/mot de passe

### D-006 — Tailwind CSS v4 avec @theme
- **Date :** 2026-09-30
- **Contexte :** Choix du framework CSS
- **Décision :** Tailwind v4 avec directive @theme pour les variables CSS natives
- **Conséquences :** Pas de tailwind.config.js, tokens dans globals.css

### D-007 — Biome plutôt qu'ESLint + Prettier
- **Date :** 2026-09-30
- **Contexte :** Besoin d'un linter et formatter
- **Décision :** Biome (outil unique en Rust) plutôt que la combinaison ESLint + Prettier
- **Conséquences :** Configuration minimale, performances élevées, un seul outil

### D-008 — Pages payroll sous /payroll/ et non /paie/
- **Date :** 2026-09-30
- **Contexte :** Conflit entre les routes créées par deux agents parallèles
- **Décision :** Conserver `/payroll/` qui correspond aux liens de la sidebar
- **Conséquences :** Suppression du dossier `/paie/` dupliqué

### D-009 — DataTable sans prop actions
- **Date :** 2026-09-30
- **Contexte :** Besoin d'ajouter des boutons d'action par ligne dans les tableaux
- **Décision :** Utiliser une colonne avec `render` plutôt qu'une prop `actions` dédiée
- **Conséquences :** Pattern cohérent, pas de modification du composant DataTable

### D-010 — Composants UI custom plutôt que bibliothèque tierce
- **Date :** 2026-09-30
- **Contexte :** Choix entre shadcn/ui, Radix, ou composants custom
- **Décision :** Composants UI simples et sur mesure (Button, StatCard, DataTable, etc.)
- **Conséquences :** Contrôle total, pas de dépendance supplémentaire, code léger

### D-011 — Produit « Gestion Ecole », établissement en paramètre
- **Date :** 2026-10-08
- **Contexte :** Le nom « CEMAS » était codé en dur à 11 endroits ; une version Excel « Gestion Ecole » existe
- **Décision :** L'application s'appelle « Gestion Ecole » (titre, connexion) ; nom, sigle, coordonnées et préfixes de l'établissement sont stockés dans `parametres_ecole` (ligne unique) et éditables dans Paramètres
- **Conséquences :** Les identifiants existants ne changent pas ; pas de logo pour l'instant

### D-012 — Séquences d'identifiants par préfixe
- **Date :** 2026-10-08
- **Contexte :** Préfixes configurables ; l'ancien calcul (`MAX` texte global + `split("-")`) cassait avec plusieurs préfixes
- **Décision :** La séquence est calculée par préfixe (et par année pour matricules élèves et reçus), par comparaison numérique
- **Conséquences :** Changer un préfixe redémarre la séquence à 1 pour ce préfixe ; unicité préservée

### D-013 — Repli des paramètres sur les valeurs par défaut
- **Date :** 2026-10-08
- **Contexte :** `scripts/entrypoint.sh` masque les erreurs de migration
- **Décision :** `getParametres()` renvoie les valeurs CEMAS si la table ou la ligne est absente
- **Conséquences :** L'application reste utilisable même si la migration `0005` n'est pas appliquée

### D-014 — CI/CD GitHub Actions + Portainer
- **Date :** 2026-10-09
- **Contexte :** Aucun pipeline ; déploiements manuels par redéploiement Git de la stack Portainer
- **Décision :** CI (typecheck, lint, build, e2e sur base neuve) à chaque PR et push ; déploiement automatique après une CI verte sur `main` via l'API Portainer, précédé d'un `pg_dump` et suivi d'une vérification de santé
- **Conséquences :** Secrets `PORTAINER_URL` / `PORTAINER_API_KEY` dans GitHub ; règles Biome historiques en avertissement (dette) ; voir `docs/18_ci_cd.md`

### D-015 — Bilan net des salaires, vue trésorerie
- **Date :** 2026-10-09
- **Contexte :** Le solde ignorait les salaires ; besoin d'un détail mensuel. En production, des parents paient d'avance (scolarité de janvier encaissée en octobre) et des dépenses existent en septembre
- **Décision :** Solde = paiements + recettes − dépenses − salaires payés. Détail mensuel rattaché à la date d'encaissement/décaissement ; octobre → juillet toujours affichés, autres mois s'ils ont des mouvements. Salaires de l'année = bulletins payés dont la période est dans l'année scolaire
- **Conséquences :** Le tableau mensuel montre la trésorerie réelle, pas le mois de scolarité concerné ; ajout de Vitest pour les calculs (lancé en CI)

### D-016 — Impayés : un mois payé est soldé
- **Date :** 2026-10-09
- **Contexte :** Montants réellement payés variables (remises, fratries) ; une comptabilité stricte créerait de faux impayés
- **Décision :** Un mois de frais mensuel pour lequel un paiement est enregistré est soldé, quel que soit le montant ; un frais unique est soldé par tout paiement de ce frais dans l'année
- **Conséquences :** Pas de suivi des paiements partiels ; Dû − Payé peut différer du Reste (expliqué sur la page)

### D-017 — Grille tarifaire : montant par défaut signalé
- **Date :** 2026-10-09
- **Contexte :** Grille vide en production, montants réels différents des défauts
- **Décision :** Écran de saisie de la grille ; en l'absence de montant, le calcul utilise le montant par défaut du frais et la page Impayés signale les classes concernées
- **Conséquences :** Les impayés sont exacts une fois la grille remplie

### D-018 — Sauvegarde quotidienne par un service dédié
- **Date :** 2026-10-09
- **Contexte :** Seules des sauvegardes avant déploiement existaient
- **Décision :** Service `backup` (image postgres:16-alpine + script) : `pg_dump -Fc` au démarrage puis chaque jour à 2 h UTC, vérifié, conservé 30 jours dans un volume dédié
- **Conséquences :** Restauration documentée (`docs/19_sauvegardes.md`) ; copie hors serveur à prévoir

---

> Ce fichier est la source de vérité pour le journal des décisions du projet CEMAS.
