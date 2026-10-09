#!/bin/sh
# Test local du script de sauvegarde : une exécution (ONCE=1) contre une base PostgreSQL de dev.
# Usage : PGHOST=localhost PGUSER=cemas PGPASSWORD=… PGDATABASE=cemas sh scripts/backup/test-backup.sh
set -eu
DIR=$(mktemp -d)
trap 'rm -rf "$DIR"' EXIT

# Un vieux fichier (40 jours) doit être supprimé, un récent (5 jours) conservé
touch -t "$(date -v-40d +%Y%m%d%H%M 2>/dev/null || date -d '40 days ago' +%Y%m%d%H%M)" "$DIR/cemas-ancien.dump"
touch -t "$(date -v-5d +%Y%m%d%H%M 2>/dev/null || date -d '5 days ago' +%Y%m%d%H%M)" "$DIR/cemas-recent.dump"

BACKUP_DIR="$DIR" RETENTION_JOURS=30 ONCE=1 sh "$(dirname "$0")/backup.sh"

echec() { echo "ÉCHEC : $1" >&2; exit 1; }
nouveau=$(find "$DIR" -name 'cemas-2*.dump' | head -1)
[ -n "$nouveau" ] || echec "aucune sauvegarde créée"
pg_restore -l "$nouveau" | grep -q "TABLE DATA" || echec "sauvegarde illisible"
[ ! -e "$DIR/cemas-ancien.dump" ] || echec "le fichier de 40 jours n'a pas été supprimé"
[ -e "$DIR/cemas-recent.dump" ] || echec "le fichier de 5 jours a été supprimé"
[ -z "$(find "$DIR" -name '*.tmp')" ] || echec "fichier temporaire restant"
echo "OK : $(basename "$nouveau")"
