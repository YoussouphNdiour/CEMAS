#!/bin/sh
# Sauvegarde quotidienne de la base PostgreSQL (service « backup » de docker-compose).
# - une sauvegarde au démarrage, puis chaque jour à BACKUP_HEURE (heure UTC = heure de Dakar)
# - format pg_dump -Fc, vérifié par pg_restore -l ; conservation RETENTION_JOURS jours
# Connexion : variables PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE.
# ONCE=1 : une seule sauvegarde puis sortie (tests).
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_JOURS="${RETENTION_JOURS:-30}"
BACKUP_HEURE="${BACKUP_HEURE:-2}"

log() { echo "[backup] $(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

sauvegarder() {
	fichier="$BACKUP_DIR/cemas-$(date -u +%Y%m%d-%H%M%S).dump"
	if pg_dump -Fc -f "$fichier.tmp" && pg_restore -l "$fichier.tmp" > /dev/null; then
		mv "$fichier.tmp" "$fichier"
		log "OK $fichier ($(du -h "$fichier" | cut -f1))"
	else
		rm -f "$fichier.tmp"
		log "ÉCHEC de la sauvegarde" >&2
		return 1
	fi
	find "$BACKUP_DIR" -name 'cemas-*.dump' -type f -mtime +"$RETENTION_JOURS" | while read -r ancien; do
		rm -f "$ancien"
		log "supprimé (plus de $RETENTION_JOURS jours) $ancien"
	done
}

# Secondes jusqu'à la prochaine BACKUP_HEURE:00 UTC
attente() {
	h=$(date -u +%H); m=$(date -u +%M); s=$(date -u +%S)
	ecoule=$(( $(expr "$h" + 0) * 3600 + $(expr "$m" + 0) * 60 + $(expr "$s" + 0) ))
	cible=$(( BACKUP_HEURE * 3600 ))
	if [ "$ecoule" -lt "$cible" ]; then echo $(( cible - ecoule )); else echo $(( 86400 - ecoule + cible )); fi
}

mkdir -p "$BACKUP_DIR"
sauvegarder || true
[ "${ONCE:-0}" = "1" ] && exit 0

while true; do
	secondes=$(attente)
	log "prochaine sauvegarde dans ${secondes}s"
	sleep "$secondes"
	sauvegarder || true
done
