# Backup & Restore — Postgres

Mục đích: khôi phục DB nhanh sau sự cố trong closed beta. Đảm bảo dữ liệu người chơi (Character, ledger, mail, giftcode redemption, sect) không mất.

> Pair script: `scripts/backup-db.sh` + `scripts/restore-db.sh` (Smart production readiness §8). Idempotent, an toàn để chạy nhiều lần.

## TL;DR

```bash
# Backup (default: ./backups/<timestamp>-mtt.sql.gz)
pnpm backup:db

# Restore (yêu cầu confirm)
pnpm restore:db ./backups/20260429-150000-mtt.sql.gz

# Restore bỏ confirm (cron / CI)
ASSUME_YES=1 pnpm restore:db ./backups/foo.sql.gz
```

## Tổng quan

- **Format**: `pg_dump --format=plain` + gzip → `.sql.gz`. Plain SQL dễ inspect (`gunzip -c file.sql.gz | head`), restore chỉ cần `psql`.
- **Strategy auto-detect**:
  1. Nếu host có `pg_dump`/`psql` → dùng host binary trực tiếp với `DATABASE_URL`.
  2. Nếu không, fallback sang `docker exec xuantoi-pg pg_dump ...` (dùng container dev).
  3. Force chế độ docker bằng `USE_DOCKER=1`.
- **Naming**: `<BACKUP_DIR>/<YYYYMMDD-HHMMSS>-<dbname>.sql.gz`. Default `BACKUP_DIR=./backups`.
- **Verify**: backup-db kiểm tra file > 0 byte + grep marker `-- PostgreSQL database dump`. Fail rõ nếu dump rỗng.
- **Risk khi restore**: **DROP DATABASE** rồi **CREATE** lại — phá toàn bộ data hiện có. Mặc định prompt `yes`; chỉ skip khi `ASSUME_YES=1`.
- **Bootstrap sau restore**: nếu restore từ backup cũ thiếu admin/sect, chạy `pnpm --filter @xuantoi/api bootstrap` (idempotent).

## Khi nào backup

- **Hàng ngày** (closed beta): chạy `pnpm backup:db` qua cron 02:00 sáng. Giữ 7 bản gần nhất.
- **Trước migration mới**: `pnpm backup:db` rồi mới `pnpm prisma:migrate`.
- **Trước restore production**: backup hiện trạng trước, đề phòng restore sai file.
- **Trước khi xoá hàng loạt** (admin script clean rác).

## Khi nào restore

- Sự cố data corruption (admin xoá nhầm, migration phá schema, container pg crash mất volume).
- Rollback sau release lỗi.
- Promote backup từ staging vào dev local để repro bug.

## Workflow chi tiết

### 1. Backup

```bash
# Default: backup DB hiện tại trỏ bởi DATABASE_URL hoặc fallback localhost:5432/mtt
pnpm backup:db

# Custom DB URL (ví dụ staging)
DATABASE_URL=postgresql://user:pass@staging.host:5432/mtt pnpm backup:db

# Custom output dir
BACKUP_DIR=/var/backups/xuantoi pnpm backup:db

# Force docker mode (bỏ qua host pg_dump nếu có)
USE_DOCKER=1 pnpm backup:db
```

Output mẫu:
```
[backup-db] DATABASE_URL=postgresql://mtt:mtt@localhost:5432/mtt
[backup-db] Writing to: ./backups/20260429-150000-mtt.sql.gz
[backup-db] Strategy: docker exec
[backup-db] Done: ./backups/20260429-150000-mtt.sql.gz (8.0K, 5966 bytes)
[backup-db] Verified PostgreSQL header marker.
```

Exit codes:
- `0` — success.
- `2` — DATABASE_URL không parse được DB name.
- `3` — không có cả `pg_dump` host lẫn `xuantoi-pg` container.
- `4` — file output rỗng (pg_dump fail).
- `5` — file thiếu PostgreSQL marker (file không phải dump hợp lệ).

### 2. Inspect backup

```bash
# Xem header
gunzip -c ./backups/20260429-150000-mtt.sql.gz | head -20

# Đếm số table
gunzip -c ./backups/20260429-150000-mtt.sql.gz | grep -c "CREATE TABLE"
# → expect ~21 (post Prisma schema 9e)

# Xem table cụ thể (e.g. Character)
gunzip -c ./backups/20260429-150000-mtt.sql.gz | grep -A 5 "TABLE.*Character"

# Đếm số record User (cần restore vào DB tạm)
gunzip -c ./backups/20260429-150000-mtt.sql.gz | grep -c "^INSERT INTO public.\"User\""
```

### 3. Restore

