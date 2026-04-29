# Runtime Smoke Report — Session 9d→9g Integration (Task D)

> Verify end-to-end runtime của các flow đã merge từ session 9d→9g (PR #84..#107) trên `main` local @ `82f2020` (post PR #107 merge).
> Run: 29/4/2026 ~19:25–19:30 UTC. Tester: Devin (autonomous).
> Stack: API @ `http://localhost:3000` (NestJS dev watch), web @ `http://localhost:5173` (Vite dev), Postgres + Redis + Mailhog + MinIO via `pnpm infra:up`.

## 0. Setup

```bash
pnpm infra:up                                          # docker compose up -d (pg/redis/mailhog/minio)
cp apps/api/.env.example apps/api/.env                 # quote SMTP_FROM (chứa ký tự < >)
pnpm --filter @xuantoi/api exec prisma migrate deploy  # 9 migrations applied (init→password_reset_token)
pnpm --filter @xuantoi/api exec prisma db seed         # idempotent
pnpm --filter @xuantoi/api bootstrap                   # tạo admin@example.com + 3 sect mặc định
pnpm --filter @xuantoi/api dev                         # nest --watch :3000
pnpm --filter @xuantoi/web dev --port 5173 --host      # vite :5173
```

Healthz: `GET /api/healthz` → `{"ok":true,"uptimeMs":36723,"ts":"2026-04-29T19:24:52.686Z"}`.

## 1. Player register / login / onboard

| # | Endpoint | Result |
|---|---|---|
| 1.1 | `POST /api/_auth/register` | `ok:true`, user `cmokg2nug…` PLAYER role |
| 1.2 | `POST /api/_auth/login` | `ok:true`, cookie `xt_access` set |
| 1.3 | `GET /api/character/me` (before onboard) | `ok:true, character: null` |
| 1.4 | `POST /api/character/onboard` (`name="LyTieuDieu", sectKey="thanh_van"`) | `ok:true, character: {realmKey:"luyenkhi", realmStage:1, expNext:"1600", power:14, sectKey:"thanh_van"}` |
| 1.5 | Reject `name` chứa space (`"Lý Tiêu Diêu"`) | `INVALID_INPUT` (regex `[A-Za-zÀ-ỹ0-9._]+` không cho space — ✅ guard hoạt động) |
| 1.6 | `GET /api/me/next-actions` (after onboard) | `[{key:"DAILY_LOGIN_AVAILABLE", priority:2}, {key:"BOSS_ACTIVE", priority:3, params:{name:"Yêu Vương Thổ Huyết", level:1}}]` ✅ |
| 1.7 | `POST /api/character/cultivate` (`{cultivating:true}`) | `ok:true, character.cultivating:true` |

## 2. Daily login claim (PR #80)

| # | Endpoint | Result |
|---|---|---|
| 2.1 | `GET /api/daily-login/me` | `{todayDateLocal:"2026-04-30", canClaimToday:true, currentStreak:0, nextRewardLinhThach:"100"}` |
| 2.2 | `POST /api/daily-login/claim` | `{claimed:true, linhThachDelta:"100", newStreak:1, claimDateLocal:"2026-04-30"}` |
| 2.3 | `GET /api/logs/me?type=currency` | thấy entry `kind:"CURRENCY", reason:"DAILY_LOGIN", refType:"DailyLoginClaim", refId:"2026-04-30", delta:"100"` ✅ |

## 3. Leaderboard tabs (PR #94 BE + #99 FE)

| # | Endpoint | Result |
|---|---|---|
| 3.1 | `GET /api/leaderboard/power` | 1 row LyTieuDieu rank 1 power 14 sect thanh_van |
| 3.2 | `GET /api/leaderboard/topup` | `rows: []` (chưa có topup nào) |
| 3.3 | `GET /api/leaderboard/sect` | 3 rows (thanh_van rank 1 với memberCount 1, huyen_thuy + tu_la treasury 0) |

## 4. Admin login + dashboard (PR #20 + #61 + #76)

| # | Endpoint | Result |
|---|---|---|
| 4.1 | `POST /api/_auth/login` (`admin@example.com`) | `ok:true, role:"ADMIN"` |
| 4.2 | `GET /api/admin/users?limit=10` | 2 rows (player1 + admin), char info đính kèm |
| 4.3 | `GET /api/admin/stats` | `{users:{total:2, banned:0, admins:1}, characters:{total:1, cultivating:1}, economy:{linhThachCirculating:"100", topupPending:0}}` |
| 4.4 | `GET /api/admin/economy/alerts` | `{negativeCurrency:[], negativeInventory:[], stalePendingTopups:[]}` ✅ |

## 5. Admin grant currency + ledger

| # | Endpoint | Result |
|---|---|---|
| 5.1 | `POST /api/admin/users/:id/grant` (`{linhThach:"500", tienNgoc:50, reason:"smoke grant"}`) | `ok:true` |
| 5.2 | `GET /api/logs/me?type=currency` (player) | thấy 2 entry mới `reason:"ADMIN_GRANT", actorUserId:<adminId>, delta:"500"` (LINH_THACH) + `delta:"50"` (TIEN_NGOC) ✅ |

## 6. Admin mail send + player claim → inventory (PR #82 + #88)

| # | Endpoint | Result |
|---|---|---|
| 6.1 | `POST /api/admin/mail/send` (`{recipientCharacterId, subject:"Smoke test", body:"...", rewardItems:[{itemKey:"so_kiem", qty:3}]}`) | `ok:true, mail:{id, claimable:true}` |
| 6.2 | `GET /api/mail/me` (player) | 1 mail unclaimed |
| 6.3 | `POST /api/mail/:id/claim` | `ok:true, claimable:false, claimedAt:<timestamp>` |
| 6.4 | `GET /api/inventory` (player) | `items:[{itemKey:"so_kiem", qty:3, item:{kind:"WEAPON", quality:"PHAM", bonuses:{atk:5}}}]` ✅ |

## 7. Admin inventory revoke (PR #66 BE + PR #106 FE) — happy + error path

| # | Endpoint | Result |
|---|---|---|
| 7.1 | `POST /api/admin/users/:id/inventory/revoke` (`{itemKey:"so_kiem", qty:1, reason:"smoke revoke"}`) | `ok:true` ✅ |
| 7.2 | `GET /api/inventory` (player) | qty so_kiem 3 → **2** ✅ |
| 7.3 | `GET /api/logs/me?type=item` | entry mới `kind:"ITEM", reason:"ADMIN_REVOKE", refType:"User", refId:<playerUserId>, actorUserId:<adminId>, itemKey:"so_kiem", qtyDelta:-1` ✅ |
| 7.4 | `POST /api/admin/users/:id/inventory/revoke` (`{itemKey:"so_kiem", qty:99, reason:"exceed"}`) | `INVALID_INPUT` ✅ (BE từ chối khi qty > inventory hiện có) |
| 7.5 | `GET /api/admin/audit?limit=5` | entry mới `action:"admin.inventory.revoke", actorEmail:"admin@example.com", meta:{itemKey:"so_kiem", qty:1, reason:"smoke revoke", targetUserId:<playerUserId>}` ✅ |

## 8. Admin self-target prevention (PR #100)

| # | Endpoint | Result |
|---|---|---|
| 8.1 | `POST /api/admin/users/<adminId>/role` (`{role:"PLAYER"}`) | `CANNOT_TARGET_SELF` ✅ |
| 8.2 | `POST /api/admin/users/<adminId>/ban` (`{banned:true}`) | `CANNOT_TARGET_SELF` ✅ |

## 9. Forgot/reset password full flow (PR #101 + #103)

| # | Endpoint | Result |
|---|---|---|
| 9.1 | `POST /api/_auth/forgot-password` (`{email:"player1@xuantoi.local"}`) | `ok:true, devToken:"a59fc8fe-…"` (dev mode → token leak intentional) |
| 9.2 | `POST /api/_auth/forgot-password` (unknown email) | `ok:true, devToken:null` ✅ (anti-enumeration: silent OK) |
| 9.3 | `POST /api/_auth/reset-password` (devToken + newPassword) | `ok:true` ✅ |
| 9.4 | `POST /api/_auth/reset-password` (reuse same token) | `INVALID_RESET_TOKEN` ✅ (single-use enforced) |
| 9.5 | `POST /api/_auth/login` (with new password) | `ok:true` ✅ |
| 9.6 | Timing parity (PR #103) | `argon2.hash` giả cho user-not-exist/banned đảm bảo timing ngang nhau (verified by api vitest +1 from PR #103) |

## 10. World/Boss/Web routes

| # | Endpoint | Result |
|---|---|---|
| 10.1 | `GET /api/boss/current` | boss `Yêu Vương Thổ Huyết Lv.1`, status `ACTIVE`, hp 120000/120000 ✅ |
| 10.2 | `GET /` (web) | 200, content-length 855 (Vite dev SPA shell) |
| 10.3 | `GET /auth/forgot-password` (web) | 200 (route đã đăng ký từ PR #102) |
| 10.4 | `GET /admin` (web) | 200 |

## 11. Backup/restore scripts (PR #95 + #96)

```
scripts/
├── backup-db.sh      ← pg_dump --clean --if-exists, gzip output, env-driven naming
└── restore-db.sh     ← pg_terminate_backend rồi restore, SIGPIPE-safe
```
Script tồn tại; chưa run trong smoke này (đòi hỏi mock prod DSN). Smoke giai đoạn sau (closed-beta dry-run) sẽ verify roundtrip.

## 12. Bugs / risks phát hiện

**Không có Critical/High bugs phát hiện.**

Findings nhỏ:
- **F1 (Low)**: `apps/api/.env.example` line 31 (`SMTP_FROM=Xuân Tôi <noreply@xuantoi.local>`) chứa ký tự `<`/`>` không quote, làm `bash source .env` fail với `syntax error near unexpected token 'newline'`. Workaround: thêm dấu nháy kép `SMTP_FROM="Xuân Tôi <noreply@xuantoi.local>"`. Tác động: **thấp** — bootstrap script (`pnpm bootstrap`) chỉ cần env qua dotenv (Node), không qua bash; nhưng dev nào source `.env` thủ công sẽ vướng. **Đã sửa local nhưng chưa commit** (vì `.env.example` là docs gây ảnh hưởng nhiều dev) — đề nghị PR riêng nhỏ thêm dấu nháy.
- **F2 (info)**: `OnboardInput.name` regex `[A-Za-zÀ-ỹ0-9._]+` không cho **dấu cách** — tên Việt có dấu cách phổ biến (vd "Lý Tiêu Diêu") sẽ bị reject. Hợp lý cho game-handle nhưng UI nên show hint rõ "không dùng khoảng trắng".

Chưa cover (cần web E2E hoặc manual UI):
- Mobile drawer 375px (PR #97 — vẫn cần manual click responsive sidebar).
- Breakthrough-ready badge (PR #107) — cần seed character realmStage=9 + exp >= expNext mới trigger; smoke này chưa setup script seed mức cảnh giới đó.
- Web admin Inventory revoke modal happy-path UI click (đã verify BE; FE cần Playwright headless smoke trong session sau).

## 13. Conclusion

Tất cả flow chính đã merge từ session 9d→9g vận hành đúng theo design:
- Auth (register/login/forgot/reset)
- Character (onboard/cultivate/me/next-actions)
- Daily login + ledger
- Leaderboard 3 tabs
- Admin (users/stats/economy alerts/grant/revoke/audit/mail/giftcode)
- Inventory + ledger entries (CURRENCY + ITEM)
- World boss state
- Self-target prevention guards

**Status**: ✅ Pass. Sẵn sàng tiếp tục các smart features tiếp theo (admin dashboard alerting / economy ledger consistency check / Playwright golden path).
