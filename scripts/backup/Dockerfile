# Service de sauvegarde quotidienne (voir docs/19_sauvegardes.md)
FROM postgres:16-alpine
COPY scripts/backup/backup.sh /usr/local/bin/backup.sh
ENTRYPOINT ["sh", "/usr/local/bin/backup.sh"]
