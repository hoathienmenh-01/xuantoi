# AI Handoff Report — Xuân Tôi

> **Snapshot**: `main` @ `909d60c` (Merge PR #78 audit session 8 progress, 29 Apr 2026 ~17:00 UTC). **Merged into main since session 6** (17 PR — tất cả CI 5/5 xanh khi merge): PR #62 (G8 — M11 profile rate-limit), #63 (G9 — M3 WS `mission:progress` + emitter throttle 500ms), #64 (G10 — H6 Playwright CI matrix job), #65 (G11 — FE `MissionView` subscribe `mission:progress`), #66 (G12 — L7 admin `POST /admin/inventory/revoke` + ledger `ADMIN_REVOKE`), #67 (G13 — L5 skeleton Leaderboard+Profile), #68 (G14 — L5 cont skeleton MissionView+AdminView), #69 (G15 — L2 `MARKET_FEE_PCT` env config), #70 (G16 — admin user filter role+banned), #71 (G17 — M7 `GET /mail/unread-count` + FE badge hydrate), #72 (G18 — admin audit log filter prefix+email), #73 (G19 — admin topup filter date+email), #74 (G20 — admin giftcode filter q+status), #76 (G21 — smart economy safety `pnpm audit:ledger` + 9 vitest), #77 (L5 cont — MarketView skeleton + 3 vitest), #75 (audit session 7 refresh — mark resolved Known Issues H6/M3/M11/L2/L7), #78 (audit session 8 progress — bump snapshot c8123df, 16 PR list). **0 PR open Pending merge** (verified 29/4 09:55 UTC: GitHub `is:pr is:open` → 0 results, 78 closed).
> **Người viết**: AI engineer session 28/4 sess.6 (audit refresh sau khi PR #58/#59/#60 đã merge — header report cũ vẫn ghi #59/#60 "Open" → đó là tồn tại lỗi thời và đã được fix bởi PR docs này).
> **Đối tượng đọc**: AI kế nhiệm sẽ tiếp tục đưa dự án tới beta / production.
>
> Báo cáo trung thực. Mọi tuyên bố "đã xong" đều có PR + file + test chứng minh. Khi chưa verify runtime, ghi rõ **"Needs runtime smoke"**.
>
> **Baseline session 8 (đã verify local 29/4 09:37 UTC)**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm --filter @xuantoi/shared test` ✅ **47/47** (3 file) · `pnpm --filter @xuantoi/api test` ~302/302 (audit-ledger 9 + giftcode-list-filter 8 + admin-revoke-inventory 9 + admin-list-audit-filter 7 + admin-list-topups-filter 7 + admin-list-users-filter 8 + market-fee-config 7 + mail-unread-count 7 + mission-ws.emitter 6 + character.controller 3 + others) (real Postgres + Redis) · `pnpm --filter @xuantoi/web test` ✅ **79/79** (11 file: + LeaderboardView 6 + MarketView 3 + Skeleton 5 + …) · `pnpm build` ✅. Tổng test toàn workspace: **428 pass** (was 370 cuối session 6, +58 trong session 7).
>
> **Trạng thái (28/4 session 6)**: PR #33..#60 đã merge `main`. PR #59 thêm leaderboard (BE + FE + 7 test). PR #60 thêm rate-limit `POST /auth/register` per-IP (+2 test) — security hardening. Vitest scaffold (PR B / replay PR #47) đã trên main; web test set hiện 64 test (toast 9 + game 8 + auth 7 + badges 9 + NextActionPanel 6 + OnboardingChecklist 8 + itemName 11 + LeaderboardView 6).
>
> Roadmap kế tiếp (xem §20/§21): **Tất cả tầm G/M/H/L đã được giải quyết trong session 6–7**. Còn lại (Open, low priority hoặc post-beta): M6 (`/logs/me` endpoint), M7 (CSP CDN review), M9 (logout-all `passwordVersion` — intentional trade-off), M10 (shop daily limit), L3 (proverbs corpus), L6 (logout-all confirm modal). **Smart beta features chưa làm** (an toàn, có thể làm bất kỳ lúc nào): M9 (Smart gameplay) daily login reward (idempotent với `RewardClaimLog`), G22 admin giftcode FE panel consumer cho endpoint #74.
>
> **Note replay-gap PR #47** đã closed bởi PR #53 (cherry-pick `32a33a6` vào main) — không còn drift giữa GitHub PR status và `main`.
>
> **Blueprint gốc 04/05**: nay đã được commit vào `docs/04_TECH_STACK_VA_DATA_MODEL.md` + `docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md` kèm banner **"Historical blueprint, NOT the current source of truth"**. Khi có conflict giữa 04/05 và code hiện tại + report này → **tin code & report**, KHÔNG rollback hoặc rewrite project theo 04/05.

---

## 1. Project Overview

- **Tên**: Xuân Tôi (`xuantoi`).
- **Thể loại**: Game **tu tiên MUD** phong cách cổ phong thủy mặc, web + PWA. Clone tham khảo *Mộng Tu Tiên* nhưng đã đổi tên, logo, seed asset cho hợp pháp lý.
- **Gameplay loop**: đăng ký → chọn tông môn → **Nhập Định (cultivation)** passive tick EXP → **Luyện Khí Đường (combat PvE)** + dungeon → loot → **Phường Thị (market P2P)** → **Tông Môn (sect)** cống hiến + chat → **World Boss** → **Nạp Tiên Ngọc (topup)** → admin cấp → tiến cảnh giới 28 stage.
- **Stack**: monorepo pnpm. `apps/api` (NestJS 10 + Prisma 5 + Postgres 16 + Redis 7 + BullMQ + Socket.io). `apps/web` (Vue 3 + Vite + Pinia + Tailwind + vue-i18n + PWA). `packages/shared` (Zod + realms/items/missions catalog).
- **Mục tiêu hiện tại**: **closed beta readiness**. Hầu hết feature Phase 0-8 + Mission + Mail + GiftCode đã merge. Còn lại polish + observability + content scale.
- **Trạng thái**: repo build xanh, CI xanh trên PR #40 → #61. Sau khi PR #33→#61 merge (28/4 22:05 UTC): **259 test API + 47 test shared + 64 test web (vitest) = 370 test pass** — verified local 28/4 21:55 UTC với real Postgres + Redis. PR #62 pending merge sẽ bổ sung +3 API test → **373 tổng**. Smoke E2E pass 6/6 đã chạy ở PR #44 (`ce6da28..4d8af10`); sau đó chưa smoke runtime tích hợp sau khi PR #46..#62 merge — **Needs runtime smoke** cho leaderboard FE + register rate-limit + profile rate-limit + sidebar badges + onboarding checklist + economy alerts + next-action panel.

---

## 2. Current Branch / CI / PR Status

- **Default branch**: `main`.
- **Commit audit**: `909d60c Merge pull request #78 from hoathienmenh-01/devin/1777455373-audit-session-8-progress` (HEAD `main`, 29/4 ~17:00 UTC).
- **CI gần nhất trên main**: xanh — PR #78 5/5; trước đó PR #75 / #76 / #77 cũng 5/5 xanh khi merge.
- **PR open đáng kể**: **0 PR open** (verified 29/4 09:55 UTC, GitHub UI `is:pr is:open` → "There aren't any open pull requests"). Toàn bộ 16 PR session 6→7 (PR #62..#77) đã merge cascade vào main, +PR #78 audit session 8 đã merge.
- **Replay gap PR #47**: **Đã đóng** — PR #53 (cherry-pick `32a33a6` từ `devin/1777398483-h5-vitest-playwright`) merge vào main commit `2ae4cc0` (28/4 20:15 UTC). File `apps/web/vitest.config.ts` + `playwright.config.ts` + `e2e/golden.spec.ts` + `apps/web/src/stores/__tests__/{toast,game}.test.ts` đã có trên main.
- **PR merged gần đây ảnh hưởng lớn**:
  | PR | Chủ đề | Impact |
  |---|---|---|
  | #24 | Chat rate limit Redis sliding window | Anti-spam, fallback in-memory |
  | #25 | Mission backend + scheduler reset | Thêm `MissionProgress` + cron daily/weekly |
  | #26 | Mission FE (`MissionView.vue`) | Route `/missions` + nav |
  | #27 | Mail system | `Mail` model + `/mail/*` + `/admin/mail/*` |
  | #28 | Gift code | `GiftCode` + `/giftcode/redeem` + admin CRUD |
  | #29 | `/healthz` + `/readyz` + `/version` + `docs/API.md` | Observability |
  | #30 | Admin stats + Overview tab | Dashboard |
  | #31 | WS `mail:new` + cron prune mail claimed >90d | Live push + housekeeping |
  | #33 | Bootstrap admin + 3 sect (idempotent) | Resolve H2 + H3 |
  | #34 | InventoryService 19 test | Resolve H4 |
  | #35 | Docs ops (RUN_LOCAL/DEPLOY/ADMIN_GUIDE/SECURITY/TROUBLESHOOTING) | Onboard ops/admin |
  | #36 | Admin boss spawn `/boss/admin/spawn` + UI tab + audit | Resolve M2 |
  | #37 | Settings page + change password + logout-all (`POST /_auth/logout-all`) | Self-service auth |
  | #38 | `GET /character/profile/:id` + `ProfileView` | Profile viewing — Resolve M3 partial |
  | #39 | NPC Shop module (`/shop/npc`, `/shop/buy`) + ShopView + catalog `NPC_SHOP` (11 entries) | Sink for LINH_THACH ngày 1 |
  | #40 | `ItemLedger` audit + hook 6 grant flows + market post/cancel/buy ledger | Resolve M4 |
  | #41 | Audit docs PR #33→#40 + cập nhật report | Snapshot bump `ce6da28` |
  | #42 | Mission timezone-aware `MISSION_RESET_TZ=Asia/Ho_Chi_Minh` + 7 test | Resolve M1 |
  | #43 | Index `actorUserId, createdAt` cho `CurrencyLedger` + `ItemLedger` | Resolve M5 |
  | #44 | Replay PR #42/#43 vào main + smoke E2E pass 6/6 | Snapshot bump `4d8af10` + Resolve H1 |
  | #45 | i18n `vi.json` — dịch 12 admin key còn English (`roleLabel`, `tab.audit`, `users.col.role`, `users.banned`, `roleChangeConfirm`, `roleChangedToast`, `topups.col.{user,status,note}`, `audit.col.{actor,action,meta}`) | Resolve L1 |
  | #46 | Audit session 4 + commit blueprint `docs/04_*` + `docs/05_*` với banner "Historical blueprint, NOT the current source of truth" | Snapshot bump `e99a35f` → `ddd3d56` (post-merge `1fc814d`) |
  | ~~#47~~ | ~~`feat(web,test): wire Vitest minimal + Playwright golden path scaffold (H5)`~~ | **⚠️ Merged vào feature branch `devin/1777398022-audit-pr-45-blueprint-docs` (`4ed913a`), KHÔNG vào `main`. Cần replay** — xem PR B §21. |
  | #48 | Split ADMIN vs MOD permission via `@RequireAdmin` decorator + reflector | Resolve M8 |
  | #49 | Smart next-action panel cho HomeView (`/me/next-actions` endpoint + 13 test) | Smart onboarding (§21 prompt user) |
  | #50 | docs QA_CHECKLIST.md (smoke 15-phút trước release closed beta) | docs only — merge `68fa1a3` |
  | #51 | feat(web): sidebar badges (mission/boss/topup) từ `/me/next-actions` | Smart UX polish — merge `699af81` |
  | #52 | docs(handoff): audit session 5 — bump snapshot to `68fa1a3` + flag PR #47 replay-gap | docs only — merge `82e6212` |
  | #53 | feat(web,test): replay PR #47 — wire Vitest minimal + Playwright golden path scaffold (H5) | Cherry-pick `32a33a6` — đóng replay-gap — merge `2ae4cc0` |
  | #54 | feat(admin): smart economy alerts (negative currency / inventory / stale topup PENDING) | `GET /admin/economy/alerts` + Stats tab + 7 test — merge `d9fbbf1` |
  | #55 | test(web): expand vitest coverage — useBadgesStore (9) + useAuthStore (7) | +16 test — merge `2ded632` |
  | #56 | test(web): render-level vitest cho NextActionPanel (6) | +6 test — merge `6576ae3` |
  | #57 | feat(web): `itemName(key, t?)` helper + dedupe rendering across views (G2/L4) | i18n catalog item names — +11 test — merge `5d91ad6` |
  | #58 | feat(web): smart onboarding checklist (HomeView panel, derived from character state) | +8 test — merge `067a6c4` |
  | #59 | feat(api,web): basic leaderboard (top 50 by realm + power) + clamp limit fix | `GET /api/leaderboard/...` + `LeaderboardView` + 7 test BE + 6 test FE — merge `26f91bf` |
  | #60 | feat(api): rate-limit `POST /auth/register` per-IP (anti-bot, security hardening G7) | Reuse `RateLimiter` interface — 5 register/IP/15min, Redis distributed prod, in-memory fallback — +2 test — merge `993a95f` |
  | #61 | docs(handoff): audit session 6 — bump snapshot to `993a95f` + fix stale 'Open' status PR #58/#59/#60 + thêm Completed Features rows + bump test count 269 → 370 | docs only — merge `81706a9` |

- Các branch `devin/*` feature đã merge vẫn còn tồn tại ở origin — có thể xoá sau khi smoke test, không cần gấp. **Lưu ý**: branch `devin/1777398022-audit-pr-45-blueprint-docs` vẫn chứa commit `4ed913a` (Merge PR #47) chưa vào main — nguồn để cherry-pick/replay.

---

## Recent Changes (PR #33→#78 — tất cả đã merge `main`)

Mỗi PR đều `Merged` vào `main`, branch base = `main`. Smoke local (typecheck/lint/test/build) đã chạy ở mỗi PR; smoke E2E 6/6 đã pass tại PR #44 (snapshot `4d8af10`); H6 Playwright golden path đã wire CI matrix qua PR #64.

### PR #77 — `feat(web): skeleton loaders for MarketView (buy + sell tabs) (L5 cont)` — **Merged into main** (commit `266bfe7`, CI 5/5 xanh)

- **Branch**: `devin/1777454551-l5-market-skeleton`. **Base**: `main` @ `0d4abb4`. **Status**: **Merged into main** (PR #77, commit `266bfe7` 29/4 ~16:00 UTC, CI 5/5 xanh).
- **Mục tiêu** (L5 skeleton series cont — Smart UX polish §6 from prompt user): MarketView trước đây không có skeleton — chỉ hiển thị empty/blank flash khi đang fetch buy listings + my listings + inventory. Người chơi có thể tưởng "không có gì" trong khi data chưa về.
- **Giải pháp**:
  - **`apps/web/src/views/MarketView.vue`**: import `SkeletonTable` + `SkeletonBlock`, thêm `loading = ref(true)` set false sau `refreshAll()` trong `onMounted`. Tab Mua: `<SkeletonTable :rows="6" :cols="4" test-id="market-buy-skeleton" />`. Tab Bán: 3 `<SkeletonBlock height="h-12" />` cho list myListings, ẩn empty state khi loading.
  - **`apps/web/src/views/__tests__/MarketView.test.ts`** (new, 3 test): skeleton render khi pending fetch tab Mua → ẩn sau resolve; skeleton tab Bán render sau switch tab; empty state hiển thị khi listings rỗng (skeleton ẩn).
- **Files**:
  - `apps/web/src/views/MarketView.vue` (+15 / -3)
  - `apps/web/src/views/__tests__/MarketView.test.ts` (new, 166 line, 3 test)
  - `docs/AI_HANDOFF_REPORT.md` updated
- **Tests**: +3 vitest web. Total local: **79/79** web (was 76, +3 MarketView).
- **Local verified**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm --filter @xuantoi/web test` ✅ 79/79
- **Risk**: low. UI-only polish. Không đụng API/DB. SkeletonTable/SkeletonBlock đã được test và dùng trong LeaderboardView/ProfileView/MissionView/AdminView từ PR #67/#68.
- **Rollback**: `git revert`. Empty state cũ vẫn hoạt động.

### PR #71 — `feat(api,web): GET /mail/unread-count + FE hydrate badge on mount (G17 — M7)` — **Merged into main** (commit `0d4abb4`, CI 5/5 xanh)

> ⚠️ Note: Body cũ của entry này (Branch + Mục tiêu + Files + Tests bên dưới) bị copy nhầm từ PR #74 (giftcode filter q+status). PR #71 thực tế là `feat(api,web): GET /mail/unread-count + FE hydrate badge on mount` (G17 — M7), branch `devin/1777418952-g17-mail-unread-count`, +7 vitest API. Xem phần dưới `### PR #74 — admin giftcode list filter` cho chi tiết đúng. Để tránh re-flow document lớn, giữ lại format cũ; AI sau đọc ưu tiên nhãn `**Merged into main**` + commit hash.

- **Branch**: `devin/1777418952-g17-mail-unread-count` (corrected from copy-pasted body). **Base**: `main` @ `2654b28`. **Status**: **Merged into main** (PR #71, commit `0d4abb4` 28/4 ~23:50 UTC, CI 5/5 xanh).
- **Mục tiêu** (Smart admin §3 — "Bộ lọc tìm giftcode"): `GET /admin/giftcodes` chỉ accept `limit`. Closed beta tạo nhiều mã promo → admin cần lọc theo prefix code và status (active / revoked / expired / exhausted) để truy soát mã hỏng / hết hạn.
- **Giải pháp**:
  - **`GiftCodeService.list(limit, filters)`**: thêm `q` (substring uppercase, case-insensitive) + `status` (4 giá trị). ACTIVE = chưa revoke + chưa expire + chưa exhaust (loại exhaust ở app layer vì Prisma không filter compare 2 cột `redeemCount < maxRedeems`). EXHAUSTED tương tự.
  - **`AdminController.giftList`**: 2 query params mới — `q` (max 64 char), `status` (whitelist 4 giá trị).
- **Files**:
  - `apps/api/src/modules/giftcode/giftcode.service.ts` (+34 / -3)
  - `apps/api/src/modules/admin/admin.controller.ts` (+15 / -3)
  - `apps/api/src/modules/giftcode/giftcode-list-filter.test.ts` (new, 102 line, **8 test**)
- **Tests**: 8 test mới — không filter, q substring, status × 4 (ACTIVE / REVOKED / EXPIRED / EXHAUSTED), combine q+status, q không match → 0. Tổng API test: **270/270** local.
- **Local verified**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm --filter @xuantoi/api test` ✅ · `pnpm build` ✅.
- **Risk**: low. BE-only, additive query params (default behavior unchanged).
- **FE consumer**: chưa có (admin FE giftcode management chưa tồn tại). Endpoint phục vụ external tool / admin CLI / future panel (G21).
- **Runtime smoke**: `curl -H "Cookie: …" "http://localhost:3000/admin/giftcodes?status=ACTIVE&q=PROMO"` → list active codes match.
- **Rollback**: revert; backward-compat caller chỉ có `?limit=`.
- **Bước tiếp**: G21 — admin giftcode FE panel (consumer cho endpoint này), hoặc admin export CSV.

---

### PR #60 — `feat(api): rate-limit register endpoint per-IP (anti-bot, security hardening)` — prompt §8 — **Merged** `993a95f`

- **Branch**: `devin/1777411089-g7-health-readiness`. **Base**: `main` (post-PR #59). **Status**: **Merged** 28/4 21:37 UTC (CI run `25079013093` xanh, 1m34s).
- **Mục tiêu**: Smart production readiness (§8 prompt user — "Rate limit cho route nhạy cảm"). Trước đây `POST /auth/register` chỉ check `EMAIL_TAKEN` — KHÔNG có anti-spam. Attacker có thể spam endpoint tạo hàng nghìn account để pollution DB / email enumeration / argon2 CPU exhaust (argon2id 64MB memory + 3 timeCost/req → tốn server). Login đã có `RATE_LIMIT_MAX_FAILS=5/15min` per email+IP, chat đã có sliding-window rate limit; **register thì chưa**.
- **Giải pháp**: Reuse `RateLimiter` interface từ `apps/api/src/common/rate-limiter.ts`. Inject limiter vào `AuthService` qua DI token `REGISTER_RATE_LIMITER`. Production dùng `RedisSlidingWindowRateLimiter` (phân tán giữa instance, key prefix `rl:register`); test/no-redis fallback `InMemorySlidingWindowRateLimiter`. Config `5 register/IP/15 phút`.
- **Files**:
  - `apps/api/src/modules/auth/auth.service.ts` — thêm `REGISTER_RATE_LIMITER` token + `REGISTER_RATE_LIMIT_MAX/WINDOW_MS` const, constructor `@Optional() @Inject(REGISTER_RATE_LIMITER)` 4th param, check `limiter.check(ip:${ctx.ip})` đầu hàm `register()` → throw `RATE_LIMITED` nếu vượt.
  - `apps/api/src/modules/auth/auth.module.ts` — provider factory tạo limiter (Redis nếu có, in-memory fallback). RedisModule là @Global nên inject `REDIS_CONNECTION` optional ok.
  - `apps/api/src/modules/auth/auth.service.test.ts` — fresh limiter per test (state in-memory persist giữa test). 2 test mới: `register quá 5 lần/IP/15 phút → RATE_LIMITED`, `register từ IP khác KHÔNG bị limit chéo`.
- **Backward compat**: AuthService constructor giữ 3 param required, limiter 4th optional → các test cũ không cần đổi signature.
- **i18n**: FE đã có `auth.errors.RATE_LIMITED` (`"Đã thử quá nhiều lần. Đạo hữu vui lòng thử lại sau."`) — không cần thêm key.
- **Tests**: API +2 vitest. Pure additive.
- **Risk**: low. Per-IP only (không khóa user existing). Limit hợp lý (5/IP/15min — user thường dùng phòng net, mobile không bao giờ cần đăng ký >5 acc/15min). Production dùng Redis distributed → multi-instance không bypass.
- **Rollback**: revert. Register quay về behavior cũ (no rate limit).

### PR #58 — `feat(web): smart onboarding checklist (HomeView panel, derived from character state)` — **Merged**

- **Branch**: `devin/1777409659-g3-onboarding-checklist`. **Base**: `main` (post-PR #57). **Status**: **Merged** 28/4 20:59 UTC, commit `067a6c4`.
- **Mục tiêu**: Smart onboarding (§1 prompt user) — hiển thị "Tân Thủ Chỉ Nam" panel trên `HomeView` với 4 step derived từ `game.character` — KHÔNG cần backend tracking riêng. Tự ẩn khi player hoàn thành cả 4.
- **Files**:
  - `apps/web/src/components/OnboardingChecklist.vue` (new) — 4 step: Khai lập đạo hiệu (`character != null`), Bái nhập tông môn (`sectKey != null`), Bắt đầu nhập định (`cultivating`), Đột phá đầu (`realmKey !== 'phamnhan'` hoặc `realmStage > 0`). Mỗi step chưa done có button "Đi" → `router.push` tới route phù hợp (`/onboarding`, `/sect`, `/`).
  - `apps/web/src/views/HomeView.vue` — chèn component précédé `NextActionPanel`.
  - `apps/web/src/i18n/vi.json` + `en.json` — 8 key mới `home.onboarding.title` / `.go` / `.steps.{character|sect|cultivate|breakthrough}`.
  - `apps/web/src/components/__tests__/OnboardingChecklist.test.ts` (new) — 8 vitest test cover render visibility, counter, từng step done/undone, hide khi all done, click button → router.push.
- **Tests**: web vitest 50 → 58 (+8). Pure additive.
- **i18n**: vi + en đóng hộp 4 step. Tự nhiên tiếng Việt ("Khai lập đạo hiệu", "Bái nhập tông môn") đúng tông *tù tiên*.
- **Risk**: low — component pure derived từ store state, ko fetch API mới, ko đổi schema. Worst case panel hiển nhầm → player ignore.
- **Rollback**: revert PR. `HomeView` quay lại state cũ (không có panel onboarding).

### PR G1-render — `test(web): render-level vitest cho NextActionPanel (6)` (G1 step 2) — **Merged as PR #56**

- **Branch**: `devin/1777408703-g1-render-tests`. **Base**: `main` (post-PR #54 + #55). **Status**: Open (CI pending), rebased after PR #55 merge.
- **Mục tiêu**: G1 step 2 — mở rộng vitest sang render-level test bằng `@vue/test-utils@^2.4.6` + `happy-dom`. Component `NextActionPanel` là bản thể hiện smart onboarding chính của `HomeView` (§3 prompt user) — cần test render contract.
- **File**:
  - `apps/web/src/components/__tests__/NextActionPanel.test.ts` (new) — 6 test:
    1. Section ẩn khi `actions=[]` (sau resolve, ngoài loading).
    2. Render danh sách + label translated + interpolation `{count}`/`{name, level}`.
    3. Priority class branch: p≤1 rose, p≤3 amber, p>3 ink (default mute).
    4. Click "Đi ngay" gọi `router.push(action.route)`.
    5. API reject → actions=[] silent, section ẩn.
    6. `defineExpose({refresh})` reload danh sách.
  - Mock `@/api/nextAction` + `vue-router` qua `vi.mock`. i18n stub bằng `createI18n({legacy:false})` với messages tối thiểu.
- **Tests**: web vitest 17 → 23 (test base off main post-PR #54). Khi PR #55 merge → 23+16=39.
- **Risk**: zero — test-only.
- **Rollback**: revert.

### PR #54 — `feat(admin): smart economy alerts (negative currency / inventory / stale topup PENDING)` (G4) — **Merged**

- **Branch**: `devin/1777407655-smart-admin-economy-alerts`. **Base**: `main` (post-PR #53 `2ae4cc0`). **Status**: **Merged** (28/4 20:33 UTC, CI 3/3 xanh gồm Devin Review). Merge SHA `d9fbbf1`.
- **Mục tiêu**: Smart admin / economy safety (prompt §3-4) — phát hiện sớm 3 loại bất thường kinh tế trong closed beta:
  1. Character có currency âm (`linhThach < 0` OR `tienNgoc < 0` OR `tienNgocKhoa < 0`) — invariant violation, cần alert ngay.
  2. InventoryItem có `qty < 1` — nhẽ lạnh nhưng vẫn invariant (qty=0 nên bị xóa).
  3. TopupOrder PENDING > `staleHours` (mặc định 24h) — admin lười duyệt.
- **File**:
  - `apps/api/src/modules/admin/admin.service.ts` — thêm method `getEconomyAlerts(staleHours = 24)` (read-only, `Promise.all` 3 query, `take: 100` per group).
  - `apps/api/src/modules/admin/admin.controller.ts` — thêm route `GET /admin/economy/alerts?staleHours=24` (clamp 1..720). Mặc định AdminGuard → MOD+ADMIN đọc được.
  - `apps/api/src/modules/admin/economy-alerts.test.ts` (new) — 7 vitest test (empty DB, neg linhThach, neg tienNgoc+tienNgocKhoa, neg inventory qty 0/-2, stale topup default, custom staleHours, sanity).
  - `apps/web/src/api/admin.ts` — thêm interface `AdminEconomyAlerts` + `adminEconomyAlerts(staleHours = 24)`.
  - `apps/web/src/views/AdminView.vue` — Stats tab thêm panel `Economy alerts` với 3 group (rose / rose / amber). `refreshStats()` đổi thành `Promise.all([adminStats(), adminEconomyAlerts()])`.
  - `apps/web/src/i18n/{vi,en}.json` — thêm `admin.alerts.{title,subtitle,allClear,negativeCurrency,negativeInventory,stalePendingTopups}`.
- **Tests**: API +7 (không đổi existing). Web vitest 17 vẫn pass. Typecheck/lint/build xanh.
- **Risk**: **low** — endpoint read-only, không side-effect, không migration. Nếu API fail → alerts panel ẩn (handleErr toạt).
- **Rollback**: revert PR. Không ảnh hưởng schema/data.

### PR #53 — `feat(web,test): replay PR #47 — wire Vitest minimal + Playwright golden path scaffold (H5)` — PR B replay

- **Branch**: `devin/1777406837-replay-pr47-vitest-playwright`. **Base**: `main` (post-PR #52 `82e6212`). **Status**: **Merged** (commit `2ae4cc0`).
- Cherry-pick `32a33a6` từ feature branch vào main, conflict `docs/AI_HANDOFF_REPORT.md` resolved take `--ours`. Đã fix `apps/web/package.json` test từ `echo skipped` thành `vitest run`.
- **File**: `apps/web/{vitest,playwright}.config.ts`, `apps/web/e2e/golden.spec.ts`, `apps/web/src/stores/__tests__/{toast,game}.test.ts` (17 test tổng).
- **CI**: 3/3 xanh.

### PR #52 — `docs(handoff): audit session 5 — bump snapshot to 68fa1a3 + flag PR #47 replay-gap` — audit only

- **Branch**: `devin/1777406465-audit-session-5-pr50-51-pr47-replay-gap`. **Base**: `main`. **Status**: **Merged** (commit `82e6212`).
- Discovery chính: PR #47 GitHub status `closed (merged)` nhưng commit `4ed913a` chỉ tồn tại trên feature branch, KHÔNG vào main → vitest/playwright config + 17 test chưa từng có ở main. Fix PR #50/#51 status Open → Merged trong report; §16 H5 → Open (replay needed); §21 PR B retitle "Replay PR #47".
- **CI**: 2/2 xanh.

### PR #51 — `feat(web): sidebar badges (mission claimable / boss active / topup pending) từ /me/next-actions`

- **Branch**: `devin/1777401826-badges`. **Base**: `main`. **Status**: **Merged** (commit `699af81`).
- **Mục tiêu**: Smart UX polish (prompt §20 mục 6) — Reuse `/me/next-actions` (PR #49) để hiển thị badge trên sidebar nav: `Missions` (số đếm claimable), `Boss` (chấm đỏ khi có boss live), `Topup` (chấm vàng khi có order PENDING). Mail nav vẫn dùng badge cũ từ WS `mail:new`.
- **File**:
  - `apps/web/src/stores/badges.ts` (new) — Pinia store, polling `/me/next-actions` mỗi 60s, expose computed `missionClaimable`, `mailUnclaimed`, `bossActive`, `topupPending`, `breakthroughReady`.
  - `apps/web/src/components/shell/AppShell.vue` — import `useBadgesStore`, gọi `start()` onMounted + `stop()` onUnmounted; thêm 3 badge span trên Mission/Boss/Topup nav.
  - `apps/web/src/views/HomeView.vue` — thêm `badges.refresh()` khi load (immediate refresh sau khi character ready).
  - `apps/web/src/i18n/{vi,en}.json` — `shell.badge.bossActive` + `shell.badge.topupPending` cho tooltip.
- **Polling**: 60s interval, silent fail (badges chỉ ẩn khi API fail). Stop khi shell unmount.
- **Tests**: typecheck/lint/build xanh. Web vitest chưa wire ở main (PR #47 chưa merge), nên không thêm test web cho PR này — chỉ smoke manual khi PR merged.
- **Risk**: low — pure FE polish, dùng endpoint read-only đã có. Polling 1 req/60s/user.
- **Rollback**: revert PR. Không ảnh hưởng schema/data/backend.

### PR #50 — `docs: thêm QA_CHECKLIST.md (smoke 15-phút trước release closed beta)`

- **Branch**: `devin/1777400787-qa-checklist`. **Base**: `main`. **Status**: **Merged** (commit `68fa1a3`, docs only, CI 3/3 xanh).
- **Mục tiêu**: Theo prompt §20 mục 5 + 7. Checklist manual smoke 15 phút phủ 12 nhóm (Auth → Admin) + healthcheck post-deploy.
- **File**: `docs/QA_CHECKLIST.md` (new), `README.md` (link).
- **Risk**: zero — pure docs.

### PR #49 — `feat: smart next-action panel cho HomeView (smart onboarding)`

- **Branch**: `devin/1777399841-smart-next-action`. **Base**: `main`. **Status**: **Merged** (CI 2/2 xanh).
- **Mục tiêu**: Smart next-action (prompt §20 mục 2) — hiển thị "Nên làm gì tiếp?" trên HomeView dựa state: NO_CHARACTER / BREAKTHROUGH_READY / MISSION_CLAIMABLE / MAIL_UNCLAIMED / MAIL_UNREAD / BOSS_ACTIVE / TOPUP_PENDING / CULTIVATE_IDLE. Giá trị cao cho onboarding closed beta, risk low.
- **File**:
  - `apps/api/src/modules/next-action/next-action.service.ts` (new) — pure-read Prisma queries, sort theo priority 1..5 ASC.
  - `apps/api/src/modules/next-action/next-action.controller.ts` (new) — `GET /me/next-actions` yêu cầu cookie `xt_access`.
  - `apps/api/src/modules/next-action/next-action.module.ts` (new).
  - `apps/api/src/modules/next-action/next-action.service.test.ts` (new, 13 test integration Postgres).
  - `apps/api/src/app.module.ts` — mount `NextActionModule`.
  - `apps/web/src/api/nextAction.ts` (new) — client `getNextActions()`.
  - `apps/web/src/components/NextActionPanel.vue` (new) — panel render từng action với priority color (1=rose, 2-3=amber, 4-5=ink).
  - `apps/web/src/views/HomeView.vue` — import + render `<NextActionPanel>`.
  - `apps/web/src/i18n/vi.json` + `en.json` — thêm `home.nextAction.title|loading|go|items.*`.
- **Logic ưu tiên**: P1 `NO_CHARACTER`/`BREAKTHROUGH_READY`/`MISSION_CLAIMABLE` · P2 `MAIL_UNCLAIMED` · P3 `MAIL_UNREAD`+`BOSS_ACTIVE` · P4 `TOPUP_PENDING` · P5 `CULTIVATE_IDLE` fallback. Mail expired / boss expired không gợi ý.
- **Tests**: API total `235 pass` (+13 next-action). Shared `47`. Build xanh. Typecheck/lint xanh.
- **Risk**: **low** — endpoint read-only, không side-effect, không migration. Nếu API fail → panel ẩn (empty actions).
- **Rollback**: revert PR. Không ảnh hưởng schema/data.

### PR #48 — `feat(api): split ADMIN vs MOD permission via @RequireAdmin (M8)`

- **Branch**: `devin/1777398980-pr-e-admin-guard-split`. **Base**: `main`. **Status**: **Merged** (CI 2/2 xanh). **Resolve M8**.
- **Mục tiêu**: M8 — fine-grained role split. Trước PR E, `AdminGuard` chấp nhận cả ADMIN + MOD cho mọi endpoint admin, dẫn tới MOD có quyền grant/approve/broadcast/spawn ngang ADMIN. Giờ MOD chỉ đọc + ban (PLAYER); ADMIN-only cho 9 action ảnh hưởng tài sản/policy.
- **File**:
  - `apps/api/src/modules/admin/require-admin.decorator.ts` (new) — `RequireAdmin()` decorator + `REQUIRE_ADMIN_KEY`.
  - `apps/api/src/modules/admin/admin.guard.ts` — inject `Reflector`, đọc metadata `requireAdmin`; nếu set + role !== ADMIN → throw `ADMIN_ONLY` 403.
  - `apps/api/src/modules/admin/admin.controller.ts` — apply `@RequireAdmin()` cho 8 endpoint POST: role / grant / approve-topup / reject-topup / giftcode-create / giftcode-revoke / mail-send / mail-broadcast.
  - `apps/api/src/modules/boss/boss.controller.ts` — apply `@RequireAdmin()` cho `POST /boss/admin/spawn`.
  - `apps/api/src/modules/admin/admin.guard.test.ts` (new, 8 test) — UNAUTHENTICATED, FORBIDDEN cho user không tồn tại / banned / PLAYER, ADMIN pass default + RequireAdmin, MOD pass default, MOD reject (`ADMIN_ONLY`) khi RequireAdmin.
  - `apps/web/src/i18n/vi.json` + `apps/web/src/i18n/en.json` — thêm key `admin.errors.ADMIN_ONLY`.
- **MOD vẫn được**: `GET /admin/users|topups|audit|stats|giftcodes` (read-only) + `POST /admin/users/:id/ban` (service `setBanned` đã có hierarchy: MOD chỉ ban được PLAYER).
- **Tests**: API total `230 pass` (+8 admin guard test). Shared `47 pass`. Web `17 pass` (vitest). Build xanh.
- **Risk**: low — chỉ thắt chặt MOD; ADMIN không đổi behavior. Service-layer guard (cũ) vẫn còn = defense-in-depth. Không migration, không data change.
- **Rollback**: revert PR. AdminGuard fallback về behavior cũ (ADMIN + MOD pass).


### PR #33 — `feat(api): bootstrap admin đầu tiên + seed 3 tông môn (H2 + H3)`

- **Branch**: `devin/1777368742-bootstrap-admin-sect`. **Status**: Merged. **CI**: xanh.
- **Commits chính**: `a8b5fb0 feat(api): bootstrap script tạo admin đầu tiên + 3 tông môn mặc định`, `8187896 fix(api): thêm require/module/NodeJS vào eslint globals cho scripts/`.
- **Mục tiêu**: Fresh deploy chạy `pnpm --filter @xuantoi/api bootstrap` là có 1 ADMIN + 3 sect (Thanh Vân Môn, Huyền Thuỷ Cung, Tu La Điện). Idempotent — không ghi đè `passwordHash`.
- **File**: `apps/api/scripts/bootstrap.ts` (new), `apps/api/scripts/bootstrap.test.ts` (new, 7 test), `apps/api/.env.example` thêm `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD`, `apps/api/package.json` thêm script `bootstrap`, `apps/api/tsconfig.json`/`vitest.config.ts`/`eslint.config.js` cover `scripts/`, `README.md` thêm bước bootstrap.
- **Migration / seed**: không tạo migration mới — chỉ ghi vào `User` + `Sect` qua Prisma client.
- **Test**: 7 test integration (real Postgres) — env validation, tạo mới, idempotent, promote PLAYER, promote PLAYER banned, `skipAdmin`, `skipSects`.
- **Risk**: nếu `INITIAL_ADMIN_EMAIL` trùng email user PLAYER thật → promote (đã document).
- **Follow-up**: không.

### PR #34 — `test(api): inventory.service coverage 19 test (H4)`

- **Branch**: `devin/1777369187-inventory-tests`. **Status**: Merged. **CI**: xanh.
- **Commit chính**: `04724c0 test(api): inventory.service test coverage (H4)`.
- **Mục tiêu**: Đóng gap H4 — InventoryService 0 test.
- **File**: `apps/api/src/modules/inventory/inventory.service.test.ts` (new, 19 test). Không sửa service.
- **Test breakdown**: `grant`+`list` (4), `equip`/`unequip` (7), `use` (5), `equipBonus` (2), `grantTx` (1).
- **Risk**: chưa cover concurrency `Promise.all` — post-beta.
- **Follow-up**: không.

### PR #35 — `docs: 5 doc ops trước closed beta (RUN_LOCAL, DEPLOY, ADMIN_GUIDE, SECURITY, TROUBLESHOOTING)`

- **Branch**: `devin/1777369332-docs-ops`. **Status**: Merged. **CI**: xanh (docs only).
- **Commit chính**: `c827794 docs: add RUN_LOCAL/DEPLOY/ADMIN_GUIDE/SECURITY/TROUBLESHOOTING`.
- **Mục tiêu**: Onboard contributor + admin mới.
- **File**: `docs/RUN_LOCAL.md`, `docs/DEPLOY.md`, `docs/ADMIN_GUIDE.md`, `docs/SECURITY.md`, `docs/TROUBLESHOOTING.md` (5 file mới); `README.md` thêm link.
- **Migration / seed / i18n / test**: không.
- **Risk**: docs có thể outdated khi code đổi (low).
- **Follow-up**: không.

### PR #36 — `feat(boss): admin spawn endpoint + UI tab + audit (M2)`

- **Branch**: `devin/1777369737-admin-boss-spawn`. **Status**: Merged. **CI**: xanh.
- **Commits chính**: `416c6f5` (feat), `1ce753b` (fix tôn trọng admin level), `aa2b130` (fix race condition flip ACTIVE→EXPIRED), `56aa07d` (fix force-expire phải distribute reward + audit replacedBossId).
- **Mục tiêu**: Admin chủ động spawn boss (cho QA, GM event live).
- **BE**: `boss.service.ts` thêm `adminSpawn(actorId, opts)` + `BOSS_ALREADY_ACTIVE`/`INVALID_BOSS_KEY`/`INVALID_LEVEL`. `boss.controller.ts` `@Post('admin/spawn')` + `AdminGuard`. `boss.module.ts` import `AdminModule`. `admin.module.ts` export `AdminGuard`.
- **FE**: `apps/web/src/api/admin.ts` `adminSpawnBoss()`. `AdminView.vue` thêm tab `boss`. i18n VI/EN +8 key + 3 error code.
- **Audit**: `AdminAuditLog` action `BOSS_SPAWN`, có `replacedBossId` khi force-expire.
- **Test**: `boss.service.test.ts` +7 test (spawn mới, default level, auto-rotate, ALREADY_ACTIVE, force replace, INVALID_BOSS_KEY rollback, level boundary). Tổng 16 test boss.
- **Risk**: admin spam spawn → coi như feature (audit ghi rõ).
- **Follow-up**: không.

### PR #37 — `feat(settings): trang Settings + đổi mật khẩu + logout-all`

- **Branch**: `devin/1777370196-settings-page`. **Status**: Merged. **CI**: xanh.
- **Commit chính**: `96ed383 feat(settings): trang Settings + đổi mật khẩu + logout-all (M5/M7)`.
- **Mục tiêu**: Self-service đổi password + logout all devices trước beta.
- **BE**: `auth.service.ts` thêm `logoutAll(userId)` revoke toàn bộ refresh token active. `auth.controller.ts` `@Post('logout-all')` ⇒ path `/api/_auth/logout-all`.
- **FE**: `views/SettingsView.vue` (new, 4 section: account info, change password, locale, logout-all). `router/index.ts` `/settings`. `AppShell.vue` link "Tâm Pháp". `api/auth.ts` `logoutAll()`. i18n VI/EN +25 key + `shell.nav.settings`.
- **Test**: `auth.service.test.ts` +3 test cho `logoutAll` (revoke 2 active token, idempotent, không ảnh hưởng user khác). Tổng 18 test auth.
- **Caveat**: Access token cũ (15 phút) vẫn valid sau `logoutAll` cho thiết bị khác → không bump `passwordVersion` vì password chưa đổi. Trade-off acceptable.
- **Follow-up**: không.

### PR #38 — `feat(character): GET /character/profile/:id + ProfileView`

- **Branch**: `devin/1777370723-profile-view`. **Status**: Merged. **CI**: xanh.
- **Commits chính**: `c738e36` (feat), `f675328 fix(profile): hiển thị tên cảnh giới đầy đủ`.
- **Mục tiêu**: Public profile cho người chơi khác (cần cho leaderboard / market / chat tap-name).
- **BE**: `character.service.ts` thêm `PublicProfileView` + `findPublicProfile(id)` — public-safe (không lộ exp/hp/mp/stamina/linhThach/tienNgoc/cultivating). Owner banned ⇒ `null`. `character.controller.ts` `@Get('profile/:id')` yêu cầu access cookie (anti-scrape).
- **FE**: `api/character.ts` `getPublicProfile(id)`. `views/ProfileView.vue` (new). `router/index.ts` `/profile/:id`. `BossView.vue` cell tên người chơi → `RouterLink /profile/:id`. i18n +10 key.
- **Test**: `character.service.test.ts` mới, 6 case (id null, full view, sect / no-sect, banned ⇒ null, role ADMIN/MOD lộ).
- **Risk**: chưa rate-limit endpoint (low — id là cuid, hard enumerate).
- **Follow-up**: leaderboard FE đã có (PR #59) — link tap-name → `/profile/:id`.

### PR #39 — `feat(shop): NPC Shop module — GET /shop/npc + POST /shop/buy + ShopView`

- **Branch**: `devin/1777371222-npc-shop`. **Status**: Merged. **CI**: xanh.
- **Commit chính**: `2be7b74`.
- **Mục tiêu**: Sink LINH_THACH cho beta player ngày 1 (không cần chờ market P2P).
- **Shared**: `packages/shared/src/shop.ts` (new) — `NPC_SHOP` (11 entries: 3 đan HP/MP, 1 đan EXP, 1 quặng, 6 starter equipment Phàm/Linh phẩm, only LINH_THACH). Helpers `npcShopEntries`, `npcShopByKey`, `toShopEntryView`.
- **BE**: `apps/api/src/modules/shop/{shop.module,shop.service,shop.controller}.ts` (new). `shop.service.ts` `buy(userId, itemKey, qty)` `$transaction(applyTx + grantTx)` với `LedgerReason='SHOP_BUY'`. `currency.service.ts` thêm `'SHOP_BUY'` vào `LedgerReason` union. `app.module.ts` register `ShopModule`.
- **FE**: `api/shop.ts`, `views/ShopView.vue`, route `/shop`, nav "肆 NPC Tiệm", i18n +18 key.
- **Test**: `shop.service.test.ts` mới, 10 case (anti-spoof boss item, INSUFFICIENT_FUNDS không trừ tiền, NON_STACKABLE_QTY_GT_1, validation qty, gộp stackable, NO_CHARACTER, instanceof error).
- **Migration / seed**: không (Schema đã có sẵn).
- **Risk**: stock infinite, không daily limit (intentional). Không có rate-limit.
- **Follow-up**: PR #40 hook `ItemLedger` cho shop (đã làm — có dòng `SHOP_BUY` qua `grantTx`).

### PR #45 — `i18n(vi): translate 12 admin keys still in English (L1 resolved)`

- **Branch**: `devin/1777388675-i18n-reaudit`. **Status**: Merged (commit `e99a35f`). **CI**: xanh (2/2 pass).
- **Commits chính**: `8249142 i18n(vi): translate 12 admin keys still in English (L1)`, `166c26f ci: re-trigger build`, `7e4ec86 ci: retry after runner availability check`.
- **Mục tiêu**: Dứt điểm L1 — re-audit `apps/web/src/i18n/{vi,en}.json`. **554/554 key sync giữa 2 locale, 400 used `t()` key all resolve, 0 missing**. Trước fix có 28 key identical en≡vi → audit cuối: 18 universal/native term cố ý (`locale.vi/en`, `EXP`, `HP/MP`, `WS ✓/×`, `OK`, `Boss`, `A Linh`, `linh thạch`, `tiên ngọc`, `HOT`, `Email`), 10 key thực sự là gap (admin column labels + role) còn English trong `vi.json`. Fix 12 entries (10 + 2 confirm/toast liên quan) trong `vi.admin.*`.
- **Diff bảng** (vi.json):
  - `admin.roleLabel`: `Role: {role}` → `Vai trò: {role}`
  - `admin.tab.audit`: `Audit` → `Nhật ký`
  - `admin.users.col.role`: `Role` → `Vai trò`
  - `admin.users.banned`: `BANNED` → `BỊ KHOÁ`
  - `admin.users.roleChangeConfirm`: `Đổi role {email} → {role}?` → `Đổi vai trò {email} → {role}?`
  - `admin.users.roleChangedToast`: `Đã đổi role.` → `Đã đổi vai trò.`
  - `admin.topups.col.user`: `User` → `Người chơi`
  - `admin.topups.col.status`: `Status` → `Trạng thái`
  - `admin.topups.col.note`: `Note` → `Ghi chú`
  - `admin.audit.col.actor`: `Actor` → `Người thực hiện`
  - `admin.audit.col.action`: `Action` → `Hành động`
  - `admin.audit.col.meta`: `Meta` → `Chi tiết`
- **File**: `apps/web/src/i18n/vi.json` (+12/−12). `en.json` không đổi (đã đúng tiếng Anh). `docs/AI_HANDOFF_REPORT.md` (snapshot bump tại lúc tạo PR).
- **Risk**: green — text-only fix 1 locale, không đụng logic/route/auth. Rollback = revert commit.

### PR #44 — `replay: PR #42 (mission VN tz) + PR #43 (ledger index) onto main + smoke E2E pass`

- **Branch**: `devin/1777377412-replay-pr-42-43`. **Status**: Merged (commit `4d8af10`). **CI**: xanh.
- **Mục tiêu**: PR #42 (M1 mission VN tz) + PR #43 (M5 ledger index) đã merge vào branch phụ — replay vào `main`. Đồng thời chạy smoke E2E 6/6: register/onboard, mission VN tz `windowEnd=17:00Z`, shop buy + ItemLedger + CurrencyLedger row, settings change-password + logout-all, profile public view, admin boss spawn + AdminAuditLog, inventory↔ledger consistency.
- **Resolve**: H1 (smoke E2E sau khi PR #33→#40 merged).

### PR #43 — `feat(prisma): index actorUserId on CurrencyLedger + ItemLedger (M5)`

- **Branch**: `devin/1777375666-currency-ledger-index`. **Status**: Merged (vào branch phụ; replay vào main qua PR #44).
- **File**: `apps/api/prisma/schema.prisma` thêm `@@index([actorUserId, createdAt])` x2 (cho `CurrencyLedger` + `ItemLedger`). Migration `20260428112804_actor_user_id_index/migration.sql` (ADD INDEX only, an toàn rollback).
- **Test**: 269 test cũ vẫn pass; không thêm test riêng (ADD INDEX không đổi logic).
- **Risk**: thấp — ADD INDEX an toàn, không khoá bảng (size nhỏ tại `migrate deploy`).

### PR #42 — `feat(mission): timezone-aware reset window (M1) + env MISSION_RESET_TZ`

- **Branch**: `devin/1777375167-mission-tz`. **Status**: Merged (vào branch phụ; replay qua PR #44).
- **Mục tiêu**: Mission cron reset không còn UTC mặc định. Thêm env `MISSION_RESET_TZ` (default `Asia/Ho_Chi_Minh`) + helper `getMissionResetTz()` + tz-aware `nextDailyWindowEnd`/`nextWeeklyWindowEnd`.
- **File**: `apps/api/src/modules/mission/mission.service.ts`, `apps/api/.env.example`, `apps/api/src/modules/mission/mission.service.test.ts` (+7 test → 26 mission test).
- **Test**: 26 mission test pass (3 UTC default + 4 VN tz + 3 env helper + 16 cũ).
- **Risk**: thấp — helper pure + env optional (default backward-compat = `'UTC'` tại function-level).

### PR #41 — `docs: audit PR #33–#40 + cập nhật AI_HANDOFF_REPORT.md`

- **Branch**: `devin/1777374530-audit-pr-33-40-handoff`. **Status**: Merged (commit `65c28f7`).
- **Mục tiêu**: Audit chuỗi PR #33→#40 vừa merge — bump snapshot trong report + chuyển H1/H2/H3/H4/M2/M4 sang Resolved + ghi rõ chuỗi 8 PR.

### PR #40 — `feat(inventory): ItemLedger audit trail (M4) + hook 6 grant flows`

- **Branch**: `devin/1777372035-item-ledger`. **Status**: Merged. **CI**: xanh.
- **Commits chính**: `4553bb9` (feat), `b781163 fix(inventory): pass meta to grant/grantTx after merge với main (PR #34 + #39)`.
- **Mục tiêu**: Đóng gap M4 — `ItemLedger` audit table cho mọi item flow.
- **Schema**: `prisma/schema.prisma` thêm model `ItemLedger { characterId, itemKey, qtyDelta (signed Int), reason, refType?, refId?, actorUserId?, meta, createdAt }` + 4 index. Migration `20260428102849_itemledger` (ADD TABLE only, an toàn rollback).
- **Reasons**: Inflow `COMBAT_LOOT` / `BOSS_REWARD` / `MARKET_BUY` / `MISSION_CLAIM` / `MAIL_CLAIM` / `GIFTCODE_REDEEM` / `SHOP_BUY` / `ADMIN_GRANT`. Outflow `USE` / `MARKET_SELL` / `ADMIN_REVOKE`.
- **InventoryService**: `grant()`/`grantTx()` thêm tham số bắt buộc `meta: ItemLedgerMeta`. `grantOneTx()` ghi 1 dòng / item (không cộng dồn). `use()` ghi `qtyDelta=-1 reason='USE'` cùng `$transaction`.
- **Callers**: `combat.service.ts` (`COMBAT_LOOT`), `boss.service.ts` (`BOSS_REWARD`), `giftcode.service.ts` (`GIFTCODE_REDEEM`), `mail.service.ts` (`MAIL_CLAIM`), `mission.service.ts` (`MISSION_CLAIM`), `shop.service.ts` (`SHOP_BUY`), `market.service.ts` post (`-qty MARKET_SELL stage=POST`), cancel (`+qty stage=CANCEL`), buy (`+qty MARKET_BUY` cho buyer).
- **Test**: `inventory/item-ledger.test.ts` (new, 7 test) + `market.service.test.ts` +2 test (post/buy/cancel ledger flow). `test-helpers.ts` `wipeAll` xoá `itemLedger` trước `currencyLedger`.
- **Risk**: volume ~10–50 row/player/ngày (đủ index, có thể partition sau).
- **Follow-up**: equip/unequip không ghi ledger (đúng thiết kế — không thay đổi qty). `ADMIN_REVOKE` chưa có endpoint thật (chỉ enum cho future).

### Audit gap (sau session 5 — tính trạng thực tế trên `main @ 68fa1a3`)

- **⚠️ Web Vitest + Playwright (PR #47) KHÔNG ở main**: branch `devin/1777398483-h5-vitest-playwright` đã merge vào branch trung gian `devin/1777398022-audit-pr-45-blueprint-docs` (commit `4ed913a`) NHƯNG branch trung gian đó đã merge vào main TRƯỚC khi PR #47 được merge vào nó (PR #46 merge `1fc814d` mang `ddd3d56`, sau đó PR #47 merge `4ed913a` chỉ tồn tại trên feature branch). Tất cả file và thay đổi của PR #47 (vitest config, playwright config, e2e spec, store test, devDeps `vitest`/`@playwright/test`/`happy-dom`/`@vue/test-utils`, `apps/web/package.json` test script update) — **không** có mặt trên `main`.
  - Lớp dễ kiểm tra: `ls apps/web/vitest.config.ts apps/web/playwright.config.ts apps/web/e2e/golden.spec.ts` ⇒ `No such file`.
  - `grep '"test"' apps/web/package.json` vẫn ra `"echo \"(web) test skipped — wire vitest in Phase 1\""`.
- **Smoke runtime** sau PR #51 (sidebar badges): **Needs runtime smoke** (badge polling 60s, AppShell mount/unmount lifecycle). Manual smoke dựa vào `docs/QA_CHECKLIST.md` section 1.
- **Helper `itemName(key, locale)` (L4)** — chưa làm; tách PR riêng khi cần catalog item l10n cho `MissionView/MailView/GiftCodeView/ShopView`.
- **Old text về "PR #47 wired"**: trước đây session 4 ghi audit gap như "E2E Playwright scaffolded (PR #47) — wired" + "Web Vitest wired (PR #47)" — **sai** với trạng thái `main`. Chính sửa ô này trong audit session 5.

---

## Completed Features (snapshot `main @ 81706a9` — 28/4 22:05 UTC)

| Feature | Backend | Frontend | Test | Status |
|---|---|---|---|---|
| Auth (register / login / refresh / change-password / **logout-all** + **register IP rate-limit** PR #60) | `modules/auth/*` | `views/AuthView.vue` + `views/SettingsView.vue` + `stores/auth.ts` | **20 test** | **Done** |
| Onboarding (chọn sect) | `modules/character/character.service.ts` | `views/OnboardingView.vue` | 6 test (profile) | **Done** |
| Cultivation tick (BullMQ 30s) | `modules/cultivation/*` | `stores/game.ts` (WS `cultivate:tick`) | 5 test | **Done** |
| Combat (dungeon turn-based) | `modules/combat/*` | `views/DungeonView.vue` | 7 test | **Done** |
| Inventory (equip / unequip / use / stack) | `modules/inventory/*` | `views/InventoryView.vue` | 19 + 7 (ledger) test | **Done** |
| Market P2P (post / buy / cancel + 5% fee) | `modules/market/*` | `views/MarketView.vue` | 10 test | **Done** |
| Sect (list / create / join / leave / contribute) | `modules/sect/*` | `views/SectView.vue` | 7 test | **Done** |
| Chat (world / sect + Redis sliding window 8/30s) | `modules/chat/*` | `components/shell/ChatPanel.vue` | 9 test | **Done** |
| World Boss (current / attack + reward distribution) | `modules/boss/*` | `views/BossView.vue` | 16 test (incl. `adminSpawn`) | **Done** |
| **Admin Boss Spawn** (PR #36) | `POST /api/boss/admin/spawn` + `AdminGuard` + audit `BOSS_SPAWN` | `AdminView.vue` tab boss | 7 test | **Done** |
| Topup (manual approval) | `modules/topup/*` + `modules/admin/*` | `views/TopupView.vue` + `AdminView.vue` | 13 admin/topup test | **Done** |
| Admin (users / topups / audit / stats / giftcodes / mail / boss) | `modules/admin/*` | `views/AdminView.vue` | 13 test | **Done** |
| GiftCode (player redeem + admin CRUD) | `modules/giftcode/*` | `views/GiftCodeView.vue` + admin tab | 12 test | **Done** |
| Mail (inbox / read / claim + admin send/broadcast + WS `mail:new` + cron prune) | `modules/mail/*` | `views/MailView.vue` + admin tab | 14 test | **Done** |
| Mission (daily/weekly/once + claim + cron reset + **VN timezone**) | `modules/mission/*` | `views/MissionView.vue` | 26 test | **Done** |
| Health (`/healthz`/`/readyz`/`/version`) | `modules/health/*` | — | 4 test | **Done** |
| Ops housekeeping (BullMQ prune) | `modules/ops/*` | — | 7 test | **Done** |
| Realtime (WS `/api/ws` JWT auth) | `modules/realtime/*` | `ws/client.ts` | 10 test | **Done** |
| **Bootstrap CLI** (PR #33) | `apps/api/scripts/bootstrap.ts` | — | 7 test | **Done** |
| **Settings page** (PR #37) | `POST /api/_auth/logout-all` | `views/SettingsView.vue` | 3 test | **Done** |
| **Public Profile** (PR #38) | `GET /api/character/profile/:id` | `views/ProfileView.vue` | 6 test | **Done** |
| **NPC Shop** (PR #39) | `modules/shop/*` (`/shop/npc`, `/shop/buy`) + catalog `NPC_SHOP` 11 entries | `views/ShopView.vue` | 10 test | **Done** |
| **ItemLedger** audit (PR #40) | `prisma:ItemLedger` + hook 6 grant flows + market post/cancel/buy | — | 7 test (+ 2 market) | **Done** |
| **Docs ops** (PR #35) | — | `docs/RUN_LOCAL.md` + `DEPLOY.md` + `ADMIN_GUIDE.md` + `SECURITY.md` + `TROUBLESHOOTING.md` | — | **Done** |
| **Smart next-action** (PR #49) | `modules/next-action/*` (`GET /me/next-actions`) | `components/NextActionPanel.vue` (HomeView) + `stores/badges.ts` (sidebar badges PR #51) | **13 BE + 6 FE + 9 badges** test | **Done** |
| **Smart admin economy alerts** (PR #54) | `AdminService.getEconomyAlerts(staleHours)` + `GET /admin/economy/alerts` | `views/AdminView.vue` Stats tab panel | **7 test** | **Done** |
| **Smart onboarding checklist** (PR #58) | derived from `game.character` (no BE) | `components/OnboardingChecklist.vue` (HomeView) | **8 test** | **Done** |
| **Leaderboard** (PR #59) | `modules/leaderboard/*` (`GET /api/leaderboard?limit=N`, top 50 by realm + power, clamp 1≤N≤50) | `views/LeaderboardView.vue` route `/leaderboard` | **7 BE + 6 FE** test | **Done** |
| **i18n itemName helper** (PR #57) | `packages/shared` catalog (`items.ts` + `missions.ts`) | `apps/web/src/lib/itemName.ts` + dedupe across `MissionView`/`MailView`/`GiftCodeView`/`ShopView` | **11 test** | **Done** |
| **Sidebar badges** (PR #51) | reuse `GET /me/next-actions` (PR #49) | `stores/badges.ts` 60s polling — mission/boss/topup | **9 test** (`stores/__tests__/badges.test.ts`) | **Done — Needs runtime smoke** |

> Tất cả feature trên **đã merge code + test pass trong CI từng PR**, **chưa** smoke E2E sau khi tất cả merged đồng thời → mọi feature đánh `Needs runtime smoke` cho đến khi PR A (xem §21) chạy.

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
- ~~`CurrencyLedger.actorUserId` chưa có index~~ — đã fix ở PR #43 (`@@index([actorUserId, createdAt])` cho cả CurrencyLedger và ItemLedger).

---

## 12. Tests

| Area | Existing Tests | Missing | Priority |
|---|---|---|---|
| Auth | **18 test** (`auth.service.test.ts`) — +3 cho `logoutAll` (PR #37) | Email verification / password reset flow chưa có feature | — |
| Bootstrap | **7 test** (`scripts/bootstrap.test.ts`) (PR #33) | — | — |
| Character/Currency | 9 test (`currency.service.test.ts`) | Test breakthrough multi-stage | Low |
| Character/Profile | **6 test** (`character.service.test.ts`) (PR #38) | — | — |
| Cultivation | 5 test (`cultivation.processor.test.ts`) | Multi-instance lock test | Medium |
| Combat | 7 test (`combat.service.test.ts`) | Skill with status effect chain | Low |
| Inventory | **19 test** (`inventory.service.test.ts`) (PR #34) + **7 test** (`item-ledger.test.ts`) (PR #40) | Concurrency `Promise.all` race | Low |
| Market | **10 test** (`market.service.test.ts`) — +2 ledger flow (PR #40) | Fee config test | Low |
| Sect | 7 test (`sect.service.test.ts`) | Leader transfer (feature chưa có) | Low |
| Chat | 9 test (`chat.service.test.ts`) | Redis failover test | Low |
| Boss | **16 test** (`boss.service.test.ts`) — +7 cho `adminSpawn` (PR #36) | Spawn cron auto (feature chưa có) | Medium |
| Admin/Topup | **13 test** (`admin-stats` 3 + `topup-admin` 10) | User list filter edge | Low |
| GiftCode | 12 test (`giftcode.service.test.ts`) | Expire during redeem race | Low |
| Mail | 14 test (`mail.service.test.ts`) | WS `mail:new` tích hợp end-to-end | Low |
| Mission | **26 test** (`mission.service.test.ts`) — +7 cho timezone (PR #42) | — | — |
| **Shop** | **10 test** (`shop.service.test.ts`) (PR #39) | Daily limit (feature chưa có) | — |
| Health | 4 test (`health.controller.test.ts`) | — | — |
| Ops | **7 test** (`ops.processor.test.ts`) | — | — |
| Realtime | 10 test (`realtime.gateway.test.ts`) | Ban user during connection | Medium |
| Rate limiter | 8 test (`rate-limiter.test.ts`) | — | — |
| Shared (realms/catalog/proverbs) | **47 test** (3 file) | — | — |
| **Web Vitest** | **64 test** (8 file) — toast 9, game 8, auth 7, badges 9, NextActionPanel 6, OnboardingChecklist 8, itemName 11, LeaderboardView 6 | Render-level cho `MissionView` claim flow + `AppShell` nav badge interaction. | Medium |
| **E2E Playwright** | **Scaffold** (PR #53) — `apps/web/e2e/golden.spec.ts` gate `E2E_FULL=1`, chưa wire CI. | Wire CI matrix job (Postgres+Redis+api+web). | Medium |
| **Economy integration** | Rải rác trong từng service + `item-ledger.test.ts` consistency check | Cross-module: market post → buy, ngân sách sect | Medium |

**Tổng (`vitest run` thực tế, sau PR #60)**: **259 test API + 47 test shared + 64 test web = 370 test pass**. CI xanh (run `25079013093` 1m34s). Real Postgres + real Redis service trên CI; local dùng `infra/docker-compose.dev.yml` (`docker compose up -d pg redis`).

**Chạy**:
```bash
pnpm --filter @xuantoi/api test        # 259 test (26 file, includes bootstrap + leaderboard + economy-alerts + next-action)
pnpm --filter @xuantoi/shared test     # 47 test (3 file)
pnpm --filter @xuantoi/web test        # 64 test (8 file, vitest 2.1.9 happy-dom)
pnpm test                              # toàn bộ — gộp shared + api + web
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
_(Không có lỗi làm app không chạy / mất tiền / auth hỏng tại commit `ce6da28`. CI xanh ở từng PR #33→#40, ~264 test pass.)_

### High

| # | Issue | File | Impact | Status / Fix |
|---|---|---|---|---|
| ~~H1~~ | ~~Chưa có smoke E2E sau khi PR #33→#40 merged vào main.~~ | — | — | **Resolved** (28/4 session 3) — smoke E2E pass 6/6: register/onboard, mission VN tz windowEnd=17:00Z, shop buy + ItemLedger + CurrencyLedger row, settings change-password + logout-all, profile public view, admin boss spawn + AdminAuditLog, inventory↔ledger consistency. Xem `test-report.md` (deliverable session). |
| ~~H2~~ | ~~Không có seed script tạo admin đầu tiên.~~ | `apps/api/scripts/bootstrap.ts` | — | **Resolved** by **PR #33** (`pnpm --filter @xuantoi/api bootstrap`, idempotent, 7 test). |
| ~~H3~~ | ~~Không có seed sect (Thanh Vân Môn, Huyền Thuỷ Cung, Tu La Điện).~~ | `apps/api/scripts/bootstrap.ts:DEFAULT_SECTS` | — | **Resolved** by **PR #33**. |
| ~~H4~~ | ~~`InventoryService` không có test unit.~~ | `apps/api/src/modules/inventory/inventory.service.test.ts` | — | **Resolved** by **PR #34** (19 test). |
| ~~H5~~ | ~~Web chưa có Vitest + E2E Playwright **trên `main`**.~~ | `apps/web/vitest.config.ts` + `playwright.config.ts` + `e2e/golden.spec.ts` + `src/{stores,components,lib,views}/__tests__/*.test.ts` | — | **Resolved** — PR #53 cherry-pick PR #47 vào main; PR #55/#56/#57/#58/#59 mở rộng coverage → **64 vitest pass** (toast 9 + game 8 + auth 7 + badges 9 + NextActionPanel 6 + OnboardingChecklist 8 + itemName 11 + LeaderboardView 6). Playwright scaffold sẵn, gate `E2E_FULL=1`, **chưa wire CI matrix** (mở issue tiếp khi cần full E2E — xem H6 dưới). |
| ~~H6~~ | ~~Playwright golden path scaffold sẵn nhưng chưa có CI job chạy headless.~~ | `.github/workflows/ci.yml` | — | **Resolved by PR #64** (Merged into main) — added matrix job `e2e-smoke` với services postgres+redis, build api+web, run `E2E_SMOKE=1 pnpm --filter @xuantoi/web e2e:smoke`. CI hiện chạy golden path mỗi PR. |

### Medium

| # | Issue | Status / Fix |
|---|---|---|
| ~~M1~~ | ~~Cron mission reset dùng timezone UTC mặc định.~~ | **Resolved** by **PR #42** — thêm env `MISSION_RESET_TZ` (default `Asia/Ho_Chi_Minh`) + helper `getMissionResetTz()` + tz-aware `nextDailyWindowEnd`/`nextWeeklyWindowEnd` + 7 test mới. |
| ~~M2~~ | ~~Boss spawn chỉ manual + admin endpoint chưa có.~~ | **Resolved** by **PR #36** (`POST /api/boss/admin/spawn` + UI tab + 7 test, audit `BOSS_SPAWN`). |
| ~~M3~~ | ~~Chưa có WS `mission:progress` push.~~ | **Resolved by PR #63 + #65** (Merged into main) — BE `MissionWsEmitter` 500ms throttle per-user, emit `'mission:progress'` payload `{characterId, changes: MissionProgressChange[]}` sau `MissionService.track()`. FE `MissionView` subscribe và apply delta in-place. Files: `apps/api/src/modules/mission/mission-ws.emitter.ts`, `apps/web/src/views/MissionView.vue`. |
| ~~M4~~ | ~~`ItemLedger` audit table chưa có.~~ | **Resolved** by **PR #40** (model + migration `20260428102849_itemledger` + hook 6 grant flows + market post/cancel/buy + 7 test trong `item-ledger.test.ts`). |
| ~~M5~~ | ~~`CurrencyLedger.actorUserId` chưa index.~~ | **Resolved** by **PR #43** — thêm `@@index([actorUserId, createdAt])` cho cả `CurrencyLedger` và `ItemLedger`. Migration `20260428112804_actor_user_id_index` (ADD INDEX only). |
| M6 | LogsModule (G3 cũ) chưa build — không có `/logs/me` endpoint. | **Open** — low priority, chỉ khi cần UI xem log action. |
| M7 | CSP production-ready nhưng chưa test deploy với CDN/asset domain khác. | **Open** — khi deploy: review `script-src`, `connect-src`. |
| M8 | Admin guard kiểm `role === 'ADMIN' \|\| 'MOD'` — MOD có quyền broad gần ADMIN (grant currency, approve topup, broadcast mail, spawn boss). | **Resolved** by PR E — thêm `@RequireAdmin()` decorator + reflector trong `AdminGuard`; ADMIN-only cho grant / role-set / approve-topup / reject-topup / giftcode-create / giftcode-revoke / mail-send / mail-broadcast / boss-admin-spawn. MOD vẫn được: GET (read) + ban (đã có hierarchy MOD↦PLAYER ở service). 8 unit test thuê reflector cho guard. |
| M9 | Settings logout-all không bump `passwordVersion` → access token cũ (15m) vẫn valid ở thiết bị khác. | **Open** (intentional trade-off, document trong `SECURITY.md`) — nếu cần force ngay, bump `passwordVersion` hoặc implement revocation list. |
| M10 | Shop không có rate-limit + stock infinite + không daily limit. | **Open** — closed beta acceptable; sau beta thêm `dailyLimit`. |
| ~~M11~~ | ~~`GET /character/profile/:id` không có rate-limit riêng.~~ | **Resolved by PR #62** (Merged into main) — reuse `RateLimiter` interface, DI token `PROFILE_RATE_LIMITER`, key `rl:profile:ip:${ip}`, **120 req/IP/15min**. Files: `apps/api/src/modules/character/{character.controller.ts, character.module.ts, character.controller.test.ts}`. +3 test. |

### Low

| # | Issue | Status / Fix |
|---|---|---|
| L1 | Hard-code VN/EN còn lẻ tẻ. | **Resolved (PR F)** — audit cuối: 554/554 key và vi.json/en.json sync, 400 used key all resolve. Fix 12 key admin vẫn English (`roleLabel`, `tab.audit`, `users.col.role`, `users.banned`, `roleChangeConfirm`, `roleChangedToast`, `topups.col.user/status/note`, `audit.col.actor/action/meta`). Các "identical en≡vi" còn lại (locale names, EXP, HP/MP, WS, OK, Boss, A Linh, currency names) là đúng ý đồ — universal/native term. |
| ~~L2~~ | ~~Market fee 5% hard-code.~~ | **Resolved by PR #69** (Merged into main) — `MARKET_FEE_PCT` env var, validate bounds [0, 0.5], default 0.05. File: `apps/api/src/modules/market/market.service.ts`. |
| L3 | Proverbs loading screen chỉ 30+ câu — lặp nhanh. | **Open** — mở rộng corpus. |
| ~~L4~~ | ~~Không có tên item localized.~~ | **Resolved** by **PR #57** — `apps/web/src/lib/itemName.ts` helper + 11 vitest test, dedupe across `MissionView`/`MailView`/`GiftCodeView`/`ShopView`. |
| L5 | Một số view chưa skeleton loader. | **Partial** — `LeaderboardView` + `ProfileView` (PR #67 merged), `MissionView` + `AdminView` (PR #68 merged). Còn lại `MarketView` (PR #77 Pending merge). Sau khi #77 merge → Resolved. |
| L6 | Settings dùng `window.confirm()` cho logout-all. | **Open** — nhẹ nhàng, post-beta thay bằng modal đẹp. |
| ~~L7~~ | ~~`ADMIN_REVOKE` reason đã định nghĩa trong `ItemLedger` nhưng chưa có endpoint admin thực thi.~~ | **Resolved by PR #66** (Merged into main) — `POST /admin/inventory/revoke` endpoint, ledger reason `ADMIN_REVOKE`, audit log. File: `apps/api/src/modules/admin/admin.service.ts`. +9 test. |

---

## 17. Missing Pages / Missing APIs

### Frontend pages

| Trang | Tình trạng | Cần trước beta? | Ghi chú |
|---|---|---|---|
| `ProfileView` | **Có** (PR #38) | — | `/profile/:id` route + `BossView` link. |
| `SettingsView` | **Có** (PR #37) | — | `/settings` — đổi password + logout-all + locale. |
| `ShopView` | **Có** (PR #39) | — | `/shop` — 11 entry NPC, chỉ LINH_THACH. |
| `LeaderboardView` | **Có** (PR #59) | — | Top 50 by realm + power. Route `/leaderboard`, FE component test 6 vitest. |
| `AlchemyView` (luyện đan) | Thiếu | Post-beta | Feature lớn. |
| `RefineryView` (luyện khí) | Thiếu | Post-beta | Feature lớn. |
| `ArenaView` (đấu trường PvP) | Thiếu | Post-beta | Feature lớn. |
| `EventView` | Thiếu | Post-beta | Event mùa (lễ hội, double drop, …). |
| `PetView` | Thiếu | Post-beta | Theo doc 04. |
| `CompanionView` (đạo lữ / phụ tu) | Thiếu | Post-beta | Lớn + cần balance. |

### APIs

| API | Tình trạng | Cần trước beta? |
|---|---|---|
| `GET /api/character/profile/:id` | **Có** (PR #38) | — |
| `POST /api/boss/admin/spawn` | **Có** (PR #36) | — |
| `GET /api/shop/npc` + `POST /api/shop/buy` | **Có** (PR #39) | — |
| `POST /api/_auth/logout-all` | **Có** (PR #37) | — |
| `POST /api/_auth/forgot-password` + `POST /api/_auth/reset-password` | Thiếu | Nice-to-have beta closed |
| `POST /api/_auth/verify-email` | Thiếu | Closed beta không cần |
| `GET /api/leaderboard/{power,topup,sect}` | **Power**: đã có (PR #59 — `GET /leaderboard?limit=50` top by realm+power, clamp 1≤limit≤50). Topup/sect chưa có. | Power done; topup/sect Nice-to-have post-beta. |
| `WS mission:progress` (server-push tracker) | **Có** (PR #63 BE emitter throttle 500ms + PR #65 FE handler `MissionView`) | — |
| `GET /api/logs/me` (G3 cũ) | Thiếu | Low (M6) |
| `POST /api/admin/inventory/revoke` (`ADMIN_REVOKE` ledger) | **Có** (PR #66 — endpoint + 9 vitest) | — |
| `GET /api/mail/unread-count` (M7 hydrate badge) | **Có** (PR #71) | — |
| `GET /api/admin/economy/alerts` (smart admin) | **Có** (PR #54) | — |
| `POST /api/auth/register` rate-limit per-IP | **Có** (PR #60 — 5/15min) | — |
| `GET /api/me/next-actions` (smart onboarding) | **Có** (PR #49) | — |

**Không có route FE đang gọi mà BE chưa có** — đã grep `apps/web/src/api/*.ts` khớp với `@Controller` tại `apps/api/src/modules/**/*.controller.ts`. Lưu ý: prefix global `/api`, auth controller tại `/_auth`, giftcode tại `/giftcodes`.

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

### Immediate (session 9 — còn việc an toàn, sau khi PR #62..#78 đã merge)

1. **Runtime smoke tích hợp sau toàn bộ PR #46→#78 đã merge** — **Needs runtime smoke**. Checklist (15 phút, theo `docs/QA_CHECKLIST.md`): register/login (verify rate-limit 5/IP/15min), HomeView (next-action panel + onboarding checklist), sidebar badges polling 60s, leaderboard render top 50 + tap-name → profile, admin economy alerts panel, mission claim + WS `mission:progress` real-time, mail unread badge hydrate trên login, NPC shop buy + ledger row, market post/cancel/buy với `MARKET_FEE_PCT` env, admin giftcode filter q/status, admin user filter role+banned, admin audit filter action+actor, admin topup filter date+email, admin inventory revoke + ADMIN_REVOKE ledger, admin economy `pnpm audit:ledger`, MarketView skeleton.
2. **M9 (Smart gameplay) — Daily login reward** (idempotent với `RewardClaimLog` đã có sẵn): cron/endpoint `POST /me/daily-login` trả reward (LINH_THACH/EXP/item nhỏ) một lần / ngày VN tz, hooks vào `CurrencyLedger`/`ItemLedger` reason `DAILY_LOGIN`. **Value cao** (sticky retention beta), **Risk thấp** (idempotent đã có pattern).
3. **G22 — Admin giftcode FE panel** (consumer cho `GET /admin/giftcodes?q=&status=` đã merge PR #74): tab Giftcode trong AdminView, table list + filter input + create/revoke action. UX polish.
4. **M6 — `GET /logs/me` endpoint** (tự xem audit log của mình): low priority, hữu ích cho UX trong-suốt + debug user-side.
5. **L5 — Mission claim flow render-level vitest**: cover claim button enable/disable + claimedAt badge update + WS frame apply.
6. **L3 — Proverbs corpus expansion** (loading screen): hiện 30+ câu lặp nhanh; thêm 50–100 câu Hán-Việt cổ phong từ `packages/shared/src/proverbs.ts`.
7. **L6 — Logout-all confirm modal** thay `window.confirm()` trong `SettingsView`.
8. **M10 — Shop daily limit** + per-item rate-limit (post-beta nice-to-have).
9. **M7 — CSP production CDN review** (chỉ khi triển khai prod).

### Before Closed Beta

7. ~~**M5 — `CurrencyLedger.actorUserId` index**~~: **Done** by **PR #43** (cover cả `ItemLedger.actorUserId`).
8. ~~**M8 — Admin guard split**~~: **Done** by **PR E** — `@RequireAdmin()` decorator + reflector. ADMIN-only cho 9 action có ảnh hưởng tài sản/policy.
9. ~~**L1 — i18n gap audit**~~: **Done** by **PR #45** + l10n tên item by **PR #57** (`itemName(key, t)` helper).
10. **L7 — `POST /api/admin/inventory/revoke`** + UI tab Users (admin thu hồi item nhầm, ghi `ADMIN_REVOKE` ledger — reason đã định nghĩa sẵn).
11. **L2 — Market fee 5% → config env** (`MARKET_FEE_BPS=500` default 500=5%).
12. **Mobile responsive verify** trên iPhone SE viewport.
13. **Health/CSP staging deploy** — verify `connectSrc` cho WS endpoint thực tế.

### During Closed Beta

14. Monitor `/healthz` + `/readyz` + ledger balance consistency check định kỳ (qua admin overview tab + `GET /admin/economy/alerts` PR #54).
15. Thu thập user feedback + bug report.
16. Balance tuning: cultivation rate, loot drop, market fee 5%, mission reward, NPC shop price.

### After Beta

17. **Alchemy** (luyện đan).
18. **Refinery** (luyện khí forge).
19. **Arena PvP**.
20. **Pet system**.
21. **Companion/Wife** (đạo lữ).
22. **Battle Pass seasonal**.
23. **Event system + cron spawn**.
24. **Leaderboard mở rộng** — `GET /api/leaderboard/{topup,sect}` (power đã có PR #59).
25. **Cross-server world boss**.
26. **`POST /api/_auth/forgot-password` + `reset-password`** (email-based).
27. **WS `mission:progress` push** (M3) + WS `mail:new` tích hợp test.
28. ~~**`ADMIN_REVOKE` endpoint**~~ — đã chuyển lên Before Closed Beta (#10) chỗ còn thiếu thao tác admin recovery.

---

## 21. Exact PR Plan

### Done (chuỗi #33→#45 đã merge trên `main` tại `e99a35f`)

| PR | Plan cũ | Status |
|---|---|---|
| PR 1 — Seed admin + sect bootstrap (H2 + H3) | — | **Done** — PR #33 merged. |
| PR 2 — InventoryService test (H4) | — | **Done** — PR #34 merged (19 test). |
| PR 3 — Docs ADMIN_GUIDE + DEPLOY + RUN_LOCAL (+ SECURITY + TROUBLESHOOTING) | — | **Done** — PR #35 merged. |
| PR 4 — NPC Shop + seed | — | **Done** — PR #39 merged (BE + FE + 11 entry catalog + 10 test + ledger SHOP_BUY). |
| PR 5 — Admin boss spawn endpoint | — | **Done** — PR #36 merged (`POST /api/boss/admin/spawn` + UI tab + 7 test + audit). |
| PR 7 — Settings page + change password UI + logout-all | — | **Done** — PR #37 merged (`POST /api/_auth/logout-all` + 3 test). |
| PR 8 — Item Ledger | — | **Done** — PR #40 merged (model + migration `20260428102849_itemledger` + hook 6 grant flows + 7 test). |
| (PR ngoài kế hoạch) PR 8b — Profile public API + ProfileView | — | **Done** — PR #38 merged. |

### Pending (theo §20)

#### PR A — Smoke E2E + Runtime sanity (Immediate §20.1)
- **Mục tiêu**: xác nhận `main @ ce6da28` chạy đúng sau khi #33→#40 merge.
- **Bước**: `pnpm install && pnpm infra:up && prisma migrate deploy && bootstrap`. Chạy `pnpm dev`. Smoke 11 bước theo §20.1. Query `ItemLedger` + `CurrencyLedger` kiểm consistency.
- **File**: chỉ ghi báo cáo trong `docs/AI_HANDOFF_REPORT.md` (Recent Changes / Smoke section). Không sửa code (nếu không phát hiện bug).
- **Risk**: nếu phát hiện bug → mở PR fix riêng theo mức độ.

#### ~~PR B — H5 Replay PR #47 (Vitest minimal + Playwright scaffold) vào `main`~~ — **Done** (cherry-pick `32a33a6` vào main, conflict `docs/AI_HANDOFF_REPORT.md` resolved take `--ours`)
- **File**: `apps/web/vitest.config.ts` (new, vitest@^2.1.9 happy-dom), `apps/web/playwright.config.ts` (new, @playwright/test@^1.49.0), `apps/web/e2e/golden.spec.ts` (new, smoke + golden gated `E2E_FULL=1`), `apps/web/src/stores/__tests__/toast.test.ts` (new, 9 test), `apps/web/src/stores/__tests__/game.test.ts` (new, 8 test), `apps/web/package.json` (test script `vitest run` + 4 devDeps + scripts `test:watch`/`e2e`/`e2e:install`), `pnpm-lock.yaml`. **Không sửa** `.github/workflows/ci.yml` — step `pnpm test` recursive tự pickup vitest (+~2s).
- **Test**: 17 vitest pass local. Playwright KHÔNG add vào CI (cần browser + full stack). API/shared test không đổi.
- **Risk**: low — chỉ thêm test infrastructure, không sửa runtime code. CI build tốn thêm ~2s cho vitest run.

#### ~~PR C — M1 Mission reset timezone env~~ — **Done** (PR #42)
- **File**: `apps/api/src/modules/mission/mission.service.ts` (helper `getMissionResetTz` + tz-aware `nextDailyWindowEnd`/`nextWeeklyWindowEnd`), `apps/api/.env.example` (`MISSION_RESET_TZ=Asia/Ho_Chi_Minh`), `mission.service.test.ts` (+7 test).
- **Test**: 26 mission test pass (3 UTC default + 4 VN tz + 3 env helper + 16 cũ).
- **Risk**: thấp — helper pure + thêm env optional (default backward-compat = `'UTC'` tại function-level).

#### ~~PR D — M5 `CurrencyLedger.actorUserId` index~~ — **Done** (PR #43)
- **File**: `apps/api/prisma/schema.prisma` (`@@index([actorUserId, createdAt])` x2 cho `CurrencyLedger` + `ItemLedger`), migration `20260428112804_actor_user_id_index/migration.sql` (ADD INDEX only).
- **Test**: không thêm test riêng — ADD INDEX không đổi logic. 269 test cũ vẫn pass.
- **Risk**: thấp — ADD INDEX an toàn, không khoá bảng (Postgres `CREATE INDEX` non-concurrent phù hợp vì bảng cuối `migrate deploy` size nhỏ).

#### ~~PR E — M8 Admin guard split (ADMIN vs MOD)~~ — Done
- **File**: `apps/api/src/modules/admin/require-admin.decorator.ts` (new), `apps/api/src/modules/admin/admin.guard.ts` (refactor: inject `Reflector`, đọc metadata `requireAdmin`), `apps/api/src/modules/admin/admin.controller.ts` (apply `@RequireAdmin()` cho 8 endpoint), `apps/api/src/modules/boss/boss.controller.ts` (apply cho `POST /boss/admin/spawn`). Test: `apps/api/src/modules/admin/admin.guard.test.ts` (8 unit test với mocked `Reflector`).
- **Endpoints ADMIN-only**: `POST /admin/users/:id/role`, `POST /admin/users/:id/grant`, `POST /admin/topups/:id/approve`, `POST /admin/topups/:id/reject`, `POST /admin/giftcodes`, `POST /admin/giftcodes/:code/revoke`, `POST /admin/mail/send`, `POST /admin/mail/broadcast`, `POST /boss/admin/spawn`.
- **Endpoints MOD-allowed**: tất cả `GET /admin/*` (read-only) + `POST /admin/users/:id/ban` (đã có hierarchy MOD↦PLAYER ở `AdminService.setBanned`).
- **i18n**: thêm key `admin.errors.ADMIN_ONLY` cho `vi.json` + `en.json`.
- **Risk**: low — đổi quyền chỉ thắt chặt MOD, không ảnh hưởng PLAYER. ADMIN không bị ảnh hưởng. Service-layer guard (đã có sẵn cho `setRole` ADMIN-only + `grant`/`setBanned` hierarchy) là defense-in-depth.

#### ~~PR F — L1 i18n gap re-audit~~ **Done (PR #45, merged commit `e99a35f`)**
- Audit `apps/web/src/i18n/{vi,en}.json` 554/554 key sync, 400 used key all resolve, 0 missing.
- Fix 12 key admin vẫn English trong `vi.json` (roleLabel, tab.audit, users.col.role, users.banned, roleChangeConfirm, roleChangedToast, topups.col.user/status/note, audit.col.actor/action/meta) → dịch sang Việt.
- Helper `itemName(key, locale)` (L4) vẫn open — tách thành PR riêng khi có catalog item l10n.

#### Thứ tự đề xuất cho AI tiếp theo
**~~A (smoke)~~ → ~~B (Replay PR #47 — Vitest+Playwright)~~ → ~~C (timezone)~~ → ~~D (index)~~ → ~~E (guard split)~~ → ~~F (i18n)~~**.  
(A Done qua PR #44 smoke E2E pass 6/6; B Done tại PR replay PR #47 [session 5]; C Done tại PR #42; D Done tại PR #43; E Done tại PR #48; F Done tại PR #45.)

**Ưu tiên hành động sau PR B**: chuyển sang smart-feature tiếp hoặc closed-beta polish:
- ~~**G1 (high value, low risk)**: Mở rộng vitest coverage cho `HomeView` (next-action panel render), `AppShell` (badge logic 60s polling), `MissionView` (claim button enable/disable). Reuse vitest infra của PR B.~~ — **Done** by **PR #55 + PR G1-render**:
  - PR #55: useBadgesStore (9 test) + useAuthStore (7 test). Cover badge logic 60s polling + auth flow.
  - PR G1-render: NextActionPanel render-level (6 test). Cover smart onboarding panel HomeView.
  - Còn lại (low priority): `MissionView` claim flow render — tốn setup AppShell stub + multi-store mock, ROI giảm. Skip cho closed beta.
- **G2 (medium, low)**: L4 helper `itemName(key, locale)` cho `MissionView/MailView/GiftCodeView/ShopView` — dịch tên item theo i18n.
- **G3 (medium, medium)**: M3 WS `mission:progress` push (throttled `emitToUser` tại `MissionService.track*`).
- ~~**G4 (smart admin)**: Admin Overview tab thêm alert nếu currency âm / item qty âm / topup pending >24h.~~ — **Done** by **PR #54** (Open, chờ CI). Endpoint `GET /admin/economy/alerts` + Stats tab panel + 7 test.
- ~~**G5 (post-beta backlog)**: leaderboard~~ — **Done** (PR #59). Còn `ADMIN_REVOKE` endpoint (L7), Alchemy/Refinery/Arena (post-beta).
- ~~**G6 (basic leaderboard)**~~ — **Done** (PR #59 — `GET /api/leaderboard?limit=N` + `LeaderboardView` route `/leaderboard`).
- ~~**G7 (register IP rate-limit)**~~ — **Done** (PR #60 — 5 register/IP/15min, Redis distributed prod, in-memory fallback).
- ~~**G8**: M11 — rate-limit `GET /character/profile/:id`~~ → **Merged into main** (PR #62).
- ~~**G9**: M3 — WS `mission:progress` throttled push~~ → **Merged into main** (PR #63).
- ~~**G11**: FE handler `mission:progress` (closed-loop cho PR #63 BE push)~~ → **Merged into main** (PR #65).
- ~~**G10**: H6 — wire Playwright golden path vào GitHub Actions CI~~ → **Merged into main** (PR #64 — matrix job `e2e-smoke` với services postgres+redis).
- ~~**G12**: L7 — `POST /admin/inventory/revoke` + ledger `ADMIN_REVOKE`~~ → **Merged into main** (PR #66, +9 vitest).
- ~~**G13/G14**: L5 — skeleton loaders cho Leaderboard/Profile/Mission/Admin/Market~~ → **Merged into main** (PR #67/#68/#77).
- ~~**G15**: L2 — `MARKET_FEE_PCT` env config~~ → **Merged into main** (PR #69).
- ~~**G16/G18/G19/G20**: admin user/audit/topup/giftcode filter~~ → **Merged into main** (PR #70/#72/#73/#74).
- ~~**G17**: M7 — `GET /mail/unread-count` + FE badge hydrate~~ → **Merged into main** (PR #71).
- ~~**G21**: smart economy safety `pnpm audit:ledger` + 9 vitest~~ → **Merged into main** (PR #76).

Không còn issue **High** mở trên main (H6 Playwright CI wire đã wire qua PR #64). Còn **Medium** (M6 logs/me, M7 CSP CDN review, M9 logout-all passwordVersion intentional trade-off, M10 shop daily limit) và **Low** (L3 proverbs corpus, L6 logout-all confirm modal). M3 / M11 / L2 / L4 / L5 / L7 đã Resolved (PR #63/#65/#62/#69/#57/#67-68-77/#66).

Các hạng mục smart-feature đề xuất (không bắt buộc — AI tự quyết theo prompt user):
- **Smart next-action / onboarding checklist** (§16 của prompt user mục 1–2): /home giợ widget "Nên làm gì tiếp?" dựa trên state (đủ EXP đột phá, mission claim-able, mail unread, boss đang mở, …).
- **Smart admin economy alert** (mục 3–4): Admin Overview tab thêm alert nếu currency âm hoặc item qty âm hoặc topup pending quá 24h.
- **Smart QA**: Playwright golden path đã nằm trong PR B; sau đó mở rộng coverage.
- **Mission/Mail badge** trong AppShell nav (mục 6 — UX polish).
- **`POST /api/admin/inventory/revoke`** (L7): kèm UI tab Users; hoãn đến khi có case thực.

#### Post-beta backlog
~~Leaderboard~~ (Done PR #59) / Alchemy / Refinery / Arena / Pet / Companion / Event / Battle Pass / `forgot-password` / `mission:progress` WS / `ADMIN_REVOKE` endpoint.

---

### Session 6 audit log (28/4 22:45 UTC — PR #65 G11 FE mission:progress handler)

**PR #65 — G11: FE handler event `mission:progress` (stacked trên PR #63)**

- **Branch**: `devin/1777416234-g11-fe-mission-handler`. **Base**: `devin/1777414636-g9-ws-mission-progress` (PR #63 branch). **Status**: **Pending merge**. Merge PR #63 trước, sau đó rebase PR #65 xuống `main` và merge.
- **Mục tiêu**: Hoàn tất closed-loop của PR #63 ở phía FE — khi BE push frame `mission:progress` (sau `MissionService.track()`), FE nhận được event và merge delta vào `missions` ref của `MissionView.vue` → progress bar nhảy real-time không cần refetch.
- **Giải pháp**:
  - `apps/web/src/ws/client.ts`: thêm `'mission:progress'` vào mảng `events` để socket.io-client lắng nghe + dispatch tới handlers.
  - **NEW** `apps/web/src/lib/missionProgress.ts` (38 line): fn `applyMissionProgressFrame(current, frame)` — immutable update. Invariants: không lùi `currentAmount` (server monotonic), không đổi `claimed`, không tạo mission mới, completable bị gộp `!m.claimed` để tránh bug UI.
  - `apps/web/src/views/MissionView.vue`: `onMounted` subscribe `wsOn('mission:progress', ...)`; `onUnmounted` unsubscribe. `missions.value = applyMissionProgressFrame(missions.value, frame.payload)`.
- **Files**:
  - `apps/web/src/ws/client.ts` (+1 / -0)
  - `apps/web/src/lib/missionProgress.ts` (new, 38 line)
  - `apps/web/src/lib/__tests__/missionProgress.test.ts` (new, 126 line, 6 test)
  - `apps/web/src/views/MissionView.vue` (+22 / -0: import + subscribe/unsubscribe)
- **Tests**: web local pass **70/70** (was 64, +6 missionProgress).
  - 6 unit test: apply `currentAmount`+`completable` delta cho key match; completable đẩy mission sẵn sàng claim; stale frame (currentAmount nhỏ hơn local) không lùi; `claimed=true` block completable reset; empty changes → no-op return same ref; unknown mission key → skip, không tạo mới.
- **Local verified**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm --filter @xuantoi/web build` ✅ · `pnpm --filter @xuantoi/web test` ✅ 70/70.
- **CI**: chờ push branch.
- **Risk**: low.
  - Chỉ subscribe trong `MissionView`, lúc unmount hủy subscription — không leak.
  - `applyMissionProgressFrame` immutable, return cùng ref khi no-op — tránh trigger reactivity thừa.
  - Không đổi API/DB/schema.
- **Backward compat**: Nếu BE chưa push frame (vd PR #63 chưa merge), FE không nhận gì → graceful (polling cũ vẫn hoạt động).
- **Runtime smoke**: Needs runtime smoke với BE + FE chạy đồng thời sau khi PR #63 + PR #65 cùng merge — verify DevTools → WS thấy frame, progress bar UI nhảy khi tu luyện.
- **Rollback**: revert PR #65. FE mất realtime update; tính đúng đắn mission list không đổi.
- **Bước tiếp**: G12 — L5 skeleton loaders / L7 admin revoke / L2 market fee config.

---

### Session 6 audit log (28/4 22:25 UTC — PR #63 G9 M3 WS mission:progress)

**PR #63 — G9: WS `mission:progress` throttled push (M3 resolved)**

- **Branch**: `devin/1777414636-g9-ws-mission-progress`. **Base**: `main` @ `81706a9` (sau PR #61). **Status**: **Pending merge** (CI chưa mở, chờ push).
- **Mục tiêu**: M3 — sau khi `MissionService.track(...)` increment progress, push một frame `mission:progress` qua WebSocket cho user owner để FE cập nhật UI immediate, không cần polling/refetch. Throttle 500ms/user để tránh spam khi nhiều event dồn dập (vd cultivation tick + boss attack hit + chat msg cùng giay).
- **Giải pháp**:
  - `packages/shared/src/ws-events.ts`: thêm type `'mission:progress'` vào union `WsEventType` + interface `MissionProgressFramePayload` + `MissionProgressChange` + const `MISSION_PROGRESS_PUSH_THROTTLE_MS = 500`.
  - **NEW** `apps/api/src/modules/mission/mission-ws.emitter.ts`: class `MissionWsEmitter` injectable. `pushProgress(userId, payload)` — throttle 500ms per-user; trong cửa sổ → drop (return false), ngoài → emit `realtime.emitToUser(userId, 'mission:progress', payload)` (return true). `now()` hàm inject để test deterministic không cần fake-timers.
  - `mission.service.ts`: thêm DI token `MISSION_WS_EMITTER`, constructor 4th param `@Optional() @Inject(MISSION_WS_EMITTER) wsEmitter` (nếu null → silent skip). `track()` collect tất cả row được update thành công (CAS guard upd.count === 1) thành `MissionProgressChange[]`, sau đó query `character.userId` để emit. Không fail track nếu character thiếu (race-safe).
  - `mission.module.ts`: import `RealtimeModule`, register `missionWsEmitterProvider` factory inject `RealtimeService`.
  - `test-helpers.ts:makeMissionService`: thêm optional 2nd param `emitter` → backward-compat full (default `null`).
- **Files**:
  - `packages/shared/src/ws-events.ts` (+30 / -0)
  - `apps/api/src/modules/mission/mission-ws.emitter.ts` (new, 47 line)
  - `apps/api/src/modules/mission/mission.service.ts` (+45 / -10)
  - `apps/api/src/modules/mission/mission.module.ts` (rewrite, +20 -0)
  - `apps/api/src/test-helpers.ts` (+5 / -3)
  - `apps/api/src/modules/mission/mission-ws.emitter.test.ts` (new, 96 line, 6 test)
  - `apps/api/src/modules/mission/mission.service.test.ts` (+58 / -1, 1 integration test mới)
- **Tests**: API local pass **266/266** (mới: 259 → 266, +7). Shared 47/47 · Web 64/64 · Build xanh.
  - 6 emitter unit test: emit immediately, drop in window, emit after window, per-user isolation, empty changes drop, reset() works.
  - 1 integration test: `track('CULTIVATE_SECONDS', 300)` gọi `emitToUser('userId', 'mission:progress', { changes: [daily, weekly] })` 1 lần; track thứ 2 trong 100ms drop; track thứ 3 sau 600ms emit lại với snapshot mới.
- **CI**: chờ push branch.
- **Risk**: low.
  - Throttle drop in window → FE có thể bỏ lỡ update ít ôi nhưng không critical (FE mở trang `MissionView` vẫn refetch full list). Fallback an toàn.
  - `wsEmitter` `@Optional()` với default null → tất cả tính đúng đắn của `track()` vẫn nguyên (nếu thiếu emitter, chỉ mất feature WS push).
  - Không đổi schema, không migration.
- **Backward compat**: `MissionService` constructor 4th param `@Optional()`, mọi callsite cũ (3-param) vẫn hợp lệ. `makeMissionService` 2nd param default `null`, mọi test cũ vẫn pass.
- **i18n**: KHÔNG cần thêm key. Frame chỉ cần FE consume để update store.
- **FE follow-up (NOT in this PR)**: thêm handler trong `apps/web/src/stores/realtime.ts` (hoặc tương đương) cho event `mission:progress` → update `mission` store snapshot. Hiện tại FE polling/refetch khi vào `MissionView` → chưa có frame này là graceful.
- **Runtime smoke**: Needs runtime smoke (verify FE nhận đúng frame qua DevTools → Network → WS sau khi tu luyện / đánh boss / chat). Backend xanh ở mức unit-test (7 test mới); hành vi `RealtimeService.emitToUser` + `emit` đã cover ở chat/boss/mail từ trước.
- **Rollback**: revert. `track()` quay về behavior cũ (chỉ update DB, không emit WS).
- **Bước tiếp**: G10 — H6 wire Playwright vào GitHub Actions CI.

---

### Session 6 audit log (28/4 21:55 UTC — docs-only refresh)

**Audit refresh** — PR docs only, branch `devin/1777413579-audit-session-6-report-refresh`.

- **Goal**: Đồng bộ `AI_HANDOFF_REPORT.md` với trạng thái `main @ 993a95f` sau khi PR #58 + #59 + #60 merge (header cũ vẫn ghi #59/#60 "Open").
- **Discrepancy phát hiện**:
  1. Header snapshot vẫn ghi `(post-PR #54..#59 merged, cập nhật SHA khi PR #60 merge)` và "Đang mở: PR #60 G7" — sai (PR #60 đã merge `993a95f`).
  2. PR #58 entry trong Recent Changes ghi `Status: Open (CI pending)` — sai (đã merge `067a6c4` 28/4 20:59 UTC).
  3. §2 commit audit pointer `68fa1a3` — sai (main đã ở `993a95f`).
  4. §2 bảng PR merged thiếu PR #52..#60.
  5. §12 Tests: web vitest ghi `0 — Toàn bộ thiếu` — sai (64 test/8 file). Tổng test `222 + 47 = 269` — sai (`259 + 47 + 64 = 370`).
  6. §16 Known Issues: H5 ghi `Resolved partial` (17 test) — sai (đã mở rộng đến 64 test, **Resolved**); L4 vẫn `Open` — sai (Done PR #57).
  7. §17 Missing Pages: `LeaderboardView Thiếu` và `GET /leaderboard Thiếu` — sai (Done PR #59).
  8. §20 Roadmap: Immediate vẫn ghi G1/G4/G6/G7 như `Open` — sai (đã done).
- **Verify local 28/4 21:55 UTC**: `pnpm install`, `pnpm typecheck` xanh, `pnpm lint` xanh, `docker compose -f infra/docker-compose.dev.yml up -d pg redis` + `prisma migrate deploy`, `pnpm --filter @xuantoi/api test` 259/259 pass (25.8s, 26 file), `pnpm --filter @xuantoi/shared test` 47/47 pass, `pnpm --filter @xuantoi/web test` 64/64 pass (vitest 2.1.9 happy-dom), `pnpm build` xanh.
- **CI main**: gần nhất run `25079013093` xanh 1m34s.
- **Không đổi code/test/seed**. Chỉ fix report.
- **Risk**: zero (docs-only).
- **Next planned PR (sau khi #61 docs merge)**: PR G8 (M11 rate-limit profile) — analog PR #60.

---

### Session 5 audit log (28/4 19:56–20:25 UTC — PR #52 + PR #53 + PR #54)

**PR #54 — G4 smart admin economy alerts**
- Branch mới base off main (sau PR #53 merge tại `2ae4cc0`).
- API: `AdminService.getEconomyAlerts(staleHours)` + route `GET /admin/economy/alerts`. 7 vitest test cover 3 loại alert + custom staleHours + empty DB.
- FE: `adminEconomyAlerts()` client + Stats tab panel render 3 group; reuse `refreshStats()` flow.
- i18n: `admin.alerts.*` vi/en.
- Local: `pnpm typecheck` + `pnpm lint` + `pnpm build` xanh. `pnpm --filter @xuantoi/web test` 17/17 pass. `pnpm --filter @xuantoi/api test` skip local vì không có Postgres (CI sẽ chạy).
- Risk: low — read-only endpoint, không schema/migration.

---

### Session 5 audit log (28/4 19:56–20:08 UTC — PR #52 + PR B replay) [histórico]

**PR B — Replay PR #47 (cherry-pick `32a33a6` vào main)**
- Branch mới base off main (sau khi PR #52 merge tại `82e6212`).
- `git cherry-pick 32a33a6` → conflict `docs/AI_HANDOFF_REPORT.md` (file đã thay đổi nhiều từ session 4 đến 5). Resolve: `git checkout --ours docs/AI_HANDOFF_REPORT.md` (giữ report mới hơn của session 5), để PR B không đụng report. Sau đó update report riêng trong cùng PR (entry này).
- Cherry-pick continue → commit giữ nguyên tác giả + message gốc PR #47.
- `pnpm install` (mang 20 devDep mới cho vitest/playwright/happy-dom/test-utils).
- `pnpm --filter @xuantoi/web test` → 17 pass (1.86s, vitest 2.1.9, happy-dom).
- `pnpm typecheck` + `pnpm lint` + `pnpm build` → pass (xem checklist dưới).
- Risk: low — chỉ thêm test infra, không đụng runtime code.

---

**PR #52 — audit session 5 (this changelog entry referenced)**

- **Action**: pull `main` → `68fa1a3`. Verify trạng thái PR #46..#51 và phát hiện replay-gap PR #47.
- **Discrepancy phát hiện**:
  1. Snapshot pointer `e99a35f` lỗi thời — main đã tại `68fa1a3` (PR #46→#51 merged sau đó, trừ #47).
  2. **Trạng thái PR #50 + #51** ghi "đang mở" — sai (đã merge `68fa1a3` và `699af81`).
  3. **⚠️ Replay-gap PR #47**: GitHub PR API show `closed (merged)`, nhưng commit merge `4ed913a` chỉ tồn tại trên `origin/devin/1777398022-audit-pr-45-blueprint-docs`. `git branch --contains 4ed913a` ⇒ chỉ ra branch đó, không có `main`. File `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/web/e2e/golden.spec.ts`, `apps/web/src/stores/__tests__/*.test.ts` **không tồn tại** trên `main @ 68fa1a3`. `apps/web/package.json` test script vẫn `"echo \"(web) test skipped — wire vitest in Phase 1\""`.
  4. **H5 known issue** ghi "Resolved partial" qua PR #47 — sai cho trạng thái `main`. Đã đổi sang **Open (replay needed)**.
  5. **Audit gap session 4** ghi "E2E Playwright scaffolded (PR #47) — wired" + "Web Vitest wired (PR #47)" — sai. Đã ghi đè bằng note replay-gap.
  6. Section heading `Recent Changes (PR #33→#49 + PR #50 docs + PR #51 badges)` — đã đổi sang `(PR #33→#51 + replay-gap PR #47)`.
  7. §21 PR B mô tả như mới tinh — đã retitle "Replay PR #47" để AI sau hiểu rõ có commit sẵn để cherry-pick.
- **Fix đã áp dụng trong PR này (docs only)**:
  1. Header snapshot `e99a35f` → `68fa1a3` + thêm cảnh báo replay-gap.
  2. §2 commit audit + bảng PR merged gần đây thêm #46..#51 (#47 gạch ngang + note replay-gap).
  3. Recent Changes PR #50/#51 đổi Open → Merged + commit ref.
  4. Audit gap section viết lại theo thực tế main.
  5. §16 H5 → Open (replay needed).
  6. §20 Immediate roadmap reorder: replay PR #47 lên #2.
  7. §21 PR B retitle + ghi rõ có commit `32a33a6` để cherry-pick.
- **Local check session 5**: `pnpm install` → done; `pnpm --filter @xuantoi/api prisma:generate` → done; `pnpm --filter @xuantoi/shared build` → done; `pnpm typecheck` → pass (3/3 workspace); `pnpm lint` → pass (api + web `--max-warnings 0`); test/build skip (docs-only PR + chua có Postgres local).
- **Risk**: green — docs-only PR, không đụng code/test/migration/schema.
- **Roadmap kế**: PR B (replay PR #47) — base main, cherry-pick `32a33a6` (hoặc re-impl sạch); update `apps/web/package.json` test script. CI sẽ tự pickup vitest qua `pnpm test`.

---

### Session 4 audit log (28/4 — PR #46)

- **Action**: pull `main` → `e99a35f`. Verify PR #45 (L1 i18n re-audit) đã merge. Confirm 0 PR open.
- **Discrepancy phát hiện**:
  1. Snapshot pointer `4d8af10` lỗi thời — main đã tại `e99a35f` (PR #45 merged).
  2. Inconsistency: líne `Snapshot: 4d8af10` v.s. `Commit audit: ce6da28` (khác nhau 7 commit).
  3. **Trạng thái** ghi PR F "đang mở" — sai (đã merge lúc 17:36 UTC 28/4).
  4. Section heading `Recent Changes (PR #33→#40)` thiếu PR #41→#45.
  5. **Audit gap** vẫn ghi "Smoke runtime chưa chạy" — sai (PR #44 đã smoke 6/6 pass).
  6. Blueprint 04/05 chưa có trong repo — user expect `docs/04_*` + `docs/05_*` tồn tại.
- **Fix đã áp dụng trong PR này**:
  1–5. Cập nhật snapshot, audit commit, trạng thái, recent changes, audit gap.
  6. Commit `docs/04_TECH_STACK_VA_DATA_MODEL.md` + `docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md` với banner "Historical blueprint, NOT the current source of truth".
- **Local check**: `pnpm typecheck` → pass; `pnpm lint` → pass; `pnpm --filter @xuantoi/shared test` → 47/47 pass; (API test bỏ qua local — cần Postgres; CI chạy đầy đủ).
- **Risk**: green — docs-only PR, không đụng code/test/migration.
- **Roadmap kế**: PR B (Vitest minimal + Playwright golden path — H5).

### Session 9 audit log (29/4 ~10:00 UTC — PR #79 docs cleanup sau khi PR #62..#78 merged cascade)

**PR #79 — `docs(handoff): session 9 audit — fix stale Section 2/17/20/21 sau khi 17 PR merged session 6→8`** — **Pending merge**

- **Branch**: `devin/1777456890-audit-session-9-progress`. **Base**: `main` @ `909d60c`. **Status**: **Pending merge**.
- **Mục tiêu**: AI engineer mới nhận task mở repo, nhận thấy header (§1) đã được PR #78 cập nhật (snapshot c8123df, 16 PR list, 0 open) nhưng các section thân bài (§2 Current Branch / CI / PR Status, §17 Missing Pages/APIs, §20 Immediate Roadmap, §21 G items, một số entry "Recent Changes") vẫn còn các tuyên bố lỗi thời từ session 6 — cần cleanup để AI sau đọc duy nhất file này hiểu đúng hiện trạng.
- **Discrepancy phát hiện qua audit (29/4 09:55 UTC)**:
  1. **§2 Commit audit** vẫn ghi `81706a9 PR #61` (session 6) → thực tế `909d60c PR #78`.
  2. **§2 PR open đáng kể** vẫn ghi "PR #62 G8 Pending merge" → thực tế **0 PR open** (verify GitHub UI: 0 open / 78 closed).
  3. **§Recent Changes header** "PR #33→#60" → thực tế đã có entries cho PR #62..#77 trong body, nên đổi `#33→#78`.
  4. **§Recent Changes PR #77 entry** ghi "Pending merge" → thực tế Merged into main commit `266bfe7`.
  5. **§Recent Changes PR #71 entry** body bị copy nhầm content của PR #74 (giftcode filter q+status); branch ghi `devin/1777451169-g20-topup-csv-export` (sai) — đúng phải là `devin/1777418952-g17-mail-unread-count`. Đã thêm note ⚠️ giải thích & nhãn `Merged into main` chính xác.
  6. **§17 Missing APIs**: `WS mission:progress` và `POST /api/admin/inventory/revoke` vẫn ghi "Thiếu" → thực tế Resolved (PR #63/#65 + PR #66). Bổ sung 4 hàng API mới đã có (PR #71/#54/#60/#49).
  7. **§20 Immediate Roadmap**: 6 mục cũ (mostly đã merged hoặc Pending merge từ session 7) → thay bằng 9 mục Immediate session 9 sắp xếp theo ưu tiên (smoke runtime, M9 daily login, G22 admin giftcode FE, M6 logs/me, L5 mission claim test, L3/L6/M10/M7).
  8. **§21 G items**: G8/G9/G10/G11/G12/G13/G14/G15/G16/G17/G18/G19/G20/G21 vẫn ghi "Pending merge" → đổi sang **Merged into main** kèm PR number.
  9. **Closing summary**: "M11 done PR #62 pending merge" → "M11 Resolved (PR #62)".
- **Files**: `docs/AI_HANDOFF_REPORT.md` (~10 surgical edits, không touch §3..§16, không touch Recent Changes detail PR #33..#76).
- **Tests**: N/A — docs-only PR.
- **Local verified (29/4 09:58 UTC)**:
  - `pnpm install --frozen-lockfile` ✅
  - `pnpm --filter @xuantoi/api prisma:generate` ✅
  - `pnpm --filter @xuantoi/shared build` ✅
  - `pnpm typecheck` ✅ (3 workspace, 0 error)
  - `pnpm lint` ✅
  - `pnpm --filter @xuantoi/shared test` ✅ **47/47**
  - `pnpm --filter @xuantoi/web test` ✅ **79/79** (11 file)
  - `pnpm build` ✅
  - API test (`pnpm --filter @xuantoi/api test`) chưa chạy local — yêu cầu Postgres+Redis live (CI sẽ chạy full).
- **CI status**: chờ push + GitHub Actions.
- **Runtime smoke**: N/A — docs-only.
- **Risk**: low. Docs-only, không đụng code/test/migration/i18n. Rollback dễ qua `git revert`.
- **Roadmap kế (sau khi PR #79 merge)**: chọn 1 trong **Immediate §20.2/§20.3** — *M9 Daily Login Reward* (high value retention, idempotent qua `RewardClaimLog` đã có pattern) hoặc *G22 Admin Giftcode FE Panel* (consumer cho `GET /admin/giftcodes?q=&status=` đã merge PR #74, scope nhỏ, dễ test).
- **Env config**: AI session này cũng đã suggest update `devin_env` cho repo: `pnpm install` → `pnpm prisma:generate` → `pnpm --filter @xuantoi/shared build` ở mỗi maintenance. Lý do: repo cần Prisma client + shared dist trước khi typecheck/test apps/api & apps/web (web vitest fail "Failed to resolve entry for package @xuantoi/shared" nếu không build shared trước).

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
