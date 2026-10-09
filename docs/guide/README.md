# Guide CEMAS

## Démarrage rapide

### Prérequis
- Node.js 20+
- pnpm 10+
- PostgreSQL 16

### Installation

```bash
# Cloner le projet
git clone <repo-url>
cd CEMAS

# Installer les dépendances
pnpm install

# Configurer l'environnement
cp .env.example .env.local
# Éditer .env.local avec votre DATABASE_URL et AUTH_SECRET

# Appliquer les migrations
pnpm db:migrate

# Seeder la base (niveaux + utilisateur par défaut)
pnpm db:seed

# Lancer le serveur de développement
pnpm dev
```

### Connexion
Le seed crée le compte administrateur défini dans `src/shared/lib/seed.ts`. Changez son mot de passe en production.

### Première utilisation

1. Se connecter
2. Renseigner l'établissement (Paramètres → Établissement)
3. Créer et activer l'année scolaire (Académique → Années scolaires)
4. Créer les classes et leur classe suivante (Académique → Classes)
5. Remplir la grille tarifaire (Finances → Grille tarifaire)
6. Inscrire les élèves
7. En fin d'année : Académique → Années → « Passer à l'année suivante »

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Serveur de développement (port 3000) |
| `pnpm build` | Build de production |
| `pnpm start` | Lancer la version de production |
| `pnpm db:generate` | Générer les migrations après modification des schémas |
| `pnpm db:migrate` | Appliquer les migrations en attente |
| `pnpm db:seed` | Peupler la base avec les données initiales |
| `pnpm db:studio` | Ouvrir l'explorateur visuel Drizzle |
| `pnpm lint` | Vérifier le code avec Biome |
| `pnpm format` | Formater le code avec Biome |
| `pnpm typecheck` | Vérifier les types |
| `pnpm test` | Tests unitaires (Vitest) |
| `pnpm test:e2e` | Tests bout en bout (Playwright) |

## Déploiement et sauvegardes

- Déploiement automatique après fusion dans `main` : `docs/18_ci_cd.md`
- Sauvegardes et restauration : `docs/19_sauvegardes.md`

## Structure du projet

Voir [12_appendix_sources_files.md](../12_appendix_sources_files.md) pour l'inventaire complet des fichiers.

---

> Ce guide est destiné au développeur qui prend en main le projet CEMAS.
