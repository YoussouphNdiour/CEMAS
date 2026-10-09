# 19 - Sauvegardes de la base

## Ce qui est sauvegardé, quand, où

| | Sauvegarde quotidienne | Sauvegarde avant déploiement |
|---|---|---|
| Déclenchement | Au démarrage du service, puis chaque jour à **2 h** (heure de Dakar / UTC) | Avant chaque déploiement automatique (voir `18_ci_cd.md`) |
| Conteneur | `cemas-backup-1` (service `backup`) | `cemas-db-1` |
| Emplacement | `/backups/cemas-AAAAMMJJ-HHMMSS.dump` (volume `cemas_cemas_backups`) | `/var/lib/postgresql/data/backups/predeploy-<sha>-<date>.dump` |
| Conservation | **30 jours** (`RETENTION_JOURS`) | 10 derniers |

Format : `pg_dump -Fc` (base `cemas` complète), vérifié par `pg_restore -l` ; une sauvegarde illisible est supprimée et signalée dans les logs.

Script : `scripts/backup/backup.sh` ; image : `scripts/backup/Dockerfile` ; configuration : service `backup` de `docker-compose.yml`.

**Limite** : les sauvegardes sont sur le même serveur. Elles protègent contre une erreur de manipulation, pas contre la perte du serveur. Télécharger régulièrement une copie (voir ci-dessous) en attendant une copie automatique hors serveur.

## Sauvegardes déclenchées depuis l'application

- Le conteneur `cemas-app-1` monte le même volume (`/backups`, variable `BACKUP_DIR`) et dispose de `pg_dump`.
- Assistant de passage, étape 5 : « Faire une sauvegarde maintenant » crée `cemas-AAAAMMJJ-HHMMSS.dump` (purgé après 30 jours comme les autres).
- Juste avant le passage, l'application crée `prepassage-AAAAMMJJ-HHMMSS.dump` : **jamais purgé automatiquement**. C'est le point de retour si le passage doit être annulé (restauration ci-dessous).

## Vérifier que les sauvegardes fonctionnent

Portainer → Containers → `cemas-backup-1` → **Logs** : une ligne par sauvegarde, par exemple

```
[backup] 2026-10-10 02:00:01 OK /backups/cemas-20261010-020000.dump (96.0K)
[backup] 2026-10-10 02:00:01 prochaine sauvegarde dans 86399s
```

Lister les fichiers : `cemas-backup-1` → **Console** (`sh`) → `ls -lh /backups`.

## Télécharger une copie

Portainer → Containers → `cemas-backup-1` → bouton **Browse** (ou Volumes → `cemas_cemas_backups` → Browse) → télécharger le fichier `.dump` voulu.

## Restaurer une sauvegarde

1. **Arrêter l'application** : Portainer → Containers → `cemas-app-1` → Stop.
2. Ouvrir la console de `cemas-backup-1` (`sh`) et restaurer (remplace le contenu actuel de la base) :
   ```sh
   ls -lh /backups
   pg_restore --clean --if-exists -d cemas /backups/cemas-AAAAMMJJ-HHMMSS.dump
   ```
   (les variables `PGHOST`, `PGUSER`, `PGPASSWORD` du service sont déjà définies)
3. **Redémarrer l'application** : `cemas-app-1` → Start. Au démarrage elle applique les migrations manquantes.
4. Vérifier dans l'application (élèves, paiements du jour).

Pour restaurer une sauvegarde **d'avant déploiement**, même procédure depuis la console de `cemas-db-1` avec le chemin `/var/lib/postgresql/data/backups/…` et `-U cemas`.

## Lancer une sauvegarde immédiate

Redémarrer le conteneur `cemas-backup-1` (Restart) : il fait une sauvegarde au démarrage. Ou, depuis sa console : `ONCE=1 sh /usr/local/bin/backup.sh`.

## Tester le script en local

```sh
PGHOST=localhost PGUSER=cemas PGPASSWORD=… PGDATABASE=cemas sh scripts/backup/test-backup.sh
```
(`pg_dump` doit avoir la même version majeure que le serveur.)
