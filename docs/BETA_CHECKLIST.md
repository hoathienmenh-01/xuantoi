# Beta Launch Checklist

Checklist để promote beta (closed 50 users → open). Tick khi xong.

## ✅ Đã hoàn thành

### Phase 0-1 — Hạ tầng + Auth
- [x] Monorepo pnpm workspace (`apps/api`, `apps/web`, `packages/shared`)
- [x] `@xuantoi/shared` dual ESM/CJS export (tsup)
- [x] Prisma migration baseline Phase 0-8
- [x] NestJS + Vite + Pinia + Vue 3 boot
- [x] Auth đầy đủ: register / login / logout / session / refresh / change-password
- [x] argon2id + JWT access 15m + refresh 30d httpOnly
- [x] Refresh token rotation + reuse-detection revoke all
- [x] Rate limit login 5/15m qua `LoginAttempt`
- [x] `passwordVersion` check ở JWT guard (đổi mật khẩu kill mọi phiên)
- [x] `helmet`, CORS env-based
- [x] Production assert JWT secrets
- [x] `AllExceptionsFilter` envelope `{ ok, data | error }`
- [x] `AuthErrorCode` chuẩn hoá
- [x] **Logout-all với confirm modal `ConfirmModal.vue`** (PR #83 L6) — replace `window.confirm`
- [x] **Cross-tab 401 redirect** (`apps/web/src/api/client.ts` interceptor)

### Phase 2 — Nhập Định + WebSocket
- [x] BullMQ cron tu luyện (30s tick)
- [x] RealtimeGateway `/ws` cookie auth
- [x] Live `cultivate:tick` + `chat:msg` + `mission:progress` (PR #63) push
- [x] **WS `mission:progress`** real-time mission progress update

### Phase 3-8 — Modules
- [x] Combat PvE (Luyện Khí Đường + 3 dungeon + 9 monster)
- [x] Inventory + Equipment (9 slots) + revoke action (PR #66 admin)
- [x] Market P2P Phường Thị (listing + buy + escrow + 5% fee)
- [x] Sect + Chat thế giới + scope rate-limit (Redis)
- [x] World Boss + spawn endpoint (PR #36 admin) + distribute rewards
- [x] Admin panel (grant/ban/set realm) + Topup tiên ngọc
  - 7 tab: Overview (alerts PR #54), Users (filter q/role/banned + revoke), Topups (filter q/status/from/to PR #67), Audit (filter action/q), GiftCodes (filter q/status PR #81 + CODE_EXISTS PR #84), Mail, Boss
  - Role split MOD vs ADMIN (PR #48 H8) — `@RequireAdmin()` decorator trên 9 action endpoints
- [x] `CurrencyService` + `CurrencyLedger` + `ItemLedger` audit trail
- [x] **`pnpm audit:ledger`** script (`apps/api/scripts/audit-ledger.ts`) — verify ledger consistency

### Smart beta gameplay
- [x] **Daily Login Reward** (PR #80 M9) — `apps/api/src/modules/daily-login/`, FE `DailyLoginCard.vue`, idempotent claim, reset theo `Asia/Ho_Chi_Minh`
- [x] **Leaderboard Top-50 power** (PR #59) — `/api/leaderboard/power`, `LeaderboardView.vue`
- [x] **Public profile** `/profile/:id` với rate-limit (PR #59 derivative)
- [x] **NextActionPanel** suggestion engine (smart onboarding §1) — `apps/api/src/modules/next-action/`, `NextActionPanel.vue`
- [x] **A Linh** NPC guide (smart onboarding) — `apps/web/src/components/onboarding/`
- [x] **Mission system** (Daily/Weekly/Once) — gameplay + claim API + WS progress
- [x] **Mail system** (admin gửi mail + claim reward) — `MailView.vue`, badge unread, `MailModule` + `pruneExpired` cron
- [x] **Gift code** (admin tạo/revoke + player redeem) — `GiftCodeView.vue` + admin filter (PR #81 G22) + duplicate `CODE_EXISTS` (PR #84 G23)
- [x] **NPC Shop** (`ShopView.vue`) — buy/sell với pricelist
- [x] **Self audit log** `GET /logs/me` (PR #88 M6) — keyset paginated CurrencyLedger + ItemLedger
- [x] **`/activity` tab** FE consumer M6 (PR #91) — currency/item toggle, signed delta, i18n reason

### Hardening + ops
- [x] **LoginAttempt prune cron** (`apps/api/src/modules/ops/ops.processor.ts`) — BullMQ repeatable
- [x] **RefreshToken cleanup cron** (cùng processor)
- [x] **Mail expired prune** (`mail.service.ts` `pruneExpired`)
- [x] **Redis rate limit chat** (`apps/api/src/modules/chat/chat.module.ts` `chatRateLimiterProvider`)
- [x] **Health check endpoints** `/api/healthz` + `/api/readyz` + `/api/version` (`apps/api/src/modules/health/`)
- [x] **CSP production** policy chặt, dev `false` (`apps/api/src/main.ts` `helmetConfig`) — chỉ cần review CDN khi prod deploy

### Testing
- [x] **api 369** + **web 133** + **shared 55** = **557 test** (auto-snapshot 29/4 session 9d)
- [x] Real Postgres integration (CI `postgres` service, schema `mtt`)
- [x] WS integration test (real socket.io-client)
- [x] CI postgres + redis service xanh
- [x] **vitest integration cho SettingsView logout-all** (PR #85 L6b — 7 test)
- [x] **Idempotency test cho Daily Login claim** (PR #80)
- [x] **Cursor invalid + isolation test cho `/logs/me`** (PR #88, 20 test)

### UX / i18n / PWA
- [x] vue-i18n VI + EN (16+ view) — bao gồm `activity.*` (PR #91)
- [x] Locale switcher + persist localStorage
- [x] PWA manifest + PNG icons 192/512/maskable + apple-touch-icon
- [x] Workbox precache
- [x] Skeleton loader (LeaderboardView, ProfileView, ActivityView, MarketView)
- [x] Toast unified `MToast.vue`
- [x] Mission/Mail/Boss/Topup badge sidebar
- [x] **Loading splash proverbs corpus 64 câu** (PR #87 L3) — 4 chủ đề × 16 câu

### Content / Balance
- [x] 28 cảnh giới × 9 trọng (`packages/shared/src/realms.ts`)
- [x] `cultivationRateForRealm` scale 1.45^order — property test ≤24h/stage 1
- [x] 30+ item cover 9 EquipSlot + pill + ore + artifact
- [x] 10 skill (3/sect + basic_attack)
- [x] 12+ mission (5 daily + 4 weekly + 3 once)

### Docs
- [x] `docs/AI_HANDOFF_REPORT.md` (1800+ line, living handoff document)
- [x] `docs/API.md` refresh (PR #89) — endpoint sync + global prefix `/api/` note + WS event
- [x] `docs/QA_CHECKLIST.md` refresh (PR #90) — Daily Login + Leaderboard + Audit log self-view + WS
- [x] `docs/ADMIN_GUIDE.md` refresh (PR #90) — 7 tab + filter + MOD role split + boss spawn endpoint
- [x] `docs/TROUBLESHOOTING.md` (171 line)
- [x] `docs/RUN_LOCAL.md`
- [x] `docs/DEPLOY.md`
- [x] `docs/SECURITY.md`
- [x] `docs/SEEDING.md` catalog + cách thêm mới
- [x] `docs/BALANCE.md` formula + bảng tra
- [x] `docs/BETA_CHECKLIST.md` (file này)

## 🔲 Chưa làm — roadmap beta

### Gameplay features (post-beta nice-to-have)
- [ ] **M10 — Shop daily limit + per-item rate-limit**: tránh exploit unlimited buy/sell. Hiện shop không có giới hạn ngày.
- [ ] **Buff system**: item buff + sect buff + event rate (×N) nhân vào `cultivationRateForRealm`. Đã có model field, chưa có gameplay flow.
- [ ] **Equipment reforge / enchant**: upgrade bonuses trên item. Hậu beta.
- [ ] **PvP cốc đấu**: Phase 9 (ngoài scope beta).
- [ ] **Achievement system**: thành tựu mốc tiến độ. Có ledger reason `ACHIEVEMENT` placeholder, chưa có gameplay flow.

### Hardening + ops (cho production beta)
- [ ] **M7 — CSP production review**: helmet CSP đã có policy, nhưng cần review CDN list (img-src, script-src) khi prod deploy thật. Hiện dev `contentSecurityPolicy: false`.
- [ ] **Sentry / error tracking**: wire DSN vào BE + FE.
- [ ] **Structured logs** (pino) + log shipping (Loki / CloudWatch).
- [ ] **Metrics**: Prometheus endpoint / Grafana dashboard cho cultivation tick, combat, WS conn.
- [ ] **Backup DB daily** + test restore script. Hiện chỉ có `pnpm infra:up` cho dev, chưa có script backup prod.
- [ ] **Refresh token revoke chain logging**: đã có reuse-detection, nhưng chưa expose admin tab xem chain (debug user complaint).

### Nội dung (post-beta polish)
- [ ] Balance 28 realm EXP/drop dựa feedback playtest thực.
- [ ] Thêm dungeon tier cao (`hoa_than`, `luyen_hu`, `hop_the`, `dai_thua`, `do_kiep`). Hiện chỉ 3 dungeon `luyen_khi`/`truc_co`/`kim_dan`.
- [ ] Skill cho realm >= `nhan_tien` (hiện skills chỉ sect-based, chưa realm-based).
- [ ] Full boss list seed theo tier (hiện model + spawn endpoint có, chưa có seed boss-by-tier ngoài runtime admin spawn).
- [ ] 60+ xưng hiệu mốc (`titles.json` doc 05 — chưa wire DB).
- [ ] i18n EN gap audit: grep `t(` keys không có trong `en.json` (`apps/web/src/i18n/en.json`).

### QA + Launch
- [ ] **Runtime smoke tích hợp**: execute `docs/QA_CHECKLIST.md` 13 section trên local hoặc staging (15 phút).
- [x] **Playwright E2E** golden path closed beta core loop (session 9q-7 → 9q-8 → 9r-1, gated CI): **16/16 spec** pass trong ~22–25s — register → 4-step onboarding → /home → cultivate ON/OFF → daily login claim → mission tabs → shop browse disabled-buy → inventory empty → chat WORLD → leaderboard → profile → logout → **shop buy LINH_THACH** (UI) → **inventory equip** (UI) → **mail empty state** → **dungeon list + entry enabled** → **settings page load**. Xem [`QA_CHECKLIST.md`](./QA_CHECKLIST.md) §12. **Defer** (ghi rõ): cultivation breakthrough end-to-end, dungeon enter+clear+loot end-to-end (combat RNG → flaky, defer `smoke:combat`), mail claim attachment (cần admin send → defer `smoke:admin`), inventory use HP pill (fresh char hp full → no observable change), giftcode redeem (cần admin → defer `smoke:admin`). **CI integration (session 9r-1)**: workflow `.github/workflows/e2e-full.yml` chạy gated trên `pull_request` + `push` to main (path filter `apps/web/**` / `apps/api/**` / `packages/shared/**` / `pnpm-lock.yaml` / `package.json`) + `workflow_dispatch` manual. PR docs-only → workflow skip. KHÔNG required mọi PR — workflow chính `ci.yml` (build + e2e-smoke) vẫn là CI bắt buộc; `e2e-full.yml` là layer 2 closed beta regression. Roadmap: sau 2–3 tuần stable → đánh giá upgrade thành required check trong branch protection rules.
- [ ] **Load test** 1000 socket + 500 RPS (k6 / Artillery) — verify BullMQ tick scaling.
- [ ] **A Linh onboarding** bilingual full text (placeholder hiện tại).
- [ ] Terms of Service + Privacy Policy (legal).
- [ ] Discord / community channel.
- [ ] Closed beta 50 user recruitment.
- [ ] Feedback survey form (Google Form / Discord embed).
- [ ] Bug bounty / log channel.

## Cut-line cho closed beta

**Đã đủ điều kiện** (29/4 session 9d):
- [x] Auth/Mission/Mail/Gift code/Daily Login/Leaderboard/Boss/Shop — 100% gameplay loop
- [x] Logs self-view + admin audit
- [x] Backup cron pruning login/refresh/mail
- [x] Rate limit chat + login
- [x] Health check + version endpoint
- [x] Test coverage 557 (api 369 + web 133 + shared 55)

**Recommended trước beta open** (post-closed-beta):
- [ ] M7 CSP review (production deploy)
- [ ] Sentry + structured logs (production observability)
- [ ] Backup DB daily script + restore test
- [x] Playwright E2E golden path closed beta core loop (regression safety net) — gated CI workflow `.github/workflows/e2e-full.yml` (path-filtered + workflow_dispatch manual)
- [ ] Runtime smoke tích hợp 13 section QA_CHECKLIST

**Có thể defer đến sau beta**:
- M10 Shop daily limit (low risk — manual ban nếu lạm dụng)
- PvP cốc đấu
- Reforge/enchant
- Realm-based skills
- Buff/debuff mở rộng
- Higher-tier dungeons
- Achievement system

---

_Last updated: 2026-04-29 session 9d_  
_Cập nhật file này mỗi khi đóng PR lớn liên quan beta readiness._
