#!/bin/bash
# backup-db.sh — Run on Vultr server
set -e

BACKUP_DIR=/opt/perdiemify/backups
mkdir -p "$BACKUP_DIR"

docker exec perdiemify-postgres-1 pg_dump -U perdiemify perdiemify | gzip > "$BACKUP_DIR/db-$(date +%Y%m%d).sql.gz"

# Keep last 7 days
find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +7 -delete

echo "Backup complete: $BACKUP_DIR/db-$(date +%Y%m%d).sql.gz"
