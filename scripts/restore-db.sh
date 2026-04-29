#!/usr/bin/env bash
# Smart production readiness §8 — Postgres restore script.
#
# Usage:
#   scripts/restore-db.sh ./backups/20260429-150000-mtt.sql.gz
#   DATABASE_URL=... scripts/restore-db.sh ./backup.sql.gz
#   ASSUME_YES=1 scripts/restore-db.sh ./backup.sql.gz   # skip confirm prompt
#   USE_DOCKER=1 scripts/restore-db.sh ./backup.sql.gz   # force docker exec
#
# DROP + CREATE + restore. **Phá toàn bộ data hiện có**.
# Yêu cầu confirm trừ khi ASSUME_YES=1 (cho cron/CI).
#
# Pair với scripts/backup-db.sh.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"
DATABASE_URL="${DATABASE_URL:-postgresql://mtt:mtt@localhost:5432/mtt}"
ASSUME_YES="${ASSUME_YES:-0}"
USE_DOCKER="${USE_DOCKER:-auto}"

# Mask password trong DATABASE_URL khi log/echo (không leak credentials vào cron/CI log file).
SAFE_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's|://([^:]+):[^@]+@|://\1:***@|')"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "FATAL: backup file not found: $BACKUP_FILE" >&2
  exit 2
fi

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "FATAL: backup file is empty: $BACKUP_FILE" >&2
  exit 3
fi

# Extract DB name from URL.
DB_PATH="${DATABASE_URL##*/}"
DB_NAME="${DB_PATH%%\?*}"
if [[ -z "$DB_NAME" ]]; then
  echo "FATAL: cannot parse DB name from DATABASE_URL=$SAFE_URL" >&2
  exit 4
fi

# Decide strategy.
if [[ "$USE_DOCKER" == "auto" ]]; then
  if command -v psql >/dev/null 2>&1; then
    USE_DOCKER=0
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^xuantoi-pg$'; then
    USE_DOCKER=1
  else
    echo "FATAL: neither psql nor xuantoi-pg container available" >&2
    exit 5
  fi
fi

echo "[restore-db] DATABASE_URL=$SAFE_URL"
echo "[restore-db] Backup file: $BACKUP_FILE"
echo "[restore-db] Strategy: $([[ "$USE_DOCKER" == "1" ]] && echo "docker exec" || echo "host psql")"
echo
echo "WARNING: this will DROP database \"$DB_NAME\" and restore from $BACKUP_FILE."
echo "         All current data in \"$DB_NAME\" will be lost."
echo

if [[ "$ASSUME_YES" != "1" ]]; then
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "[restore-db] Aborted." >&2
    exit 6
  fi
fi

# Validate gzip integrity first.
if ! gunzip -t "$BACKUP_FILE" 2>/dev/null; then
  echo "FATAL: backup file is corrupted gzip: $BACKUP_FILE" >&2
  exit 7
fi

if [[ "$USE_DOCKER" == "1" ]]; then
  # Drop + recreate db inside docker.
  echo "[restore-db] Dropping & recreating $DB_NAME via docker exec..."
  docker exec -e PGPASSWORD=mtt xuantoi-pg \
    psql -U mtt -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
  docker exec -e PGPASSWORD=mtt xuantoi-pg \
    psql -U mtt -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
  echo "[restore-db] Restoring..."
  gunzip -c "$BACKUP_FILE" | docker exec -i -e PGPASSWORD=mtt xuantoi-pg \
    psql -U mtt -d "$DB_NAME" --quiet
else
  # Build maintenance URL trỏ vào DB `postgres` để DROP/CREATE.
  ADMIN_URL="${DATABASE_URL%/$DB_NAME*}/postgres"
  echo "[restore-db] Dropping & recreating $DB_NAME via host psql..."
  psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
  psql "$ADMIN_URL" -c "CREATE DATABASE \"$DB_NAME\";"
  echo "[restore-db] Restoring..."
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet
fi

echo "[restore-db] Done. Database \"$DB_NAME\" restored from $BACKUP_FILE."
echo "[restore-db] Sau restore, nhớ chạy: pnpm --filter @xuantoi/api bootstrap (idempotent admin + 3 sect)."
