# 18 - CI/CD

## Vue d'ensemble

```
PR ou push ──► CI (.github/workflows/ci.yml)
               ├─ checks : typecheck → lint (Biome) → tests unitaires (Vitest) → build
               └─ e2e    : Postgres 16 neuf → migrate → seed → Playwright (e2e/01..07)

push sur main + CI verte ──► Deploy (.github/workflows/deploy.yml)
               1. sauvegarde pg_dump (dans le volume de la base)
               2. redéploiement Git de la stack Portainer « cemas » (id 76)
               3. vérification https://cemas.online/api/trpc/settings.public
```

- Le déploiement ne part que si la CI du push sur `main` est verte. Il peut aussi être lancé à la main (onglet Actions → Deploy → Run workflow).
- Un seul déploiement à la fois (`concurrency: deploy-production`).
- Le job utilise l'environnement GitHub `production` : on peut y ajouter une approbation manuelle obligatoire (Settings → Environments → production → Required reviewers).

## Comment la production est construite

La stack Portainer `cemas` (endpoint 3, stack 76) est une stack **Git** : Portainer clone `main`, construit l'image avec le `Dockerfile` et lance `docker-compose.yml`. Au démarrage, `scripts/entrypoint.sh` applique les migrations Drizzle puis le seed, puis démarre Next.js.

Attention : l'entrypoint masque les erreurs de migration. La vérification de santé du déploiement ne les détecte que si l'application ne répond plus.

## Secrets GitHub

| Secret | Valeur |
|---|---|
| `PORTAINER_URL` | `https://2.59.156.226:9443` |
| `PORTAINER_API_KEY` | Clé d'API Portainer (Mon compte → Access tokens) |

Après rotation de la clé :

```bash
gh secret set PORTAINER_API_KEY
```

Le certificat Portainer est auto-signé : le script utilise `curl -k`.

## Sauvegardes de déploiement

- Emplacement : `/var/lib/postgresql/data/backups/predeploy-<sha>-<date>.dump` dans le conteneur `cemas-db-1` (volume `cemas_cemas_pgdata`).
- Format `pg_dump -Fc`, vérifié par `pg_restore -l`. Les 10 plus récents sont conservés.
- Ce sont des sauvegardes de sécurité avant déploiement, pas une politique de sauvegarde (voir le lot « Sauvegarde automatique »).

## Restaurer une sauvegarde

Dans Portainer → Containers → `cemas-db-1` → Console (`sh`) :

```sh
ls -t /var/lib/postgresql/data/backups/
# Arrêter l'application d'abord (Portainer → cemas-app-1 → Stop)
pg_restore -U cemas -d cemas --clean --if-exists \
  /var/lib/postgresql/data/backups/predeploy-<sha>-<date>.dump
```

Puis redémarrer `cemas-app-1`.

## Revenir à une version précédente du code

```bash
git revert <commit>   # sur une branche, puis PR → main
```

La CI puis le déploiement repartent automatiquement. En urgence : lancer `Deploy` à la main après le revert.

## Tester le script sans déployer

```bash
PORTAINER_URL=… PORTAINER_API_KEY=… PORTAINER_ENDPOINT_ID=3 PORTAINER_STACK_ID=76 \
DB_CONTAINER=cemas-db-1 APP_URL=https://cemas.online DEPLOY_SHA=$(git rev-parse HEAD) \
DRY_RUN=1 bash scripts/deploy/portainer-deploy.sh
```

`DRY_RUN=1` fait la sauvegarde et la vérification, sans redéployer.

## Lint

`biome.json` (Biome 2.5). Les règles historiques sont en avertissement : libellés de formulaire non associés, boutons sans `type`, assertions non nulles, clés d'index, `!important`, variables inutilisées. C'est une dette à résorber progressivement. Toute autre erreur bloque la CI.