```bash
# Default: prompt confirm
pnpm restore:db ./backups/20260429-150000-mtt.sql.gz

# Bypass prompt (cron/CI)
ASSUME_YES=1 pnpm restore:db ./backups/20260429-150000-mtt.sql.gz

# Restore vào staging
DATABASE_URL=postgresql://user:pass@staging.host:5432/mtt \
  ASSUME_YES=1 pnpm restore:db ./backups/foo.sql.gz
```

Output mẫu:
```
[restore-db] DATABASE_URL=postgresql://mtt:mtt@localhost:5432/mtt
[restore-db] Backup file: ./backups/20260429-150000-mtt.sql.gz
[restore-db] Strategy: docker exec

WARNING: this will DROP database "mtt" and restore from ./backups/20260429-150000-mtt.sql.gz.
         All current data in "mtt" will be lost.

Type 'yes' to continue: yes
[restore-db] Dropping & recreating mtt via docker exec...
DROP DATABASE
CREATE DATABASE
[restore-db] Restoring...
[restore-db] Done. Database "mtt" restored from ./backups/20260429-150000-mtt.sql.gz.
[restore-db] Sau restore, nhớ chạy: pnpm --filter @xuantoi/api bootstrap (idempotent admin + 3 sect).
```

Exit codes:
- `0` — success.
- `1` — thiếu argument backup file.
- `2` — backup file không tồn tại.
- `3` — backup file rỗng.
- `4` — DATABASE_URL không parse được DB name.
- `5` — không có psql/docker.
- `6` — user huỷ ở prompt confirm.
- `7` — backup file gzip corrupted (`gunzip -t` fail).

### 4. Sau restore

1. **Bootstrap idempotent** (nếu backup thiếu admin/sect):
   ```bash
   pnpm --filter @xuantoi/api bootstrap
   ```
2. **Migrate** (nếu schema main mới hơn backup):
   ```bash
   cd apps/api && pnpm prisma:migrate
   ```
3. **Audit ledger** consistency:
   ```bash
   cd apps/api && pnpm audit:ledger
   ```
4. **Smoke test** theo `docs/QA_CHECKLIST.md` (login + character home view + mission claim).

## Cron daily backup (production)

Suggested crontab:
```cron
# Daily 02:00 — backup + giữ 7 ngày
0 2 * * * cd /opt/xuantoi && BACKUP_DIR=/var/backups/xuantoi pnpm backup:db >> /var/log/xuantoi-backup.log 2>&1
0 3 * * * find /var/backups/xuantoi -name '*.sql.gz' -mtime +7 -delete
```

Hoặc dùng systemd timer thay vì cron (production VM).

## Disaster recovery checklist

Khi DB primary chết hoàn toàn:

1. Provision DB instance mới (same Postgres version — production target = `postgres:16`).
2. Khôi phục từ backup gần nhất:
   ```bash
   DATABASE_URL=postgresql://user:pass@new-host:5432/mtt \
     ASSUME_YES=1 pnpm restore:db /var/backups/xuantoi/<latest>.sql.gz
   ```
3. Run migrate nếu schema repo mới hơn backup:
   ```bash
   cd apps/api && DATABASE_URL=... pnpm prisma:migrate
   ```
4. Bootstrap idempotent:
   ```bash
   cd apps/api && DATABASE_URL=... pnpm bootstrap
   ```
5. Smoke API: `curl https://api/api/healthz` + `curl https://api/api/readyz` đều trả `{ ok: true }`.
6. Smoke FE: login + character home + mission claim theo `docs/QA_CHECKLIST.md` 15-min check.

## Hạn chế hiện tại

- **Single dump file**: không có WAL streaming → RPO = thời gian giữa 2 lần backup. Trong closed beta acceptable; sau beta nên bổ sung pg_basebackup + WAL archiving (PITR).
- **Không encrypt**: file gzip plain text. Khi đẩy lên S3/GCS, dùng SSE hoặc encrypt thủ công (`gpg --symmetric file.sql.gz`).
- **Không offsite copy**: script chỉ ghi vào local `BACKUP_DIR`. Pair với rclone/aws-cli/scp riêng để upload offsite.
- **Không retention**: script không tự xoá backup cũ. Dùng `find ... -mtime +7 -delete` (xem cron mẫu).

## Liên kết

- `docs/RUN_LOCAL.md` — setup dev (cần Docker chạy `xuantoi-pg`).
- `docs/SECURITY.md` — chính sách secret + log không rò token.
- `docs/QA_CHECKLIST.md` — smoke test sau restore.
- `apps/api/prisma/schema.prisma` — current schema (21 model session 9e).
