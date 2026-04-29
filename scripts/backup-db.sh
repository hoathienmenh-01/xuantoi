#!/usr/bin/env bash
# Smart production readiness §8 — Postgres backup script.
#
# Usage:
#   scripts/backup-db.sh                 # default: backup current dev DB to ./backups/
#   DATABASE_URL=... scripts/backup-db.sh
#   BACKUP_DIR=/var/backups scripts/backup-db.sh
#   USE_DOCKER=1 scripts/backup-db.sh    # force pg_dump via docker exec xuantoi-pg
#
# Output: <BACKUP_DIR>/<YYYYMMDD-HHMMSS>-<dbname>.sql.gz
# Exit code: 0 on success, non-zero on failure (file size 0 → fail).
#
# Closed-beta scale: chạy thủ công hoặc cron daily. Kích thước DB nhỏ (< 100MB)
# → một single dump file an toàn. Khi scale lên dùng pg_basebackup + WAL archiving.

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql://mtt:mtt@localhost:5432/mtt}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
USE_DOCKER="${USE_DOCKER:-auto}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Parse DB name from URL (sau dấu / cuối, trước ?).
DB_PATH="${DATABASE_URL##*/}"
DB_NAME="${DB_PATH%%\?*}"
if [[ -z "$DB_NAME" ]]; then
  echo "FATAL: cannot parse DB name from DATABASE_URL=$DATABASE_URL" >&2
  exit 2
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/$TIMESTAMP-$DB_NAME.sql.gz"

# Decide pg_dump strategy.
if [[ "$USE_DOCKER" == "auto" ]]; then
  if command -v pg_dump >/dev/null 2>&1; then
    USE_DOCKER=0
  elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^xuantoi-pg$'; then
    USE_DOCKER=1
  else
    echo "FATAL: neither pg_dump nor xuantoi-pg container available" >&2
    echo "Install postgres-client (apt-get install postgresql-client) or run pnpm infra:up" >&2
    exit 3
  fi
fi

echo "[backup-db] DATABASE_URL=$DATABASE_URL"
echo "[backup-db] Writing to: $OUT"
echo "[backup-db] Strategy: $([[ "$USE_DOCKER" == "1" ]] && echo "docker exec" || echo "host pg_dump")"

if [[ "$USE_DOCKER" == "1" ]]; then
  # Container có sẵn psql user/pass, fix DB name.
  docker exec -e PGPASSWORD=mtt xuantoi-pg \
    pg_dump --no-owner --no-acl -U mtt -d "$DB_NAME" --format=plain \
    | gzip -9 > "$OUT"
else
  pg_dump --no-owner --no-acl --format=plain "$DATABASE_URL" \
    | gzip -9 > "$OUT"
fi

# Sanity check: file phải có nội dung > 0 byte.
if [[ ! -s "$OUT" ]]; then
  echo "FATAL: backup file is empty ($OUT)" >&2
  rm -f "$OUT"
  exit 4
fi

SIZE_BYTES="$(wc -c < "$OUT" | tr -d ' ')"
SIZE_HUMAN="$(du -h "$OUT" | cut -f1)"
echo "[backup-db] Done: $OUT ($SIZE_HUMAN, $SIZE_BYTES bytes)"

# Quick verification: gunzip preview head 5 lines must contain PostgreSQL marker.
if ! gunzip -c "$OUT" | head -5 | grep -q -- "-- PostgreSQL database dump"; then
  echo "WARN: backup file does not contain expected PostgreSQL marker" >&2
  echo "WARN: verify manually with: gunzip -c $OUT | head -20" >&2
  exit 5
fi
echo "[backup-db] Verified PostgreSQL header marker."
