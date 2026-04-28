# AI Handoff Report — Xuân Tôi

> **Snapshot**: `main` @ commit `897eb2f` (28 Apr 2026, sau khi PR #25 + #31 merged).
> **Người viết**: AI engineer đã làm session 27-28/4 (Phase 0-8 + chuỗi PR #9..#31).
> **Đối tượng đọc**: AI kế nhiệm sẽ tiếp tục đưa dự án tới beta / production.
>
> Báo cáo trung thực. Mọi tuyên bố "đã xong" đều có PR + file + test chứng minh. Khi nào chưa verify runtime, sẽ ghi rõ **"chưa xác minh runtime"**.

---

## 1. Project Overview

- **Tên**: Xuân Tôi (`xuantoi`).
- **Thể loại**: Game **tu tiên MUD** phong cách cổ phong thủy mặc, web + PWA. Clone tham khảo *Mộng Tu Tiên* nhưng đã đổi tên, logo, seed asset cho hợp pháp lý.
- **Gameplay loop**: đăng ký → chọn tông môn → **Nhập Định (cultivation)** passive tick EXP → **Luyện Khí Đường (combat PvE)** + dungeon → loot → **Phường Thị (market P2P)** → **Tông Môn (sect)** cống hiến + chat → **World Boss** → **Nạp Tiên Ngọc (topup)** → admin cấp → tiến cảnh giới 28 stage.
- **Stack**: monorepo pnpm. `apps/api` (NestJS 10 + Prisma 5 + Postgres 16 + Redis 7 + BullMQ + Socket.io). `apps/web` (Vue 3 + Vite + Pinia + Tailwind + vue-i18n + PWA). `packages/shared` (Zod + realms/items/missions catalog).
- **Mục tiêu hiện tại**: **closed beta readiness**. Hầu hết feature Phase 0-8 + Mission + Mail + GiftCode đã merge. Còn lại polish + observability + content scale.
- **Trạng thái**: repo build xanh, CI xanh, **150 test api + 30 test shared = 180 test pass** (tại commit tham chiếu). Chưa E2E runtime smoke trên bản main mới (PR #25 + #31 vừa merge, chỉ local test pass).

---

## 2. Current Branch / CI / PR Status

- **Default branch**: `main`.
- **Commit audit**: `897eb2f Merge pull request #31 from hoathienmenh-01/devin/1777365088-pr-g-mail-ws-prune`.
- **CI gần nhất trên main**: xanh (GitHub Actions: `api build` + `web build`; Devin Review là external check không block merge).
- **PR open đáng kể**: **không có** tại thời điểm viết. Tất cả chuỗi PR #9..#31 đã merge (trừ các branch feature cũ chưa xoá, không mở PR).
- **PR merged gần đây ảnh hưởng lớn** (theo thứ tự thời gian):
  | PR | Chủ đề | Impact |
  |---|---|---|
  | #24 | Chat rate limit Redis sliding window | Anti-spam, fallback in-memory |
  | #25 | Mission backend (`mission.*`) + scheduler reset | Thêm module + `MissionProgress` model + cron daily/weekly |
  | #26 | Mission FE (`MissionView.vue`) | Thêm route `/missions` + nav |
  | #27 | Mail system (BE + FE + admin send/broadcast) | Thêm `Mail` model + `/mail/*` + `/admin/mail/*` |
  | #28 | Gift code (BE + FE + admin) | Thêm `GiftCode` + `GiftCodeRedemption` + `/giftcode/redeem` + `/admin/giftcodes/*` |
  | #29 | Health/docs (`/healthz` `/readyz` `/version`) + `docs/API.md` | Observability + API inventory |
  | #30 | Admin stats (`/admin/stats`) + Overview tab | Admin dashboard |
  | #31 | WS `mail:new` push + cron prune mail claimed >90d | Mail live push + housekeeping |

- Các branch `devin/*` feature đã merge vẫn còn tồn tại ở origin — có thể xoá sau khi smoke test, không cần gấp.

---

## 3. Tech Stack

| Layer | Tool |
|---|---|
| Monorepo | `pnpm` workspace (`apps/*`, `packages/*`) — `pnpm@9.15.1`, Node `>=20` |
| Backend framework | NestJS 10 (`@nestjs/core`, `@nestjs/platform-express`, `@nestjs/platform-socket.io`, `@nestjs/websockets`, `@nestjs/jwt`, `@nestjs/bullmq`) |
| Frontend framework | Vue 3.5 + Vite 5 + TypeScript, Pinia 2, Vue Router 4, vue-i18n 10 |
| CSS | Tailwind 3 + custom theme `ink/gold` |
| Database | PostgreSQL 16 (dev: docker compose) |
| ORM | Prisma 5.22 |
| Redis / Queue | Redis 7 + BullMQ 5 (cultivation tick, ops prune, mission reset) |
| Realtime | Socket.io 4.8 (custom `/ws` path, cookie JWT auth) |
| Validation | Zod 3 (shared schemas ở `packages/shared`) |
| Auth hash | argon2id (`argon2@^0.41`) |
| Security | Helmet 8, CORS env-based, JWT access 15m + refresh 30d httpOnly, rotation + reuse-detect |
| Build | `nest build` (api), `vite build` + `vue-tsc` (web), `tsup` (shared dual ESM/CJS) |
| Test | Vitest (+ `unplugin-swc` để emit decorator metadata cho NestJS DI trong test) |
| PWA | `vite-plugin-pwa` 0.20, `workbox-*` 7.3 |
| i18n | `vue-i18n` 10 + `@intlify/unplugin-vue-i18n` |
| Lint | ESLint 9 + `@vue/eslint-config-typescript`, `eslint-plugin-vue` |
| Dev infra | docker-compose: postgres + redis + minio + mailhog |

---

## 4. Repository Structure

```
xuantoi/
├── apps/
│   ├── api/                NestJS backend
│   └── web/                Vue 3 PWA
├── packages/
│   └── shared/             Zod schemas + catalogs (realms/items/missions/...)
├── infra/
│   └── docker-compose.dev.yml
├── docs/
└── .github/workflows/ci.yml
```

### apps/api

- **Mục đích**: REST API + WS gateway + BullMQ workers.
- **Entry**: `src/main.ts` (helmet, cookie-parser, CORS, assertProductionSecrets, bootstrap OpsService recurring).
- **Root module**: `src/app.module.ts` — 20 import lines, đủ 18 feature module.
- **Prisma schema**: `prisma/schema.prisma` (399 dòng, 28 model/enum).
- **Migrations**: `prisma/migrations/` (5 migration: init Phase 0-8 → currency_ledger → mission_progress → mail → giftcode).
- **AI mới nên đọc trước**:
  1. `src/app.module.ts` — nhìn sơ đồ module.
  2. `prisma/schema.prisma` — hiểu data model.
  3. `src/modules/character/currency.service.ts` — mọi tiền đi qua đây.
  4. `src/modules/realtime/realtime.gateway.ts` — WS auth pattern.
  5. `src/common/all-exceptions.filter.ts` + `src/common/api-exception.ts` — envelope `{ ok, data|error }`.

### apps/web

- **Mục đích**: Vue 3 SPA + PWA.
- **Entry**: `src/main.ts` → `App.vue` → router outlet + `AppShell.vue`.
- **Views**: `src/views/*.vue` (14 trang).
- **Stores**: `src/stores/{auth,game,toast}.ts`.
- **API client**: `src/api/client.ts` + `src/api/{auth,character,combat,...}.ts`.
- **WS client**: `src/ws/client.ts` (socket.io-client wrapper + reconnect).
- **i18n**: `src/i18n/{vi,en}.json` (616 dòng mỗi file).
- **AI mới nên đọc**:
  1. `src/router/index.ts` — map route → view.
  2. `src/stores/game.ts` — subscriber WS event `cultivate:tick`, `chat:msg`, `mail:new`.
  3. `src/components/shell/AppShell.vue` — topbar, nav, locale switch.

### packages/shared

- **Mục đích**: source of truth cho FE + BE (không đi qua DB).
- **Build**: `tsup` dual ESM/CJS.
- **Export**: `enums`, `realms`, `proverbs`, `ws-events`, `api-contracts`, `combat`, `items`, `missions`, `boss`, `topup`.
- **Test**: `realms.test.ts`, `catalog.test.ts`, `proverbs.test.ts` (3 test file, 30 test).

### infra

- `docker-compose.dev.yml` — postgres (mtt/mtt), redis, minio (admin/admin12345), mailhog. Chỉ dùng cho dev local, **chưa có compose production**.

### docs

- `README.md` (root) + `docs/API.md` + `docs/SEEDING.md` + `docs/BALANCE.md` + `docs/BETA_CHECKLIST.md`.
- Chưa có: `DEPLOY.md`, `SECURITY.md`, `RUN_LOCAL.md` riêng (một phần trong README), `TROUBLESHOOTING.md`, `CHANGELOG.md`, `ADMIN_GUIDE.md`.

### .github/workflows

- `ci.yml` — chạy postgres + redis service, pnpm install, prisma generate + migrate, typecheck, lint, test, build. 2 job: `api` + `web`. Matrix node 20.

---

## 5. Backend Architecture

Tất cả module trong `apps/api/src/modules/`. Controller thường tại `/<module>/*`. Mọi response bọc `{ ok, data | error }` do `AllExceptionsFilter` xử lý.

| Module | Purpose | Controller prefix | Service | Files chính | Status | Notes |
|---|---|---|---|---|---|---|
| `auth` | Đăng ký/đăng nhập/refresh/đổi mật khẩu | `/auth` | `AuthService` | `auth.service.ts`, `auth.controller.ts`, `auth.service.test.ts` (15 test) | OK | argon2id + JWT rotation + reuse detect + rate limit login 5/15m. |
| `character` | Onboarding + state + cultivate toggle + breakthrough + **CurrencyService** | `/character` | `CharacterService`, `CurrencyService` | `character.service.ts`, `currency.service.ts`, `currency.service.test.ts` (9 test) | OK | `CurrencyService.applyTx` là điểm duy nhất ghi `linhThach`/`tienNgoc` → atomic + ledger. |
| `cultivation` | BullMQ cron tu luyện 30s/tick | — (worker only) | `CultivationService` + `CultivationProcessor` | `cultivation.processor.ts`, `cultivation.queue.ts`, `cultivation.processor.test.ts` (5 test) | OK | Emit WS `cultivate:tick`. Scale EXP theo `cultivationRateForRealm(order)` (PR #20). |
| `realtime` | WS gateway `/ws` | `/ws` (WS) | `RealtimeService` | `realtime.gateway.ts`, `realtime.service.ts`, `realtime.gateway.test.ts` (10 test) | OK | Cookie `xt_access` hoặc `handshake.auth.token`. Auto-join `world` + `sect:<id>`. Map userId → Set<socketId>. |
| `combat` | Dungeon list + encounter start/action/abandon | `/combat` | `CombatService` | `combat.service.ts`, `combat.service.test.ts` (7 test) | OK | Turn-based server-side. Reward qua `CurrencyService` + `InventoryService`. |
| `inventory` | List + equip/unequip/use | `/inventory` | `InventoryService` | `inventory.service.ts`, `inventory.controller.ts` | **Không có test unit riêng** | Test gián tiếp qua combat/market. |
| `market` | Listing P2P + post + buy + cancel + mine | `/market` | `MarketService` | `market.service.ts`, `market.service.test.ts` (8 test) | OK | Atomic transaction: buyer LINH_THACH − listingFee 5% + seller nhận 95%. Bilateral lock. |
| `sect` | List/create/join/leave/contribute | `/sect` | `SectService` | `sect.service.ts`, `sect.service.test.ts` (7 test) | OK | Contribute LINH_THACH → sect treasury + user `congHien`. Chống race khi leave. |
| `chat` | Gửi world/sect + history + rate limit | `/chat` | `ChatService` | `chat.service.ts`, `chat.service.test.ts` (9 test), `chat.module.ts` | OK | Redis sliding window 8 msg/30s (PR #24). Fallback in-memory khi không có Redis. Hook `MissionService.trackChatSend` (PR #25). |
| `boss` | Current + attack | `/boss` | `BossService` | `boss.service.ts`, `boss.service.test.ts` (6 test) | OK | Damage attribution per character. Defeat → `distributeRewards` top1/top2-3/top4-10 + ledger `BOSS_REWARD`. |
| `topup` | Packages + create order + mine | `/topup` | `TopupService` | `topup.service.ts` | **Không có test riêng** | Test gián tiếp qua `admin/topup-admin.service.test.ts` (11 test). |
| `admin` | User list/ban/role/grant + topup approve/reject + audit + stats + giftcode CRUD + mail send/broadcast | `/admin` | `AdminService` | `admin.service.ts` (484 dòng), `admin.guard.ts`, `admin-stats.test.ts`, `topup-admin.service.test.ts` | OK | Guard role ADMIN|MOD. Mọi action ghi `AdminAuditLog`. Idempotent approve topup (check status trước). |
| `giftcode` | Player redeem | `/giftcode` | `GiftCodeService` | `giftcode.service.ts`, `giftcode.service.test.ts` (12 test) | OK | Unique `(giftCodeId, userId)` → redeem once. Expire + revoke + max redeems. |
| `mail` | Inbox + read + claim | `/mail` | `MailService` | `mail.service.ts`, `mail.service.test.ts` (14 test) | OK | Reward claim qua `CurrencyService` + `InventoryService`. Claim once. WS `mail:new` khi admin send (PR #31). |
| `mission` | Progress tracker + claim reward + reset daily/weekly cron | `/missions` | `MissionService` + `MissionProcessor` + `MissionScheduler` | `mission.service.ts`, `mission.service.test.ts` (19 test), `mission.scheduler.ts`, `mission.processor.ts` | OK | Hook ở `cultivation.processor`, `combat.service`, `chat.service`, `sect.service`. Reset cron BullMQ. |
| `health` | Liveness/readiness/version | `/healthz` `/readyz` `/version` | `HealthController` | `health.controller.ts`, `health.controller.test.ts` (3 test) | OK | Readyz check Postgres + Redis. |
| `ops` | Housekeeping cron prune | — (worker only) | `OpsService` + `OpsProcessor` | `ops.processor.ts`, `ops.processor.test.ts` (6 test) | OK | Prune LoginAttempt 90d + RefreshToken revoked 30d + Mail claimed >90d. Scheduled mỗi `OPS_PRUNE_INTERVAL_MS`. |

**Phụ thuộc chính giữa module**:
- `CurrencyService` (ở `character`) được inject bởi: combat, market, sect, boss, admin, topup, giftcode, mail, mission. Bất kỳ mutation tiền nào đều phải qua đây.
- `MissionService` (ở `mission`) được inject bởi: `chat.service` (`trackChatSend`), `combat.service` (`trackCombatWin`), `cultivation.processor` (`trackCultivateTick`), `sect.service` (`trackSectContribute`).
- `RealtimeService` (ở `realtime`) được inject bởi: chat, cultivation, mail (để `emitToUser`).

**Rủi ro backend**:
- `InventoryService` không có test unit riêng — độ tin cậy dựa vào market/combat test. **Nên thêm** 4-5 test trực tiếp (equip/unequip swap, stack qty, idempotent use).
- `TopupService` tương tự (test gián tiếp qua admin). User-side `createOrder` + `listMine` không có test khẳng định TOO_MANY_PENDING path.
- `RealtimeGateway` extract token từ cookie bằng parser tự viết — không filter domain. OK cho single-origin, nhưng nếu có subdomain WS riêng cần review lại.

---

## 6. Frontend Architecture

14 view, 15 route (kể cả `/` redirect + catch-all `:pathMatch`).

| View | Route | Purpose | API Used | Store | Status | Missing/Notes |
|---|---|---|---|---|---|---|
| `AuthView.vue` | `/auth` | Đăng ký/đăng nhập | `/auth/register`, `/auth/login` | `auth` | OK | Hiển thị error code dịch sang text VI/EN. |
| `OnboardingView.vue` | `/onboarding` | Tạo nhân vật | `/character/onboard` | `auth`, `game` | OK | A Linh bilingual (PR #18 text, PR #17 i18n). Chưa có full NPC avatar animation. |
| `HomeView.vue` | `/home` | Dashboard + tu luyện toggle | `/character/me`, `/character/cultivate` | `game` | OK | EXP bar live update qua WS. |
| `DungeonView.vue` | `/dungeon` | Combat PvE | `/combat/*` | `game` | OK | Có log + HP/MP bar. Chưa có animation skill. |
| `InventoryView.vue` | `/inventory` | Inventory + equip/unequip/use | `/inventory/*` | `game` | OK | Chưa có filter theo quality/slot. |
| `MarketView.vue` | `/market` | List + post listing + buy | `/market/*` | — | OK | Chưa có filter quality/price range. |
| `SectView.vue` | `/sect` | List sect + join/leave/contribute + chat | `/sect/*`, `/chat/*` | `game` | OK | Chat live. Chưa có sect member ranking UI. |
| `BossView.vue` | `/boss` | World boss + damage contribution | `/boss/*` | `game` | OK | Live update qua `boss:update` + `boss:end` + `boss:defeated`. |
| `MissionView.vue` | `/missions` | Daily/Weekly/Once + claim | `/missions/me`, `/missions/claim` | — | OK | Countdown mỗi giây. Chưa có WS `mission:progress` push — user chủ động refresh. |
| `MailView.vue` | `/mail` | Inbox + read + claim | `/mail/*` | — | OK | WS `mail:new` hiển thị badge (PR #31). Chưa có delete / archive. |
| `GiftCodeView.vue` | `/giftcode` | Nhập code + redeem | `/giftcode/redeem` | — | OK | Chỉ input + show reward. Không có history. |
| `TopupView.vue` | `/topup` | Packages + tạo order + lịch sử | `/topup/*` | — | OK | Chưa có tích hợp cổng thanh toán thật (intentional — beta). |
| `AdminView.vue` | `/admin` | Admin panel (tabs: Users, Topups, Audit, Stats, GiftCodes, Mail) | `/admin/*` | — | OK | Guard `role === 'ADMIN' \|\| 'MOD'` ở client + server. |
| `NotFoundView.vue` | `/:pathMatch(.*)*` | 404 | — | — | OK | Public, không cần auth. |

**Router guard**: global `beforeEach` check `meta.public`; redirect `/auth` nếu không session.

**Pinia stores**:
- `auth.ts` — user, role, session refresh timer. Resolve `/auth/session` onMounted.
- `game.ts` — character state + subscribe WS event `state:update`, `cultivate:tick`, `chat:msg`, `mail:new`, `boss:update`, `boss:end`, `boss:defeated`. `refresh()` method reload state.
- `toast.ts` — queue toast success/error/info.

**API client**: `src/api/client.ts` là axios instance với `withCredentials: true`, interceptor 401 → `/auth/refresh` retry 1 lần, nếu vẫn fail → redirect `/auth`. Mỗi module có file riêng (`auth.ts`, `combat.ts`, `mission.ts`, `mail.ts`, ...).

**i18n**: `src/i18n/{vi,en}.json` 616 dòng mỗi file. Root namespace: `auth`, `onboarding`, `home`, `dungeon`, `inventory`, `market`, `sect`, `boss`, `mission`, `mail`, `giftcode`, `topup`, `admin`, `shell`, `chat`, `common`, `errors`. Locale switcher trong `AppShell.vue` persist qua localStorage.

**Components chính** (`src/components/`):
- `shell/AppShell.vue` — topbar + sidebar + locale switch + logout + chat panel.
- `shell/ChatPanel.vue` — world/sect chat collapsible.
- `common/MButton.vue` — loading state + i18n.

**Rủi ro frontend**:
- **Không có Vitest cho web** (`test` script hiện là `echo "skipped"`). Mọi test FE phải làm manual hoặc Playwright.
- **Chưa có E2E Playwright**.
- Một số view không fetch lại khi locale đổi runtime — i18n chỉ ảnh hưởng static text.

---

## 7. Shared Package

`packages/shared/src/`:

| File | Export |
|---|---|
| `index.ts` | Re-export tất cả |
| `enums.ts` | `Role`, `Quality`, `ItemType`, `EquipSlot`, `Difficulty`, `CurrencyKind` (mirror Prisma enum) |
| `realms.ts` | `REALMS[]` (28 stage), `realmByKey`, `expCostForStage`, `nextRealm`, `fullRealmName`, `cultivationRateForRealm` (scale 1.45^order) |
| `proverbs.ts` | 30+ câu châm ngôn random cho loading screen |
| `ws-events.ts` | `WsFrame`, `WsEventType`, `CharacterStatePayload`, `CultivateTickPayload`, heartbeat constants |
| `api-contracts.ts` | Zod schema + TS type cho request/response tất cả endpoint |
| `combat.ts` | `MONSTERS`, `DUNGEONS`, `SKILLS`, helpers |
| `items.ts` | `ITEMS` (30 item đủ 9 slot), `rollDungeonLoot` |
| `missions.ts` | `MISSIONS` (12 mission: 5 daily / 4 weekly / 3 once), `missionByKey`, `missionsByPeriod` |
| `boss.ts` | Boss pool + `distributeRewards` |
| `topup.ts` | Topup package list + contract |

**Build**: `tsup` → `dist/index.mjs` + `dist/index.cjs` + `dist/index.d.ts`.

**Import**: `import { REALMS, realmByKey, type CharacterStatePayload } from '@xuantoi/shared';`

**Test**: 3 file, 30 test.

---

## 8. Database / Prisma Schema

File: `apps/api/prisma/schema.prisma` (399 dòng, 19 model + 9 enum).

### Migrations (theo thứ tự)

1. `20260427210442_init_phase_0_8` — toàn bộ Phase 0-8 baseline.
2. `20260427223631_add_currency_ledger` — thêm `CurrencyLedger`.
3. `20260428050829_add_mission_progress` — `MissionProgress` + enum `MissionPeriod`.
4. `20260428060000_add_mail` — `Mail`.
5. `20260428070000_add_giftcode` — `GiftCode` + `GiftCodeRedemption`.

### Bảng model chính

| Model | Purpose | Important Relations | Risk/Notes |
|---|---|---|---|
| `User` | Account (email+password+role+passwordVersion+banned) | `refreshTokens`, `character` (1-1) | Soft-ban qua field `banned` (guard reject). |
| `RefreshToken` | Rotation + reuse detection | `user` | `revokedAt` set khi reuse → revoke chain. Prune 30d qua Ops. |
| `LoginAttempt` | Rate limit login 5/15m theo (ip, email) | — | Prune 90d qua Ops. |
| `Character` | State nhân vật (exp, hp/mp, attr, linhThach, tienNgoc, sect…) | `inventory`, `ledger`, `mails`, `missionProgress` | `@unique` trên `userId` + `name`. Ghi tiền **phải** qua `CurrencyService`. |
| `InventoryItem` | Item instance | `character` | Stack qty. itemKey ∈ `ITEMS` catalog (shared). |
| `Listing` | Market P2P | seller (`Character`) | `@@unique` trên `(itemId)` khi OPEN đảm bảo 1 item ⇒ 1 listing active. |
| `Sect` | Tông môn (treasury, member count) | members (`Character[]`) | SectKey ∈ `thanh_van`, `huyen_thuy`, `tu_la` (seed sẵn). |
| `ChatMessage` | Chat world/sect history | `character`, `sect?` | Index `(channel, createdAt)` + `(sectId, createdAt)`. |
| `WorldBoss` | Boss spawn + status | `damages` | Status enum ACTIVE/DEFEATED/EXPIRED. |
| `BossDamage` | Per-character damage log | `boss`, `character` | Dùng để rank reward. |
| `Encounter` | Dungeon fight state (turn, hp) | `character` | Status ACTIVE/WON/LOST/ABANDONED. |
| `CurrencyLedger` | **Audit trail 100% thay đổi linhThach/tienNgoc** | `character` | Reason union: MARKET_BUY/MARKET_SELL/SECT_CONTRIBUTE/ADMIN_GRANT/ADMIN_TOPUP_APPROVE/BOSS_REWARD/COMBAT_LOOT/GIFTCODE_REDEEM/MAIL_CLAIM/MISSION_CLAIM. Delta có dấu. |
| `TopupOrder` | User tạo order → admin approve | — | Status PENDING/APPROVED/REJECTED. TOO_MANY_PENDING guard (max 3). |
| `AdminAuditLog` | Log mọi admin action | — | Ghi `actorId, action, meta, createdAt`. |
| `Mail` | Inbox per character | `recipient` | `readAt`, `claimedAt`, `expiresAt`. Prune claimed >90d. |
| `GiftCode` | Mã quà | `redemptions` | Unique `code`, `expiresAt`, `revokedAt`, `maxRedeems`. |
| `GiftCodeRedemption` | User đã redeem | `giftCode` | `@@unique(giftCodeId, userId)` — 1 user 1 lần. |
| `MissionProgress` | Progress theo (characterId, missionKey) trong windowStart/End | `character` | `@@unique(characterId, missionKey, periodStart)`. Reset cron daily/weekly. |

### Migrate

```bash
# Apply migrations
pnpm --filter @xuantoi/api exec prisma migrate deploy

# Generate client
pnpm --filter @xuantoi/api exec prisma generate

# Reset (dev only — MẤT DATA)
pnpm --filter @xuantoi/api exec prisma migrate reset --force --skip-seed
```

### Điểm cần cẩn thận

- Không có migration rollback tự động — nếu cần, copy migration.sql vào một migration mới và viết `DROP`/revert thủ công.
- `CurrencyLedger` index `(characterId, createdAt)` + `(reason, createdAt)` đủ cho query user + admin. Không có index `(actorUserId)` — thêm nếu cần query theo admin.
- `MissionProgress` không có soft delete — reset cron tạo row mới theo period.

---

## 9. Core Gameplay Flows

### Auth Flow
- `POST /auth/register` → `AuthService.register` → argon2id hash → create User + set cookie `xt_access` + `xt_refresh`.
- `POST /auth/login` → check `LoginAttempt` rate limit → verify hash → rotate refresh.
- `GET /auth/session` → JWT guard → trả user + role.
- `POST /auth/refresh` → verify refresh → rotate + issue new access (reuse detection: nếu token đã revoked → revoke cả chain).
- `POST /auth/logout` → revoke current refresh + clear cookie.
- `POST /auth/change-password` → `passwordVersion`++ → kill tất cả access token đang active (guard reject khi `version` lệch).
- **File**: `apps/api/src/modules/auth/*`. FE: `apps/web/src/views/AuthView.vue` + `stores/auth.ts`.
- **Test**: `auth.service.test.ts` (15 test).
- **Risk còn lại**: cookie `SameSite=Lax` → khi deploy cross-origin cần đổi `None` + `Secure`. Chưa có email verification / reset password qua email.

### Onboarding / Character Flow
- User mới login → `GET /character/me` trả 404 → FE redirect `/onboarding`.
- `POST /character/onboard` body `{ name, sectKey }` → tạo Character + gán vào Sect.
- Redirect `/home`.
- **File BE**: `character.service.ts`. **FE**: `OnboardingView.vue`.
- **Test**: gián tiếp qua các test khác (makeUserChar helper).

### Cultivation Flow
- `POST /character/cultivate` body `{ on: true/false }` → toggle `Character.cultivating`.
- BullMQ `cultivation` queue: repeatable job mỗi `CULTIVATION_TICK_MS=30s`.
- `CultivationProcessor.process`: lấy tất cả `cultivating=true` → `realmByKey` + `cultivationRateForRealm(order)` → ghi EXP.
- Nếu đủ EXP → auto-breakthrough hoặc chờ user call `POST /character/breakthrough`.
- Sau khi ghi DB → `realtime.emitToUser(userId, 'cultivate:tick', payload)`.
- FE `game.ts` subscribe `cultivate:tick` → update character.exp → EXP bar animate.
- Mission hook `trackCultivateTick` → tăng daily/weekly mission progress.
- **File**: `cultivation.processor.ts`, `cultivation.queue.ts`, `cultivation.service.ts`.
- **Test**: `cultivation.processor.test.ts` (5 test) + WS live push test trong `realtime.gateway.test.ts`.
- **Risk**: cron tick multi-instance chưa test — chỉ 1 api process đảm bảo không double credit. Khi scale cần Redis lock hoặc BullMQ limiter group.

### Combat Flow
- `GET /combat/dungeons` → list static từ `combat.ts` catalog.
- `POST /combat/encounter/start` body `{ dungeonKey, difficulty }` → tạo `Encounter` ACTIVE.
- `POST /combat/encounter/:id/action` body `{ skillKey }` → server compute damage/heal/status → update hp → ghi turn log.
- Khi monster hp ≤ 0 → distribute loot: `CurrencyService.applyTx(LINH_THACH, ..., COMBAT_LOOT)` + `InventoryService.grant(items)`.
- Thắng 100% hp lose → status LOST + hp=1.
- Mission hook `trackCombatWin` → daily_kill_monster_5 etc.
- **File**: `combat.service.ts`, `combat.controller.ts`. FE: `DungeonView.vue`.
- **Test**: `combat.service.test.ts` (7 test).
- **Risk**: công thức damage simple (attack − defense); chưa có status effect elaborated (buff/debuff chỉ có trong catalog nhưng xử lý đơn giản).

### Inventory Flow
- `GET /inventory` → list theo characterId.
- `POST /inventory/equip` body `{ inventoryItemId }` → check slot + swap nếu đã có.
- `POST /inventory/unequip` body `{ slot }`.
- `POST /inventory/use` body `{ inventoryItemId, qty }` → consume potion → heal/buff.
- **File**: `inventory.service.ts`. FE: `InventoryView.vue`.
- **Risk**: không có test unit riêng (đã ghi ở §5).

### Market Flow
- `POST /market/post` body `{ inventoryItemId, price, qty }` → tạo Listing OPEN + move item ra escrow (giảm inventory qty).
- `GET /market/listings` → list OPEN.
- `POST /market/:id/buy` → TRANSACTION: buyer trừ LINH_THACH (price); seller nhận 95% (listingFee 5%); move item vào buyer inventory; listing status SOLD.
- Bilateral lock: `updateMany` với guard `status=OPEN` → 1 thắng 1 fail, không double-buy.
- `POST /market/:id/cancel` → return item về seller; status CANCELLED.
- **File**: `market.service.ts`. FE: `MarketView.vue`.
- **Test**: `market.service.test.ts` (8 test — bao gồm insufficient funds + double-buy prevention + cancel own).
- **Risk**: fee 5% hard-code, chưa có config env.

### Sect Flow
- `POST /sect/create` body `{ key, name, desc }` — **chỉ admin** (guard).
- `GET /sect/list` / `GET /sect/:id` — public info.
- `POST /sect/:id/join` — character chưa có sect.
- `POST /sect/leave` — đang có sect.
- `POST /sect/contribute` body `{ amount }` → trừ LINH_THACH (reason `SECT_CONTRIBUTE`) → sect treasury += amount → user `congHien` += amount.
- **File**: `sect.service.ts`. FE: `SectView.vue`.
- **Test**: `sect.service.test.ts` (7 test).

### Chat Flow
- `POST /chat/world` body `{ text }` → rate limit 8 msg/30s → persist `ChatMessage` → broadcast `world` room WS.
- `POST /chat/sect` → same nhưng room `sect:<id>`.
- `GET /chat/history?channel=world|sect&limit=N` → lấy messages gần nhất.
- Rate limit: Redis sliding window (key `rl:chat:<userId>`). Fallback in-memory khi không có Redis (thường chỉ ở test).
- Mission hook `trackChatSend` → daily_chat_N.
- **File**: `chat.service.ts`. FE: `ChatPanel.vue`.
- **Test**: `chat.service.test.ts` (9 test).

### Boss Flow
- Boss spawn thủ công (qua admin) hoặc cron tương lai.
- `GET /boss/current` → boss ACTIVE nếu có.
- `POST /boss/attack` body `{ skillKey }` → compute damage → ghi `BossDamage` → emit `boss:update`.
- Khi hp ≤ 0 → status DEFEATED → `distributeRewards` top1/top2-3/top4-10 → emit `boss:defeated` + `boss:end`.
- Reward ghi ledger reason `BOSS_REWARD`.
- **File**: `boss.service.ts`. FE: `BossView.vue`.
- **Test**: `boss.service.test.ts` (6 test).
- **Risk**: chưa có cron spawn boss tự động. Admin phải tạo manually (endpoint chưa có — **thiếu**).

### Topup Flow
- `GET /topup/packages` → list static.
- `POST /topup/create` body `{ packageKey }` → tạo `TopupOrder` PENDING với `transferCode` unique. Guard TOO_MANY_PENDING (≥3 pending → reject).
- User chuyển khoản ngân hàng kèm transferCode.
- Admin mở `/admin` → Topups tab → xác nhận → `POST /admin/topups/:id/approve` → credit TIEN_NGOC + ledger `ADMIN_TOPUP_APPROVE` + `AdminAuditLog`.
- Idempotent: check status PENDING trước khi credit.
- **File**: `topup.service.ts` + `admin.service.ts`. FE: `TopupView.vue` + `AdminView.vue`.
- **Test**: `topup-admin.service.test.ts` (11 test).
- **Risk**: chưa có tự động webhook — 100% manual approve.

### GiftCode Flow
- Admin: `POST /admin/giftcodes` body `{ code, rewardLinhThach, rewardTienNgoc, rewardExp, rewardItems[], maxRedeems?, expiresAt? }`.
- Player: `POST /giftcode/redeem` body `{ code }` → uppercase normalize → check expired/revoked/exhausted/already-redeemed → TRANSACTION credit rewards + tạo `GiftCodeRedemption` + ledger `GIFTCODE_REDEEM`.
- Error codes: `CODE_NOT_FOUND/CODE_EXPIRED/CODE_REVOKED/CODE_EXHAUSTED/ALREADY_REDEEMED/NO_CHARACTER/INVALID_INPUT`.
- **File**: `giftcode.service.ts`. FE: `GiftCodeView.vue` + Admin tab.
- **Test**: `giftcode.service.test.ts` (12 test — bao gồm race `maxRedeems=1` 2 user đồng thời).

### Mail Flow
- Admin: `POST /admin/mail/send` body `{ recipientCharacterId, subject, body, reward*, items, expiresAt? }` hoặc `POST /admin/mail/broadcast` body cùng schema nhưng recipient=all.
- Player: `GET /mail/me` → inbox (phân biệt read/unread, claimed). `POST /mail/:id/read` → set `readAt`. `POST /mail/:id/claim` → credit rewards + set `claimedAt` + ledger `MAIL_CLAIM`.
- Claim once: guard `claimedAt IS NULL`.
- WS `mail:new` khi admin send (PR #31) → FE badge.
- Cron prune mail claimed >90d (PR #31).
- **File**: `mail.service.ts`. FE: `MailView.vue`.
- **Test**: `mail.service.test.ts` (14 test — bao gồm claim once + expired + no reward + broadcast).

### Mission Flow
- Catalog: `packages/shared/src/missions.ts` — 12 mission: 5 daily + 4 weekly + 3 once.
- Tracker: mỗi module gọi `MissionService.track<Event>` (chat/combat/cultivate/sect).
- Service update `MissionProgress.currentCount` per `(characterId, missionKey, periodStart)`.
- `GET /missions/me` → list 3 period + status (pending/ready/claimed) + windowEnd.
- `POST /missions/claim` body `{ missionKey }` → guard completed + not claimed → credit reward + ledger `MISSION_CLAIM` + set `claimedAt`.
- Reset cron: `MissionScheduler.scheduleRecurring` → DAILY @ 00:00, WEEKLY @ Monday 00:00. Xoá/tạo new period.
- Mission ONCE không reset.
- **File**: `mission.service.ts`, `mission.scheduler.ts`, `mission.processor.ts`. FE: `MissionView.vue`.
- **Test**: `mission.service.test.ts` (19 test).
- **Risk**: chưa có WS `mission:progress` — user phải refresh. Khi reset cron chạy lệch giờ (timezone) — mặc định UTC. Nếu cần VN timezone, phải adjust trong scheduler.

---

## 10. WebSocket / Realtime

### Gateway

File: `apps/api/src/modules/realtime/realtime.gateway.ts`.

- Path: `/ws`.
- CORS: `origin: true, credentials: true`.
- Auth 2 nguồn:
  1. `handshake.auth.token` (ưu tiên — dùng trong test + có thể dùng cho mobile native).
  2. Cookie `xt_access` (web).
- Verify bằng `JwtService.verifyAsync` với `JWT_ACCESS_SECRET`. Fail → emit `error {code: UNAUTHENTICATED}` + disconnect.
- Sau khi auth OK:
  - `client.data.userId = payload.sub`.
  - `realtime.attach(userId, socketId)` → map `Map<userId, Set<socketId>>`.
  - Auto-join room `world`.
  - Nếu user có `Character.sectId` → join `sect:<id>`.
- Disconnect: `realtime.detach(userId, socketId)`.

### RealtimeService methods

- `emitToUser(userId, type, payload)` — lấy tất cả socket của user và emit.
- `emitToSect(sectId, type, payload)` — emit vào `sect:<id>` room.
- `emitToWorld(type, payload)` — emit `world` room.

### Events

| Event | Direction | Payload | Emitter |
|---|---|---|---|
| `state:update` | S→C | `CharacterStatePayload` | chưa dùng (placeholder) |
| `cultivate:tick` | S→C | `CultivateTickPayload` | `CultivationProcessor` |
| `logs:append` | S→C | — | chưa implement (G3 gap) |
| `marquee` | S→C | `{ text }` | chưa implement |
| `chat:msg` | S→C | `{ channel, id, text, from, ts }` | `ChatService.sendWorld/sendSect` |
| `boss:spawn` / `boss:update` / `boss:end` / `boss:defeated` | S→C | boss state | `BossService` |
| `mail:new` | S→C | `{ mailId, subject }` | `MailService.sendToCharacter` (PR #31) |
| `ping` / `pong` | C↔S | heartbeat | `RealtimeGateway.onPing` |
| `chat:send` | C→S | — | chưa dùng qua WS (dùng REST) |

### Lỗi cũ + fix

- **G1 + G2** (gap report phase-0-8): `cultivate:tick` và `chat:msg` không deliver FE → fix ở **PR #11**. Root cause: FE `VITE_WS_URL` chứa `path=/ws` khiến socket.io connect sai path. Đã strip path + để socket.io tự append `/ws`.

### Test realtime

- `realtime.gateway.test.ts` (10 test) — dựng Nest app ephemeral port + real socket.io-client:
  - connect với cookie OK.
  - connect với `handshake.auth.token` OK.
  - `emitToUser` deliver đúng.
  - anti-regression G1/G2 (cultivate tick + chat msg live).
  - reject no/invalid/expired token.
  - auto-join sect room khi có sectId.

---

## 11. Economy / Ledger / Anti-Fraud

| Kiểm tra | Status | Ghi chú |
|---|---|---|
| `CurrencyService` | OK | `apps/api/src/modules/character/currency.service.ts`. Mọi mutation `linhThach`/`tienNgoc` chỉ qua `applyTx`. |
| `CurrencyLedger` | OK | Schema + index. Ghi per mutation. |
| `ItemLedger` | **Chưa có** | Item grant/consume không có audit table. Risk: không thể trace item duplication exploit. |
| `RewardClaimLog` | **Có idempotent trong từng module** (MissionProgress.claimedAt, Mail.claimedAt, GiftCodeRedemption) nhưng **không có** unified reward log. |
| `AdminAuditLog` | OK | Mọi admin action ghi. |
| Topup approve idempotent | OK | Check status PENDING trước credit. |
| Market buy atomic | OK | `updateMany` guard `status=OPEN`. |
| Boss reward claim once | OK | Distribute 1 lần khi DEFEATED, không redo. |
| GiftCode redeem once | OK | `@@unique(giftCodeId, userId)`. |
| Mission reward claim once | OK | Guard `claimedAt IS NULL`. |
| Mail reward claim once | OK | Guard `claimedAt IS NULL`. |

**Grep kết quả** `linhThach: { increment`/`tienNgoc: { increment` trong code (không tính test):

```
apps/api/src/modules/character/currency.service.ts:72   data: { linhThach: { increment: input.delta } }
apps/api/src/modules/character/currency.service.ts:88   data: { tienNgoc: { increment: deltaNum } }
```

→ **CHỈ CurrencyService** mutate tiền trực tiếp. Không bypass.

**Risk còn lại**:
- `ItemLedger` nên thêm khi bước sau — giúp audit duplication khi equip/unequip race + market fraud.
- `CurrencyLedger.actorUserId` chưa có index — query "user X đã làm gì với tiền người Y" sẽ full-scan.

---

## 12. Tests

| Area | Existing Tests | Missing | Priority |
|---|---|---|---|
| Auth | 15 test (`auth.service.test.ts`) | Email verification / password reset flow chưa có feature nên không test | — |
| Character/Currency | 9 test (`currency.service.test.ts`) | Test breakthrough multi-stage | Low |
| Cultivation | 5 test (`cultivation.processor.test.ts`) | Multi-instance lock test | Medium |
| Combat | 7 test (`combat.service.test.ts`) | Skill with status effect chain | Low |
| Inventory | **0 test riêng** | Equip/unequip swap, stack, use | **Medium** |
| Market | 8 test (`market.service.test.ts`) | Fee config test | Low |
| Sect | 7 test (`sect.service.test.ts`) | Leader transfer (feature chưa có) | Low |
| Chat | 9 test (`chat.service.test.ts`) | Redis failover test | Low |
| Boss | 6 test (`boss.service.test.ts`) | Spawn cron (feature chưa có) | Medium |
| Admin/Topup | 11 test (`admin-stats` + `topup-admin`) | User list filter edge | Low |
| GiftCode | 12 test (`giftcode.service.test.ts`) | Expire during redeem race | Low |
| Mail | 14 test (`mail.service.test.ts`) | WS `mail:new` tích hợp end-to-end | Low |
| Mission | 19 test (`mission.service.test.ts`) | Reset cron timezone | Medium |
| Health | 3 test (`health.controller.test.ts`) | — | — |
| Ops | 6 test (`ops.processor.test.ts`) | — | — |
| Realtime | 10 test (`realtime.gateway.test.ts`) | Ban user during connection | Medium |
| Rate limiter | 11 test (`rate-limiter.test.ts`) | — | — |
| Shared (realms/catalog/proverbs) | 30 test | — | — |
| **Web Vitest** | **0** | **Toàn bộ** | **High** |
| **E2E Playwright** | **0** | **Toàn bộ golden path** | **High** |
| **Economy integration** | Rải rác trong từng service | Cross-module ledger consistency test | Medium |

**Tổng**: 150 test api + 30 test shared = **180 test**. CI xanh. Real Postgres + real Redis service.

**Chạy**:
```bash
pnpm --filter @xuantoi/api test        # 150 test
pnpm --filter @xuantoi/shared test     # 30 test
pnpm test                              # toàn bộ (web script = echo skip)
```

---

## 13. Seed Data / Balance / Content

### Seed

- **Không có `prisma/seed.ts`** (dự án intentionally không seed vào DB — xem `docs/SEEDING.md`).
- Static catalog trong `packages/shared`:
  - `items.ts` — 30 item đủ 9 `EquipSlot` + consumables (PR #19).
  - `combat.ts` — 9 monster + 3 dungeon + 10 skill (3 skill/sect + basic).
  - `missions.ts` — 12 mission (5 daily, 4 weekly, 3 once) (PR #19).
  - `realms.ts` — 28 cảnh giới balanced `1.45^order` (PR #20).
  - `boss.ts` — boss pool.
  - `topup.ts` — packages.
- **Sect seed**: **chưa có script seed sect**. `Sect` model không có auto-create; cần admin tạo thủ công hoặc boot script (missing).

**Idempotent?** Static catalog → type-safe, tree-shakable, reload no migrate. DB chỉ lưu reference key → import mới sẽ sync ngay khi code deploy.

### Balance

- `docs/BALANCE.md` giải thích công thức EXP, cultivation rate (1.45^order), market fee, boss reward tiering.
- `cultivationRateForRealm(order)` tested (property test 28 stage ≤ 24h ở stage 1 — PR #20).

### Thiếu

- Seed sect (Thanh Vân Môn, Huyền Thuỷ Cung, Tu La Điện) — cần script boot hoặc migration data.
- Seed admin user đầu tiên — **hiện phải promote bằng SQL thủ công** (xem §19).
- Chưa có content scale: chỉ 3 dungeon + 9 monster cho 28 cảnh giới → late-game sẽ trống.
- Chưa có seed quest chain (cốt truyện NPC) — chỉ có mission daily/weekly/once tĩnh.

---

## 14. i18n / PWA / UX

| Item | Status | Ghi chú |
|---|---|---|
| i18n VI/EN dictionary | OK | `apps/web/src/i18n/{vi,en}.json` 616 dòng mỗi file, 17 namespace. PR #17 + #23 + mission/mail/giftcode. |
| Locale switcher UI | OK | `AppShell.vue`. Persist localStorage. |
| Hard-coded VN/EN còn sót? | **Có thể còn ít** | PR #23 đã gap fill nhưng chưa audit lại sau khi thêm mission/mail/giftcode. Khuyến nghị grep `['"`].*[À-ỹ].*['"]\` trong .vue/.ts trước beta. |
| PWA manifest | OK | `apps/web/public/manifest.webmanifest` + vite-plugin-pwa generateSW. 32 entries precache 623 KiB. |
| PWA icons | OK | `icons/icon-192.png`, `icon-512.png`, `icon-maskable-*.png`, `apple-touch-icon.png` (PR #18). |
| A Linh onboarding bilingual | OK | PR #18 + i18n PR #17 key `onboarding.alinh.*`. |
| Loading / empty / error state | Phần lớn OK | AuthView + OnboardingView + DungeonView có state đủ. Một số view (Boss, Giftcode history) chưa có skeleton loader. |
| Mobile responsive | **Chưa xác minh runtime** | Tailwind breakpoint có nhưng chưa smoke test trên viewport < 375px. |

---

## 15. Docs

| File | Có? | Nội dung |
|---|---|---|
| `README.md` | OK | Stack overview + quick start + architecture. |
| `docs/API.md` | OK | Endpoint inventory đầy đủ (bảng cho từng module). PR #29. |
| `docs/SEEDING.md` | OK | Static catalog strategy, helper functions list. PR #21. |
| `docs/BALANCE.md` | OK | Cultivation formula, market fee, boss tiering. PR #21. |
| `docs/BETA_CHECKLIST.md` | OK | Cut-line beta + ✅/⏳ items. PR #21. |
| `docs/ADMIN_GUIDE.md` | **Thiếu** | Cần: promote admin, grant currency, ban user, topup approve, giftcode create, mail broadcast. |
| `docs/DEPLOY.md` | **Thiếu** | Cần: prod env, migration deploy, helmet CSP, CORS origins, JWT secrets rotate. |
| `docs/SECURITY.md` | **Thiếu** | Cần: threat model, secret rotation, rate limit, audit. |
| `docs/RUN_LOCAL.md` | Phần trong README | Nên tách riêng. |
| `docs/TROUBLESHOOTING.md` | **Thiếu** | Cần: WS không connect, migration fail, Redis down, typecheck loop. |
| `docs/CHANGELOG.md` | **Thiếu** | Hiện track qua PR description. Nên consolidate. |
| `docs/AI_HANDOFF_REPORT.md` | **Đang viết (file này)** | — |

---

## 16. Known Issues / Risks

### Critical
_(Không có lỗi làm app không chạy / mất tiền / auth hỏng tại commit này. CI xanh + 180 test pass.)_

### High

| # | Issue | File | Impact | Fix đề xuất |
|---|---|---|---|---|
| H1 | Chưa có smoke E2E sau khi PR #25 + #31 merged vào main. | — | Có thể có regression không bắt được bằng unit test. | Chạy lại smoke phase-0-8 đã dùng cho PR #11, cập nhật thêm mission/mail/giftcode steps. |
| H2 | Không có seed script tạo admin đầu tiên. | `apps/api/prisma/` | Deploy mới phải promote admin bằng SQL thủ công → dễ sai + tạm bợ. | Thêm `scripts/promote-admin.ts` dùng argon2 + env `INITIAL_ADMIN_EMAIL/PASSWORD`. |
| H3 | Không có seed sect (Thanh Vân Môn, Huyền Thuỷ Cung, Tu La Điện). | — | Onboarding reference key vỡ nếu DB trống. | Thêm migration data hoặc bootstrap service check-and-create khi start. |
| H4 | `InventoryService` không có test unit. | `apps/api/src/modules/inventory/*` | Có thể exploit equip race / stack off-by-one. | Thêm ≥ 5 test integration. |
| H5 | Web chưa có Vitest + E2E Playwright. | `apps/web` | Regression FE không bắt được. | Wire Vitest minimal + 1 Playwright happy path (login → home → cultivate 1 tick → mission claim). |

### Medium

| # | Issue | Fix |
|---|---|---|
| M1 | Cron mission reset dùng timezone UTC mặc định. | Thêm env `MISSION_RESET_TZ` + config timezone (VN +07). |
| M2 | Boss spawn chỉ manual qua admin (nhưng endpoint admin spawn chưa có). | Thêm `POST /admin/boss/spawn` + audit log. |
| M3 | Chưa có WS `mission:progress` push. | Thêm emitToUser ở `MissionService.track*` (cẩn thận throttle để không spam). |
| M4 | `ItemLedger` audit table chưa có. | Model + migration + hook ở `InventoryService.grant/consume`. |
| M5 | `CurrencyLedger.actorUserId` chưa index. | `@@index([actorUserId])`. |
| M6 | LogsModule (G3 cũ) chưa build — không có `/logs/me` endpoint. | Low priority, chỉ bổ sung khi cần UI xem log action. |
| M7 | CSP production-ready nhưng chưa test deploy với CDN/asset domain khác. | Khi deploy: review `script-src`, `connect-src`. |
| M8 | Admin guard kiểm `role === 'ADMIN' \|\| 'MOD'` — MOD có quyền broad gần ADMIN. | Split fine-grained permission: MOD không được grant/approve topup. |

### Low

| # | Issue | Fix |
|---|---|---|
| L1 | Hard-code VN/EN còn lẻ tẻ. | Grep `[À-ỹ]` + `[A-Z][a-z]+ [A-Z]` trong `.vue/.ts` + thay bằng `t()`. |
| L2 | Market fee 5% hard-code. | Đưa ra `config` namespace. |
| L3 | Proverbs loading screen chỉ 30+ câu — lặp nhanh. | Mở rộng corpus. |
| L4 | Không có tên item localized (FE `MissionView` hiển thị `itemKey ×qty`). | Thêm helper `itemName(key, locale)`. |
| L5 | Một số view chưa skeleton loader. | UI polish. |

---

## 17. Missing Pages / Missing APIs

### Frontend pages thiếu (so với roadmap MUD tu tiên)

| Trang | Cần trước beta? | Ghi chú |
|---|---|---|
| `ProfileView` | **Yes** | Xem attributes, equipped, stats. Có thể dùng HomeView tab mở rộng. |
| `LeaderboardView` | Nice-to-have beta | Top power / topup / sect. |
| `SettingsView` | Nice-to-have beta | Đổi password (hiện phải qua API trực tiếp), logout all devices, locale. |
| `ShopView` (NPC shop) | **Nên có beta** | Hiện chỉ có market P2P. NPC shop bán linh dược/đan thuốc cơ bản. |
| `AlchemyView` (luyện đan) | Post-beta | Feature lớn. |
| `RefineryView` (luyện khí) | Post-beta | Feature lớn. |
| `ArenaView` (đấu trường PvP) | Post-beta | Feature lớn. |
| `EventView` | Post-beta | Event mùa (lễ hội, double drop, …). |
| `PetView` | Post-beta | Theo doc 04. |
| `CompanionView` (đạo lữ / phụ tu) | Post-beta | Lớn + cần balance. |

### APIs thiếu

| API | Tình trạng | Cần trước beta? |
|---|---|---|
| `GET /character/profile/:id` (xem profile player khác) | Thiếu | Nice-to-have |
| `POST /admin/boss/spawn` | Thiếu | **Yes** (để run live event) |
| `POST /auth/forgot-password` + `POST /auth/reset-password` | Thiếu | Nice-to-have beta closed |
| `POST /auth/verify-email` | Thiếu | Closed beta không cần |
| `GET /leaderboard/{power,topup,sect}` | Thiếu | Nice-to-have |
| `GET /shop/npc` + `POST /shop/buy` | Thiếu | **Nên có** |
| `POST /missions/progress/stream` (WS mission:progress) | Thiếu | Low |
| `POST /logs/me` | Thiếu (G3) | Low |

**Không có route FE đang gọi mà BE chưa có** — kiểm tra nhanh `apps/web/src/api/*.ts` khớp với controller.

---

## 18. How To Run Locally

```bash
# 1. Clone + install
git clone https://github.com/hoathienmenh-01/xuantoi.git
cd xuantoi
pnpm install

# 2. Boot infra (postgres + redis + minio + mailhog)
pnpm infra:up

# 3. Env
cp apps/api/.env.example apps/api/.env       # chỉnh nếu cần
cp apps/web/.env.example apps/web/.env       # VITE_API_URL + VITE_WS_URL

# 4. Prisma
pnpm --filter @xuantoi/api exec prisma generate
pnpm --filter @xuantoi/api exec prisma migrate deploy

# 5. (Optional) seed admin đầu tiên — xem §19

# 6. Dev (2 tab song song)
pnpm -r --parallel run dev    # hoặc pnpm --filter @xuantoi/api dev & pnpm --filter @xuantoi/web dev

# 7. Test + typecheck + lint + build
pnpm typecheck
pnpm lint
pnpm --filter @xuantoi/api test
pnpm --filter @xuantoi/shared test
pnpm build
```

**Default env** (dev):
- `DATABASE_URL=postgresql://mtt:mtt@localhost:5432/mtt?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `JWT_ACCESS_SECRET=dev-access-secret`
- `JWT_REFRESH_SECRET=dev-refresh-secret`
- `NODE_ENV=development`
- `CORS_ORIGINS=http://localhost:5173`

**Production**: phải set `NODE_ENV=production` + cả `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` ≠ mặc định + `CORS_ORIGINS` csv. `main.ts:assertProductionSecrets` sẽ throw nếu thiếu.

**Port**:
- API: 3000 (mặc định Nest)
- Web: 5173 (Vite)
- Postgres: 5432
- Redis: 6379
- Minio: 9000 (+ console 9001)
- Mailhog: 1025/8025

---

## 19. How To Promote Admin / Test Admin

**Hiện tại không có script tạo admin sẵn**. 2 cách:

### Option A — SQL thủ công (dev)

```bash
pnpm --filter @xuantoi/api exec prisma studio
# Mở http://localhost:5555 → bảng User → chọn user → role = ADMIN
```

Hoặc:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.local';
```

### Option B — Đã có 1 admin sẵn (grant người khác)

Admin hiện tại có thể vào `/admin` → Users → tìm → **Set role = ADMIN**. Mỗi action ghi `AdminAuditLog`.

### Login admin

- Login bình thường qua `/auth` với email + password đã đổi role.
- Vào `/admin` (route sẽ guard role check cả FE + BE).

### Quyền admin

| Tab | Hành động | Endpoint |
|---|---|---|
| Users | list, ban/unban, set role, grant currency | `/admin/users*` |
| Topups | list by status, approve, reject | `/admin/topups*` |
| Audit | list log | `/admin/audit` |
| Stats | user count, active, topup total | `/admin/stats` |
| GiftCodes | list, create, revoke | `/admin/giftcodes*` |
| Mail | send (1 char), broadcast | `/admin/mail/*` |

### Hành động nguy hiểm

- **Grant currency** không có limit — admin có thể cộng 10^18 linhThach. Ghi audit nhưng không rollback.
- **Broadcast mail với reward lớn** → mọi character đều nhận. Không thể unsend.
- **Set role** — mất quyền ADMIN nếu tự demote chính mình (**rule 9** không được vi phạm, FE hiện **không chặn** self-demote — cần fix).

---

## 20. Recommended Next Roadmap

### Immediate (ngay trong 1-2 session tới)

1. **Smoke E2E sau PR #25 + #31 merged**: chạy full auth → onboarding → cultivate → combat → mission claim → mail claim → giftcode redeem trên main hiện tại. Ghi report.
2. **Fix H2 + H3**: thêm script seed admin + sect qua `scripts/bootstrap.ts`.
3. **Fix H4**: thêm 5-6 test cho InventoryService.
4. **Viết** `docs/ADMIN_GUIDE.md` + `docs/DEPLOY.md` + `docs/RUN_LOCAL.md`.

### Before Closed Beta

5. **Web Vitest minimal** (component smoke cho 3-4 view chính).
6. **E2E Playwright** 1 golden path (login → home → cultivate tick → mission claim → mail claim).
7. **NPC Shop** (feature + API + view + seed item).
8. **Admin boss spawn endpoint**.
9. **Item Ledger** audit table.
10. **Admin guard split** (MOD giảm quyền).
11. **Settings page** (đổi password + logout all + locale).
12. **i18n gap audit** (grep cuối).
13. **Timezone config cho mission reset cron**.
14. **Mobile responsive verify** trên iPhone SE viewport.

### During Closed Beta

15. Monitor `/healthz` + `/readyz` + ledger balance consistency check định kỳ.
16. Thu thập user feedback + bug report.
17. Balance tuning: cultivation rate, loot drop, market fee, mission reward.

### After Beta

18. **Alchemy** (luyện đan).
19. **Refinery** (luyện khí forge).
20. **Arena PvP**.
21. **Pet system**.
22. **Companion/Wife** (đạo lữ).
23. **Battle Pass seasonal**.
24. **Event system + cron spawn**.
25. **Leaderboard**.
26. **Cross-server world boss**.

---

## 21. Exact PR Plan For Next AI

### PR 1 — Seed admin + sect bootstrap (H2 + H3)
- **Mục tiêu**: Fresh deploy có thể chạy được ngay.
- **File dự kiến**:
  - `apps/api/scripts/bootstrap.ts` (new) — hash password bằng argon2, upsert user ADMIN, upsert 3 sect.
  - `apps/api/package.json` — thêm script `"bootstrap": "ts-node scripts/bootstrap.ts"`.
  - `apps/api/.env.example` — thêm `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`.
  - `README.md` + `docs/RUN_LOCAL.md` — hướng dẫn chạy.
- **Test**: 1 test đảm bảo chạy 2 lần không tạo duplicate (idempotent upsert).
- **Risk**: Nếu production đã có admin thủ công → script phải chỉ upsert khi chưa có (check count). Ghi rõ trong PR.

### PR 2 — InventoryService test (H4)
- **Mục tiêu**: tăng coverage.
- **File**: `apps/api/src/modules/inventory/inventory.service.test.ts` (new).
- **Test cases**: equip → unequip → swap slot; stack qty up/down; use potion heal; grant đúng qty; equip khi slot đã occupied → swap.
- **Risk**: thấp, không sửa service.

### PR 3 — Docs ADMIN_GUIDE + DEPLOY + RUN_LOCAL
- **Mục tiêu**: AI mới + user admin mới có thể tự setup.
- **File**: `docs/ADMIN_GUIDE.md` (new), `docs/DEPLOY.md` (new), `docs/RUN_LOCAL.md` (new), README link.
- **Test**: không.

### PR 4 — NPC Shop + seed
- **Mục tiêu**: late-game không trống vì chưa đủ player để maintain market.
- **File**: `apps/api/src/modules/shop/*` (new module), `packages/shared/src/shop.ts` (new catalog), `apps/web/src/views/ShopView.vue` (new), `router/index.ts`, i18n.
- **Test**: `shop.service.test.ts` (buy ok / out-of-stock / insufficient).
- **Risk**: balance giá — bắt đầu với item phàm 3-5 cấp LINH_THACH thấp.

### PR 5 — Admin boss spawn endpoint
- **Mục tiêu**: admin có thể chạy live event.
- **File**: `admin.service.ts` thêm `spawnBoss`, controller `POST /admin/boss/spawn`, admin tab UI.
- **Test**: admin-stats test extend + guard test.
- **Risk**: nếu đã có ACTIVE boss → reject với BOSS_ACTIVE.

### PR 6 — E2E Playwright golden path
- **Mục tiêu**: bắt regression quan trọng nhất.
- **File**: `apps/web/e2e/golden.spec.ts` (new), `playwright.config.ts` (new), CI job.
- **Test**: register → onboard → cultivate toggle → 1 tick → mission claim → mail claim.
- **Risk**: CI chạy postgres/redis + vite build → thêm 2-3 phút pipeline.

### PR 7 — Settings page + change password UI
- **Mục tiêu**: user có thể đổi password mà không cần curl.
- **File**: `apps/web/src/views/SettingsView.vue` (new), router, i18n, logout-all button.
- **Test**: không unit (wire FE only).

### PR 8 — Item Ledger
- **Mục tiêu**: audit item grant/consume.
- **File**: migration (new), `ItemLedger` model, hook ở `InventoryService`.
- **Test**: extend inventory test.
- **Risk**: migration ADD TABLE — an toàn backward compat. Rollback: DROP TABLE.

### Thứ tự đề xuất
**1 → 2 → 3 → 6** (trước closed beta core) → **4 → 5 → 7 → 8** (enhance).

---

## 22. Rules For The Next AI

**LUẬT KHÔNG ĐƯỢC VI PHẠM** (copy từ user):

1. Không push thẳng vào `main` — luôn qua PR.
2. Không merge PR khi CI đỏ.
3. Không tắt/skip test hoặc CI stage để cho qua.
4. Không commit secret/token/key/cookie/`.env` thật. Dùng `.env.example` placeholder.
5. Không xoá database hoặc reset production data.
6. Không xoá repo, không xoá branch quan trọng.
7. Không đổi default branch nếu không cần.
8. Không thêm payment thật / tích hợp cổng thanh toán thật khi chưa có yêu cầu.
9. Không làm mất quyền admin đầu tiên.
10. Không xoá dữ liệu người chơi thật.

**Quy tắc làm việc**:

- Mỗi PR scope rõ. Ưu tiên PR nhỏ, dễ review.
- Không refactor lan man ngoài phạm vi.
- Viết ghi chú giả định trong PR body nếu phải tự quyết (ảnh hưởng dữ liệu? cách rollback?).
- Chạy đủ 4 bước trước khi báo xong:
  ```bash
  pnpm typecheck && pnpm lint && pnpm --filter @xuantoi/api test && pnpm build
  ```
- Sau khi push, đợi CI 3/3 xanh (2 GitHub Actions build + Devin Review không block) rồi báo user.
- Nếu credential/secret thiếu: placeholder + TODO trong PR, không hard-code.
- Báo cáo 9 mục sau mỗi PR: Mục tiêu / File sửa-thêm / Dữ liệu seed-balance-i18n / Migration / Test / Lệnh đã chạy / CI status / Rủi ro còn lại / PR tiếp theo.

**Lưu ý Nest DI trong test**:
- Vitest cần `unplugin-swc` để emit decorator metadata — đã wire ở `apps/api/vitest.config.ts`. Khi thêm test Nest service mới với DI, constructor phải đủ tham số (không bypass).
- Helper `makeMissionService(prisma)` trong `src/test-helpers.ts` — dùng cho test có hook mission.

**Lưu ý migration**:
- Mỗi migration thêm ADD TABLE / ADD COLUMN là an toàn.
- Tránh DROP COLUMN / ALTER TYPE destructive khi đã có data.
- Luôn test locally: `prisma migrate reset --force --skip-seed` + full test suite trước khi push.

**Lưu ý security**:
- Password hash = argon2id (không phải bcrypt).
- JWT access 15m, refresh 30d, cookie httpOnly SameSite=Lax. Cross-origin production cần None + Secure.
- Rate limit login 5 fail/15m/(ip+email).
- `passwordVersion` tăng khi change-password → kill all active access.

---

## Appendix A — Quick commands cheat sheet

```bash
# Start fresh
pnpm install && pnpm infra:up
pnpm --filter @xuantoi/api exec prisma migrate reset --force --skip-seed
pnpm -r --parallel run dev

# Tests
pnpm --filter @xuantoi/api test                    # 150 test
pnpm --filter @xuantoi/shared test                 # 30 test

# Specific test
pnpm --filter @xuantoi/api exec vitest run src/modules/mission

# Prisma
pnpm --filter @xuantoi/api exec prisma studio
pnpm --filter @xuantoi/api exec prisma migrate dev --name my_migration
pnpm --filter @xuantoi/api exec prisma generate

# Build
pnpm build
```

## Appendix B — Key file paths for quick orientation

| Mục đích | File |
|---|---|
| Module list | `apps/api/src/app.module.ts` |
| Schema | `apps/api/prisma/schema.prisma` |
| WS gateway | `apps/api/src/modules/realtime/realtime.gateway.ts` |
| Currency wrapper | `apps/api/src/modules/character/currency.service.ts` |
| Error envelope | `apps/api/src/common/all-exceptions.filter.ts` |
| Auth cookies | `apps/api/src/common/auth-cookies.ts` |
| Router FE | `apps/web/src/router/index.ts` |
| Game store (WS subscribe) | `apps/web/src/stores/game.ts` |
| API client | `apps/web/src/api/client.ts` |
| Shell / nav / locale | `apps/web/src/components/shell/AppShell.vue` |
| Shared entry | `packages/shared/src/index.ts` |
| Realms catalog | `packages/shared/src/realms.ts` |
| Mission catalog | `packages/shared/src/missions.ts` |
| Docs hub | `docs/API.md`, `docs/SEEDING.md`, `docs/BALANCE.md`, `docs/BETA_CHECKLIST.md` |

---

_Kết thúc báo cáo. Chúc AI kế nhiệm may mắn — hãy giữ nguyên tinh thần đạo hữu (hoathienmenh-01): thà chậm mà chắc, CI phải xanh, tiền phải ghi ledger, và đừng bao giờ push thẳng `main`._
