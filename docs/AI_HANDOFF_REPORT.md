# AI Handoff Report — Xuân Tôi

> **Snapshot (session 9n-I in-flight, shared combat catalog tests — rebased post-#172)**: `main` @ `614cd66` (Merge PR #172 `docs(CHANGELOG): catch-up 9m+9n`, 30 Apr 2026 ~15:50 UTC). **Session 9n progress (8 PR merged + 0 in-flight)**: PR #165..#172 merged. **This PR (9n-I, branch `devin/1777555835-shared-combat-tests`)**: smart catalog integrity tests cho `packages/shared/src/combat.ts` — trước đây 0 test cho 238 dòng combat data (MONSTERS/DUNGEONS/SKILLS catalog + rollDamage RNG). +40 vitest unit cover: monster catalog invariants (unique key, stat>0), dungeon catalog (monster cross-ref, recommendedRealm cross-ref với REALMS, staminaEntry tăng theo difficulty), SKILLS catalog (mpCost/atkScale/selfHealRatio/selfBloodCost ranges, sect enum, huyết tế design rule, heal-only tuyệt kỹ rule), helper lookups, `rollDamage` invariants (integer >= 1, variance 85-115%, def cực cao clamp 1, scale=0 clamp 1), STAMINA constants. Shared baseline 96 → **136**.

> **Snapshot (session 9n-H merged as PR #172)**: `docs/CHANGELOG.md` catch-up session 9m (PR #160..#164) + session 9n (PR #165..#171) — backfill section API service test coverage push + smart audit-ledger/economy-alerts CLI + TROUBLESHOOTING + i18n parity fixes.

> **Snapshot (session 9n-G merged as PR #171)**: i18n parity fix cho fallback Error messages ở `apps/web/src/api/{auth,shop,character}.ts` — thêm i18n keys `common.apiFallback.{register,login,changePassword,forgotPassword,resetPassword,logoutAll,shopLoad,shopBuy,onboard}` ở vi.json + en.json + helper `fallbackError(op)`. +19 vitest. Web vitest baseline 513 → 532.

> **Snapshot (session 9n-F merged as PR #170)**: `apps/web/src/stores/toast.ts` Pinia store dùng `i18n.global.t('toast.title.<type>')` thay vì hard-code VN titles. +4 vitest locale switch.

> **Snapshot (session 9n-E merged as PR #169)**: smart economy-alerts CLI `pnpm --filter @xuantoi/api alerts:economy` + 18 vitest + extract `queryEconomyAlerts()` + ADMIN_GUIDE §11.3.

> **Snapshot (session 9n-C merged as PR #167)**: `main` @ `0b1b6da` (Merge PR #166 `feat(api,docs): smart audit-ledger CLI — --json flag + formatResult/parseArgs unit tests + ADMIN_GUIDE §11`, 30 Apr 2026 ~12:32 UTC). PR #167 economy alerts thresholds env-driven — `ECONOMY_ALERTS_DEFAULT_STALE_HOURS` / `_MIN_` / `_MAX_` + 22 vitest unit + ADMIN_GUIDE §11.3 + `apps/api/.env.example` doc.

> **Snapshot (session 9n-B merged as PR #166)**: `main` @ `4b5b799` (Merge PR #165 `docs(handoff): session 9n kickoff — audit refresh post-9m close-out`, 30 Apr 2026 ~12:13 UTC). Audit-ledger CLI `--json` flag + 13 vitest unit (parseArgs 4 + formatResult 5 + formatResultJson 4) + ADMIN_GUIDE §11 docs.

> **Snapshot (session 9n kickoff — audit refresh post-9m close-out, merged as PR #165)**: `main` @ `d332a18` (Merge PR #164 `test(api): giftcode-race.test.ts — 5 vitest concurrent economy safety (double-grant prevention)`, 30 Apr 2026 ~11:51 UTC). **Session 9m close-out (5/5 PR merged)**: PR #160 (docs audit refresh kickoff @ `873a0a3`), #161 (docs CHANGELOG catch-up sessions 9g/9h/9i/9j/9l @ `9c1e63a`), #162 (test API topup.service +17 vitest @ `0f56438`), #163 (test API email.service +14 vitest @ `ba17380`), #164 (test API giftcode-race +5 vitest @ `d332a18`). **Zero open PRs** at audit time 30/4 ~12:10 UTC. **Baseline verified local 30/4 ~12:10 UTC trên branch audit refresh**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ · `pnpm --filter @xuantoi/shared test` ✅ **96/96** (6 file) · `pnpm --filter @xuantoi/web test` ✅ **509/509** (54 file) · `pnpm build` ✅ (PWA precache 47 entries / 763.79 KiB). API test chưa chạy local (cần `pnpm infra:up` — Postgres+Redis); CI matrix verify trên PR — session 9m PR #162/#163/#164 đã merge xanh, baseline API tăng từ ~259 lên **+36 test** (topup 17 + email 14 + giftcode-race 5). **Lưu ý**: cần `pnpm --filter @xuantoi/api exec prisma generate` trước khi chạy `pnpm typecheck` local vì `@prisma/client` types sinh ra từ `prisma generate`; thiếu sẽ fail TS2305 ở `apps/api/src/modules/topup/topup.service.ts` + `test-helpers.ts`. CI auto-run vì `prebuild` hook. Cần `pnpm build` (hoặc `pnpm --filter @xuantoi/shared build`) trước khi chạy web test local vì `@xuantoi/shared` export từ `dist/`. **Roadmap session 9n**: tiếp tục backlog post-9m — chọn task an toàn có giá trị cao nhất theo §20.

> **Snapshot (session 9m kickoff — audit refresh)**: `main` @ `f103485` (Merge PR #159 `test(web): UI primitive render tests — ConfirmModal 17 + SkeletonBlock 4 + SkeletonTable 4`, 30 Apr 2026 ~11:00 UTC). **Session 9l close-out (4/4 PR merged)**: PR #156 (audit refresh @ `739b10a`), #157 (docs RELEASE_NOTES + CHANGELOG @ `64d02fd`), #158 (handoff M9 Resolved @ `a1079dc`), #159 (UI primitive tests +25 vitest @ `f103485`). **Zero open PRs**. **Baseline verified local 30/4 ~11:05 UTC**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ · `pnpm --filter @xuantoi/shared test` ✅ **96/96** (6 file) · `pnpm --filter @xuantoi/web test` ✅ **509/509** (54 file — includes PR #159 +25 test) · `pnpm build` ✅ (PWA precache 47 entries / 763.79 KiB). **Lưu ý**: cần `pnpm build` (hoặc `pnpm --filter @xuantoi/shared build`) trước khi chạy web test local vì `@xuantoi/shared` export từ `dist/` — thiếu build sẽ fail 15 test file với "Failed to resolve entry for package @xuantoi/shared". CI không gặp vì CI build trước test. **Roadmap session 9m**: tiếp tục backlog post-9k — chọn task an toàn có giá trị cao nhất.
>
> **Snapshot (session 9k task F — M9 doc merged)**: `main` @ `f1214a3` (Merge PR #150, 30 Apr 2026 ~09:10 UTC).
>
> **Snapshot (session 9k kickoff — PR #149, merged)**: `main` @ `e342513` (Merge PR #148 `test(shared): smart BOSSES catalog integrity tests — 22 vitest (session 9j task O, reward safety)`, 30 Apr 2026 ~08:55 UTC). **Session 9j close-out**: toàn bộ chuỗi task A→O đã merge cascade vào main: **PR #134** (task A — fix C-TSNARROW-RESOLVEFN typecheck red @ `2521672`), **#135** (task B — TopupView + MailView 24 vitest @ `fa8082a`), **#136** (task C — InventoryView 15 vitest merge vào branch #135 stale không vào main, replay qua **#138**), **#137** (task D — ShopView 19 vitest @ `2ed8c29`), **#138** (task E — replay InventoryView vitest lên main @ `6f060fe`), session 9j task I (SectView 12 vitest, merged qua chain trước #139), **#139** (task F — AuthView 14 vitest @ `4c7c87e`), **#140** (task G — OnboardingView 16 vitest @ `6529652`), **#141** (task H — DungeonView 13 vitest @ `3f631db`), **#142** (task I — SectView 12 vitest merged @ `ee68539`), **#143** (task J — NotFoundView + router manifest lockdown 8 vitest @ `e91bbb4`), **#144** (task K — BossView 12 vitest @ `d79bf6c`), **#145** (task L — ChatPanel + LocaleSwitcher 17 vitest @ `62f7ee3`), **#146** (task M / K3.11 — MButton + MToast UI primitive 14 vitest @ `178ec14`), **#147** (task N — shared shop+topup catalog integrity 19 vitest @ `d14ae2c`), **#148** (task O — shared BOSSES catalog integrity 22 vitest @ `e342513`). **Zero open PRs tại thời điểm audit** (30/4 ~09:00 UTC). **Baseline verified local trên branch audit session 9k**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/shared test` ✅ **96/96** (6 file — boss 22 + catalog 17 + proverbs 11 + realms 27 + shop 9 + topup 10) · `pnpm --filter @xuantoi/web test` ✅ **466/466** (50 file) · `pnpm build` ✅ (PWA precache 47 entries / 763.79 KiB). API test chưa chạy (cần `pnpm infra:up` — Postgres+Redis); CI matrix verify trên PR. **Roadmap session 9k**: task A (**this PR** — audit refresh docs-only) → task B (runtime smoke matrix Playwright `E2E_FULL=1` end-to-end — bao gồm admin user export CSV download smoke PR #123 + daily login claim + leaderboard tabs + mission claim + mail read/claim + shop buy + admin revoke inventory smoke) → task C (AdminView render-level vitest — smart tab badge + export button + giftcode revoke confirm modal flow + economy alerts panel) → task D (Docs `docs/PRIVACY.md` + `docs/TOS.md` closed-beta tester agreement) → task E (smart QA helper `pnpm smoke:beta` 5-phút CLI script — register → cultivate tick → claim mission → buy shop → read mail → admin smoke).
>
> **Snapshot (session 9j task A earlier)**: `main` @ `2ed8c29` (Merge PR #137 `test(web): smart ShopView smoke tests — 19 vitest (session 9j task D / K3.3)`, 30 Apr 2026 ~07:54 UTC). **QUAN TRỌNG**: PR #136 (InventoryView test) đã merge nhưng vào branch `devin/1777534094-...` (base branch của PR #135 đã merge rồi) nên **không vào main** — `apps/web/src/views/__tests__/InventoryView.test.ts` hiện KHÔNG có trong main. Session 9j task E **this PR** là replay commit InventoryView (cherry-pick từ `8e40294`) lên main dạng PR mới. Session 9i cascade đã merge toàn bộ: #119..#133 (task A/A2/B/C/D/E/F/G/H/J + Devin Review #127 follow-up #129 + audit refresh #130 + task K1 GiftCodeView tests #131 + task K2 ProfileView tests #132 + task K migration adopt `extractApiErrorCode` #133). **Session 9j task A (#134) đã merge** — fix Critical C-TSNARROW-RESOLVEFN: đổi `let resolveFn: ((v:unknown)=>void)|null` → `resolveHolder: { current }` object-property pattern để tránh vue-tsc narrow-to-never qua Promise executor closure. **In-flight (this PR)**: `test(web): smart TopupView + MailView smoke tests — 24 vitest (session 9j task B / K3)` — TopupView 10 vitest (onMounted routing, packages + history render, buy flow success/error/submitting guard, catalog load error) + MailView 14 vitest (onMounted + clearMailBadge, list render empty/unread badge/rewardBadge/selectHint, select flow readMail gọi khi chưa read/skip khi đã read/silent khi throw, claim flow success + fetchState / error map / claiming guard, list fetch error). Pending merge. **Merged into main since session 9d** (toàn bộ chuỗi 9d→9g task A/B/C/D/E.a/F1 đã vào main): PR #84/#86/#87/#88/#89/#90/#91 (session 9d), **#92** (docs BETA_CHECKLIST refresh — Merged @ `a5821ee`), **#93** (docs handoff session 9e audit refresh — Merged @ `d37b6d4`), **#94** (BE leaderboard topup + sect — Merged @ `fed47a6`), **#95** (ops backup/restore Postgres script + docs — Merged @ session 9e), **#96** (scripts backup/restore reliability — SIGPIPE-safe + pg_terminate_backend — Merged @ `253c4b1`), **#97** (FE mobile responsive AppShell drawer + AdminView tables — Merged @ `ee933ad`), **#98** (docs handoff session 9f audit refresh — Merged @ `4072a3d`), **#99** (FE LeaderboardView tabs Power/Topup/Sect — Merged @ `5a93d22`), **#100** (admin self-demote/self-target prevention — Merged @ `47d34b5`), **#101** (auth forgot/reset-password BE + EmailService — Merged @ `6f3faf4`), **#102** (auth forgot/reset-password FE views stacked — Merged @ `5ca225e` rồi vào main qua PR #101 merge), **#103** (auth forgotPassword timing-fix Devin Review — Merged @ `3c1aa39`), **#104** (docs/CHANGELOG.md bootstrap — Merged @ `c026f37`), **#105** (docs handoff session 9g audit refresh — Merged @ `a907eb1`), **#106** (FE admin inventory revoke UI — Merged @ `7d1965e`), **#107** (FE i18n parity test + breakthroughReady badge — Merged @ `82f2020`), **#108** (docs handoff session 9g task D runtime smoke 9d→9g — Merged @ `0a6c664`), **#109** (FE smart admin economy alerts badge + 60s polling — Merged @ `58fa69d`), **#110** (env fix `SMTP_FROM` quote — Merged @ `4c214eb`), **#111** (docs handoff session 9h audit refresh — Merged @ `43f626e`), **#112** (replay orphan commit `7e27aa9` admin audit-ledger endpoint + UI — Merged @ `f4e67f4`), **#113** (Playwright golden expand daily login + leaderboard tabs gated `E2E_FULL=1` — Merged @ `8cdb93c`), **#114** (smart onboarding expand Leaderboard/Mail visits → 6-step — Merged @ `885e56c`), **#115** (smart admin economy report top 10 whales + circulation — Merged @ `6f18ce6`), **#116** (smart admin users filter expand currency range + realmKey — Merged @ `7b6f927`), **#117** (smart admin recent activity widget Stats tab — Merged @ `0fc1431`), **#118** (smart admin tab badge — pending topup count on Topups tab nav + Devin Review fix re-fetch sau approve/reject — Merged @ `27552a8` session 9h task H).
> **Người viết**: AI engineer session 9j (audit + hotfix 30/4 ~07:20 UTC sau khi phát hiện main `0e9c438` typecheck đỏ — `GiftCodeView.test.ts` introduced bởi PR #131 dùng `let resolveFn: ((v:unknown)=>void) \| null = null` rồi gán trong Promise executor; vue-tsc 2.0+ (TS 5.x) narrow biến capture-by-closure thành `never` tại thời điểm sử dụng, trigger TS2349 "This expression is not callable". Fix: đổi sang `resolveHolder: { current: ((v:unknown)=>void) \| null }` — object property không bị narrow. Session 9j audit này bump snapshot `8a2be4a → 0e9c438`, mark PR #128/#129/#130/#131/#132 Merged, ghi PR #133 Open CI đỏ, thêm C-TSNARROW-RESOLVEFN vào Known Issues §16 Critical, bump baseline web vitest 268 → 302 (32 → 35 file: + GiftCodeView.test 10 + LeaderboardView.test 10 + ProfileView.test 12 = +32 test vs baseline session 9i close).
> **Đối tượng đọc**: AI kế nhiệm sẽ tiếp tục đưa dự án tới beta / production.
>
> Báo cáo trung thực. Mọi tuyên bố "đã xong" đều có PR + file + test chứng minh. Khi chưa verify runtime, ghi rõ **"Needs runtime smoke"**.
>
> **Baseline session 9j task N (đã verify local 30/4 ~08:43 UTC trên branch `devin/1777538522-shared-shop-topup-catalog-tests` base main @ `62f7ee3` post #139..#145 merged)**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · `pnpm --filter @xuantoi/shared test` ✅ **74/74** (5 file — shop.test 9 + topup.test 10 = +19 vs base 55). **K3 chain merged**: #139..#145 (AuthView, OnboardingView, DungeonView, SectView, NotFoundView+router, BossView, ChatPanel+LocaleSwitcher) — tất cả trên main. In-flight: #146 MButton+MToast UI primitives (14, rebased), **this PR** shop+topup catalog integrity (19 shared tests — economy safety). API test: chưa run trong session 9j (cần `pnpm infra:up`); CI matrix sẽ verify trên PR.
>
> **Trạng thái (30/4 session 9i, ~06:35 UTC)**: PR #33..#122 đã merge `main`; session 9i task A (#119 docs audit refresh) + task B (#120 docs/RELEASE_NOTES.md bootstrap) + task C (#121 smart giftcode active badge) + task D (#122 smart UX toast duration policy) đều cascade merged. **Đang Pending merge**: PR #123 (task E admin user export CSV — endpoint + helper + 15 vitest + Export CSV button) và PR #124 (task F HomeView smoke tests — 9 vitest). Toàn bộ Critical/High/Medium đã Resolved trừ M7 (CSP CDN — chỉ verify khi prod deploy), M9 (logout-all `passwordVersion` — intentional trade-off), M10 (shop daily limit — post-beta nice-to-have). Low: tất cả Resolved. Roadmap session 9i tiếp theo: task G (AppShell skeleton tests — RouterLink + 4 store mock pattern) → task H (admin giftcode revoke UI consume PR #61 BE) → task I (beta runtime smoke matrix end-to-end via Playwright).
>
> **Lưu ý**: `pnpm audit:ledger` SCRIPT đã có trong main từ PR #76 (G21, commit `e5ece30` + Devin Review fixes `1fff79a` + `b08c0ad`); 9 vitest test chạy với real Postgres (test helpers `makeUserChar` + `wipeAll`). Endpoint admin `GET /admin/economy/audit-ledger` (commit `7e27aa9`) chưa vào main, là task replay session 9h B.
>
> **Session 9d done (29/4 ~13:00 → 14:55 UTC)**: PR #84 (G23 giftcode duplicate `CODE_EXISTS` error) **Merged into main** @ `05b05c0` — `apps/api/src/modules/giftcode/giftcode.service.ts` + admin controller throw `CODE_EXISTS` khi tạo trùng code, FE map qua i18n. PR #86 (docs handoff session 9d audit refresh) **Merged into main** @ `011e930` — bump snapshot `05b05c0` + L6/L6b/G23 Resolved. PR #87 (L3 proverbs corpus expand 7 → 64 + invariants test) **Merged into main** @ `89e3fb6` — `packages/shared/src/proverbs.ts` 64 câu chia 4 chủ đề + 8 vitest. PR #88 (M6 BE `GET /logs/me`) **Merged into main** @ `c6da89a` — `apps/api/src/modules/logs/{logs.service,logs.controller,logs.module}.ts` + 20 vitest API integration (cursor encode/decode 6 + listForUser currency 11 + listForUser item 3). PR #89 (docs API.md refresh) **Merged into main** @ `537a4d6` — sync endpoints + global prefix `/api` note + WS `mission:progress` + auth route `/_auth/*` fix. PR #90 (docs QA_CHECKLIST + ADMIN_GUIDE refresh) **Merged into main** @ `1cbf349` — add Daily Login (M9), Leaderboard, audit log self-view (M6), WS mission progress, logout-all confirm modal, fix `/api/healthz` path. PR #91 (FE M6 `/activity` tab consumer) **Merged into main** @ `3283e42` — `apps/web/src/views/ActivityView.vue` + `apps/web/src/api/logs.ts` + sidebar link + i18n vi/en + 10 vitest cover skeleton/empty/delta sign/tab switch/load more/error map.
>
> **Session 9f done (29/4 ~17:18 → 18:40 UTC)**: PR #98 (docs handoff audit refresh) **Merged @ `4072a3d`**. PR #99 (FE LeaderboardView tabs Power/Topup/Sect — consume PR #94 BE) **Merged @ `5a93d22`** — `apps/web/src/views/LeaderboardView.vue` + i18n vi/en + 10 vitest. PR #100 (admin self-demote/self-target prevention — FE guards + BE setRole/setBanned vitest) **Merged @ `47d34b5`** — `apps/web/src/lib/adminGuards.ts` (+12 pure vitest), AdminView FE guards, `apps/api/src/modules/admin/admin.service.ts` lock-in vitest +2. PR #101 (auth forgot/reset-password BE + EmailService Mailhog scaffold) **Merged @ `6f3faf4`** — `apps/api/src/modules/auth/{auth.service,auth.controller}.ts` + `apps/api/src/modules/email/email.service.ts` + 11 vitest BE; Devin Review fix r3163113344 áp dụng trước merge (token format `<id>.<secret>` O(1) lookup). PR #102 (FE forgot/reset-password views) **Merged into PR #101 branch @ `5ca225e`** rồi vào main qua PR #101 merge — `apps/web/src/views/{Forgot,Reset}PasswordView.vue` + AuthView "Quên huyền pháp?" link + i18n auth.{forgot,reset}.* + 12 vitest. PR #103 (forgotPassword timing side-channel mitigation — Devin Review post-merge fix r3163261711) **Merged @ `3c1aa39`** — argon2.hash giả ~100ms cho user-not-exist/banned + +1 vitest timing parity. PR #104 (docs/CHANGELOG.md bootstrap — Keep-a-Changelog adapted closed-beta) **Merged @ `c026f37`**.
>
> **Session 9g in-flight (29/4 ~18:50 UTC)**: PR docs này (`audit-session-9g-refresh`) đồng bộ snapshot `c026f37` + chuyển trạng thái PR #104 từ "Pending merge" → "Merged into main" + cập nhật baseline test count (web 133→**161**, 17→**20** file) + close §20 task F + thêm Roadmap session 9g (FE admin inventory revoke UI + smart UX polish + runtime smoke).
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
- **Commit audit (session 9n kickoff)**: `d332a18 Merge pull request #164 from hoathienmenh-01/devin/1777549692-economy-race-tests` (HEAD `main`, 30/4 ~11:51 UTC).
- **CI gần nhất trên main**: xanh — PR #164 ✅; trước đó #160, #161, #162, #163 cũng xanh khi merge.
- **PR open đáng kể (audit time 30/4 ~12:10 UTC)**: **0 PR open** — toàn bộ session 9m (#160..#164) đã merged.
- **Commit audit (trước đó, session 9m kickoff)**: `f103485 Merge pull request #159 from hoathienmenh-01/devin/1777546019-ui-primitive-tests` (HEAD `main`, 30/4 ~11:00 UTC).
- **Commit audit (trước đó, session 9i close)**: `27552a8 Merge pull request #118 from hoathienmenh-01/devin/1777527557-admin-tab-badges` (HEAD `main`, 30/4 ~06:18 UTC).
- **Replay gap PR #47**: **Đã đóng** — PR #53 (cherry-pick `32a33a6` từ `devin/1777398483-h5-vitest-playwright`) merge vào main commit `2ae4cc0` (28/4 20:15 UTC). File `apps/web/vitest.config.ts` + `playwright.config.ts` + `e2e/golden.spec.ts` + `apps/web/src/stores/__tests__/{toast,game}.test.ts` đã có trên main.
- **PR merged gần đây ảnh hưởng lớn**:
  | PR | Chủ đề | Impact |
  |---|---|---|
  | #164 | test(api): giftcode-race.test.ts — 5 vitest concurrent economy safety (session 9m) | Reward safety — chống double-grant qua unique index `[giftCodeId,userId]` + `Promise.allSettled` race; cover maxRedeems=1 (3 user concurrent), maxRedeems=2 (5 user), same-user double-redeem, concurrent items grant, revoke-during-redeem — merge `d332a18` |
  | #163 | test(api): email.service.test.ts — 14 vitest unit (session 9m) | Email infra coverage — mode selection (console/smtp/smtp+auth), sendPasswordResetEmail link generation + URL-encode + expiry minutes copy, SMTP_FROM default + custom — merge `ba17380` |
  | #162 | test(api): topup.service.test.ts — 17 vitest economy safety (session 9m) | Topup createOrder happy/invalid/limit/isolation/uniqueness, listForUser empty/sorted/cap-50, bankInfo, toView normal/fallback, no-currency-side-effect — merge `0f56438` |
  | #161 | docs(changelog): catch-up sessions 9g/9h/9i/9j/9l (session 9m) | Reconstruct missing sections in `docs/CHANGELOG.md` from AI_HANDOFF_REPORT.md — merge `9c1e63a` |
  | #160 | docs(handoff): session 9m kickoff — audit refresh stale §2/§13/§15/§17/§19 + bump snapshot a1079dc | Docs audit refresh kickoff — merge `873a0a3` |
  | #148 | test(shared): BOSSES catalog integrity — 22 vitest (session 9j task O) | Reward safety (boss drops + currency rewards) — merge `e342513` |
  | #147 | test(shared): shop + topup catalog integrity — 19 vitest (session 9j task N) | Economy safety (shop prices + topup packages) — merge `d14ae2c` |
  | #146 | test(web): MButton + MToast UI primitive — 14 vitest (session 9j task M / K3.11) | UI primitive smoke coverage — merge `178ec14` |
  | #145 | test(web): ChatPanel + LocaleSwitcher — 17 vitest (session 9j task L / K3.10) | merge `62f7ee3` |
  | #144 | test(web): BossView — 12 vitest (session 9j task K / K3.9) | merge `d79bf6c` |
  | #143 | test(web): NotFoundView + router manifest lockdown — 8 vitest (session 9j task J) | merge `e91bbb4` |
  | #142 | test(web): SectView — 12 vitest (session 9j task I / K3.7) | merge `ee68539` |
  | #141 | test(web): DungeonView — 13 vitest (session 9j task H / K3.6) | merge `3f631db` |
  | #140 | test(web): OnboardingView — 16 vitest (session 9j task G / K3.5) | merge `6529652` |
  | #139 | test(web): AuthView — 14 vitest (session 9j task F / K3.4) | merge `4c7c87e` |
  | #138 | test(web): replay InventoryView vitest → main — 15 vitest (session 9j task E) | Đóng PR #136 replay gap (merge vào stale PR #135 branch) — merge `6f060fe` |
  | #137 | test(web): ShopView — 19 vitest (session 9j task D / K3.3) | Core economy view coverage — merge `2ed8c29` |
  | ~~#136~~ | ~~test(web): InventoryView — 15 vitest (session 9j task C / K3.2)~~ | **Merged vào branch `devin/1777534094-...` base của PR #135 (đã merge), KHÔNG vào main** — replay qua PR #138. |
  | #135 | test(web): TopupView + MailView — 24 vitest (session 9j task B / K3) | merge `fa8082a` |
  | #134 | fix(web,test): C-TSNARROW-RESOLVEFN typecheck red (session 9j task A) | Fix vue-tsc narrow-to-never Promise executor closure → `resolveHolder: { current }` pattern — merge `2521672` |
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
  | #62..#79 | (Đã liệt kê chi tiết tại header §3 + body Recent Changes) — G8/M11 profile rate-limit, G9 WS mission:progress emitter, G10 Playwright CI matrix, G11 FE MissionView WS handler, G12/L7 admin inventory revoke, G13/G14 skeleton loaders, G15/L2 MARKET_FEE_PCT env, G16 admin user filter, G17/M7 mail unread-count, G18 admin audit filter, G19 admin topup filter, G20 admin giftcode filter, G21 audit:ledger script, L5 MarketView skeleton, audit refresh sessions 7/8/9 | Cascade merged into main, snapshots bump tới `c8123df` rồi `f24fe63` |
  | #80 | feat(api,web): M9 Smart gameplay — Daily login reward (model `DailyLoginClaim`, BE `DailyLoginService` + endpoints `GET/POST /daily-login/{me,claim}` + ledger reason `DAILY_LOGIN`, FE `DailyLoginCard` + i18n VI/EN + NextAction `DAILY_LOGIN_AVAILABLE`) | +12 vitest API + +4 vitest web — merge `ec37f10` (29/4 ~10:25 UTC) — **Done / Needs runtime smoke** |
  | #81 | feat(web): G22 — admin giftcode FE panel (consumer cho `GET/POST /admin/giftcodes` + `POST /admin/giftcodes/:code/revoke`) — tab `Giftcode` trong `AdminView` với filter q+status, list table, create form (LT/TN/EXP/maxRedeems/expiresInDays), revoke action, helper `giftCodeStatusOf()` mirror BE | +11 vitest web (admin.giftcodes API) — merge `c4f3468` (29/4 ~10:31 UTC) |
  | #82 | test(web): L5 — MissionView claim flow vitest (claim button enable/disable, claimed badge, click happy path, error handler, WS `mission:progress` apply, sort, tab filter, empty state) | +9 vitest web — merge `45e42dc` (29/4 ~12:30 UTC) |
  | #83 | feat(web): L6 — logout-all ConfirmModal — `apps/web/src/components/ui/ConfirmModal.vue` reusable (Teleport + danger styling + loading lock + Escape/backdrop cancel) + `SettingsView.submitLogoutAll` mở modal thay `window.confirm()` | +13 vitest ConfirmModal — merge `78261eb` (29/4 ~12:45 UTC) — sau lint default-prop fix `ca85265` |
  | #85 | test(web): L6b — SettingsView logout-all confirm modal integration — `apps/web/src/views/__tests__/SettingsView.test.ts` mount full SettingsView verify modal wired đúng (open trên click, confirm gọi `logoutAll`, navigate `/auth`, error map qua i18n, Escape đóng modal) | +7 vitest web — merge `bbb6718` (29/4 ~13:02 UTC) |

- Các branch `devin/*` feature đã merge vẫn còn tồn tại ở origin — có thể xoá sau khi smoke test, không cần gấp. **Lưu ý**: branch `devin/1777398022-audit-pr-45-blueprint-docs` vẫn chứa commit `4ed913a` (Merge PR #47) chưa vào main — nguồn để cherry-pick/replay.

---

## Recent Changes (PR #33→#166 đã merged trên main; session 9n-C **this PR** smart admin economy alerts thresholds env-tunable)

### PR session 9n-C (in-flight, this PR) — `feat(api,docs): smart admin economy alerts thresholds — ECONOMY_ALERTS_DEFAULT_STALE_HOURS / _MIN_ / _MAX_ env override + 22 vitest unit + ADMIN_GUIDE §11.3 + .env.example` — **Pending merge**

- **Branch**: `devin/1777552393-economy-alerts-env-thresholds`. **Base**: `main` @ `0b1b6da` (post PR #166 merge).
- **Vì sao**: `GET /admin/economy/alerts?staleHours=N` trước đây hard-code default `24` giờ + range `[1..720]` trong controller. Ops soft-launch closed beta có thể muốn 48h default (topup pending tolerance longer) hoặc audit dài 90 ngày (2160h max) mà không cần patch code. PR này tách parsing sang pure helper + inject qua ConfigService để đọc env override.
- **Files**:
  - `apps/api/src/modules/admin/economy-alerts-config.ts` — **new** pure helper module: `parseEnvHours`, `resolveEconomyAlertsBounds`, `clampStaleHours`, `EconomyAlertsBounds` type, `DEFAULT_ECONOMY_ALERTS_BOUNDS`. Invariant-safe clamp (`max >= min`, `default ∈ [min, max]`). Invalid env log warn thay vì brick.
  - `apps/api/src/modules/admin/economy-alerts-config.test.ts` — **new** 22 vitest unit (parseEnvHours 6 + resolveEconomyAlertsBounds 9 + clampStaleHours 7). No DB.
  - `apps/api/src/modules/admin/admin.controller.ts` — inject `ConfigService` + `Logger`; `economyAlertsBounds` resolved once trong constructor; `@Get('economy/alerts')` dùng `clampStaleHours()`; response thêm `data.bounds` (additive field).
  - `apps/web/src/api/admin.ts` — `AdminEconomyAlerts` thêm `bounds?: { defaultHours, minHours, maxHours }` optional (backward compat với BE cũ).
  - `apps/api/.env.example` — thêm 3 env var commented-out.
  - `docs/ADMIN_GUIDE.md` — thêm §11.3 Economy alerts — ops-tunable thresholds (bảng env + ví dụ soft-launch 48h/90d).
  - `docs/AI_HANDOFF_REPORT.md` — Recent Changes (this entry) + §20 Roadmap + §21 PR Plan.
- **Tests added**: 22 vitest unit (`economy-alerts-config.test.ts`).
- **CI status (local 30/4 ~12:40 UTC)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ · `pnpm --filter @xuantoi/api exec vitest run src/modules/admin/economy-alerts-config.test.ts` ✅ **22/22** (no DB) · `pnpm --filter @xuantoi/shared test` ✅ 96/96 · `pnpm --filter @xuantoi/web test` ✅ 509/509.
- **Risk**: 🟢 thấp — controller behavior preserved cho query `staleHours` nằm trong range; default behavior không thay đổi khi env absent; new field `data.bounds` là additive (FE types đã optional).
- **Rollback**: revert single PR — restore old controller parsing inline + xoá `economy-alerts-config.ts` / `.test.ts` + revert ADMIN_GUIDE §11.3 + revert `.env.example`.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes + §20 Roadmap + §21 Exact PR Plan.

### PR #166 — `feat(api,docs): smart audit-ledger CLI — --json flag + formatResult/parseArgs unit tests + ADMIN_GUIDE §11` — **Merged into main** @ `0b1b6da` (30/4 ~12:32 UTC, CI ✅ 5/5) — **Resolved**

- **Branch**: `devin/1777551718-audit-ledger-cli-json`. **Base**: `main` @ `4b5b799` (post PR #165 merge).
- **Files**: `apps/api/scripts/audit-ledger.ts` (refactor + `--json` + exports); `apps/api/scripts/audit-ledger-format.test.ts` (new, 13 vitest); `docs/ADMIN_GUIDE.md` (+§11); `docs/AI_HANDOFF_REPORT.md`. +380/-26 LOC.
- **Risk**: 🟢 (additive). CI ✅ 5/5.

### PR session 9n-B (legacy in-flight pointer — see PR #166 above) — **Merged**

- **Branch**: `devin/1777551718-audit-ledger-cli-json`. **Base**: `main` @ `4b5b799` (post PR #165 merge).
- **Vì sao**: `pnpm --filter @xuantoi/api audit:ledger` (PR #76 + PR #112 endpoint) đã có nhưng chỉ in human-readable text → khó parse cho cron/CI/monitoring pipeline. PR này thêm `--json` flag để emit machine-parseable output (giữ exit code semantics: 0 clean / 1 discrepancy / 2 error). Đồng thời export `parseArgs`/`formatResult`/`formatResultJson` để có thể unit test pure functions không cần Postgres (fast feedback). Bonus: docs `ADMIN_GUIDE §11` ghi cách dùng CLI cho devops + ví dụ cron job + caveat về BigInt → string serialize.
- **Files**:
  - `apps/api/scripts/audit-ledger.ts` — refactor: export `parseArgs`/`formatResult`/`formatResultJson`; add `formatResultJson()` BigInt-safe (serialize `bigint` → `string`); thêm `--json` branch trong `main()`; doc comment exit codes.
  - `apps/api/scripts/audit-ledger-format.test.ts` — **new** 13 vitest unit (parseArgs 4 + formatResult 5 + formatResultJson 4), không cần DB.
  - `docs/ADMIN_GUIDE.md` — thêm §11 (renumber §11→§12 reset env, §12→§13 liên kết).
  - `docs/AI_HANDOFF_REPORT.md` — Recent Changes (this entry) + §12 Tests + §16 Known Issues (no change) + §20 Roadmap (close 9n-B promote 9n-C).
- **Tests added**: 13 vitest unit (`audit-ledger-format.test.ts`).
- **CI status (local 30/4 ~12:25 UTC)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/api exec vitest run scripts/audit-ledger-format.test.ts` ✅ **13/13** (unit, no DB) · existing `audit-ledger.test.ts` (10 vitest needs DB) — không thay đổi behavior, chỉ refactor export. CI matrix sẽ run full API test với Postgres.
- **Risk**: 🟢 thấp — `formatResult()` behavior preserved exactly (only exported); new `formatResultJson()` + `parseArgs()` are additive; CLI default behavior unchanged; no DB schema change.
- **Rollback**: revert single PR — restore old `audit-ledger.ts` (formatResult inline private) + xoá `audit-ledger-format.test.ts` + revert ADMIN_GUIDE §11.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes + §20 Roadmap (close 9n-B promote 9n-C).

### PR #165 — `docs(handoff): session 9n kickoff — audit refresh post-9m close-out (bump snapshot f103485 → d332a18 + mark PR #160..#164 Merged)` — **Merged into main** @ `4b5b799` (30/4 ~12:13 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777551102-audit-refresh-9m-close-out`. **Base**: `main` @ `d332a18` (post PR #164 merge).
- Bump top snapshot `f103485 → d332a18`, §2 commit audit + PR table thêm 5 hàng #160..#164, §12 Tổng baseline session 9n, §20 Roadmap Immediate (close 9m close-out 5/5 done; promote 10 backlog items post-9m), §21 Exact PR Plan (mark 9m table done, add 9n-A entry).
- **Files**: `docs/AI_HANDOFF_REPORT.md` only (+120/-35). **Tests added**: 0 (docs-only). CI ✅ 5/5 (build x2, e2e-smoke x2, Devin Review).
- **Risk**: 🟢 (docs-only). **Rollback**: revert single PR.

### PR session 9n kickoff (legacy in-flight pointer — see PR #165 above) — **Merged**

- **Branch**: `devin/1777551102-audit-refresh-9m-close-out`. **Base**: `main` @ `d332a18` (post PR #164 merge). **Status**: docs-only, in-flight.
- **Vì sao**: snapshot block cũ ghi `main @ f103485` (PR #159) nhưng PRs #160..#164 đã merged sau đó. §2 commit audit + recent changes table + Roadmap Immediate đều stale. AI sau đọc report sẽ nhầm trạng thái close-out session 9m. PR này:
  1. Bump top snapshot `f103485 → d332a18` + ghi rõ session 9m close-out 5/5 PR merged (ngày giờ + commit hash + tiêu đề).
  2. §2 Current Branch / CI / PR Status: bump commit audit `f103485 → d332a18`, di chuyển f103485 xuống "trước đó".
  3. §2 PR merged table: thêm 5 hàng PR #160..#164 với impact summary + commit hash.
  4. §3 Recent Changes: tiêu đề bump `#149 → #164`; thêm entry chi tiết cho PR #160..#164 (branch, status, files, tests, CI status).
  5. §12 Tests: cập nhật "Tổng" line baseline với count API +36 (topup 17 + email 14 + giftcode-race 5).
  6. §20 Roadmap Immediate: đóng session 9m close-out (5/5 done); promote backlog post-9m sang Immediate session 9n.
  7. §21 Exact PR Plan: mark PR #160..#164 Done; promote next priority task.
- **Files**: `docs/AI_HANDOFF_REPORT.md` only.
- **Tests added**: 0 (docs-only).
- **CI status (local audit 30/4 ~12:10 UTC, trên branch này base `d332a18`)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/shared test` ✅ **96/96** (6 file) · `pnpm --filter @xuantoi/web test` ✅ **509/509** (54 file) · `pnpm build` ✅ (PWA precache 47 entries / 763.79 KiB). API test cần `pnpm infra:up` local; CI matrix sẽ verify.
- **Risk**: 🟢 thấp (docs-only, không touch code, schema, seed, migration, config).
- **Rollback**: revert single PR (xóa edit duy nhất docs/AI_HANDOFF_REPORT.md).
- **`AI_HANDOFF_REPORT.md updated`**: header §0 snapshot + §2 commit audit/CI/PR table + Recent Changes (this entry + 5 entry mới cho #160..#164) + §12 Tests "Tổng" + §20 Roadmap Immediate + §21 Exact PR Plan.

### PR #164 — `test(api): giftcode-race.test.ts — 5 vitest concurrent economy safety (double-grant prevention)` — **Merged into main** @ `d332a18` (30/4 ~11:51 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777549692-economy-race-tests`. **Base**: `main` @ `ba17380` (post PR #163 merge).
- Chống double-grant qua unique index `[giftCodeId, userId]` + `Promise.allSettled` race testing. Cover: (1) `maxRedeems=1` 3-user concurrent (chỉ 1 succeed, 2 fail `OUT_OF_USES`), (2) `maxRedeems=2` 5-user concurrent (đúng 2 succeed), (3) same-user 2 lần concurrent (1 succeed, 1 `ALREADY_REDEEMED`), (4) concurrent items grant không double-credit inventory, (5) revoke-during-redeem consistency (revoke phải block các redeem chưa commit).
- **Files**: `apps/api/src/modules/giftcode/giftcode-race.test.ts` (new). **Tests added**: 5 vitest API. CI ✅
- **Risk**: 🟢 (test-only). **Rollback**: revert single PR.

### PR #163 — `test(api): email.service.test.ts — 14 vitest unit (mode selection/send console/sendPasswordResetEmail link generation/SMTP_FROM)` — **Merged into main** @ `ba17380` (30/4 ~11:40 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777549062-email-service-tests`. **Base**: `main` @ `0f56438` (post PR #162 merge).
- Email infra coverage: mode selection (4: console default/explicit/smtp/smtp+auth), send console (2: log verify/text-only), `sendPasswordResetEmail` (6: default URL/custom URL/URL-encode/subject 'Xuân Tôi'/expiry minutes/min-1-phút), SMTP_FROM (2: default/custom).
- **Files**: `apps/api/src/modules/email/email.service.test.ts` (new). **Tests added**: 14 vitest API. CI ✅ (Devin Review fix: thêm subject assertion 'Xuân Tôi').
- **Risk**: 🟢 (test-only, no DB needed). **Rollback**: revert single PR.

### PR #162 — `test(api): topup.service.test.ts — 17 vitest economy safety (createOrder/listForUser/bankInfo/toView/no-currency-side-effect)` — **Merged into main** @ `0f56438` (30/4 ~11:32 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777548417-topup-service-tests`. **Base**: `main` @ `9c1e63a` (post PR #161 merge).
- Economy safety: `createOrder` happy/invalid/limit (`MAX_PENDING_PER_USER=5`)/isolation/uniqueness/persistence/slot-free, `listForUser` empty/sorted/isolation/cap-50, `bankInfo`, `toView` normal/fallback, no-currency-side-effect (createOrder không grant currency trước khi admin approve).
- **Files**: `apps/api/src/modules/topup/topup.service.test.ts` (new). **Tests added**: 17 vitest API. CI ✅ (Devin Review fix: dùng fresh user per package để tránh `MAX_PENDING_PER_USER=5` limit).
- **Risk**: 🟢 (test-only). **Rollback**: revert single PR.

### PR #161 — `docs(changelog): catch-up sessions 9g/9h/9i/9j/9l — fill 5 missing sections trong docs/CHANGELOG.md (session 9m)` — **Merged into main** @ `9c1e63a` (30/4 ~11:23 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777547964-changelog-catchup-9g-9j`. **Base**: `main` @ `873a0a3` (post PR #160 merge).
- Reconstruct CHANGELOG sections cho session 9g/9h/9i/9j/9l từ AI_HANDOFF_REPORT.md. CHANGELOG trước đó chỉ có sections 9d→9f. PR fill gap để dev/AI sau có thể đọc CHANGELOG độc lập.
- **Files**: `docs/CHANGELOG.md` (+5 section). **Tests added**: 0 (docs-only). CI ✅
- **Risk**: 🟢 (docs-only). **Rollback**: revert single PR.

### PR #160 — `docs(handoff): session 9m kickoff — audit refresh fix stale §2/§13/§15/§17/§19 + bump snapshot a1079dc` — **Merged into main** @ `873a0a3` (30/4 ~11:10 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777547236-audit-refresh-session-9m`. **Base**: `main` @ `f103485` (post PR #159 merge).
- Session 9m kickoff audit refresh: bump snapshot `2e54a1e → f103485 → a1079dc` (intermediate), fix §2 commit audit cũ (`27552a8` → `f103485`), §13 Seed Data, §15 Docs (mark CHANGELOG/RELEASE_NOTES updated), §17 Missing forgot-password Resolved (PR #101..#103 đã merged), §19 self-demote Resolved.
- **Files**: `docs/AI_HANDOFF_REPORT.md` only. **Tests added**: 0 (docs-only). CI ✅
- **Risk**: 🟢 (docs-only). **Rollback**: revert single PR.

### PR session 9k task C (in-flight, this PR) — `test(web): smart AdminView render-level smoke tests — 18 vitest (session 9k task C / admin ops safety)` — **Pending merge**

- **Branch**: `devin/1777541055-adminview-render-tests`. **Base**: `main` @ `5a815b3` (post PR #149 merge). **Status**: code + test, in-flight.
- **Vì sao**: AdminView (1695 dòng, component admin lớn nhất repo) chưa có render-level vitest — gap nằm trong §12 Tests "Render-level cho AdminView revoke modal flow". Helpers liên quan (`adminAlerts.test.ts`, `adminGuards.test.ts`, `adminGiftcodeApi.test.ts`, `adminInventoryRevoke.test.ts`) đã có unit test nhưng chưa wire lên view. PR này cover:
  1. **onMounted role guard** (4 test): unauth → `router.replace('/auth')` + không gọi admin API; PLAYER (không phải ADMIN/MOD) → toast error `admin.noPermission` + `router.replace('/home')`; ADMIN pass → `adminStats` + `adminEconomyAlerts` + `adminListTopups('PENDING', 0)` đều gọi; MOD cũng pass guard.
  2. **Tab badge rendering** (4 test): `alertsCount > 0` render `data-testid="admin-tab-stats-alerts-badge"` với số cảnh báo (tổng 3 loại negativeCurrency + negativeInventory + stalePendingTopups); `alertsCount = 0` → no badge; `pendingTopupCount > 0` render `admin-tab-topups-pending-badge`; `activeGiftcodeCount > 0` render `admin-tab-giftcodes-active-badge` qua `giftCodeStatusOf` ACTIVE filter (skip REVOKED row).
  3. **Tab switch fetch** (2 test): click Users tab → `adminListUsers` gọi; click Audit tab → `adminListAudit` gọi. Verify watcher `watch(tab)` fire correct refresh function.
  4. **Export CSV flow** (3 test): click `admin-users-export-csv-btn` → `adminExportUsersCsv` + toast success `admin.users.exportedToast { rows }`; truncated=true → toast warning `exportTruncatedToast { exported, total }`; error code `UNAUTHENTICATED` → toast error i18n `admin.errors.UNAUTHENTICATED`. Stub `URL.createObjectURL` + `URL.revokeObjectURL` vì jsdom không có.
  5. **Giftcode revoke ConfirmModal wiring** (5 test): click `admin-giftcode-revoke-{code}` → ConfirmModal (Teleport to body) open với title chứa code + impact preview text; cancel → modal close không gọi API; confirm → `adminRevokeGiftcode(code)` + toast success `admin.giftcodes.revokedToast` + modal close + `refreshGiftcodes` reload; confirm lỗi `CODE_REVOKED` → toast error i18n `admin.errors.CODE_REVOKED` (không dùng handleErr UNKNOWN fallback — đúng branching logic `confirmGiftcodeRevoke`); mã REVOKED + EXPIRED không render nút revoke (filter qua `giftCodeStatusOf`).
- **Files**: `apps/web/src/views/__tests__/AdminView.test.ts` (new, 18 vitest, 750ms run).
- **Tests added**: 18 vitest. Baseline web: `466 → 484` test (50 → 51 file).
- **CI status (local audit 30/4 ~09:30 UTC, trên branch này base `5a815b3`)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/shared test` ✅ **96/96** (6 file) · `pnpm --filter @xuantoi/web test` ✅ **484/484** (51 file — +AdminView.test.ts 18 test) · `pnpm build` ✅ (PWA precache 47 entries / 763.79 KiB). API test chưa chạy local (cần infra); CI matrix sẽ verify.
- **Risk**: 🟢 thấp (render-level test-only, mock toàn bộ `@/api/admin` + `@/api/boss` + stores + vue-router + AppShell; không touch production code, schema, seed, migration).
- **Rollback**: revert single PR (xóa file test duy nhất).
- **`AI_HANDOFF_REPORT.md updated`**: header §0 snapshot + session 9k task C entry (this PR); Recent Changes (this entry); §12 Tests baseline web `466 → 484` (50 → 51 file); §20 Roadmap (đóng task C session 9k, promote task B/D/E); §21 Exact PR Plan (mark task C in-flight, task A Merged PR #149).

### PR #149 — `docs(handoff): session 9k kickoff — bump snapshot to e342513 (post #148) + mark PR #134..#148 all Merged + sync baseline web vitest 466/466 (50 file) + shared 96/96 (6 file) + session 9k roadmap` — **Merged into main** @ `5a815b3` (30/4 ~09:00 UTC, CI ✅ 5/5) — **Resolved**

- **Branch**: `devin/1777540074-audit-session-9j-refresh-e342513`. **Base**: `main` @ `e342513` (post PR #148 merge). **Status**: docs-only, merged.
- **Vì sao**: Header report trước đó (snapshot `2ed8c29` PR #137) lệch 11 PR vì session 9j task E..O đã merge cascade trong khi report vẫn ghi PR #136 "Pending merge stacked" và baseline web vitest 302/35 file. Audit này: (1) bump snapshot → `e342513`; (2) chuyển PR #136 sang **Merged vào branch stale KHÔNG vào main** (replay PR #138 đã vào main); (3) mark PR #134..#148 tất cả Merged với merge commit SHA; (4) cập nhật baseline web vitest **302→466** (35→50 file) + shared **55→96** (3→6 file, +41 test từ PR #147+#148); (5) cập nhật §12 Tests; (6) cập nhật §20 Roadmap (đóng session 9j, mở session 9k A→E: audit docs / runtime smoke Playwright / AdminView render test / PRIVACY+TOS docs / pnpm smoke:beta script); (7) cập nhật §21 Exact PR Plan (mark PR #134..#148 Done, thêm session 9k pending list).
- **Files**: `docs/AI_HANDOFF_REPORT.md` (header §0/§2/Recent Changes/§12 baseline/§20 roadmap/§21 PR Plan).
- **Tests added**: 0 (docs-only).
- **CI status (local audit 30/4 ~09:00 UTC, trên branch này base `e342513`)**: `pnpm typecheck` ✅ (3 project: shared/api/web) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/shared test` ✅ **96/96** (6 file) · `pnpm --filter @xuantoi/web test` ✅ **466/466** (50 file) · `pnpm build` ✅ (PWA precache 47 entries / 763.79 KiB). API test chưa chạy local (cần `pnpm infra:up` Postgres+Redis); CI matrix sẽ verify.
- **Risk**: 0 (docs-only). Không touch code/schema/test/migration.
- **Rollback**: revert single PR.
- **`AI_HANDOFF_REPORT.md updated`**: header §0 snapshot + session 9k kickoff + session 9j close-out summary; §2 commit audit + zero-open-PR note; §2 "PR merged gần đây" bảng thêm 15 row cho PR #134..#148; §12 Tests baseline; §20 Roadmap (đóng 9j, mở 9k A→E); §21 Exact PR Plan.

### PR #148 — `test(shared): smart BOSSES catalog integrity tests — 22 vitest (session 9j task O, reward safety)` — **Merged into main** @ `e342513` (30/4 ~08:55 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777538719-shared-boss-catalog-tests`. **Merge commit**: `e342513`. **Status**: Merged. **Impact**: reward safety — BOSSES catalog có 22 vitest guard để chặn reward/drop/currency regression khi thêm boss mới hoặc đổi reward bảng.

### PR #147 — `test(shared): smart shop + topup catalog integrity tests — 19 vitest (session 9j task N, economy safety)` — **Merged into main** @ `d14ae2c` (30/4 ~08:48 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777538522-shared-shop-topup-catalog-tests`. **Merge commit**: `d14ae2c`. **Impact**: economy safety — shop 9 test + topup 10 test chặn giá/mua/catalog regression.

### PR #146 — `test(web): smart MButton + MToast UI primitive smoke tests — 14 vitest (session 9j task M / K3.11)` — **Merged into main** @ `178ec14` (30/4 ~08:46 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777538233-k3-11-ui-primitive-tests`. **Merge commit**: `178ec14`. **Impact**: UI primitive — MButton 7 test + MToast 7 test.

### PR #145 — `test(web): smart ChatPanel + LocaleSwitcher smoke tests — 17 vitest (session 9j task L / K3.10)` — **Merged into main** @ `62f7ee3` (30/4 ~08:40 UTC, CI ✅) — **Resolved**

### PR #144 — `test(web): smart BossView smoke tests — 12 vitest (session 9j task K / K3.9)` — **Merged into main** @ `d79bf6c` (30/4 ~08:40 UTC, CI ✅) — **Resolved**

### PR #143 — `test(web): NotFoundView smoke + router route manifest lockdown — 8 vitest (session 9j task J)` — **Merged into main** @ `e91bbb4` (30/4 ~08:38 UTC, CI ✅) — **Resolved**

### PR #142 — `test(web): smart SectView smoke tests — 12 vitest (session 9j task I / K3.7)` — **Merged into main** @ `ee68539` (30/4 ~08:33 UTC, CI ✅) — **Resolved**

### PR #141 — `test(web): smart DungeonView smoke tests — 13 vitest (session 9j task H / K3.6)` — **Merged into main** @ `3f631db` (30/4 ~08:33 UTC, CI ✅) — **Resolved**

### PR #140 — `test(web): smart OnboardingView smoke tests — 16 vitest (session 9j task G / K3.5)` — **Merged into main** @ `6529652` (30/4 ~08:32 UTC, CI ✅) — **Resolved**

### PR #139 — `test(web): smart AuthView smoke tests — 14 vitest (session 9j task F / K3.4)` — **Merged into main** @ `4c7c87e` (30/4 ~08:32 UTC, CI ✅) — **Resolved**

### PR #138 — `test(web): replay InventoryView smoke tests to main — 15 vitest (session 9j task E)` — **Merged into main** @ `6f060fe` (30/4 ~08:18 UTC, CI ✅) — **Resolved**

- Đóng replay gap PR #136 (merged vào branch `devin/1777534094-...` — stale PR #135 base — KHÔNG vào main).

### PR session 9j task D (session 9j) — `test(web): smart ShopView smoke tests — 19 vitest (session 9j task D / K3.3)` — **Merged into main** @ `2ed8c29` (30/4 ~07:57 UTC, CI ✅) — **Resolved**

- **Branch**: `devin/1777535142-k3-3-shop-view-tests`. **Base**: `main` @ `fa8082a` (post PR #135 merge).
- **Vì sao**: ShopView là core economy view — buyFromShop đụng **cả CurrencyLedger + ItemLedger** (trừ linhThach/tienNgoc, cộng item vào inventory). Trước đó view này **không có vitest coverage** — `submittingKey` guard chống double-click purchase chưa được test, qty clamp 1..99 chưa được test, canAfford dual-currency (LINH_THACH + TIEN_NGOC) chưa được test. Thêm 19 test bảo vệ.
- **Changes**:
  1. **`apps/web/src/views/__tests__/ShopView.test.ts`** (NEW, +395 line, **19 vitest**): 2 onMounted routing (unauth redirect · auth → fetchState + bindSocket + listNpcShop) · 4 render (loading state · empty state · balance + name + totalPrice · non-stackable hiện `nonStackable` label, ẩn input qty) · 4 canAfford gating (đủ linhThach enabled · thiếu linhThach disabled · đủ tienNgoc enabled · thiếu tienNgoc disabled) · 3 qty clamping (qty=0 → 1 · qty=500 → 99 · totalPrice = price × qty) · 5 buy flow (success: buyFromShop + toast i18n-param + fetchState · non-stackable: buyFromShop qty=1 bất kể state · error NOT_ENOUGH_BALANCE map `shop.errors.NOT_ENOUGH_BALANCE` · error code lạ fallback UNKNOWN · submittingKey guard click lần 2 → `buyFromShop` chỉ 1 call) · 1 list fetch error (listNpcShop throw → toast `shop.errors.loadFail` + empty state).
- **Pattern**: mock `@/api/shop` qua `vi.importActual` spread (preserve `ShopEntry` / `ShopBuyResult` type). Mutable `gameState.character` trước mỗi test để set linhThach/tienNgoc. Submitting guard test dùng `resolveHolder: { current }` pattern (C-TSNARROW-RESOLVEFN-safe).
- **Tests**: `pnpm typecheck` ✅ · `pnpm lint` ✅ · shared 55/55 · web **345/345** (38 file — ShopView.test 19/19 + không regression) · build ✅ (Vite + PWA).
- **Risk**: 🟢 thấp — test-only, không touch production code. Rollback: revert PR.
- **Follow-up**: K3 chain đã cover TopupView + MailView + InventoryView + ShopView (economy core). Còn: AuthView / BossView / DungeonView / SectView / OnboardingView / AdminView chưa có vitest. Tiếp theo: **AuthView** (login/register entry point — high value cho smoke) hoặc **admin smart feature** / runtime smoke Playwright.

### PR #136 — `test(web): smart InventoryView smoke tests — 15 vitest (session 9j task C / K3.2)` — **Merged vào branch `devin/1777534094-...` stale (base của PR #135 đã merge rồi) → KHÔNG vào main**. Replay **Resolved by PR #138** (Merged into main @ `6f060fe`, 30/4 ~08:18 UTC)

- **Branch**: `devin/1777534748-k3-2-inventory-view-tests`. **Base ban đầu**: PR #135 branch. Sau khi PR #135 merge vào main thì PR #136 auto-retarget NHƯNG GitHub đã merge vào branch gốc trước khi detect retarget → commit `8e40294` chỉ ở branch stale, không vào main.
- **Replay**: PR #138 cherry-pick `8e40294` lên main qua commit `a50543f` (merge `6f060fe`) — `apps/web/src/views/__tests__/InventoryView.test.ts` nay đã có trong main.
- **Risk còn lại**: 0 — gap đã đóng.

### PR #135 — `test(web): smart TopupView + MailView smoke tests — 24 vitest (session 9j task B / K3)` — **Merged into main** @ `fa8082a` (30/4 ~07:45 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777534094-k3-view-tests-topup-mail-inventory-settings`. **Base**: `main` @ `2521672` (post PR #134 merge).
- **Vì sao**: TopupView + MailView là 2 view nạp tiền + hệ thống thư — core flow nhưng trước đó **không có vitest coverage**. Rủi ro regression: (a) double-click buy → duplicate order (economy safety), (b) readMail fail → block render thư đã chọn, (c) handleErr map thiếu fallback. Thêm 24 test giúp CI chặn regression khi refactor API client, rename i18n key, hoặc đổi error code.
- **Changes**:
  1. **`apps/web/src/views/__tests__/TopupView.test.ts`** (NEW, +362 line, **10 vitest**): 2 onMounted routing (unauth → `/auth` + không gọi API · có auth → fetchState + bindSocket + parallel fetch catalog + getMyTopups) · 3 render (package name/price/HOT badge · empty state history · 3 status pill PENDING/APPROVED/REJECTED) · 4 buy flow (success: toast + prepend order + lastOrder section · error map PACKAGE_NOT_FOUND → `topup.errors.PACKAGE_NOT_FOUND` · error code lạ → fallback UNKNOWN · submitting guard: click lần 2 trong khi pending không re-fire API) · 1 catalog load error (handleErr UNKNOWN, header vẫn render).
  2. **`apps/web/src/views/__tests__/MailView.test.ts`** (NEW, +368 line, **14 vitest**): 2 onMounted routing (unauth redirect · có auth: fetchState + bindSocket + `clearMailBadge` + listMail) · 4 list render (empty state · unread count badge · rewardBadge cho claimable · selectHint khi chưa chọn) · 3 select flow (click mail chưa đọc → readMail gọi + cập nhật readAt · click mail đã đọc → readMail không gọi · readMail throw → silent, vẫn render body) · 4 claim flow (success: claimMail + toast + fetchState + badge "Đã nhận" · error ALREADY_CLAIMED → map `mail.errors.ALREADY_CLAIMED` · error code lạ → fallback UNKNOWN · claiming guard: click lần 2 khi pending không re-fire API) · 1 listMail fetch error (toast UNKNOWN).
- **Pattern**: mock `@/api/topup` + `@/api/mail` qua `vi.importActual` spread (preserve `TopupOrderView` / `MailView` type export), mock 3 store (auth/game/toast) + `vue-router` + stub `AppShell`. Cho MailView: mock `@/lib/onboardingVisits` (markVisited) để bỏ qua smart onboarding side-effect.
- **Tests**: `pnpm typecheck` ✅ (3 project, 0 error) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/shared test` ✅ **55/55** · `pnpm --filter @xuantoi/web test` ✅ **326/326** (37 file — TopupView.test 10/10 + MailView.test 14/14 pass) · `pnpm --filter @xuantoi/web build` ✅ (Vite 5.21s + PWA 47 entries 763.47 KiB).
- **Risk**: 🟢 thấp — test-only, không touch production code. Rollback: revert PR.
- **Follow-up**: K3 phần còn lại: InventoryView (equip/unequip/useItem, dùng EquipSlot shared catalog) + polish test cho SettingsView (đã có test, có thể mở rộng). Sau đó: session 9i task I — beta runtime smoke matrix end-to-end Playwright.

### PR #134 — `fix(web,test): resolve main typecheck red — GiftCodeView.test.ts resolveFn narrow-to-never (C-TSNARROW-RESOLVEFN) + session 9j audit refresh` — **Merged into main** @ `2521672` (30/4 ~07:29 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777533603-fix-main-typecheck-giftcode-resolvefn`. **Base**: `main` @ `0e9c438` (post PR #132 merge).
- **Root cause**: audit session 9j phát hiện main `0e9c438` typecheck **đỏ** — `apps/web/src/views/__tests__/GiftCodeView.test.ts:273` báo `TS2349: This expression is not callable. Type 'never' has no call signatures.` Pattern từ PR #131 `let resolveFn: ((v:unknown)=>void) | null = null` + gán trong Promise executor → vue-tsc 2.0+ narrow `let` capture-by-closure thành `never` qua async boundary. Cùng regression đã làm PR #133 CI đỏ (job_id `73726162152`).
- **Fix**: đổi sang ref-holder pattern `const resolveHolder: { current: ((v:unknown)=>void) | null } = { current: null }` — object property không bị narrow qua closure mutation.
- **Docs**: audit refresh: snapshot `8a2be4a → 0e9c438 → 2521672` (post-merge), thêm C-TSNARROW-RESOLVEFN vào §16 Known Issues Critical (Resolved), bump baseline web vitest 268 → 302.
- **Tests**: typecheck ✅ · lint ✅ · shared 55/55 · web 302/302 · build ✅.
- **Risk**: 🟢 thấp — sửa 1 test function, không touch production code.
- **Impact sau merge**: main typecheck xanh trở lại → PR #133 CI unblock → PR #133 merge ngay sau đó.

### PR #133 — `refactor(web): adopt extractApiErrorCode helper across 18 views/components — DRY error code extraction (session 9i task K migration)` — **Merged into main** @ `23fffa3` (30/4 ~07:25 UTC) — **Resolved**

- **Branch**: `devin/1777532894-adopt-apierror-views`. **Base**: `main` @ `0e9c438`.
- **Changes**: adopt `extractApiErrorCode` / `extractApiErrorCodeOrDefault` helper (từ PR #128) trong 18 callsite — 17 view (AdminView/TopupView/GiftCodeView/ResetPasswordView/MissionView/SectView/DungeonView/ShopView/BossView/OnboardingView/MarketView/HomeView/InventoryView/SettingsView ×2/MailView/LeaderboardView/ForgotPasswordView/ActivityView) + 1 component (ChatPanel).
- **Note**: merge trước khi PR #134 fix hotfix — main đã ở `23fffa3` vẫn còn broken typecheck cho đến khi PR #134 merge (`2521672`).
- **Risk**: 🟢 thấp — pure refactor, helper đã có 17 vitest cover.

### PR #132 — `test(web): smart ProfileView smoke tests — 12 vitest covering onMounted routing + render branches (role badge / sect / fallback realmKey) (session 9i task K2)` — **Merged into main** @ `0e9c438` (30/4 ~07:13 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777532752-profile-view-tests`. **Base**: `main` post-#131.
- **Changes**: `apps/web/src/views/__tests__/ProfileView.test.ts` (+12 vitest cover: unauthenticated → `/auth`, no id → `/`, authenticated load + render role badge STAFF/PLAYER, sect badge khi có, fallback realmKey hidden, error toast).
- **Impact**: web vitest file count 34 → 35, test count 290 → 302.

### PR #131 — `test(web): smart LeaderboardView smoke tests + GiftCodeView smoke tests (session 9i task K1)` — **Merged into main** @ `4a69497` (30/4 ~07:10 UTC, CI 5/5 ✅) — **Resolved** *(introduces C-TSNARROW-RESOLVEFN Critical — fixed by session 9j task A)*

- **Branch**: `devin/1777532593-leaderboard-skeleton-tests`. **Base**: `main` post-#130.
- **Changes**: `apps/web/src/views/__tests__/GiftCodeView.test.ts` (+10 vitest) + `apps/web/src/views/__tests__/LeaderboardView.test.ts` (+10 vitest).
- **Known regression**: `GiftCodeView.test.ts:273` `let resolveFn: ((v:unknown)=>void) | null = null` pattern — vue-tsc narrow `never` → TS2349 khi typecheck main qua CI (không reproduce trên branch riêng vì TS incremental cache khác). Fixed by PR session 9j task A (this PR).

### PR #130 — `docs(handoff): session 9i cascade audit refresh — bump snapshot 8a2be4a + mark PR #123..#127 Merged + ghi PR #128/#129 + bump baseline web vitest 236 → 268 + roadmap task J/K` — **Merged into main** @ `a002dc4` (30/4 ~07:08 UTC, CI 4/4 ✅) — **Resolved**

### PR #129 — `fix(admin): giftcode revoke handleErr fallback for UNAUTHENTICATED/FORBIDDEN/ADMIN_ONLY (Devin Review #127 follow-up)` — **Merged into main** @ `70c4324` (30/4 ~07:02 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777532143-fix-giftcode-revoke-handleerr-fallback`. **Base**: `main` @ `8a2be4a` (post PR #127 merge).
- **Vì sao**: Devin Review trên PR #127 (comment 3166138114) flag `confirmGiftcodeRevoke` regression — helper `mapGiftcodeRevokeErrorKey` chỉ map `CODE_NOT_FOUND` / `CODE_REVOKED`, mọi code khác (UNAUTHENTICATED/FORBIDDEN/ADMIN_ONLY) đều fall through `admin.errors.UNKNOWN` ("Có lỗi xảy ra") — admin mất actionable error message khi session hết hạn / role bị tước.
- **Changes**: `apps/web/src/views/AdminView.vue` `confirmGiftcodeRevoke` catch branch — nếu `key === 'admin.errors.UNKNOWN'` → fallback `handleErr(e)` (dynamic mapper `t('admin.errors.${code}')`); ngược lại giữ toast riêng (CODE_NOT_FOUND/CODE_REVOKED).
- **Tests**: typecheck ✅, lint ✅, web vitest **263/263** (32 file), không thêm test mới (helper đã cover bởi 4 vitest từ PR #127).
- **Risk**: 🟢 thấp — sửa 7 dòng trong 1 catch branch.

### PR #128 — `feat(web): smart extractApiErrorCode helper — pure shape-aware error extraction + 17 vitest + adopt AdminView/AuthView (session 9i task J)` — **Merged into main** @ `8ecaf37` (30/4 ~07:05 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777531917-extract-api-error-code`. **Base**: `main` @ `8a2be4a` (post PR #127 merge).
- **Vì sao**: codebase web có **18 chỗ** lặp pattern `(e as { code?: string }).code ?? 'FALLBACK'` — không xử lý non-object thrown values (NPE với `throw 42`) + không bao phủ shape axios error (`error.response.data.code`) hoặc nested `cause`/`original`.
- **Changes**:
  1. **`apps/web/src/lib/apiError.ts`** (NEW, +82 line): `extractApiErrorCode(err)` đọc field `code: string` theo thứ tự direct → response.data → cause → original; reject null/undefined/primitive/empty/non-string. `extractApiErrorCodeOrDefault(err, fallback)` variant với default string. 2 helper private `readStringField` / `readObjectField` type-narrow an toàn.
  2. **`apps/web/src/lib/__tests__/apiError.test.ts`** (NEW, +118 line, **17 vitest**): 14 test cho `extractApiErrorCode` (object direct/Error instance/axios shape/top-level priority/cause/original/null/undefined/primitive/no-code/non-string/empty string/missing data.code/data null/no response) + 3 test cho `extractApiErrorCodeOrDefault` (có code/không có code/empty fallback).
  3. **`apps/web/src/views/AdminView.vue`** `handleErr(e)` — adopt helper (1 line).
  4. **`apps/web/src/views/AuthView.vue`** `onLogin/onRegister/onChange` — adopt `extractApiErrorCodeOrDefault` (3 callsite, preserve fallback string cũ).
- **Tests**: typecheck ✅, lint ✅, web vitest **268/268** (32 file).
- **Risk**: 🟢 thấp — pure helper bổ sung, adopt 4 callsite không thay đổi behavior.
- **Future cleanup** (tracked roadmap K): 14 view khác còn pattern cũ — TopupView, GiftCodeView, ResetPasswordView, MissionView, ShopView, MarketView, InventoryView, SettingsView (×2), SectView, DungeonView, BossView, MailView, LeaderboardView, ForgotPasswordView, ActivityView, ChatPanel.

### PR #127 — `feat(admin): smart giftcode revoke ConfirmModal — replace native confirm() + impact preview + 12 vitest (session 9i task H)` — **Merged into main** @ `8a2be4a` (30/4 ~07:50 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777531575-giftcode-revoke-confirm`. **Base**: `main` @ post-#126.
- **Changes**:
  1. **`apps/web/src/lib/giftcodeRevoke.ts`** (NEW, +95 line): `computeGiftcodeRevokeImpact(input)` tính `redeemUsage` (`X / Y` hoặc `X / ∞`), `remaining` (clamp ≥ 0), `expiryStatus` (`expired` / `expires-soon` <24h / `active` / `no-expiry`); `mapGiftcodeRevokeErrorKey(code)` map BE code → i18n key.
  2. **`apps/web/src/lib/__tests__/giftcodeRevoke.test.ts`** (NEW, +128 line, **12 vitest**).
  3. **`apps/web/src/views/AdminView.vue`** thay `window.confirm()` bằng `<ConfirmModal>` danger style + state `giftcodeRevokeTarget` + `giftcodeRevokeBusy` + computed `giftcodeRevokeImpact`. 3 function `openGiftcodeRevoke/cancelGiftcodeRevoke/confirmGiftcodeRevoke`.
  4. **`apps/web/src/i18n/{vi,en}.json`** (+5 key/file): `revokeModalTitle/Usage/Expired/ExpiresSoon/Warning`.
- **Devin Review note**: comment 3166138114 flag regression UNAUTHENTICATED/FORBIDDEN — sửa trong PR #129 follow-up.
- **Risk**: 🟢 thấp — UI refactor + 1 helper file mới, không touch BE.

### PR #126 — `test(web): smart AppShell skeleton tests — 15 vitest covering mobile nav toggle + sidebar badges + staff link + cultivating color (session 9i task G)` — **Merged into main** (30/4 ~07:30 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777531321-appshell-tests`.
- **Changes**: `apps/web/src/components/shell/__tests__/AppShell.test.ts` (NEW, +355 line, **15 vitest**) cover: 3 mobile nav toggle (initial closed/click toggle/click backdrop), 5 sidebar badges (breakthrough purple dot/bossActive rose dot/missionClaimable amber count/unreadMail count/none), 7 staff-only + cultivating + WS status + logout (PLAYER không thấy admin link/MOD thấy/ADMIN thấy/cultivating emerald/no cultivating/WS pill/logout button).
- **Pattern**: mock `vue-router` `RouterLink` (stub `<a data-to>`), 3 stores (auth/game/badges), child component (ChatPanel/LocaleSwitcher stubs).
- **Risk**: 🟢 thấp — test-only.

### PR #125 — `docs(handoff): session 9i task A2 audit refresh — bump snapshot e8c85df + mark PR #119..#122 Merged + ghi PR #123/#124 Pending merge + bump baseline web vitest 207 → 236` — **Merged into main** (30/4 ~06:55 UTC, CI 4/4 ✅) — **Resolved**

### PR #124 — `test(web): smart HomeView smoke tests — 9 vitest covering onMounted routing + cultivate/breakthrough actions (session 9i task F)` — **Pending merge**

- **Branch**: `devin/1777530911-test-coverage-skeleton`. **Base**: `main` @ `e8c85df`.
- **Changes**:
  1. **`apps/web/src/views/__tests__/HomeView.test.ts`** (+288 line, **9 vitest**): mock `@/api/character`, `vue-router`, `@/stores/{auth,toast,game,badges}`, stub child component (`AppShell`, `NextActionPanel`, `OnboardingChecklist`, `DailyLoginCard`). 4 test cho onMounted routing branches (chưa auth → `/auth`, no character → `/onboarding`, có character → `fetchState + bindSocket + badges.refresh`, getCharacter throw → `/onboarding`) + 5 test cho render với character (tên/realm/exp text/HP/MP, toggleCultivate gọi setCultivating + toast started, breakthrough disabled khi `realmStage 1`, enabled khi `realmStage 9 && exp >= expNext`, error code `NOT_AT_PEAK` → toast warning notAtPeak).
- **Tests**: typecheck ✅, lint ✅, web vitest **236/236** (30 file), runner cho 9 test mới passed trong 1.3s.
- **Risk**: 🟢 thấp — test-only, không touch source code/i18n/BE. Mock pattern theo `SettingsView.test.ts` đã ổn định.

### PR #123 — `feat(admin): smart user export CSV — endpoint + helper + 15 vitest + Export CSV button (session 9i task E)` — **Pending merge**

- **Branch**: `devin/1777530374-admin-user-export-csv`. **Base**: `main` @ `e8c85df`.
- **Changes**:
  1. **`apps/api/src/modules/admin/user-csv.ts`** (+88 line, NEW): pure helper `escapeCsvField`, `formatUserCsvRow`, `formatUsersCsv` + const `USER_CSV_HEADER` (12 cột) + interface `UserCsvRow`. RFC 4180-compliant escape (comma/quote/CRLF/leading/trailing whitespace).
  2. **`apps/api/src/modules/admin/user-csv.test.ts`** (+136 line, NEW, **15 vitest**): escape edge case (comma/quote/CRLF/whitespace/null), format row (with character / null character / special char), format full CSV (empty/multiple rows/CRLF/header order).
  3. **`apps/api/src/modules/admin/admin.service.ts`** (+93 line): `exportUsers(actorId, q, filters)` reuse cùng filter logic với `listUsers()`, take 5000 row, audit `user.exportCsv` với `{total, exported, truncated, filters}` (bigint stringified).
  4. **`apps/api/src/modules/admin/admin.controller.ts`** (+72 line): `@Get('users.csv')` `@RequireAdmin()` `@Res({ passthrough: true })` set headers `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="xuantoi-users-{ISO}.csv"`, `X-Export-Total`, `X-Export-Rows`, `X-Export-Truncated`.
  5. **`apps/web/src/api/admin.ts`** (+30 line): `adminExportUsersCsv(q, filters)` → `{ csv, total, rows, truncated }`.
  6. **`apps/web/src/views/AdminView.vue`**: extract `buildUserFilters()` (DRY cho `refreshUsers` + export), thêm ref `usersExporting` + `exportUsersCsv()` (Blob + BOM + `<a>.click()` download + toast theo `truncated`), template `<MButton>` Export CSV bên cạnh Search button.
  7. **`apps/web/src/i18n/{vi,en}.json`** (+4 key/file): `admin.users.exportCsvBtn`, `exportingLabel`, `exportedToast`, `exportTruncatedToast`.
- **Tests**: typecheck ✅, lint ✅, `pnpm --filter @xuantoi/api exec vitest run user-csv` ✅ **15/15**; web vitest **227/227** (29 file post-#122 baseline), không regression.
- **Runtime smoke**: pending sau merge — cần kiểm tra tải file CSV thật, mở Excel với BOM (UTF-8 tiếng Việt), header `X-Export-Truncated: true` khi >5000 row, audit log entry `user.exportCsv`.
- **Risk**: 🟢 thấp — additive, ADMIN-only (`@RequireAdmin()` chỉ ADMIN, MOD bị 403), audit logged, cap 5000 row, không sửa BE schema/migration/economy.

### PR #122 — `feat(web): smart UX toast duration policy — extract resolveToastDuration helper + scale by severity (session 9i task D)` — **Merged into main** @ `e8c85df` (30/4 ~06:32 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777530219-toast-duration-policy`.
- **Changes**:
  1. **`apps/web/src/lib/toastDuration.ts`** (+38 line, NEW): pure helper `resolveToastDuration(type, override?)` + record `TOAST_DURATION_MS` (info: 3000, success: 3500, warning: 5000, error: 6000). Override precedence: caller-provided `>= 0` ưu tiên hơn policy.
  2. **`apps/web/src/lib/__tests__/toastDuration.test.ts`** (+58 line, NEW, **9 vitest**): policy ordering (error >= warning >= success >= info), positive integers per-type, override precedence, edge case (0/negative/undefined).
  3. **`apps/web/src/stores/toast.ts`**: thay inline `(type === 'warning' || type === 'error' ? 3600 : 2600)` bằng `resolveToastDuration(type, raw.duration)`.
  4. **`apps/web/src/stores/__tests__/toast.test.ts`**: cập nhật baseline (info 2600 → 3000, warning 3600 → 5000) + thêm 4 test mới (error 6000ms, success 3500ms, override precedence, caller 100ms flash).
- **Tests**: typecheck ✅, lint ✅, web vitest 220/220 (28 file).
- **Risk**: 🟢 thấp — pure refactor + additive policy, không touch BE.

### PR #121 — `feat(admin): smart tab badge — active giftcode count on Giftcode tab nav (session 9i task C)` — **Merged into main** (30/4 ~06:25 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777529974-admin-giftcode-unused-badge`.
- **Changes**:
  1. **`apps/web/src/lib/giftcodeBadge.ts`** (NEW): pure helper `countActiveUnused(rows, now?)` đếm giftcode chưa expired + còn slot.
  2. **`apps/web/src/lib/__tests__/giftcodeBadge.test.ts`** (NEW, **7 vitest**): expired/exhausted/active edge case + `now` injection.
  3. **`apps/web/src/views/AdminView.vue`**: import + ref `activeGiftcodeCount` + helper `refreshActiveGiftcodeCount()` + badge cyan-500 trên nav button "Quà Tặng" khi count > 0.
  4. **`apps/web/src/i18n/{vi,en}.json`** (+1 key/file): `admin.giftcodes.activeBadgeTooltip`.
- **Tests**: web vitest 214/214 (28 file).
- **Risk**: 🟢 thấp — read-only consume API có sẵn `GET /admin/giftcodes`.

### PR #120 — `docs: bootstrap docs/RELEASE_NOTES.md (closed-beta-1 user-facing press kit) (session 9i task B)` — **Merged into main** (30/4 ~06:23 UTC, CI 4/4 ✅) — **Resolved**

- **Branch**: `devin/1777529785-docs-release-notes-bootstrap`. **Type**: docs-only.
- **Changes**: tạo `docs/RELEASE_NOTES.md` (~165 line) với highlight closed-beta-1 (12 feature gameplay/admin/onboarding + 6 safety/economy + 4 newbie UX + i18n parity), known issue table, feedback channel, roadmap preview post-beta.
- **Risk**: 🟢 zero — docs-only, không update `AI_HANDOFF_REPORT.md` (tránh conflict với PR #119 in-flight).

### PR #119 — `docs(handoff): session 9i audit refresh — bump snapshot 0fc1431 + mark PR #111..#117 Merged + sync baseline web vitest 207/207 + add session 9i roadmap` — **Merged into main** @ `8ecfa72` (30/4 ~06:21 UTC, CI 5/5 ✅) — **Resolved**

- **Branch**: `devin/1777528782-audit-session-9i-refresh-pr117`. **Type**: docs-only.
- **Mục tiêu**: gom toàn bộ session 9h cascade (PR #111..#118) sang Merged + bump baseline web vitest 207/207 + mở session 9i roadmap.
- **Risk**: 🟢 zero — docs-only.

### PR #118 — `feat(admin): smart tab badge — pending topup count on Topups tab nav (session 9h task H)` — **Merged into main** @ `27552a8` (30/4 ~06:18 UTC, CI 5/5 ✅) session 9h task H — **Resolved**

- **Branch**: `devin/1777527557-admin-tab-badges`. **Status**: Merged. Take-over by session 9i: rebase lên `main @ 0fc1431` (resolve conflict trong `refreshStats()` với PR #117's `loadRecentActivity()` block — kept both side-effects), apply Devin Review fix (`pendingTopupCount` stale sau approve/reject) qua helper `refreshPendingTopupCount()` fire-and-forget tại `apps/web/src/views/AdminView.vue:461`, gọi từ `approveTopup()` (line 437) và `rejectTopup()` (line 449). Force-push commit `e8a6e1c`.
- **Changes**:
  1. **`apps/web/src/views/AdminView.vue`**: `pendingTopupCount = ref(0)` + load lần đầu trong `refreshStats()` + poll 60s qua `refreshAlertsOnly()` + helper mới `refreshPendingTopupCount()` (fire-and-forget) gọi sau approve/reject để badge update ngay không chờ poll. Badge amber-500 trên nav button "Nạp Tiên Ngọc" khi count > 0.
  2. **`apps/web/src/i18n/{vi,en}.json`** (+1 key/file): `admin.topups.pendingBadgeTooltip`.
- **Tests**: web baseline `207/207` không đổi (additive UI, dùng API có sẵn `GET /admin/topups?status=PENDING`).
- **Risk**: thấp — read-only, dùng API có sẵn, lỗi try/catch im lặng giữ giá trị cũ. Không touch BE/schema/economy. Không thêm timer mới.

### PR session 9i task A (in-flight, this PR) — `docs(handoff): session 9i audit refresh — bump snapshot 27552a8 + mark PR #111..#118 Merged + sync baseline web vitest 207/207 + add session 9i roadmap` — **Pending merge**

- **Branch**: `devin/1777528782-audit-session-9i-refresh-pr117`. **Base**: ban đầu `main` @ `0fc1431` (post PR #117 merge); rebase lên `main` @ `27552a8` (post PR #118 merge) sau khi user merge PR #118.
- **Mục tiêu**: report cũ (snapshot `4c214eb` = PR #110 merge) đã lỗi thời sau khi cả chuỗi PR #111..#118 cascade merged 30/4 ~06:18 UTC. PR #117 ghi `Pending merge` trong Recent Changes nhưng đã merge; PR #118 (session 9h task H pending topup badge) take-over + Devin Review fix mới merged. Audit này:
  - Bump snapshot `4c214eb` → `27552a8`.
  - Chuyển PR #111..#118 từ "Pending merge / In-flight" → "Merged into main" với commit hash đầy đủ.
  - Sync baseline web vitest: `187/187` (23 file) → `207/207` (27 file) sau khi PR #112/#114/#115/#116 thêm test (admin audit-ledger 3 + admin economy report 3 + admin list-users-filter 5 + onboarding visits 6 + 3 add to OnboardingChecklist). PR #117/#118 additive UI không đổi count.
  - Đóng session 9h roadmap A/B/C/D/E/F/G/H (tất cả task đã merged).
  - Thêm session 9i roadmap mới: docs/RELEASE_NOTES.md bootstrap → smart giftcode unredeemed badge (topup đã xong qua PR #118) → smart UX polish toast duration → test coverage expand → admin user export CSV.
- **Files**: `docs/AI_HANDOFF_REPORT.md` only.
- **Tests added**: 0 (docs-only).
- **CI status (local)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/web test` ✅ 207/207 (27 file).
- **Risk**: 0 (docs-only).
- **Rollback**: revert single PR.
- **`AI_HANDOFF_REPORT.md updated`**: ✅ — header snapshot/người viết/baseline/trạng thái + §2 commit audit + Recent Changes (this entry + PR #117 Merged) + §20 roadmap session 9i + §21 PR Plan.

### PR #117 — `feat(admin): smart recent activity widget — inline last 5 audit entries on Stats tab (session 9h task G)` — **Merged into main** @ `0fc1431` (30/4 ~05:49 UTC, CI 5/5 ✅) session 9h task G — **Resolved**

- **Branch**: `devin/1777527139-admin-recent-activity-widget`. **Status**: Merged.
- **Mục tiêu**: admin/MOD trên Stats tab nhìn ngay 5 thao tác audit gần nhất (admin nào vừa làm gì) mà không phải switch sang tab Audit. Đặc biệt hữu ích khi nhiều admin cùng vận hành live, hoặc khi đang debug mà không muốn rời Stats tab.
- **Changes**:
  1. **`apps/web/src/views/AdminView.vue`**: thêm `recentActivity = ref<AdminAuditRow[]>([])` + `recentActivityRunning` state, `loadRecentActivity()` handler (gọi `adminListAudit(0)` rồi slice 5). `refreshStats()` auto-trigger `loadRecentActivity().catch(() => null)` (lỗi widget không phá main stats). Panel violet-500 dưới economy report → bảng 3 cột (time/actor/action) + button refresh manual.
  2. **`apps/web/src/i18n/{vi,en}.json`** (+9 key mỗi file): `admin.recentActivity.{title,subtitle,loading,empty,col.{time,actor,action}}`.
- **Tests**: web baseline `204/204` (post-#116 merge) không đổi (additive UI, dùng API có sẵn `/admin/audit`).
- **Risk**: thấp — read-only, dùng API có sẵn, panel độc lập (try/catch riêng). Không touch BE/schema/economy.

### PR #116 — `feat(admin): smart users filter expand — currency range (linhThach/tienNgoc) + realmKey via GET /admin/users (session 9h task F)` — **Merged into main** session 9h task F — **Resolved**

- **Branch**: `devin/1777526486-admin-users-filter-expand`. **Status**: Merged. CI 5/5 ✅.
- **Changes**: `admin.service.ts` listUsers() +18 line filter param. `admin.controller.ts` @Get('users') +30 line parse helper. `admin-list-users-filter.test.ts` +6 BE vitest. `admin.ts` AdminListUsersFilters interface. `AdminView.vue` +5 ref + +60 UI. `i18n/{vi,en}.json` +6 key. `admin.list-users-filter.test.ts` +5 FE vitest. Web `199 → 204`, BE vitest +6.
- **Risk**: thấp — additive query param, default unchanged. Index Character.realmKey có sẵn.

### PR #115 — `feat(admin): smart economy report — top 10 whales (linhThach + tienNgoc) + circulation snapshot via GET /admin/economy/report (session 9h task E)` — **Merged into main** @ `6f18ce6` session 9h task E — **Resolved**

- **Branch**: `devin/1777525664-economy-report-tab`. **Status**: Merged. CI 5/5 ✅.
- **Changes**: `admin.service.ts` getEconomyReport() 5 query parallel + bigint serialize. `admin.controller.ts` @Get('economy/report'). AdminView Stats panel cyan + 5 stat cards + 2 cột top whales. i18n 13 key/locale. +6 BE vitest + 3 FE vitest (web 199 → 202, file 25 → 26).
- **Risk**: thấp — read-only.


### PR #114 — `feat(web): smart onboarding expand — track Leaderboard + Mail visits via localStorage (6-step checklist) (session 9h task D)` — **Merged into main** session 9h task D — **Resolved**

- **Branch**: `devin/1777525372-onboarding-visit-steps`. **Status**: Merged. CI 5/5 ✅.
- **Changes**: `apps/web/src/lib/onboardingVisits.ts` (mới, hasVisited/markVisited/clearAllVisits SSR-safe localStorage helper). `apps/web/src/components/OnboardingChecklist.vue` (4 → 6 step). `apps/web/src/views/{LeaderboardView,MailView}.vue` (+2 line mỗi file dynamic-import markVisited onMounted). `apps/web/src/i18n/{vi,en}.json` (+2 key). `apps/web/src/lib/__tests__/onboardingVisits.test.ts` (mới +6 vitest). `apps/web/src/components/__tests__/OnboardingChecklist.test.ts` (+3 test refactor 4 → 6 step). Web vitest 187 → 199 (file 23 → 25).
- **Risk**: thấp — FE-only, localStorage best-effort, không touch BE/schema/economy.

### PR #113 — `test(web): expand Playwright golden path — daily login claim + leaderboard tabs (gated E2E_FULL=1) (session 9h task C)` — **Merged into main** @ `8cdb93c` session 9h task C — **Resolved**

- **Branch**: `devin/1777524299-playwright-golden-expand`. **Status**: Merged. CI 5/5 ✅.
- **Changes**: `apps/web/e2e/golden.spec.ts` (+95) thêm 2 test gated `E2E_FULL=1` (daily login claim, leaderboard tabs). `docs/QA_CHECKLIST.md` (+25) doc how-to chạy full e2e local + CI gate. Web vitest 187/187 không đổi (chỉ thêm Playwright spec).
- **Risk**: thấp — gated test, không touch app code.

### PR #112 — `feat(admin): replay orphan commit 7e27aa9 — GET /admin/economy/audit-ledger endpoint + AdminView panel button + 6 BE vitest + 3 FE vitest + i18n` — **Merged into main** session 9h task B

- **Branch**: `devin/1777523851-replay-admin-audit-ledger-endpoint`. **Base**: ban đầu stacked trên `devin/1777523096-audit-session-9g-refresh-pr110` (PR #111), sau khi PR #111 merge thì rebase + retarget về `main`. **Status**: Merged.
- **Mục tiêu**: replay orphan commit `7e27aa9` (admin endpoint `GET /admin/economy/audit-ledger` + AdminView panel) chưa vào main — được session 9h audit phát hiện. Trước replay, admin muốn on-demand check ledger consistency phải SSH server gõ `pnpm audit:ledger` (PR #76, G21). Closed-beta cần monitor trên UI.
- **Changes (cherry-pick `7e27aa9` resolve `docs/AI_HANDOFF_REPORT.md` `--ours`)**:
  1. **`apps/api/src/modules/admin/ledger-audit.ts`** (mới, +167): pure `auditLedger(prisma)` move từ script + `auditResultToJson()` serialize bigint → string cho HTTP response.
  2. **`apps/api/scripts/audit-ledger.ts`** (refactor): re-export pure logic từ `ledger-audit.ts`, giữ CLI entrypoint và 9 vitest test cũ vẫn pass.
  3. **`apps/api/src/modules/admin/admin.service.ts`** (+16): `runLedgerAudit()` reuse `PrismaService`.
  4. **`apps/api/src/modules/admin/admin.controller.ts`** (+17): `@Get('economy/audit-ledger')` + JwtAdminGuard (ADMIN/MOD readable).
  5. **`apps/api/src/modules/admin/admin-audit-ledger.test.ts`** (mới, +141, +6 vitest BE): empty DB ok, ledger khớp, linhThach mismatch, tienNgoc mismatch, inventory mismatch, multi-entry sum.
  6. **`apps/web/src/api/admin.ts`** (+35): `adminAuditLedger()` helper + types `AdminLedgerAudit/Char/Inv`.
  7. **`apps/web/src/views/AdminView.vue`** (+83): panel violet-500 trong Stats tab + button "Chạy audit" + render discrepancy table.
  8. **`apps/web/src/i18n/{vi,en}.json`** (+11 key mỗi file): `admin.ledgerAudit.*`.
  9. **`apps/web/src/api/__tests__/admin.audit-ledger.test.ts`** (mới, +78, +3 vitest FE): clean response, discrepancies bigint string, throw on `ok=false`.
- **Tests added**: +6 vitest BE + 3 vitest FE (web `187 → 190`, file `23 → 24`).
- **CI status**: 5/5 ✅ (CI green merge).
- **Risk**: thấp–trung — refactor behavior-preserving, endpoint read-only.
- **Rollback**: revert single PR.

### PR #111 — `docs(handoff): session 9h audit refresh — bump snapshot 4c214eb + mark PR #109/#110 Merged + sync baseline web vitest 187/187 + add session 9h roadmap` — **Merged into main** session 9h task A

- **Branch**: `devin/1777523096-audit-session-9g-refresh-pr110`. **Base**: `main` @ `4c214eb`. **Status**: Merged.
- **Mục tiêu**: refresh stale handoff report (snapshot `0a6c664` → `4c214eb`), mark PR #109+#110 Merged + Resolved, sync baseline web vitest 174 → 187, mở §20 session 9h roadmap (task A audit, task B replay 7e27aa9, task C Playwright expand).
- **Changes**: `docs/AI_HANDOFF_REPORT.md` only (+84/-30 line).
- **CI status**: 5/5 ✅.
- **Risk**: cực thấp — docs-only.


### PR #110 — `fix(env): quote SMTP_FROM trong .env.example để bash source .env không fail (session 9g task F1)` — **Merged into main** @ `4c214eb` (29/4 ~19:55 UTC, CI 5/5 ✅) session 9g task F1

- **Branch**: `devin/1777492223-env-example-smtp-from-quote`. **Base**: `main` @ post-PR #109 (`58fa69d`). **Status**: docs/config-only — Merged.
- **Mục tiêu**: smoke runtime 9g phát hiện F1 (Low): `apps/api/.env.example` line 31 `SMTP_FROM=Xuân Tôi <noreply@xuantoi.local>` chứa ký tự `<`/`>` + space không quote → admin/dev nào dùng `set -a && source .env && set +a` để load shell sẽ fail (`bash: <noreply@xuantoi.local>: No such file or directory`). Tuy NestJS dùng dotenv parse fine (không bị ảnh hưởng), `.env.example` là tài liệu tham khảo cho dev → quote lại để tương thích cả `bash source` lẫn dotenv.
- **Changes**:
  1. **`apps/api/.env.example`** line 31: `SMTP_FROM=Xuân Tôi <noreply@xuantoi.local>` → `SMTP_FROM="Xuân Tôi <noreply@xuantoi.local>"` + comment giải thích vì sao quote.
- **Verify**: `cp .env.example /tmp/test.env && set -a && source /tmp/test.env && set +a && echo $SMTP_FROM` → trả `Xuân Tôi <noreply@xuantoi.local>` ✅. Dotenv (NestJS ConfigModule) cũng strip outer quotes nên `process.env.SMTP_FROM` không đổi.
- **Tests added**: 0 (config file, không có code path mới).
- **CI status (local)**: typecheck/lint không bị ảnh hưởng (file .env.example không qua lint pipeline).
- **Risk**: cực thấp — config-only, không touch code/schema/test/migration.
- **Rollback**: revert single PR.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry), PR #108 line 101 mark F1 Resolved.

### PR #109 — `feat(web): smart admin economy alerts badge + 60s polling — wire AdminView nav (session 9g task E.a)` — **Merged into main** @ `58fa69d` (29/4 ~19:50 UTC, CI 5/5 ✅) session 9g task E.a — **Resolved**

- **Branch**: `devin/1777491606-admin-economy-alerts-widget`. **Base**: `main` @ `0a6c664` (post PR #108 merge).
- **Mục tiêu**: BE `GET /admin/economy/alerts` đã tồn tại từ PR #54/#76 (báo cáo characters có currency âm, inventory qty < 1, topup PENDING quá staleHours). FE AdminView Stats tab đã render danh sách alerts khi user click vào tab Stats. Trước PR này, admin đang ở tab Users/Topups/Audit không biết hiện có alerts → phải nhớ click sang Stats → click "Refresh" định kỳ. PR này đóng gap UX: (1) red dot count badge trên nav button **Stats** khi `alertsCount > 0`, (2) auto-poll `/admin/economy/alerts` mỗi 60s (silent retry on error) để badge luôn fresh dù admin đang ở tab khác.
- **Changes**:
  1. **`apps/web/src/lib/adminAlerts.ts`** (mới, 36 line): pure helper `countEconomyAlerts(alerts)` cộng `negativeCurrency.length + negativeInventory.length + stalePendingTopups.length` (defensive null/undefined → 0). Thêm `alertSeverity(count): 'none'|'low'|'medium'|'high'` với boundary 0 / 1..2 / 3..9 / >=10 (chuẩn bị cho color tier về sau, hiện chưa dùng).
  2. **`apps/web/src/views/AdminView.vue`** (+~30 line, -8 line): import `countEconomyAlerts`; thêm `computed alertsCount`; thêm `alertsPollTimer` setInterval 60s gọi `refreshAlertsOnly()` (chỉ fetch alerts, không đổi `loading` state để tránh nhấp nháy); `onBeforeUnmount` cleanup; thêm `<span data-testid="admin-tab-stats-alerts-badge">{{ alertsCount }}</span>` rose-500 trên nav button `tk === 'stats'` khi count > 0.
  3. **`apps/web/src/i18n/vi.json`** (+1 key): `admin.alerts.badgeTooltip = "{count} cảnh báo kinh tế cần xem"`.
  4. **`apps/web/src/i18n/en.json`** (+1 key): `admin.alerts.badgeTooltip = "{count} economy alerts need attention"`.
  5. **`apps/web/src/lib/__tests__/adminAlerts.test.ts`** (mới, 105 line, **+13 vitest**): cover 5 case `countEconomyAlerts` (null/undefined/empty/cộng đủ 3 nguồn/1 nguồn) + 8 case `alertSeverity` (0/âm defensive/1/2/3/9/10/9999 boundary).
- **Tests added**: **+13 vitest** (web: 174 → **187**, file count 22 → **23**).
- **Risk**: Thấp — (a) helper pure additive; (b) badge wiring pure additive; (c) polling 60s nhẹ; (d) parity test (PR #107) auto-verify vi/en symmetric.

### PR #108 — `docs(handoff): session 9g task D — runtime smoke 9d→9g integration + report bump 82f2020` — **Merged into main** @ `0a6c664` (29/4 ~19:45 UTC, CI 5/5 ✅) session 9g task D

- **Branch**: `devin/1777490963-runtime-smoke-9d-9g`. **Base**: `main` @ `82f2020` (post PR #107 merge). **Status**: docs-only.
- **Mục tiêu**: chạy local `pnpm infra:up` + Postgres + Redis + Mailhog + MinIO + `prisma migrate deploy` + `prisma db seed` + `bootstrap` + `pnpm dev` (api + web), smoke 41 endpoint flow theo `docs/QA_CHECKLIST.md` để verify runtime của các PR session 9d→9g (#84..#107). Ghi kết quả + bug nhỏ phát hiện vào `docs/RUNTIME_SMOKE_9G.md` (mới); bump report header snapshot `7d1965e` → `82f2020`; close §20 task D session 9g.
- **Coverage smoke** (29/4 19:25–19:30 UTC, api commit 82f2020): healthz · register · login · character/me · onboard · cultivate · daily-login claim (PR #80) · leaderboard power/topup/sect (PR #94/#99) · admin/users · admin/stats · admin/economy/alerts (PR #54/#76) · admin grant currency + ledger ADMIN_GRANT · admin mail send rewardItems + player mail/me + claim → inventory (PR #82/#88) · **admin inventory revoke happy path** (PR #66 BE + #106 FE wire) → ledger ADMIN_REVOKE entry visible in `/api/logs/me?type=item` ✅ · admin revoke insufficient qty → `INVALID_INPUT` ✅ · admin/audit `admin.inventory.revoke` ✅ · admin self-demote/self-ban → `CANNOT_TARGET_SELF` (PR #100) ✅ · forgot-password full flow (PR #101 + PR #103 timing-parity) — devToken issue → reset → reuse same token → `INVALID_RESET_TOKEN` (single-use) → login with new password ✅ · boss/current ACTIVE ✅ · web :5173 routes 200.
- **Bugs phát hiện**: **0 Critical/High**. **F1 (Low) — Resolved by PR #110** `apps/api/.env.example` line 31 (`SMTP_FROM=Xuân Tôi <noreply@xuantoi.local>`) chứa ký tự `<`/`>` không quote → `bash source .env` fail. PR #110 quote lại + comment giải thích. **F2 (info)** `OnboardInput.name` regex `[A-Za-zÀ-ỹ0-9._]+` không cho dấu cách Việt phổ biến — UI nên show hint rõ.
- **Files**:
  1. **`docs/RUNTIME_SMOKE_9G.md`** (mới, 13 section, full evidence từng endpoint với input/output mong đợi).
  2. **`docs/AI_HANDOFF_REPORT.md`**: bump snapshot `7d1965e` → `82f2020`; thêm PR #107 + PR #108 entry vào Recent Changes; close §20 task C/D + §21 PR plan.
- **Tests added**: 0 (smoke task — không thêm code/test). Local baseline pre-smoke: typecheck ✅ (3 project) · lint ✅ (max-warnings 0) · web 174/174 ✅ · build ✅.
- **Risk**: cực thấp (docs-only). Rollback: revert single PR.
- **`AI_HANDOFF_REPORT.md updated`**: §0 header (snapshot bump 7d1965e → 82f2020 + thêm PR #107 vào chuỗi Merged, đổi trạng thái session 9g task A/B/C **DONE**), Recent Changes (this entry + PR #107 entry promotion → Merged), §20 (close task C + task D), §21 PR plan (PR #107 Merged + PR #108 in-flight).

### PR #107 — `feat(web): i18n parity test + wire breakthroughReady sidebar badge + smart UX polish` — **Merged into main** @ `82f2020` (29/4 ~19:30 UTC, CI 5/5 ✅) session 9g task C

- **Branch**: `devin/1777489851-i18n-gap-audit-smart-ux-polish`. **Base**: `main` @ `7d1965e` (sau PR #106 merge). **Status**: code complete + local typecheck/lint/web test/build all xanh.
- **Mục tiêu** (session 9g task C — smart UX polish + i18n gap audit follow-up):
  1. **Wire `badges.breakthroughReady`** (computed từ `/me/next-actions` `BREAKTHROUGH_READY` action, tồn tại nhưng không được hiển thị ở đâu trong sidebar trước PR này) thành small dot indicator (violet-400) trên RouterLink `/home` trong `AppShell.vue`. Style nhất quán với `bossActive` (rose-500) + `topupPending` (amber-400). Khi player sẵn sàng đột phá cảnh giới, badge sẽ hiện hướng họ về trang Tổ Động.
  2. **i18n parity test** (`apps/web/src/i18n/__tests__/parity.test.ts`, mới, +6 vitest) — enforce rằng:
     - Mọi key trong `vi.json` phải tồn tại trong `en.json` (và ngược lại).
     - Không có giá trị rỗng (string trim() === "") trong cả hai locale.
     - ICU placeholder `{name}` parity — mỗi placeholder trong vi phải xuất hiện trong en cùng key (catch typo như `{count}` vs `{counts}`).
     - Smoke test cho 3 badge keys (`shell.badge.{breakthroughReady,bossActive,topupPending}`).
     - Hiện tại 0 mismatch — bảo vệ future contributor thêm key mới quên thêm cả hai locale.
  3. **i18n keys mới** — `shell.badge.breakthroughReady` (vi: "Sẵn sàng đột phá cảnh giới", en: "Ready to break through realm").
- **Changes**:
  1. **`apps/web/src/components/shell/AppShell.vue`** (+7 line): `<RouterLink to="/home">` thêm `class="... relative"` + `<span v-if="badges.breakthroughReady">` với `data-testid="shell-nav-home-breakthrough-badge"` + `:title="t('shell.badge.breakthroughReady')"`.
  2. **`apps/web/src/i18n/{vi,en}.json`** (+1 key mỗi locale): `shell.badge.breakthroughReady`.
  3. **`apps/web/src/i18n/__tests__/parity.test.ts`** (mới, +93 line, **+6 vitest**): flatten lồng nhau → Map<dot.path, leaf> với hỗ trợ array (onboarding lines), 4 test parity (vi→en, en→vi, no empty vi, no empty en) + 1 test ICU placeholder parity + 1 smoke test cho `shell.badge.*`.
- **Tests added**: **+6 vitest** (web: 168 → **174**, file count 21 → **22**). Hiện tại `vi.json` và `en.json` parity 100% — 0 missing key, 0 empty value, 0 placeholder mismatch.
- **CI status (local sau khi rebase main `7d1965e`)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/web test` ✅ **174/174** (22 file) · `pnpm build` ✅ (web precache 45 entries / 738.03 KiB).
- **Risk**: cực thấp — (a) badge wiring pure additive, không đổi logic cũ; (b) parity test validate state có sẵn, không modify file vi/en (ngoài 1 key mới); (c) không touch BE/schema/migration. Không có đang lo regress đã hiển thị breakthrough badge trước đây — chiếm `relative` class + `<span v-if>` chuyển state pi nia.
- **Rollback**: revert single PR. AppShell home link trở lại không có badge, parity test biến mất. Không touch schema/migration/seed.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry), §12 Tests (web 168 → 174, file count 21 → 22, tổng 618 → ~624), §20 Roadmap (close task C), §21 Exact PR Plan (PR #107).

### PR #106 — `feat(web): admin inventory revoke UI — consume PR #66 BE (`POST /admin/users/:id/inventory/revoke`) + 7 vitest helper + i18n vi/en` — **Merged into main** @ `7d1965e` (29/4 ~19:09 UTC, CI 5/5 ✅ session 9g task B)

- **Branch**: `devin/1777489060-admin-inventory-revoke-fe`. **Base**: `main` @ `a907eb1` (sau PR #105 merge). **Status**: Merged into main.
- **Mục tiêu**: đóng L7 FE — BE `POST /admin/users/:id/inventory/revoke` đã tồn tại từ PR #66 với `@RequireAdmin()` guard + ledger `ADMIN_REVOKE` + audit log `admin.inventory.revoke`. Trước PR này FE chưa có UI → admin phải dùng curl/postman để thu hồi item grânt nhầm. PR này thêm helper `adminRevokeInventory(id, itemKey, qty, reason)` + nút "Thu hồi item" trong row Users tab + modal với 3 trường (`itemKey`, `qty 1..999`, `reason`) → toast + refresh list.
- **Changes**:
  1. **`apps/web/src/api/admin.ts`** (+20 line): thêm helper `adminRevokeInventory(id, itemKey, qty, reason)` gọi `POST /admin/users/:id/inventory/revoke` với `encodeURIComponent(id)` an toàn. JSDoc mô tả schema + lỗi BE map (`ITEM_NOT_FOUND` / `INSUFFICIENT_QTY` → `INVALID_INPUT`).
  2. **`apps/web/src/views/AdminView.vue`** (+~70 line): import helper mới, thêm `revokeOpen` / `revokeItemKey` / `revokeQty` / `revokeReason` refs, hàm `openRevoke(u)` (chặn self-target) + `submitRevoke()` (validate `itemKey` non-empty + `qty` integer 1..999 client-side rồi call helper). Thêm nút **"Thu hồi item"** trong cột action của Users tab — chỉ hiển thị cho ADMIN (`v-if="isAdmin()"`), disabled nếu `isSelfRow(u)`. Modal với `data-testid="admin-users-revoke-modal"` chứa 3 input + submit/cancel.
  3. **`apps/web/src/i18n/vi.json`** (+10 key): `admin.users.{revokeBtn,revokeTitle,revokeHint,revokeItemKey,revokeQty,revokeReason,revokeReasonPlaceholder,revokedToast,revokeMissingItemKey,revokeInvalidQty}`.
  4. **`apps/web/src/i18n/en.json`** (+10 key): mời trên.
  5. **`apps/web/src/api/__tests__/admin.inventory-revoke.test.ts`** (mới, +95 line, **+7 vitest**): cover (a) POST URL + body đúng format; (b) `encodeURIComponent` userId; (c) `INVALID_INPUT` BE → throw với code; (d) `FORBIDDEN` defense-in-depth; (e) UNKNOWN khi response thiếu data+error; (f) `reason=""` forward nguyên; (g) qty=999 max boundary.
- **Tests added**: **+7 vitest** (web: 161 → **168**, file count 20 → **21**). Không thêm BE test — BE đã có 16 vitest từ PR #66 (`apps/api/src/modules/admin/admin-revoke-inventory.test.ts`).
- **CI status (local sau khi rebase main `a907eb1`)**: `pnpm typecheck` ✅ (3 project) · `pnpm lint` ✅ (max-warnings 0) · `pnpm --filter @xuantoi/web test` ✅ **168/168** · `pnpm build` ✅ (web precache 45 entries / 737.51 KiB).
- **Risk**: Thấp — BE đã tồn tại + đã có 16 BE vitest cover edge case (qty 0 / >999 / item not found / insufficient / self-target). FE pure additive, không đổi logic cũ (Grant modal / Ban / SetRole đều nguyên). Có client-side validation trước khi gọi BE. ADMIN-only `v-if` + BE `@RequireAdmin()` defense-in-depth.
- **Rollback**: revert single PR. Không touch schema/migration/seed.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry), §12 Tests (web 161 → 168, file count 20 → 21, tổng 611 → ~618), §20 Roadmap (close task B), §21 Exact PR Plan (mấu PR #106 Done).

### PR #105 — `docs(handoff): session 9g audit refresh — bump snapshot c026f37 + mark PR #104 Merged + sync web vitest baseline 161/161 + add session 9g roadmap` — **Merged into main** @ `a907eb1` (29/4 ~19:00 UTC, CI 4/4 ✅ session 9g)

- **Branch**: `devin/1777488654-audit-session-9g-refresh`. **Base**: `main` @ `c026f37` (post-PR #104 docs/CHANGELOG bootstrap merge). **Status**: docs-only — Merged.
- **Mục tiêu**: Header trước (snapshot `ee933ad` PR #97) lệch 7 PR vì #98/#99/#100/#101/#102/#103/#104 đã merge cascade session 9f trong khi report cũ vẫn ghi PR #104 "Pending merge" và baseline web vitest 133/133. Audit này: (1) bump snapshot → `c026f37`; (2) chuyển PR #104 sang **Merged into main**; (3) cập nhật baseline web vitest **133→161** + file count **17→20** (PR #99 +10 LeaderboardView, PR #100 +12 adminGuards, PR #102 +12 Forgot/ResetPasswordView); (4) close §20 task F (PR #104 Done); (5) thêm Roadmap session 9g task A→D (audit refresh + FE admin inventory revoke + smart UX polish + runtime smoke).
- **Files**: `docs/AI_HANDOFF_REPORT.md` (header §0/§2/Recent Changes/§12/§20/§21).
- **Tests**: không thêm test mới (docs-only). Đã verify local baseline trên main `c026f37`: typecheck ✅ · lint ✅ · shared 55/55 ✅ · web 161/161 ✅ · build ✅. API test cần `pnpm infra:up` (PG+Redis) — bỏ qua trong session docs-only, CI sẽ chạy.
- **Risk**: Cực thấp. Doc-only, không touch code/schema/test/migration. Rollback: revert single PR.
- **`AI_HANDOFF_REPORT.md updated`**: §0 header (snapshot + baseline + status), §2 (commit audit), Recent Changes (this entry + PR #104 status), §12 Tests (web vitest 161), §20 (close task F + add session 9g A→D), §21 (mark PR #104 Done + new session 9g pending PR list).

### PR #104 — `docs(changelog): bootstrap docs/CHANGELOG.md — gom highlight PR #33→#103 thành section session 9d/9e/9f + Unreleased` — **Merged into main** @ `c026f37` (29/4 ~18:40 UTC, CI 5/5 ✅ session 9f)

- **Branch**: `devin/1777487587-docs-changelog-bootstrap`. **Base**: `main` @ `3c1aa39` (post-PR #103 timing-fix merge). **Status**: docs-only — Merged.
- **Mục tiêu** (theo §15 docs gap "Thiếu — Hiện track qua PR description. Nên consolidate"): tạo file `docs/CHANGELOG.md` user/operator-facing dễ đọc thay vì đọc 70+ PR description. Format Keep-a-Changelog adapted closed-beta — section theo "session khoảng PR" (chưa release public), section nhỏ Added/Changed/Fixed/Security/Docs/Internal.
- **Sections seeded**: Unreleased (rỗng), session 9f PR #98→#103 (forgot/reset full stack + 2 Devin Review fix + leaderboard tabs + admin self-protect + audit refresh + CHANGELOG bootstrap), session 9e PR #92→#97 (backup/restore + mobile responsive), session 9d PR #80→#91 (daily login + admin giftcode + activity log + proverbs + logout-all modal + giftcode dup fix), Earlier PR #33→#79 highlight.
- **Hướng dẫn format** cho future PR: tự bổ sung 1 dòng vào section "Unreleased" mỗi khi merge.
- **Files**: `docs/CHANGELOG.md` (mới, +124 line), `docs/AI_HANDOFF_REPORT.md` (mark §15 docs gap CHANGELOG → "Có (PR #104)").
- **Risk**: Cực thấp. Doc-only, không touch code/schema/test. Có thể rollback bằng cách xoá file.

### PR #103 — `fix(api): forgotPassword timing side-channel — argon2.hash giả cho user-not-exist/banned (Devin Review r3163261711)` — **Merged into main** @ `3c1aa39` (29/4 ~18:55 UTC, CI 5/5 ✅) session 9f

- **Branch**: `devin/1777487244-auth-forgot-timing-fix`. **Base**: `main` @ `6f3faf4` (post-PR #101 stack merge). **Merge commit**: `3c1aa39`.
- **Vấn đề**: `forgotPassword` thiết kế silent-ok nhưng path-có-user chạy argon2.hash (~100ms) còn path-không-user return ngay (~vài ms) → attacker đo network latency phân biệt email.
- **Fix**: Thêm `argon2.hash('xt-forgot-password-dummy-padding', ARGON2_OPTS)` trong nhánh `!user || user.banned` để timing parity.
- **Test added** (+1 it `auth.service.test.ts` 15→16 it): `forgotPassword: timing parity user-exists vs not-exists` (ratio ≥ 0.5).
- **Files**: `apps/api/src/modules/auth/auth.service.ts` (+7 line), `apps/api/src/modules/auth/auth.service.test.ts` (+22 line).
- **Risk**: Cực thấp. Không thay đổi public API behavior. Rate-limit 3/IP/15min đã chặn amplification.

### PR #102 — `feat(web): forgot/reset-password views + AuthView "Quên huyền pháp?" link + 12 vitest` — **Merged into PR #101 branch** @ `5ca225e` (29/4 ~18:10 UTC, CI 5/5 ✅) — sẽ vào main khi PR #101 merge

- **Branch**: `devin/1777485608-fe-forgot-reset-views-stacked` (stacked trên PR #101 vì cần shared types `ForgotPasswordInput` + `ResetPasswordInput`). **Status**: code complete + typecheck/lint/test/build all xanh local (web 137→**149 vitest**, +12 mới).
- **Mục tiêu** (Roadmap §20 session 9f task D follow-up): consume PR #101 BE bằng FE form views — đóng nốt luồng forgot/reset cho closed beta.
- **Changes**:
  1. **`apps/web/src/views/ForgotPasswordView.vue`** (mới, +119 line): form email → call `forgotPassword()`, hiển thị "đã gửi" silent ok cho mọi email (chống enum), show `devToken` panel + shortcut "→ Đặt lại huyền pháp" khi non-prod (`NODE_ENV !== 'production'`).
  2. **`apps/web/src/views/ResetPasswordView.vue`** (mới, +130 line): auto-fill token từ `?token=...` query (≥16 char), fallback paste tay nếu thiếu; password + confirm với mismatch indicator real-time, disable submit nếu mismatch; `resetPassword()` → toast success + `router.push('/auth')`.
  3. **`apps/web/src/router/index.ts`**: thêm 2 route public `/auth/forgot-password` + `/auth/reset-password`.
  4. **`apps/web/src/api/auth.ts`**: thêm `forgotPassword(input)` (return `{ok, devToken}`) + `resetPassword(input)`.
  5. **`apps/web/src/views/AuthView.vue`**: tab login thêm `<router-link to="/auth/forgot-password">` thay cho text note (vẫn giữ note dạng paragraph riêng).
  6. **i18n** `vi.json` + `en.json`: thêm `auth.forgot.{title,subtitle,email,submit,back,sent,devTokenNote}` + `auth.reset.{title,subtitle,token,tokenFromUrl,newPassword,confirm,submit,success,mismatch,missingToken}` + `auth.errors.INVALID_RESET_TOKEN`.
  7. **Vitest** `apps/web/src/views/__tests__/{ForgotPasswordView,ResetPasswordView}.test.ts` (+12 it): forgot mock API + sent state + devToken UI + RATE_LIMITED toast + back link + email empty no-call; reset auto-fill from URL + paste fallback + short-token ignore + submit ok + mismatch error + INVALID_RESET_TOKEN toast + missing token guard.
- **Files**: `apps/web/src/views/ForgotPasswordView.vue` (mới, +119), `apps/web/src/views/ResetPasswordView.vue` (mới, +130), `apps/web/src/router/index.ts` (+12), `apps/web/src/api/auth.ts` (+25), `apps/web/src/views/AuthView.vue` (+8/-3), `apps/web/src/i18n/{vi,en}.json` (+30 mỗi file), `apps/web/src/views/__tests__/{ForgotPasswordView,ResetPasswordView}.test.ts` (mới, +280).
- **Tests local**: typecheck ✅, lint ✅, web vitest **149/149**, web build ✅ (45 precache entries).
- **Risk**: Thấp. FE-only, không touch schema/BE/economy. Public route không yêu cầu auth (đúng thiết kế). Mismatch confirm + minlength 8 client-side check phụ trên BE Password zod. `devToken` panel chỉ hiện khi BE trả non-null (BE chỉ trả non-null khi `NODE_ENV !== 'production'`).
- **Bước tiếp theo**: smoke runtime với `pnpm infra:up` + Mailhog UI (`http://localhost:8025`) sau khi PR #101 + #102 merge.

### PR #101 review fix (Devin Review BUG_pr-review-job-...) — **Token format `<id>.<secret>` thay scan limit 50** (29/4 ~18:30 UTC)

- **Vấn đề báo bởi Devin Review** ([comment #r3163113344](https://github.com/hoathienmenh-01/xuantoi/pull/101#discussion_r3163113344)): `resetPassword` cũ scan tất cả token active với `take: 50` rồi loop `argon2.verify` từng row → nếu attacker từ ~17 IP (mỗi IP rate-limit 3/15min) tạo 51+ token cho 51+ email → token nạn nhân bị đẩy khỏi top-50 scan window → silently rejected as `INVALID_RESET_TOKEN`. Đây vừa là correctness bug (valid token → wrong error) vừa là DOS vector.
- **Fix**: Token format mới `<tokenId>.<secret>` (Devin Review đề xuất):
  - `tokenId` = UUID (`randomUUID()`, non-secret, dùng để index DB row).
  - `secret` = 32-byte URL-safe base64 (như cũ, plaintext không lưu DB).
  - Plaintext gửi qua email = `${tokenId}.${secret}`.
  - DB lưu `id = tokenId` + `hashedToken = argon2.hash(secret)`.
- **`resetPassword` rewrite**: split token theo dot → `findUnique({ where: { id: tokenId } })` (O(1) PK lookup) → `argon2.verify(row.hashedToken, secret)` chỉ 1 lần. Bỏ hoàn toàn loop + `take: 50`. Không còn DOS vector từ token flooding.
- **Test added** (+4 it `auth.service.test.ts` 11→15 it):
  - `token format id.secret → lookup O(1)` (verify format + hash không chứa secret plaintext).
  - `token id đúng + secret sai → INVALID_RESET_TOKEN`.
  - `token id không tồn tại → INVALID_RESET_TOKEN` (chống enum).
  - `token thiếu dot → INVALID_RESET_TOKEN` (format guard).
- **Files**: `apps/api/src/modules/auth/auth.service.ts` (forgotPassword + resetPassword), `apps/api/src/modules/auth/auth.service.test.ts` (+4 it).
- **Compat**: Token chỉ tồn tại 30 phút TTL → user pending sẽ phải refresh `forgot-password` để có token format mới (acceptable migration trade-off).
- **Risk**: Thấp. Hash cũ trong DB vẫn argon2 nhưng giờ verify với `secret` thay vì full plaintext → token đã phát trước fix sẽ không reset được (force user re-request, max 30 phút delay). Schema không đổi.

### PR #101 — `feat(api): forgot/reset-password endpoints + EmailService scaffold (Mailhog)` — **Pending merge** session 9f

- **Branch**: `devin/1777484371-auth-forgot-reset-password`. **Base**: `main` @ `5a93d22` (sau PR #99 merged). **Status**: code complete + typecheck/lint/build all xanh local; 11 vitest mới (api auth.service.test.ts) chưa run live cần `pnpm infra:up` + `prisma migrate deploy` — CI sẽ chạy đủ.
- **Mục tiêu** (Roadmap §20 session 9f task D — closed beta nice-to-have): trước PR #101, không có cách reset password nếu user quên — chỉ có `change-password` cần old pass. Closed beta cần luồng `forgot-password` an toàn không bị user enumeration + `reset-password` one-shot token.
- **Giải pháp** (BE-only, FE form sẽ là PR riêng):
  1. **Prisma model** `PasswordResetToken { id, userId, hashedToken (argon2id), expiresAt, consumedAt, createdAt }` + migration `20260429180000_add_password_reset_token`. Token plaintext không lưu DB.
  2. **`apps/api/src/modules/email/{email.service,email.module}.ts`** (mới): SMTP transactional service tách biệt `MailModule` (in-game letter system). 2 mode: `console` (mặc định, log stdout cho CI/test) vs `smtp` (nodemailer → Mailhog dev hoặc SMTP thật). `sendPasswordResetEmail()` build link `WEB_PUBLIC_URL/auth/reset-password?token=...`.
  3. **`apps/api/src/modules/auth/auth.service.ts`**:
     - `forgotPassword(input, ctx)`: rate-limit 3/IP/15min (anti-mailflood); silent ok khi user not exist hoặc banned (chống user enumeration); revoke token cũ chưa consumed của user, tạo token mới (32-byte URL-safe base64 plaintext, argon2id hash trong DB), TTL 30 phút; gửi email best-effort (fail-silent để response time không leak); trả `{ devToken }` khi `NODE_ENV !== 'production'` cho E2E test.
     - `resetPassword(input)`: scan candidate token (consumedAt null + expiresAt > now, take 50, order desc), `argon2.verify` từng row tìm match (token plaintext không index được); atomic transaction: mark token consumed, mark mọi token reset khác của user consumed (chống multi-window), update `passwordHash` + bump `passwordVersion`, revoke tất cả refresh token active. Throw `INVALID_RESET_TOKEN` cho mọi fail (token sai/expired/consumed/user banned).
  4. **`apps/api/src/modules/auth/auth.controller.ts`**: `POST /_auth/forgot-password` (body `{email}`, fail-silent ngoài rate-limit) + `POST /_auth/reset-password` (body `{token, newPassword}`, throw 400 `INVALID_RESET_TOKEN`).
  5. **DI** `auth.module.ts`: thêm `forgotPasswordLimiterProvider` (Redis hoặc in-memory fallback) như `registerLimiterProvider`. `EmailModule` ở app.module global.
  6. **Shared zod** `packages/shared/src/api-contracts.ts`: `ForgotPasswordInput {email}` + `ResetPasswordInput {token, newPassword}` + thêm `INVALID_RESET_TOKEN` vào `AuthErrorCode` enum + `AUTH_ERROR_VI` map.
  7. **Vitest BE** `auth.service.test.ts` (+11 it): forgot ok devToken, forgot user-not-exist silent, forgot banned silent, forgot dual-call revoke cũ, forgot rate-limit `RATE_LIMITED`; reset ok bump passwordVersion + revoke refresh, reset wrong token, reset consumed (one-shot), reset expired, reset user banned post-token.
  8. **Env scaffold** `apps/api/.env.example`: thêm `SMTP_HOST/PORT/USER/PASS/FROM` + `MAIL_TRANSPORT=console` + `WEB_PUBLIC_URL`. Mailhog đã có sẵn trong `infra/docker-compose.dev.yml` (port 1025/8025).
  9. **Deps**: `apps/api/package.json` thêm `nodemailer` + `@types/nodemailer`.
- **Files**: `apps/api/prisma/schema.prisma` (+15), `apps/api/prisma/migrations/20260429180000_add_password_reset_token/migration.sql` (mới, +20), `apps/api/src/modules/email/{email.service,email.module}.ts` (mới, +119), `apps/api/src/modules/auth/{auth.service,auth.controller,auth.module}.ts` (+150), `apps/api/src/modules/auth/auth.service.test.ts` (+125, +11 it), `apps/api/src/app.module.ts` (+2), `apps/api/.env.example` (+13), `apps/api/package.json` + `pnpm-lock.yaml` (nodemailer dep), `packages/shared/src/api-contracts.ts` (+18).
- **Tests local**: typecheck ✅, lint ✅, web vitest 137/137 (không touch web), api build ✅. API 11 vitest mới skip vì cần infra:up — CI sẽ run.
- **Risk**: Thấp/Vừa. Migration thêm 1 table mới (không touch table cũ). Không thay đổi schema User. Endpoint mới mở public không yêu cầu auth (đúng thiết kế forgot-password). Rate-limit anti-spam. Argon2 cost ~150ms/verify × tối đa 50 candidate → response time ≤ ~7s nếu DB đầy token (production: token 30min TTL nên row count thấp).
- **Bước tiếp theo (post-merge)**: FE form `/auth/forgot-password` + `/auth/reset-password` views (PR riêng FE only, sẽ tự pick).

### PR #100 — `feat(web,api): admin self-demote/self-target prevention — FE guards + BE setRole/setBanned vitest` — **Merged into main** @ `47d34b5` (29/4 ~17:45 UTC, CI 5/5 ✅) session 9f

- **Branch**: `devin/1777483905-admin-self-demote-prevention`. **Base**: `main` @ `5a93d22` (rebased onto post-#99 main). FE `AdminView.vue` disable role select + grant + ban button cho self row, badge "Bạn", tooltip lock-out warning + helper module `apps/web/src/lib/adminGuards.ts` (+12 vitest pure) + BE vitest +2 (setRole/setBanned self-block lock-in). Web vitest 137→**149/149**. CI 5/5 ✅ (post-rebase). Risk thấp.

### PR #99 — `feat(web): LeaderboardView tabs Power/Topup/Sect — consume PR #94 BE` — **Merged into main** @ `5a93d22` (29/4 ~17:35 UTC, CI 5/5 ✅)

- **Branch**: `devin/1777483089-fe-leaderboard-tabs`. **Base**: `main` @ `4072a3d` (sau PR #98 docs audit refresh merged). **Status**: Merged. typecheck/lint/test/build all xanh local (web 133→137 vitest, +4 net = 6 new test cover tab switch + topup table + sect table BigInt format + lazy-fetch + aria-selected, replace 3 cũ với mock 3-fn).
- **Mục tiêu** (Roadmap §20 session 9f task B): consume PR #94 BE leaderboard topup/sect endpoints. Trước PR #99: `LeaderboardView.vue` chỉ render top power; `GET /leaderboard/topup` + `GET /leaderboard/sect` chưa có FE consumer.
- **Giải pháp** (FE-only):
  1. **API client `apps/web/src/api/leaderboard.ts`**: thêm `LeaderboardTopupRow` (rank, characterId, name, realmKey, realmStage, totalTienNgoc:number, sectKey) + `LeaderboardSectRow` (rank, sectId, sectKey, name, level, treasuryLinhThach:string BigInt, memberCount, leaderName) + `fetchLeaderboardTopup()` + `fetchLeaderboardSect()`.
  2. **`LeaderboardView.vue`** rewrite với 3 tab `power | topup | sect`:
     - Tablist `role=tablist` với `data-testid=leaderboard-tab-{power,topup,sect}` + `aria-selected` đúng cho a11y.
     - Lazy-fetch: chỉ gọi `fetch{Power,Topup,Sect}` lần đầu user click tab đó (cache trong refs). Không re-fetch nếu click cùng tab 2 lần.
     - Power table: y nguyên (rank/name/realm/sect/power).
     - Topup table: rank/name/realm/sect/totalTienNgoc với rank ≤3 highlight amber.
     - Sect table: rank/sectName(i18n nếu có sectKey, else fallback `name` BE)/leaderName/level/memberCount/treasuryLinhThach. Treasury format BigInt-string với `formatBigIntString()` (regex thousand separator) để tránh `Number()` overflow.
  3. **i18n** `apps/web/src/i18n/{vi,en}.json`: refactor `leaderboard.subtitle` từ string → object `{power, topup, sect}`; thêm `leaderboard.tab.{power, topup, sect}`; thêm `leaderboard.col.{totalTienNgoc, sectName, leader, level, members, treasury}`.
  4. **Test** `apps/web/src/views/__tests__/LeaderboardView.test.ts`: refactor mock từ 1-fn thành 3-fn (`fetchPower/Topup/Sect`); giữ 4 power test cũ (skeleton, empty, error+retry, render power, rank highlight, lazy-fetch chỉ power) + 4 test mới (tab topup render + format, tab sect render + BigInt format, click cùng tab 2 lần fetch chỉ 1, aria-selected).
- **Files**: `apps/web/src/api/leaderboard.ts` (+27 line), `apps/web/src/views/LeaderboardView.vue` (rewrite, 108→302 line), `apps/web/src/views/__tests__/LeaderboardView.test.ts` (rewrite, 171→307 line, 6→10 test), `apps/web/src/i18n/{vi,en}.json` (refactor subtitle + add tab + cols).
- **Tests local**: web vitest 133→**137 pass / 137 total** (17 file). typecheck ✅, lint ✅, build ✅.
- **Risk**: Thấp — FE-only, không touch BE/schema/economy/auth. i18n key `leaderboard.subtitle` shape thay đổi (string → object) — nhưng chỉ `LeaderboardView.vue` consume key này, đã grep verify. Rollback: revert single PR.
- **Bước tiếp theo (post-merge)**: task C session 9f roadmap (admin self-demote prevention) hoặc task D (forgot/reset-password endpoints).

### PR #98 — `docs(handoff): session 9f audit refresh — bump snapshot ee933ad + mark PR #92→#97 Merged + add session 9f roadmap A-D` — **Merged into main** @ `4072a3d` (29/4 ~17:18 UTC, CI 4/4 ✅)

- **Branch**: `devin/1777482757-audit-session-9f-refresh`. **Base**: `main` @ `ee933ad`. Docs-only, +28/-15 line `docs/AI_HANDOFF_REPORT.md`. Bump snapshot `3283e42 → ee933ad`, đồng bộ trạng thái 6 PR session 9d→9e (#92/#93/#94/#95/#96/#97), thêm sub-section Immediate session 9f với task A→D.

### PR #97 — `fix(web): mobile responsive — AppShell sidebar drawer + AdminView tables overflow-x-auto` — **Merged into main** @ `ee933ad` (29/4 ~16:47 UTC, CI 5/5 ✅)

- **Branch**: `devin/1777479151-mobile-responsive-polish`. **Base**: `main` @ `253c4b1` (sau PR #96 merged). **Status**: Merged. typecheck/lint/web test 133/133/build all xanh local + CI.
- **Mục tiêu** (Roadmap §20 #14 — closed beta UX polish): trên iPhone SE (375×667 viewport), AppShell sidebar `hidden md:flex` ẩn hoàn toàn → user mobile không thể navigate. AdminView 4 table có 6-9 cột → overflow ngang silent (rows bị chen ép vì không có wrapper scroll).
- **Giải pháp** (CSS-only):
  1. **AppShell mobile drawer** (`apps/web/src/components/shell/AppShell.vue`): thêm hamburger button `md:hidden` góc top-left header (data-testid `shell-mobile-toggle`, aria-label dùng i18n key `shell.nav.toggle`), state `mobileNavOpen` ref + watch `route.fullPath` auto-close khi navigate. Sidebar đổi từ `hidden md:flex` → responsive: `fixed md:static` + `transform translate-x-0/-translate-x-full md:translate-x-0` slide-in animation từ trái + backdrop `bg-black/60` click để close.
  2. **AdminView tables** (`apps/web/src/views/AdminView.vue`): wrap 4 table (users, topup, audit, giftcode) bằng `<div class="overflow-x-auto">` + thêm `min-w-[640px]`/`min-w-[560px]` cho phép horizontal scroll thay vì ép column.
  3. **i18n key `shell.nav.toggle`** (vi: "Mở menu điều hướng", en: "Toggle navigation menu") cho aria-label hamburger button.
- **Files**: `apps/web/src/components/shell/AppShell.vue` (+30 line layout/state), `apps/web/src/views/AdminView.vue` (4 wrap × ~3 line + ESLint --fix re-indent), `apps/web/src/i18n/{vi,en}.json` (+1 key mỗi file).
- **Tests**: 133/133 web vitest unchanged (CSS-only, không touch logic).
- **Risk**: Thấp — CSS + state nhỏ, no schema/API/data change. Rollback: revert single PR.
- **Bước tiếp theo (mobile)**: MissionView/MarketView đã dùng flex-wrap (acceptable trên 375px), ActivityView chưa kiểm tra runtime trên emulator. Có thể follow-up PR khác sau khi runtime smoke verify.

### PR #96 — `fix(scripts): backup/restore reliability — SIGPIPE-safe verify + pg_terminate_backend trước DROP` — **Merged into main** @ `253c4b1` session 9e (CI 5/5 ✅)

- **Branch**: `devin/1777480220-backup-restore-reliability-fixes`. **Base**: `main` (sau PR #95 merged). **Status**: code complete + scripts smoke pass live (verify dump 1.67MB decompressed + restore với active connection blocking).
- **Mục tiêu**: 2 bug functional Devin Review tìm được sau khi PR #95 merged:
  1. **🔴 SIGPIPE bug** trong `scripts/backup-db.sh` — pipeline `gunzip -c | head -5 | grep` dưới `set -euo pipefail` exit 141 cho database > 64KB decompressed (head đóng stdin → SIGPIPE → gunzip exit 141 → pipefail propagate). Mọi production DB sẽ trigger false-fail. Fix: capture HEADER vào variable trước khi grep, `|| true` để tránh pipefail.
  2. **🟡 DROP DATABASE blocked bởi active connections** trong `scripts/restore-db.sh` — Postgres từ chối DROP nếu Prisma client / pgAdmin / API server còn connect. Fix: `pg_terminate_backend(pid) WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid()` trước cả 2 path docker + host.
- **Files**: `scripts/backup-db.sh` (+5 line, replace 1 line) + `scripts/restore-db.sh` (+10 line).
- **Smoke pass**: backup 1.67MB decompressed dump (5000 row × 128-byte md5) → verify success (no SIGPIPE). Restore với simulated `pg_sleep(120)` active session → terminated thành công → DROP + CREATE + restore success → 21 table restored.
- **Risk**: Thấp — script ops only, không touch code/schema/test pipeline.

### PR #95 — `feat(ops): backup/restore Postgres script + docs/BACKUP_RESTORE.md` — **Merged into main** session 9e (CI 5/5 ✅; security fix Devin Review)

- **Branch**: `devin/1777478618-backup-restore-script`. **Base**: `main` @ `fed47a6` (sau PR #94 merged). **Status**: Merged. Devin Review credential leak fix applied (mask password trong stdout/log).
- **Mục tiêu** (Roadmap §20 #13): production readiness §8 — closed beta cần backup/restore tự động, chưa có. Disaster recovery để ngăn mất player data sau migration sai / container crash / admin xoá nhầm.
- **Giải pháp**: `scripts/backup-db.sh` (~95 line bash, executable) — `pg_dump --format=plain | gzip -9` ghi `<BACKUP_DIR>/<YYYYMMDD-HHMMSS>-<dbname>.sql.gz`, auto-detect host pg_dump vs `docker exec xuantoi-pg`. `scripts/restore-db.sh` (~100 line bash, executable) — argument file.sql.gz, prompt `Type 'yes'` confirm (skip với `ASSUME_YES=1`), DROP + CREATE + restore. `pnpm backup:db` + `pnpm restore:db` npm scripts root level. `docs/BACKUP_RESTORE.md` (~210 line) — TL;DR + workflow + cron daily mẫu + disaster recovery checklist + hạn chế hiện tại.
- **Security**: DATABASE_URL credentials masked qua `sed` regex (`://user:***@`) khi echo. FATAL messages cũng dùng SAFE_URL — không leak password vào log/cron file khi `ASSUME_YES=1` redirect stdout.
- **Tested live**: `BACKUP_DIR=/tmp/test-backups pnpm backup:db` → 5966 byte gzip, 21 `CREATE TABLE`. `ASSUME_YES=1 pnpm restore:db <file>` → DROP + CREATE + restore success.
- **Risk**: Thấp — script ops thuần, không touch code/schema/test pipeline. Confirm prompt mặc định ngăn DROP nhầm prod.

### PR #94 — `feat(api): leaderboard topup + sect — top nạp Tiên Ngọc + xếp hạng tông môn` — **Merged into main** @ `fed47a6` (29/4 session 9e, CI 5/5 ✅)

- **Branch**: `devin/1777477707-leaderboard-topup-sect`. **Base**: `main` @ `a5821ee` (sau PR #92 merged). **Status**: code complete + local typecheck/lint xanh + api test 382/382 (leaderboard 7→20, +13 vitest mới) + build xanh. CI GitHub 5/5 ✅.
- **Mục tiêu** (Roadmap §20 #11 — closed beta nice-to-have): leaderboard `power` đã có từ PR #59, nhưng `topup` (đua nạp tiên ngọc) và `sect` (đua tông môn) còn thiếu — 2 endpoint này khuyến khích economy + sect competition cho closed beta.
- **API contract**: `GET /api/leaderboard/topup?limit=N` (1≤N≤100, default 50) → rows `{ rank, characterId, name, realmKey, realmStage, totalTienNgoc, sectKey }`. `GET /api/leaderboard/sect?limit=N` → rows `{ rank, sectId, sectKey, name, level, treasuryLinhThach (string), memberCount, leaderName }`.
- **Files**: `apps/api/src/modules/leaderboard/{service,controller,test}.ts` (+343 line, +13 vitest). Test api 369→382.
- **Risk**: Thấp — BE only, read-only aggregate. Không touch schema/migration/economy.
- **Bước tiếp theo**: FE consumer LeaderboardView tab Power/Topup/Sect (PR riêng FE only).

### PR #92 — `docs(beta): refresh BETA_CHECKLIST.md — sync 14+ feature đã merge sau PR #59→#91` — **Merged into main** @ `a5821ee` (29/4 ~16:00 UTC, CI 5/5 ✅)

- **Branch**: `devin/1777474187-docs-beta-checklist-refresh`. **Base**: `main` @ `d37b6d4` (sau PR #91 + #93 merged). **Status**: docs-only PR mở từ session 9d, conflict với cascade #91/#93 → session 9e merge main giữ session 9e snapshot + add PR #92 entry mới này.
- **Mục tiêu** (Smart docs/handoff §7 — `docs/BETA_CHECKLIST.md` lệch nghiêm trọng): file đánh dấu nhiều mục là "🔲 Chưa làm" nhưng thực tế đã merge từ session 5-9. Test count "94 test" (api 77 + shared 17) lệch hẳn so với thực tế **557 test** (api 369 + web 133 + shared 55) — sai lệch 6×. PM/PO đọc sẽ tưởng beta chưa sẵn sàng và yêu cầu duplicate work.
- **Phát hiện gap** (8 nhóm):
  - **Smart beta gameplay**: thiếu list Daily Login (PR #80), Leaderboard (PR #59), Public Profile, NextActionPanel, A Linh, /activity tab (PR #91), `pnpm audit:ledger` script. Đã marker "MissionProgress chưa làm" nhưng thực tế đã merge.
  - **Mail system + GiftCode + LogsModule** ghi pending — thực tế đã có `MailView.vue`/`GiftCodeView.vue`/`/api/logs/me` (PR #88) live + admin UI filter (PR #81/#84).
  - **LoginAttempt prune cron + RefreshToken cleanup**: ghi pending, thực tế `apps/api/src/modules/ops/ops.processor.ts` đã có repeatable BullMQ `prune`.
  - **Redis rate limit chat**: ghi pending, thực tế `chatRateLimiterProvider` ở `apps/api/src/modules/chat/chat.module.ts` đã có.
  - **Health check `/health`,`/ready`**: ghi pending, thực tế `apps/api/src/modules/health/health.controller.ts` đã có 3 endpoint `/healthz`/`/readyz`/`/version`.
  - **Test count**: 94 → **557** (auto-snapshot 29/4) + new PR #85 SettingsView logout-all 7 test, PR #80 Daily Login idempotent, PR #88 logs cursor + isolation 20 test.
  - **PR #83 L6 confirm modal + cross-tab 401 redirect**: chưa có entry.
  - **Admin tab**: ghi "5 tab" nhưng đã 7 tab; thiếu filter cho từng tab + role split MOD/ADMIN (PR #48).
  - **Loading splash proverbs**: thiếu PR #87 expand 7 → 64.
  - **Recent docs PR**: thiếu reference PR #89 (API.md), PR #90 (QA + Admin guide), PR #93 (audit session 9e refresh).
- **Thay đổi** (1 file):
  - `docs/BETA_CHECKLIST.md` (~120 line → ~155 line): chuyển 14 mục từ "🔲 Chưa làm" sang "✅ Đã hoàn thành"; bổ sung 12 mục thực tế đã làm chưa được liệt kê; cập nhật test count; add 7 row "smart beta gameplay" mới (Daily Login, Leaderboard, Public profile, NextActionPanel, A Linh, /activity, audit:ledger script); thêm 2 row hardening (chat rate limit, health endpoint); thêm "Recommended trước beta open" + "Đã đủ điều kiện cho closed beta" cut-line analysis.
- **Risk**: Cực thấp — docs only, không touch code/test/migration. Beta cut-line decision lúc này chính xác phản ánh code thực.
- **Rollback**: revert single PR.
- **Test added**: 0 (docs only).
- **CI status (local sau merge main)**: typecheck ✅ lint ✅ web test 133/133 ✅ shared test 55/55 ✅ build ✅ — không touch code nên baseline giữ nguyên từ session 9e.
- **Runtime smoke**: N/A (docs).
- **`AI_HANDOFF_REPORT.md updated`**: this Recent Changes entry.
- **Bước tiếp theo**: Audit RUN_LOCAL.md / DEPLOY.md / SECURITY.md / SEEDING.md / BALANCE.md cho staleness; hoặc execute QA_CHECKLIST runtime smoke trên local (15 phút); hoặc bắt đầu task top-priority tiếp theo theo §20 (leaderboard topup/sect, forgot-password, backup script, mobile responsive).

### PR #93 — `docs(handoff): session 9e audit refresh — bump snapshot 3283e42 + sync M6/G23 Merged status` — **Merged into main** @ `d37b6d4` (29/4 ~15:35 UTC, CI 4/4 ✅)

- **Branch**: `devin/1777476427-audit-session-9e-refresh`. **Base**: `main` @ `3283e42`. **Status**: Merged into main; CI 4/4 ✅ (build ×2 + e2e-smoke ×2). Docs-only.
- **Mục tiêu**: Sau khi audit session 9d (PR #86) merged, chuỗi follow-up #84/#87/#88/#89/#90/#91 đã merge cascade vào main 29/4 ~14:55 UTC nhưng report cũ vẫn ghi snapshot `bbb6718` + một số entry "Pending merge" cho M6/G23 → audit này đồng bộ trạng thái: header snapshot bbb6718 → 3283e42; §2 commit + CI gần nhất + 0 PR open; PR #91 entry status Pending merge → Merged @ 3283e42; PR #84 entry status Pending merge → Merged @ 05b05c0; §16 M6 row Resolved by PR #88 + PR #91; §17 logs/me Resolved; §20 Roadmap mark M6 BE+FE Done + add 4 NEW top-priority tasks (leaderboard topup/sect, forgot-password, backup/restore script, mobile responsive verify); §12 Tests refresh shared 47→55, web 64→133, api ~370→~369, add Logs (M6) row 20 test.
- **Files**: 1 file (`docs/AI_HANDOFF_REPORT.md` +38/-32 line).
- **Risk**: green — docs-only, no code/schema change.
- **Rollback**: revert single PR.
- **`AI_HANDOFF_REPORT.md updated`**: bản thân PR này là refresh report.

### PR #91 — `feat(web): /activity tab — M6 self audit log consumer (GET /logs/me)` — **Merged into main** @ `3283e42` (29/4 ~14:55 UTC, CI 5/5 ✅)

- **Branch**: `devin/1777473333-fe-logs-tab`. **Base**: `main` @ `c6da89a` (sau PR #88 + #90 merged). **Status**: Merged into main. typecheck/lint/test 369/133/55 + build xanh local; CI 5/5 xanh PR #91; runtime smoke pending (chuỗi M6 BE+FE cần verify với `pnpm dev` + `infra:up` real DB).
- **Mục tiêu** (Recommended Roadmap §20 — FE consumer cho M6 sau khi PR #88 merged): BE `GET /logs/me` đã live nhưng FE chưa có view nào tiêu thụ → endpoint chưa hữu dụng cho người chơi. Thêm tab "Hoạt Động" trong sidebar để player tự xem ledger thu/chi linh thạch + tiên ngọc + xuất nhập linh bảo (replace flow "support tra DB tay").
- **Giải pháp** (FE only, không touch BE/schema):
  - **`apps/web/src/api/logs.ts`** (new, ~70 line): `fetchLogsMe({ type, limit, cursor })` wrap `GET /logs/me`. Type `LogEntry = LogEntryCurrency | LogEntryItem` mirror BE `apps/api/src/modules/logs/logs.service.ts`. Envelope unwrap throw `Error & {code}` (cùng pattern `leaderboard.ts`).
  - **`apps/web/src/views/ActivityView.vue`** (new, ~225 line): tab toggle `currency|item` (default currency), keyset pagination "Xem thêm" button (không infinite scroll để tránh phụ thuộc IntersectionObserver), signed delta display (dương `+N` xanh, âm `-N` đỏ, 0 xám), reason map qua i18n `activity.reasons.${REASON}` fallback raw key, item name lookup qua `itemByKey()` từ `@xuantoi/shared`, currency label `LINH_THACH/TIEN_NGOC` qua i18n, error code map qua `activity.errors.${code}` fallback `UNKNOWN`. Skeleton 6 dòng khi loading lần đầu. Empty state khi `entries.length === 0`. Auth guard `router.replace('/auth')` nếu chưa login.
  - **`apps/web/src/router/index.ts`**: thêm route `/activity` lazy-loaded.
  - **`apps/web/src/components/shell/AppShell.vue`**: thêm sidebar link `帳 Hoạt Động` giữa `Nạp Tiên Ngọc` và `Tâm Pháp`.
  - **i18n**: thêm `activity.*` block (vi + en) — tabs, loading, loadMore, empty, errors UNAUTHENTICATED/NO_CHARACTER/INVALID_CURSOR/UNKNOWN, currencyLabel LINH_THACH/TIEN_NGOC, reasons cho 24 ledger reason code (CULTIVATE_TICK, BREAKTHROUGH_*, MISSION_REWARD, DAILY_LOGIN, MAIL_CLAIM, GIFTCODE_REDEEM, TOPUP_APPROVED, ADMIN_GRANT/REVOKE, MARKET_LIST/CANCEL/BUY/SELL/FEE, SHOP_BUY/SELL, SECT_DONATE, INVENTORY_EQUIP/UNEQUIP/USE, BOSS_REWARD, DUNGEON_DROP, ACHIEVEMENT). Reason không có key → fallback raw string (tương lai BE thêm reason mới không crash UI).
  - **`apps/web/src/views/__tests__/ActivityView.test.ts`** (new, ~285 line, 10 vitest): (1) skeleton khi đang fetch, (2) empty state, (3) currency delta dương `+N` xanh, (4) currency delta âm `-N` đỏ, (5) switch tab item gọi `type=item` reset entries, (6) item qtyDelta âm với item name từ catalog, (7) load more với cursor append, (8) error map qua i18n, (9) error code lạ → fallback UNKNOWN, (10) reason không có key → fallback raw không crash.
- **API contract consumed**:
  ```
  GET /logs/me?type=currency|item&limit=20&cursor=<opaque>
  → { ok: true, data: { entries: LogEntry[], nextCursor: string | null } }
  ```
- **Files** (5 file new + 3 file modified):
  - `apps/web/src/api/logs.ts` (new, 70 line)
  - `apps/web/src/views/ActivityView.vue` (new, 225 line)
  - `apps/web/src/views/__tests__/ActivityView.test.ts` (new, 285 line, 10 vitest)
  - `apps/web/src/router/index.ts` (+5 line, route)
  - `apps/web/src/components/shell/AppShell.vue` (+7 line, sidebar link)
  - `apps/web/src/i18n/vi.json` (+50 line, `activity.*` block)
  - `apps/web/src/i18n/en.json` (+50 line, `activity.*` block)
- **Risk**: Thấp — FE only, không thay schema/migration/BE. Read-only consumer của endpoint stable đã có 20 vitest cover (PR #88). Reason mapping fallback raw → BE thêm reason code mới không crash. Item catalog lookup fallback raw key.
- **Rollback**: revert single PR. Không có data migration. Sidebar link biến mất, route 404 → người chơi quay lại flow cũ (không có hoạt động).
- **Test added**: +10 web vitest. Tổng web: 123 → 133.
- **CI status (local)**: typecheck ✅ lint ✅ test 369 (api) / 133 (web) / 55 (shared) ✅ build ✅. CI GitHub: chờ.
- **Runtime smoke**: Pending — sẽ smoke khi merge: open `/activity`, verify currency tab render, switch tab item, load more, check delta sign + reason translation, test empty state cho character chưa có ledger entry.
- **`AI_HANDOFF_REPORT.md updated`**: this Recent Changes entry.
- **Bước tiếp theo**: Audit other docs (RUN_LOCAL.md / DEPLOY.md / SECURITY.md / BETA_CHECKLIST.md / SEEDING.md / BALANCE.md) hoặc execute QA_CHECKLIST.md runtime smoke (15 phút).

### PR #90 — `docs(qa,admin): refresh QA_CHECKLIST.md + ADMIN_GUIDE.md + fix /api/_auth/* path bugs` — **Merged into main** (CI 5/5 ✅, session 9d)

- **Branch**: `devin/1777472509-docs-qa-checklist-refresh`. **Base**: `main` @ `89e3fb6` (sau PR #87 L3 merged). **Status**: docs-only PR session 9d, sau khi PR #89 + #87 + #88 merged.
- **Mục tiêu** (Smart docs/handoff §7 — đồng bộ docs sau cascade PR #59/#63/#66/#67/#71/#80/#81/#83/#84/#88; fix path bugs `/api/auth/*` → `/api/_auth/*`):
  - **`docs/QA_CHECKLIST.md`**: thiếu §4b Daily Login (PR #80), §7b Leaderboard (PR #59), §13 Audit log self-view (PR #88 M6), WS `mission:progress` (PR #63), confirm modal logout-all (PR #83), filter Admin filter (PR #67/#81), Boss spawn (PR #36), inventory revoke (PR #66), economy alerts (PR #54), `CODE_EXISTS` (PR #84). §10 ghi "5 tab" nhưng thực tế 7 tab. Path `/_health/...` sai → đúng `/api/healthz|readyz|version`.
  - **`docs/ADMIN_GUIDE.md`**: §3 thiếu filter q/status/role/banned/from/to/action; §2 MOD ghi "treat gần như ADMIN, kế hoạch tách sau" nhưng PR #48 đã tách (`@RequireAdmin()` decorator); §6 thiếu `CODE_EXISTS` toast; §8 boss spawn ghi "backlog PR" nhưng đã merge; §9 ghi "chưa có UI search action" nhưng đã có; thiếu cross-ref `GET /logs/me`.
  - **`docs/TROUBLESHOOTING.md` §12**: `curl -X POST /api/auth/logout` sai path → `/api/_auth/logout`.
  - **`docs/AI_HANDOFF_REPORT.md` §17 BE-vs-FE table**: `POST /api/auth/register` sai path → `/api/_auth/register`.
- **Files** (4 thay đổi):
  - `docs/QA_CHECKLIST.md` (+30/-4 line) — §4 WS bullet, §4b mới Daily Login, §7b mới Leaderboard, §10 4→9 bullet với filter, §12 confirm modal explicit, §13 mới Audit log self-view, post-smoke `/api/healthz` path fix.
  - `docs/ADMIN_GUIDE.md` (+9/-7 line) — §1 PR #48 note, §2 MOD role, §3 7 tab có filter chi tiết, §6 CODE_EXISTS note, §8 boss spawn endpoint, §9 audit filter + logs/me cross-ref.
  - `docs/TROUBLESHOOTING.md` (1 char fix) — `/api/auth/logout` → `/api/_auth/logout`.
  - `docs/AI_HANDOFF_REPORT.md` (1 char fix line 1296 + this Recent Changes entry).
- **Risk**: Cực thấp — docs only, không touch code/test/migration. Admin/QA/operator/dev có doc đúng để vận hành + smoke.
- **Rollback**: revert single PR.
- **Test added**: 0 (docs only).
- **CI status**: build×2 ✅, e2e-smoke×2 ✅, Devin Review ✅ trên commit đầu (5/5). Re-check sau khi push commit mở rộng scope.
- **Runtime smoke**: N/A (docs).
- **`AI_HANDOFF_REPORT.md updated`**: this Recent Changes entry + path fix line 1296.
- **Bước tiếp theo**: FE tab "Hoạt động" wire `GET /logs/me` (sau khi PR #88 merge) hoặc audit RUN_LOCAL.md / DEPLOY.md / SECURITY.md / BETA_CHECKLIST.md / SEEDING.md / BALANCE.md.

### PR #88 — `feat(api): GET /logs/me — self audit log (CurrencyLedger + ItemLedger keyset paginated) (M6)` — **Merged into main** (29/4 session 9d, CI 5/5 ✅)

- **Branch**: `devin/1777469824-m6-logs-me`. **Base**: `main` @ `011e930` (sau PR #86 audit refresh merged). **Status**: code complete + local typecheck/lint/api test 369/369/build xanh; PR mở session 9d.
- **Mục tiêu** (Recommended Roadmap §20 M6 + Smart admin/economy §3,4 — minh bạch ledger cho người chơi): tới giờ CurrencyLedger + ItemLedger là audit-trail nội bộ (admin only — `apps/api/src/modules/admin/admin.controller.ts` + `pnpm audit:ledger` script). Người chơi không có cách tự xem mình đã nhận/mất tiền/item ở đâu → khi có thắc mắc support "Sao tôi mất 500 LT?" admin phải tra DB tay. Endpoint `/logs/me` mở read-only self-view audit chronological cho user.
- **Giải pháp** (BE only — module mới `apps/api/src/modules/logs/`, không thay đổi schema):
  - **`logs.service.ts`** (new, ~205 line):
    - `LogsService.listForUser(userId, { type, limit, cursor })` lookup `Character.id` của user (throw `NO_CHARACTER` nếu chưa onboard) rồi query `CurrencyLedger` hoặc `ItemLedger` filtered theo `characterId`.
    - **Type filter**: `type='currency'` hoặc `type='item'` — riêng từng ledger để keyset pagination đơn giản. Không hỗ trợ `type='all'` để tránh phức tạp merge cursor (FE có thể gọi 2 lần parallel).
    - **Keyset pagination**: `ORDER BY createdAt DESC, id DESC` + cursor `(createdAt, id)` để stable khi 2 entry cùng `createdAt` (race condition trong cùng `$transaction`). Tận dụng index có sẵn `@@index([characterId, createdAt])`.
    - **Cursor opaque**: `encodeCursor(c)` = base64url của `${createdAt.toISOString()}|${id}`; `decodeCursor(s)` validate format strict, throw `LogsError('INVALID_CURSOR')` cho mọi case (non-base64, missing separator, invalid ISO, empty id).
    - **Limit clamp**: min=1, max=50, default=20 (qua `LOGS_LIMIT_*` constants).
    - **BigInt serialize**: `delta.toString()` để FE giữ nguyên độ chính xác BigInt.
    - **Privacy**: trả `actorUserId` (cuid) nguyên dạng — **không** lookup email actor để tránh leak admin PII tới user.
  - **`logs.controller.ts`** (new, ~70 line): `@Controller('logs')` với `@Get('me')` — auth qua cookie `xt_access` + `AuthService.userIdFromAccess()` (cùng pattern `DailyLoginController`); zod `ListQuery` validate `type/limit/cursor`; map `LogsError.code` → HTTP status (`NO_CHARACTER` → 404, `INVALID_CURSOR` → 400). Chưa add rate-limit (read-only, low risk; có thể thêm sau nếu lạm dụng).
  - **`logs.module.ts`** (new): import `AuthModule`, providers `LogsService` + `PrismaService`.
  - **`apps/api/src/app.module.ts`**: thêm `LogsModule` vào imports.
- **API contract**:
  ```
  GET /logs/me?type=currency&limit=20&cursor=<opaque>
  → { ok: true, data: { entries: LogEntry[], nextCursor: string | null } }
  ```
  - `LogEntryCurrency` = `{ kind: 'CURRENCY', id, createdAt, reason, refType, refId, actorUserId, currency: 'LINH_THACH'|'TIEN_NGOC', delta: string }`
  - `LogEntryItem` = `{ kind: 'ITEM', id, createdAt, reason, refType, refId, actorUserId, itemKey, qtyDelta: number }`
  - Errors: `UNAUTHENTICATED` (401), `INVALID_INPUT` (400), `NO_CHARACTER` (404), `INVALID_CURSOR` (400)
- **Files** (4 file new + 1 file modified):
  - `apps/api/src/modules/logs/logs.service.ts` (new, 205 line)
  - `apps/api/src/modules/logs/logs.controller.ts` (new, 70 line)
  - `apps/api/src/modules/logs/logs.module.ts` (new, 13 line)
  - `apps/api/src/modules/logs/logs.service.test.ts` (new, ~330 line, 20 vitest)
  - `apps/api/src/app.module.ts` (modified, +2 line)
- **Risk**: Thấp — read-only endpoint, không thay schema/migration, không đụng economy/inventory. User chỉ thấy ledger của character thuộc user hiện tại (kiểm tra qua `prisma.character.findUnique({ where: { userId } })`). Test "isolation" verify character A không thấy ledger character B.
- **Rollback**: revert single PR. App.module unregister `LogsModule`, FE chưa wire → 0 impact.
- **Test added**: +20 vitest API integration (Postgres + `wipeAll`):
  - **Cursor encode/decode** (6 test): round-trip, ký tự đặc biệt, non-base64, missing separator, invalid ISO, empty id.
  - **listForUser() currency** (11 test): empty ledger, `NO_CHARACTER`, list 5 DESC order, BigInt serialize, limit clamp min=1/max=50, pagination 2 page no-dup/no-skip, tie-break stable when same `createdAt`, character A↔B isolation, invalid cursor, default limit=20.
  - **listForUser() item** (3 test): list DESC + qtyDelta sign preserved, pagination cross-page no-dup, type filter (currency-only vs item-only).
  - Tổng api 349 → 369.
- **CI status (local)**: typecheck ✅ (3 project), lint ✅ (max-warnings 0), api test ✅ (369/369), build ✅.
- **Runtime smoke**: **Needs runtime smoke** — chưa hit endpoint thật qua HTTP với cookie auth thật. Sẽ smoke khi FE tab "Hoạt động" wire (next PR).
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry), §20 Roadmap M6 → Resolved/Done.
- **Bước tiếp theo**: FE tab "Hoạt động" trong ProfileView/SettingsView — list logs với infinite scroll dùng `nextCursor`, format reason qua i18n `logs.reason.${reason}`, format delta theo currency/item.

### PR #89 — `docs(api): refresh API.md — sync endpoints + global prefix /api note + WS mission:progress + auth route /_auth/* fix` — **Merged into main** @ `537a4d6` (29/4 ~13:35 UTC, CI 5/5 ✅)

- **Branch**: `devin/1777470949-docs-api-refresh` (merged). **Base**: `main` @ `011e930`. **Merge commit**: `537a4d6`.
- **Mục tiêu**: Sync `docs/API.md` với code thực sau cascade PR #36/#54/#59/#60/#62/#63/#66/#71/#80/#81/#83/#84/#85/#88 + fix auth route sai (`/auth/*` → đúng `/_auth/*`).
- **Files**: `docs/API.md` (157 → ~190 line) + Recent Changes entry mô tả gap.
- **Test added**: 0 (docs only). Test counts không thay đổi (api 369 / web 123 / shared 47/55).
- **CI**: 5/5 ✅.
- **Risk**: Cực thấp.

### PR #86 — `docs(handoff): session 9d audit refresh — bump snapshot 05b05c0 + L6/L6b/G23 Resolved` — **Merged into main** @ `011e930` (29/4, CI 4/4 xanh)

- **Branch**: `devin/1777468789-audit-session-9d-refresh` (đã merged). **Base**: `main` @ `05b05c0` (sau PR #84 G23 merged). **Merge commit**: `011e930`. **Status**: Merged into main.
- **Mục tiêu** (Smart docs/handoff §7 — đồng bộ report sau cascade 5 PR #81/#82/#83/#84/#85): header còn snapshot `ec37f10`, L6/L6b vẫn ghi "Pending merge", L5/G22/M9 vẫn nằm trong Immediate Roadmap, PR #84 G23 ghi "Pending merge" — refresh single-PR docs-only thay vì sửa từng PR riêng lẻ.
- **Files** (1 thay đổi): `docs/AI_HANDOFF_REPORT.md` (+34/-28 line — bump §3 Snapshot, §2 Current Branch/CI, §2 PR merged table, §16 Known Issues L6 Resolved, §20 Roadmap Immediate restruck).
- **Risk**: Cực thấp — docs only, không touch code/test/migration.
- **CI status**: 4/4 ✅ build×2 + e2e-smoke×2.
||||||| 537a4d6
- **Branch**: `devin/1777470949-docs-api-refresh`. **Base**: `main` @ `011e930` (sau PR #86 audit refresh merged). **Status**: docs-only PR session 9d.
- **Mục tiêu** (Smart docs/handoff §7 — `docs/API.md` lệch thực tế): API.md cũ liệt kê endpoint từ session 6 (157 line, ~30 endpoint) + có lỗi sai (auth route ghi `/auth/...` nhưng code thực `@Controller('_auth')` → 404 nếu dev mới làm theo doc). Sau cascade PR #36/#54/#59/#60/#62/#63/#66/#71/#80/#81/#83/#84/#85/#88 đã thêm/sửa nhiều endpoint mới chưa được ghi.
- **Phát hiện gap khi audit (đối chiếu `apps/api/src/modules/*/[*.controller.ts]`)**:
  - **Path sai**: `/auth/register` etc. — code thực là `/_auth/register` (controller `@Controller('_auth')`).
  - **Missing endpoint**: `/character/profile/:id` (PR #62), `/daily-login/me` + `/daily-login/claim` (PR #80, M9), `/leaderboard/power` (PR #59), `/shop/npc` + `/shop/buy`, `/me/next-actions` (smart UX), `/mail/unread-count` (PR #71, M7), `/admin/users/:id/inventory/revoke` (PR #66), `/admin/stats`, `/admin/economy/alerts` (PR #54), `/boss/admin/spawn` (PR #36), `/_auth/logout-all` (PR #83/#85, L6), `/topup/packages`, `/logs/me` (PR #88, M6).
  - **Missing param**: `/admin/giftcodes` filter `q + status` (PR #81 G22), `/admin/topups` filter `q + from + to` (date+email), `/admin/audit` filter `action + q`, `/admin/users` filter `role + banned`.
  - **Missing error code**: `CODE_EXISTS` (PR #84 G23), `ALREADY_ONBOARDED`, `NOT_AT_PEAK`, `INVALID_CURSOR` (PR #88).
  - **Missing WS event**: `mission:progress` (PR #63).
  - **Missing context**: global prefix `/api/`, intentional logout-vs-logout-all trade-off, env var `MISSION_RESET_TZ` / `MARKET_FEE_PCT` / `ADMIN_BOOTSTRAP_*`.
- **Files** (1 thay đổi): `docs/API.md` rewrite từ 157 → ~190 line. Cấu trúc mới:
  - Note about `/api/` global prefix.
  - Tách section riêng: Auth, Character, Combat, Inventory, Market, Sect & Chat, Boss, **Daily Login**, **Leaderboard**, **Shop**, Mission, Mail, Giftcode, Topup & Admin, **Next Action**, **Logs (M6)**, WebSocket, Error codes, Environment.
  - Mỗi endpoint ghi PR số + bối cảnh (rate-limit, audit reason, ledger reason).
  - Error codes group theo domain + ghi rõ HTTP status nơi cần.
- **Risk**: Cực thấp — docs only, không touch code/test/migration. Reference cho dev/AI mới.
- **Rollback**: revert single PR.
- **Test added**: 0 (docs only).
- **CI status (local)**: typecheck ✅, lint ✅, build ✅. Test 369/123/47 không thay đổi.
- **Runtime smoke**: N/A (docs).
- **`AI_HANDOFF_REPORT.md updated`**: this Recent Changes entry.
- **Bước tiếp theo**: FE tab "Hoạt động" wire `GET /logs/me` (sau khi PR #88 merge).

### PR #87 — `feat(shared): proverbs corpus expand 7 → 64 + corpus invariants test (L3)` — **Merged into main** (29/4 session 9d, CI 5/5 ✅)

- **Branch**: `devin/1777469379-l3-proverbs-expand` (merged). **Base**: `main` @ `05b05c0` (sau PR #84 G23 merged). **Status**: Merged into main.
- **Mục tiêu** (Smart UX polish §6 + Recommended Roadmap L3): `packages/shared/src/proverbs.ts` chỉ có 7 câu — splash loading lặp nhanh.
- **Files** (2 thay đổi): `packages/shared/src/proverbs.ts` 7 → 64 câu (4 chủ đề, 16 câu/chủ đề); `packages/shared/src/proverbs.test.ts` +8 vitest invariants (≥50 câu, no-empty/trim, no-dup, consistent punctuation, randomProverb boundary). Tổng shared 47 → 55.
- **CI**: 5/5 ✅. **Risk**: Cực thấp — data only.

### PR #89 — `docs(api): refresh API.md — sync endpoints + global prefix /api note + WS mission:progress + auth route /_auth/* fix` — **Merged into main** @ `537a4d6` (29/4 ~13:35 UTC, CI 5/5 ✅)

- **Branch**: `devin/1777470949-docs-api-refresh` (merged). **Base**: `main` @ `011e930`. **Merge commit**: `537a4d6`.
- **Mục tiêu**: Sync `docs/API.md` với code thực sau cascade PR #36/#54/#59/#60/#62/#63/#66/#71/#80/#81/#83/#84/#85/#88 + fix auth route sai (`/auth/*` → đúng `/_auth/*`).
- **Files**: `docs/API.md` (157 → ~190 line) + Recent Changes entry mô tả gap.
- **Test added**: 0 (docs only). Test counts không thay đổi (api 369 / web 123 / shared 47/55).
- **CI**: 5/5 ✅.
- **Risk**: Cực thấp.

### PR #85 — `test(web): SettingsView logout-all confirm modal integration — 7 test (L6b)` — **Merged into main** @ `bbb6718` (29/4 ~13:02 UTC, CI 5/5 xanh)

- **Branch**: `devin/1777467454-l6b-settings-logout-vitest` (đã merged, có thể dọn). **Base**: `main` @ `78261eb` (sau khi PR #83 L6 merged). **Merge commit**: `bbb6718`. **Status**: Merged into main.
- **Mục tiêu** (Smart testing/QA §5 — Render-level integration vitest cho L6 logout-all flow): PR #83 đã thêm `ConfirmModal.vue` + 13 unit test cho component nhưng **không** có integration test cho `SettingsView` xác minh modal được wire đúng (open trên nút logout-all, gọi `logoutAll()` đúng lúc, navigate `/auth` sau success, map error code qua i18n). Gap test có thể regress khi sửa SettingsView tương lai.
- **Giải pháp** (test only, không sửa prod code):
  - `apps/web/src/views/__tests__/SettingsView.test.ts` (new, ~225 line): mount full SettingsView với mock `@/api/auth` (`logoutAll`, `changePassword`), mock `vue-router` (`replace`), mock toast/auth/game store, stub AppShell. 7 test cases covering: (1) initial render không hiện modal + không gọi API; (2) click `[data-testid="settings-logout-all-btn"]` mở modal `[data-testid="logout-all-confirm-modal"]` mà không gọi API; (3) cancel modal đóng + không gọi API; (4) confirm gọi `logoutAll`, toast success, `router.replace('/auth')`, đóng modal; (5) error có code map qua `settings.errors.${code}` → toast text; (6) error code unmapped → fallback `settings.errors.UNKNOWN`; (7) phím Escape khi modal mở → đóng modal + không gọi API.
- **Files** (1 file new):
  - `apps/web/src/views/__tests__/SettingsView.test.ts` (+225 line)
- **Risk**: Rất thấp — pure test add, no prod code touched. Mock pattern theo template `MissionView.test.ts` / `LeaderboardView.test.ts`.
- **Rollback**: revert single PR.
- **Test added**: +7 vitest web. Tổng web 116 → 123.
- **CI status (local)**: typecheck ✅, lint ✅, web test ✅ (123/123), build ✅.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry).

### PR #84 — `feat(api,web): giftcode duplicate code → CODE_EXISTS error (G23)` — **Merged into main** @ `05b05c0` (29/4 ~13:25 UTC, CI 4/4 ✅)

- **Branch**: `devin/1777467022-g23-giftcode-duplicate-error`. **Base**: `main` @ `bbb6718`. **Status**: Merged into main; CI GitHub 4/4 ✅ (build ×2, e2e-smoke ×2) sau merge commit `8eff2ca` (session 9d resolve `docs/AI_HANDOFF_REPORT.md` conflict với origin/main — drop duplicate G23 entry).
- **Mục tiêu** (Smart UX polish §6 — UX nit phát hiện trong G22 testing PR #81): Khi admin tạo giftcode trùng code, BE trả về `INVALID_INPUT` chung — FE hiện toast generic `Tham số không hợp lệ` rất khó hiểu.
- **Giải pháp** (5 file, ~40 line +/-):
  - `apps/api/src/modules/giftcode/giftcode.service.ts`: thêm `'CODE_EXISTS'` vào `GiftCodeErrorCode` union; `create()` line 148 throw `CODE_EXISTS` thay `INVALID_INPUT` khi duplicate.
  - `apps/api/src/modules/admin/admin.controller.ts`: `handleErr` map `CODE_EXISTS` → HTTP 409 CONFLICT.
  - `apps/web/src/i18n/{vi,en}.json`: thêm 6 key `admin.errors.{CODE_EXISTS, CODE_NOT_FOUND, CODE_EXPIRED, CODE_REVOKED, CODE_EXHAUSTED, ALREADY_REDEEMED}`. FE `AdminView.handleErr` đã có pattern lookup → tự pickup.
  - `apps/api/src/modules/giftcode/giftcode.service.test.ts`: test "từ chối code trùng" assertion đổi `INVALID_INPUT` → `CODE_EXISTS`.
- **Risk**: Thấp — error code rename, status 400 → 409 đúng semantic, FE check `error.code` field nên không bị ảnh hưởng HTTP status.
- **Test**: 1 test rename + assert đổi. Tổng api 349/349 (giữ nguyên số test).
- **CI**: 3/3 GitHub xanh.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry).

Mỗi PR đều `Merged` vào `main`, branch base = `main`. Smoke local (typecheck/lint/test/build) đã chạy ở mỗi PR; smoke E2E 6/6 đã pass tại PR #44 (snapshot `4d8af10`); H6 Playwright golden path đã wire CI matrix qua PR #64.

### PR #83 — `feat(web): logout-all confirm modal — replace window.confirm() (L6)` — **Merged into main** (CI 5/5)

- **Branch**: `devin/1777466552-l6-logout-all-confirm-modal` → merged 29/4 ~12:50 UTC. CI: build ×2 ✅, e2e-smoke ×2 ✅, Devin Review ✅.
- **Mục tiêu** (Smart UX polish §6 + Recommended Roadmap L6 — replace `window.confirm()` cho logout-all): SettingsView trước đây dùng native `window.confirm()` để confirm logout-all-devices — UX kém (browser-styled, không tích hợp i18n đầy đủ với title, không support keyboard escape gracefully, không thể disable trong loading). Closed beta cần modal đẹp tích hợp design system.
- **Giải pháp**:
  - **`apps/web/src/components/ui/ConfirmModal.vue`** (new, ~115 line): reusable confirm modal component với props `open / title / message / confirmText / cancelText / danger / loading / testId`. Emits `confirm` + `cancel`. Features: Teleport to body, backdrop click-self → cancel, Escape key → cancel (cả hai bị block khi `loading=true`), `danger=true` style đỏ cho phá huỷ flow, fallback i18n `common.confirm` / `common.cancel`. Slot mặc định để mở rộng khi cần custom body.
  - **`apps/web/src/views/SettingsView.vue`** (modified): remove `window.confirm(t('settings.logoutAll.confirm'))` ở `submitLogoutAll`; thay bằng `<ConfirmModal>` ở cuối `<template>` với `danger` + `loading=submittingLogoutAll`. Thêm state `logoutAllConfirmOpen` + helpers `openLogoutAllConfirm` / `cancelLogoutAllConfirm`. Logout button gắn `data-testid="settings-logout-all-btn"`.
- **i18n**: tận dụng key có sẵn (`common.confirm` / `common.cancel` / `common.loading` đã có). Không thêm key mới.
- **Files** (3 thay đổi):
  - `apps/web/src/components/ui/ConfirmModal.vue` (new)
  - `apps/web/src/views/SettingsView.vue` (modified)
  - `apps/web/src/components/__tests__/ConfirmModal.test.ts` (new, 13 vitest)
- **Risk**: Thấp — pure FE work, không có migration / không đụng economy / không thay đổi BE / không thay đổi API contract. Logout-all flow giữ nguyên semantics: button click → confirm modal → user confirm → call `POST /auth/logout-all` → toast + router replace `/auth`. Modal cancel/escape/backdrop → đóng modal không gọi API.
- **Rollback**: Revert single PR; không cần migration rollback.
- **Test added**: +13 vitest web cho `ConfirmModal` (open/close, render title+message, default i18n label, custom label override, click confirm/cancel emit, loading disable + text "Đang xử lý…", Escape emit cancel, Escape khi loading bị block, backdrop click-self emit cancel, danger=true class red vs danger=false class amber, custom testId prefix, cleanup keydown listener khi unmount). Tổng web 103 → 116.
- **CI status (local)**: typecheck ✅ (3 project), lint ✅, web test ✅ (116/116), api test ✅ (349/349 sau khi `pnpm infra:up` + `prisma migrate deploy`), shared test ✅ (47/47), build ✅. CI GitHub sẽ chạy 5/5 check.
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry), Known Issues §17 L6 → Pending merge.

### PR #82 — `test(web): MissionView claim flow vitest — 9 test (L5)` — **Merged into main** @ `45e42dc` (29/4 ~12:30 UTC, CI 5/5 xanh)

- **Branch**: `devin/1777465473-l5-mission-claim-vitest`. **Base**: `main` @ `ec37f10` (sau khi PR #80/#81 merged). **Status**: code complete + local typecheck/lint/web test/shared test/build xanh; PR mở session 9c, CI sẽ chạy.
- **Mục tiêu** (Smart testing/QA §5 + Recommended Roadmap L5 — render-level vitest cho mission claim flow): `MissionView.vue` (268 line) trước đây không có vitest riêng — coverage chỉ qua `lib/missionProgress.test.ts` (pure function `applyMissionProgressFrame`). FE `MissionView` có nhiều state-driven branches (claim button enable/disable, `claimed` badge, sort theo claimable/pending/done, tab filter DAILY/WEEKLY/ONCE, WS `mission:progress` live update) — gap test có thể regress khi refactor mission UI tương lai.
- **Giải pháp**:
  - **`apps/web/src/views/__tests__/MissionView.test.ts`** (new, ~310 line, 9 test): mount `MissionView` với mock `@/api/mission` (`listMissions`, `claimMission`), mock `@/ws/client.on` (capture `mission:progress` handler để chủ động trigger frame), mock stores (auth/game/toast) + vue-router. i18n VI thật-style.
  - 9 test case:
    1. `Nhận Thưởng enabled cho mission completable & chưa claim` — verify button không có `disabled` attr + badge "Sẵn sàng" hiện.
    2. `Nhận Thưởng disabled khi mission chưa completable` — verify `disabled` attr + không có badge.
    3. `Hiển thị badge "Đã nhận" và ẩn nút khi claimed=true` — claimed branch.
    4. `Click Nhận Thưởng → gọi claimMission + toast success + cập nhật list` — full happy path.
    5. `Claim lỗi ALREADY_CLAIMED → toast error i18n key tương ứng` — error branch (handleErr maps code → i18n).
    6. `WS mission:progress frame → cập nhật currentAmount + completable enable nút` — covers `applyMissionProgressFrame` integration vào view: trước WS frame disabled → sau frame enabled, progress text "0 / 10" → "10 / 10".
    7. `Sort: completable → chưa xong → đã claim trong cùng tab` — verify computed `filtered` order.
    8. `Tab WEEKLY filter → ẩn DAILY mission` — verify period filter.
    9. `Empty state khi tab không có mission nào` — verify i18n `mission.empty`.
- **Files** (1 thay đổi): `apps/web/src/views/__tests__/MissionView.test.ts` (new).
- **Risk**: Cực thấp — chỉ thêm test, không sửa code production. Không có migration / không đụng economy / không thay đổi BE/FE behavior.
- **Rollback**: Revert single PR; chỉ xoá test file.
- **Test added**: +9 vitest web (tổng web 94 → 103 pass).
- **CI status (local)**: typecheck ✅ (3 project), lint ✅, web test ✅ (103/103), shared test ✅ (47/47), build ✅. CI GitHub sẽ chạy 5/5 check (build ×2, e2e-smoke ×2, Devin Review).
- **`AI_HANDOFF_REPORT.md updated`**: Recent Changes (this entry), Tests section, Roadmap (gỡ L5 mission claim test khỏi gap list).

### PR #81 — `feat(web): admin giftcode panel — list/filter/create/revoke` (G22) — **Merged into main** (CI 5/5 xanh)

- **Branch**: `devin/1777458198-g22-admin-giftcode-fe`. **Base**: `main` @ `ec37f10`. **Status**: code complete + local typecheck/lint/web test/shared test/build xanh; PR mở session 9c, CI đang chạy.
- **Mục tiêu** (Smart admin §3 + Recommended Roadmap G22): consumer FE cho admin giftcode endpoints đã có từ PR #74 — admin trước đây phải gọi API trực tiếp (curl/Postman) để tạo và list giftcode. Closed beta cần UI để vận hành team có thể tạo code khuyến mãi (welcome 100 LT, event reward, etc.) và thu hồi an toàn.
- **Giải pháp FE**:
  - **`apps/web/src/api/admin.ts`** (modified): thêm `AdminGiftCodeRow` + `AdminGiftCreateInput` + `GiftCodeStatus` types. Wrappers `adminListGiftcodes(filters?)`, `adminCreateGiftcode(input)`, `adminRevokeGiftcode(code)`. Helper pure-function `giftCodeStatusOf(row, now?)` mirror BE logic: REVOKED ưu tiên cao nhất → EXPIRED nếu `expiresAt < now` → EXHAUSTED nếu `redeemCount >= maxRedeems` → ACTIVE.
  - **`apps/web/src/views/AdminView.vue`** (modified): thêm tab `giftcodes` (insert giữa `audit` và `boss`). Filter bar: input `q` (placeholder "Tìm theo mã"), select `status` (ACTIVE/REVOKED/EXPIRED/EXHAUSTED + All), button Search. Button "+ Tạo Giftcode" mở inline create form chỉ hiện cho ADMIN (`isAdmin()` guard). Form có 6 field: code (4–32, A-Z 0-9 _ -), Linh Thạch (string), Tiên Ngọc (number), EXP (string), Max Redeems (optional number), Expires In Days (optional number → BE nhận ISO datetime). Submit gọi `adminCreateGiftcode()` rồi refresh list. Table 7 cột (code/rewards/redeemed/expires/status/createdAt/actions). Status badge color-coded (emerald=ACTIVE, red=REVOKED, ink=EXPIRED/EXHAUSTED). Button Revoke chỉ hiện cho ADMIN + status=ACTIVE; confirm dialog trước khi revoke.
  - **i18n VI/EN** (`apps/web/src/i18n/{vi,en}.json`): thêm `admin.tab.giftcodes`, `admin.giftcodes.{filter, status, col, empty, createBtn, createTitle, create.{code, linhThach, tienNgoc, exp, maxRedeems, maxRedeemsPlaceholder, expiresDays, expiresDaysPlaceholder}, submitCreate, creating, createdToast, revokeBtn, revokeConfirm, revokedToast, itemsLabel}`. Cả 2 ngôn ngữ.
- **API contracts** (đã có sẵn từ PR #74):
  - `GET /api/admin/giftcodes?q=&status=&limit=` → `{ ok:true, data:{ codes:[AdminGiftCodeRow] } }` — guard MOD/ADMIN.
  - `POST /api/admin/giftcodes` body `{ code, rewardLinhThach, rewardTienNgoc, rewardExp, rewardItems, maxRedeems?, expiresAt? }` → `{ ok:true, data:{ code:AdminGiftCodeRow } }` — guard ADMIN, audit log `admin.giftcode.create`.
  - `POST /api/admin/giftcodes/:code/revoke` → `{ ok:true, data:{ code:AdminGiftCodeRow } }` — guard ADMIN, audit log `admin.giftcode.revoke`.
- **Tests** (+11 vitest web, total web 94/94):
  - `apps/web/src/api/__tests__/admin.giftcodes.test.ts`: `giftCodeStatusOf` (6 case bao toàn priority logic), `adminListGiftcodes` (3 case: filter pass-through, default params, BE error throw), `adminCreateGiftcode`/`adminRevokeGiftcode` (2 case: payload + URL encoding).
  - Mock `apiClient.get/post` từ `@/api/client`.
- **Files** (5 thay đổi): `apps/web/src/api/admin.ts`, `apps/web/src/views/AdminView.vue`, `apps/web/src/i18n/{vi,en}.json`, `apps/web/src/api/__tests__/admin.giftcodes.test.ts`.
- **Risk**: Thấp — pure FE work, không có migration / không đụng economy / không thay đổi BE. ADMIN guard double-checked (FE: `v-if="isAdmin()"` cho create/revoke buttons; BE: `RequireAdmin()` decorator có sẵn từ PR #74). Helper `giftCodeStatusOf` là pure function, deterministic, dễ test.
- **Rollback**: Revert single PR; không cần migration rollback (no schema change).
- **Runtime smoke còn thiếu**: Cần admin login → tab Giftcode → filter, tạo code "DEVIN_TEST_001" với 100 LT 5 redeem 7 ngày → revoke → quan sát toast + list refresh.
- **`AI_HANDOFF_REPORT.md updated`**: §0 header, Recent Changes (this entry), §6 Completed Features (G22 done), §20 Roadmap (gỡ G22 khỏi Immediate).

### PR #80 — `feat(api,web): M9 daily login reward — idempotent + ledger DAILY_LOGIN + FE card` — **Merged into main** @ `ec37f10` (29/4 ~10:25 UTC)

- **Branch**: `devin/1777457450-m9-daily-login-reward` (rebased on `main` @ `f24fe63` sau PR #79 merge). **Base**: `main` @ `f24fe63`. **CI**: 5/5 xanh (build×2, e2e-smoke×2, Devin Review). Có fix-up commit thêm seed `DailyLoginClaim` cho 2 test `next-action.service.test.ts` (CULTIVATE_IDLE fallback) + thêm 2 test mới cho DAILY_LOGIN_AVAILABLE coverage.
- **Mục tiêu** (Smart gameplay beta §9 — "Daily login reward đơn giản nếu đã có RewardClaimLog"): closed beta cần một feedback loop hằng ngày giữ player online + làm tone "tu tiên hằng ngày". `RewardClaimLog` chưa tồn tại → tạo model mới `DailyLoginClaim` có unique `(characterId, claimDateLocal)` để chống double-claim.
- **Giải pháp BE**:
  - **Schema** (`apps/api/prisma/schema.prisma`): thêm model `DailyLoginClaim { id, characterId, claimDateLocal:String, linhThachDelta:BigInt, streakAtClaim:Int, createdAt }` với `@@unique([characterId, claimDateLocal])` + `@@index([characterId, createdAt])`. `Character.dailyLoginClaims` relation. **Migration mới** `20260429100000_add_daily_login_claim`.
  - **`apps/api/src/modules/daily-login/daily-login.service.ts`** (new, ~170 line): `DailyLoginService.status(userId)` → `{ todayDateLocal, canClaimToday, currentStreak, nextRewardLinhThach }`. `claim(userId)` → INSERT `DailyLoginClaim` + `CurrencyService.applyTx({ delta:100n, reason:'DAILY_LOGIN', refType:'DailyLoginClaim', refId:todayDateLocal })` trong **1 `$transaction`**. Catch `Prisma.P2002` (unique violation) → idempotent return `{ claimed:false, linhThachDelta:'0' }`. Streak: nếu hôm qua đã claim → `+1`, else reset `=1`. Helpers `getLocalDateString(now, tz)` (Intl.DateTimeFormat 'en-CA' YYYY-MM-DD), `addDaysLocal(dateLocal, days)`. Tz lấy từ `getMissionResetTz()` (mission.service) — Asia/Ho_Chi_Minh mặc định.
  - **`apps/api/src/modules/daily-login/daily-login.controller.ts`** (new): `GET /daily-login/me` + `POST /daily-login/claim` (cùng auth pattern cookie `xt_access` như mission controller). Throw `NO_CHARACTER` → 404.
  - **`apps/api/src/modules/daily-login/daily-login.module.ts`** (new): import `AuthModule` + `CharacterModule` (cho `CurrencyService`).
  - **`apps/api/src/app.module.ts`**: import `DailyLoginModule`.
  - **`apps/api/src/modules/character/currency.service.ts`**: thêm `'DAILY_LOGIN'` vào `LedgerReason` union.
  - **NextAction smart §2** (`apps/api/src/modules/next-action/next-action.service.ts`): thêm `DAILY_LOGIN_AVAILABLE` (priority 2) — query `dailyLoginClaim.findUnique({ characterId_claimDateLocal })` cho ngày hôm nay, push action nếu chưa claim.
  - **`apps/api/src/test-helpers.ts`**: `wipeAll` xoá `dailyLoginClaim` trước character.
- **Giải pháp FE**:
  - **`apps/web/src/api/dailyLogin.ts`** (new): `getDailyLoginStatus()` + `claimDailyLogin()` axios wrappers, `DailyLoginStatus` + `DailyLoginClaimResult` types (BigInt-as-string).
  - **`apps/web/src/components/DailyLoginCard.vue`** (new): card amber border, hiển thị `availableHint` + button "Nhận quà" hoặc `claimedHint` + streak badge × N. Test ID `daily-login-card`/`daily-login-claim-btn`. Toast success/already-claimed.
  - **`apps/web/src/views/HomeView.vue`**: render `<DailyLoginCard>` giữa `OnboardingChecklist` và `NextActionPanel`.
  - **`apps/web/src/api/nextAction.ts`**: thêm `'DAILY_LOGIN_AVAILABLE'` vào `NextActionKey`.
  - **i18n VI/EN** (`apps/web/src/i18n/{vi,en}.json`): `home.dailyLogin.{title, availableHint, claimedHint, claim, claiming, successToast, alreadyClaimedToast}` + `home.nextAction.items.DAILY_LOGIN_AVAILABLE`.
- **Files** (17 thay đổi):
  - **BE new**: `apps/api/src/modules/daily-login/daily-login.{service,controller,module}.ts`, `apps/api/src/modules/daily-login/daily-login.service.test.ts`, `apps/api/prisma/migrations/20260429100000_add_daily_login_claim/migration.sql`
  - **BE modified**: `apps/api/prisma/schema.prisma`, `apps/api/src/app.module.ts`, `apps/api/src/modules/character/currency.service.ts`, `apps/api/src/modules/next-action/next-action.service.ts`, `apps/api/src/test-helpers.ts`
  - **FE new**: `apps/web/src/api/dailyLogin.ts`, `apps/web/src/components/DailyLoginCard.vue`, `apps/web/src/components/__tests__/DailyLoginCard.test.ts`
  - **FE modified**: `apps/web/src/api/nextAction.ts`, `apps/web/src/views/HomeView.vue`, `apps/web/src/i18n/vi.json`, `apps/web/src/i18n/en.json`
- **API contracts mới**:
  - `GET /api/daily-login/me` → `{ ok:true, data:{ todayDateLocal:'2026-04-29', canClaimToday:bool, currentStreak:int, nextRewardLinhThach:'100' } }`. 401 nếu chưa auth, 404 nếu không có character.
  - `POST /api/daily-login/claim` → `{ ok:true, data:{ claimed:bool, linhThachDelta:'100'|'0', newStreak:int, claimDateLocal:'YYYY-MM-DD' } }`. Idempotent — call lần 2 cùng ngày trả `claimed:false, delta:'0'`.
- **Tests**:
  - `apps/api/src/modules/daily-login/daily-login.service.test.ts`: **+12 vitest** (helpers VN/UTC tz; `status()` first-time / no-character / already-claimed; `claim()` first → +100 LT + ledger DAILY_LOGIN + claim row; idempotent same-day không double credit; streak +1 sau hôm qua; streak reset sau gap >1 ngày; NO_CHARACTER throw).
  - `apps/web/src/components/__tests__/DailyLoginCard.test.ts`: **+4 vitest** (canClaim render button; claimed render hint+streak; click claim → API + toast success + reload status; server idempotent → toast alreadyClaimed).
  - **Total local verified 29/4 09:49 UTC**: api **347/347** ✅ (was 335 baseline, +12), web **83/83** ✅ (was 79, +4), shared 47/47 ✅ → tổng workspace **477 pass**.
- **Local verified**: `pnpm --filter @xuantoi/api typecheck` ✅, `pnpm --filter @xuantoi/api lint` ✅, api test ✅, `pnpm --filter @xuantoi/web typecheck` ✅, `pnpm --filter @xuantoi/web lint` ✅, web test ✅. CI Playwright matrix sẽ verify trên PR.
- **Risk**: low–medium. Migration mới (1 bảng + 1 unique index) — backward compatible, không touch dữ liệu cũ. Idempotency P2002 catch ngay cả nếu race 2 request cùng lúc. Reward `100n` linh thạch hardcode cho closed beta, có thể move env config sau.
- **Rollback**: `git revert` → drop module. Nếu cần undo migration: `DROP TABLE "DailyLoginClaim";` (FK CASCADE từ Character → tự dọn). Ledger DAILY_LOGIN row giữ lại làm audit.
- **Runtime smoke**: **chưa test live UI**. `Needs runtime smoke` — login player → vào `/` → click "Nhận quà" trong DailyLoginCard → verify toast + linh thạch tăng + button biến mất + reload page vẫn không claim được + sang ngày mới claim được tiếp + streak +1.

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
| Auth | **18 test** (`auth.service.test.ts`) — +3 cho `logoutAll` (PR #37) | Email verification flow chưa có feature | — |
| Email | **14 test** (`email.service.test.ts` session 9m) — mode selection (4: console default/explicit/smtp/smtp+auth), send console (2: log verify/text-only), sendPasswordResetEmail (6: default URL/custom URL/URL-encode/subject/expiry minutes/min-1-phút), SMTP_FROM (2: default/custom) | — | — |
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
| Admin/Topup | **13 test** (`admin-stats` 3 + `topup-admin` 10) + **17 test** (`topup.service.test.ts` session 9m) — createOrder happy/invalid/limit/isolation/uniqueness/persistence/slot-free, listForUser empty/sorted/isolation/cap-50, bankInfo, toView normal/fallback, economy safety (no currency change/no ledger entry) | — | — |
| GiftCode | 12 test (`giftcode.service.test.ts`) + **5 race test** (`giftcode-race.test.ts` session 9m) — concurrent maxRedeems=1 (3 users), maxRedeems=2 (5 users), same-user double-redeem (unique index), concurrent items grant, revoke-during-redeem consistency | — | — |
| Mail | 14 test (`mail.service.test.ts`) | WS `mail:new` tích hợp end-to-end | Low |
| Mission | **26 test** (`mission.service.test.ts`) — +7 cho timezone (PR #42) | — | — |
| **Shop** | **10 test** (`shop.service.test.ts`) (PR #39) | Daily limit (feature chưa có) | — |
| Health | 4 test (`health.controller.test.ts`) | — | — |
| Ops | **7 test** (`ops.processor.test.ts`) | — | — |
| Realtime | 10 test (`realtime.gateway.test.ts`) | Ban user during connection | Medium |
| Rate limiter | 8 test (`rate-limiter.test.ts`) | — | — |
| Shared (realms/catalog/proverbs/shop/topup/boss) | **96 test** (6 file, post session 9j close) — boss 22 (PR #148) + catalog 17 + proverbs 11 (PR #87 +8 invariants) + realms 27 + shop 9 (PR #147) + topup 10 (PR #147) | — | — |
| **Web Vitest** | **484 test** (51 file, post session 9k task C this PR base `5a815b3`) — baseline cũ 187 (23 file) + session 9i +115 (K/K1/K2/F/G tasks: AppShell 15 + HomeView 9 + GiftCodeView 10 + LeaderboardView 10 skeleton + ProfileView 12 + apiError helper 17 + extractApiErrorCode migration) + session 9j +164 (task B Topup 10 + Mail 14 + task D Shop 19 + task E Inventory 15 + task F Auth 14 + task G Onboarding 16 + task H Dungeon 13 + task I Sect 12 + task J NotFound+router 8 + task K Boss 12 + task L Chat+Locale 17 + task M MButton+MToast 14) + **session 9k task C +18 AdminView render-level (this PR)** — onMounted role guard 4 + tab badge 4 + tab switch 2 + Export CSV 3 + Giftcode revoke ConfirmModal 5. | Render-level cho `AppShell` nav badge interaction (`breakthroughReady` vừa wire PR #107); runtime smoke for full claim/buy flow E2E (session 9k task B — Playwright matrix expand). | Low |
| **E2E Playwright** | **Wired** (PR #64) — `apps/web/e2e/golden.spec.ts` matrix job `e2e-smoke` với Postgres+Redis services, build api+web, run `E2E_SMOKE=1 pnpm --filter @xuantoi/web e2e:smoke`. | Full happy-path expand (M6 `/activity` browse, daily login claim, mission claim, market post/buy). | Low |
| **Economy integration** | Rải rác trong từng service + `item-ledger.test.ts` consistency check + `pnpm audit:ledger` script | Cross-module: market post → buy, ngân sách sect | Low |
| **Logs (G3 cũ/M6)** | **20 test** (`logs.service.test.ts`) (PR #88) — cursor encode/decode 6 + listForUser currency 11 + listForUser item 3 | — | — |

**Tổng (`vitest run` thực tế, baseline session 9n trên main @ `d332a18` post session 9m close-out)**: **~431 test API (cần infra:up — +17 topup + 14 email + 5 giftcode-race session 9m, all merged) + 96 test shared + 509 test web = ~1036 test pass expected**. CI xanh trên cả 5 PR session 9m (#160..#164). Real Postgres + real Redis service trên CI; local dùng `infra/docker-compose.dev.yml` (`docker compose up -d pg redis`). Web count 509 (54 file). Shared count 96 (6 file). API count ~431 (+17 topup + 14 email + 5 giftcode-race session 9m).

**Chạy**:
```bash
pnpm --filter @xuantoi/api test        # ~395 test (api modules + bootstrap + leaderboard + economy-alerts + next-action + logs + auth forgot/reset + admin self-demote + admin revoke inventory); cần Postgres+Redis qua `pnpm infra:up`
pnpm --filter @xuantoi/shared test     # 96 test (6 file: boss 22 + catalog 17 + proverbs 11 + realms 27 + shop 9 + topup 10)
pnpm --filter @xuantoi/web test        # 484 test (51 file, vitest 2.1.9 happy-dom) — +AdminView.test.ts 18 test session 9k task C
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
- **Sect seed**: **Resolved by PR #33** — `pnpm --filter @xuantoi/api bootstrap` creates 3 default sects (Thanh Vân Môn, Huyền Thuỷ Cung, Tu La Điện) idempotently.

**Idempotent?** Static catalog → type-safe, tree-shakable, reload no migrate. DB chỉ lưu reference key → import mới sẽ sync ngay khi code deploy.

### Balance

- `docs/BALANCE.md` giải thích công thức EXP, cultivation rate (1.45^order), market fee, boss reward tiering.
- `cultivationRateForRealm(order)` tested (property test 28 stage ≤ 24h ở stage 1 — PR #20).

### Thiếu

- ~~Seed sect~~ — **Resolved by PR #33** (`pnpm --filter @xuantoi/api bootstrap` creates 3 sects).
- ~~Seed admin user đầu tiên~~ — **Resolved by PR #33** (`bootstrap` creates admin from `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` env vars).
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
| `docs/ADMIN_GUIDE.md` | **Có** (PR #35) | Promote admin, grant currency, ban user, topup approve, giftcode, mail broadcast. 7.6 KB. |
| `docs/DEPLOY.md` | **Có** (PR #35) | Prod env, migration deploy, CSP, CORS, JWT secrets. 7.9 KB. |
| `docs/SECURITY.md` | **Có** (PR #35 + PR #154 session 9k) | Threat model, secret rotation, rate limit, audit, logout-all behavior. 8.5 KB. |
| `docs/RUN_LOCAL.md` | **Có** (PR #35) | Tách riêng từ README — full step-by-step. 4.7 KB. |
| `docs/TROUBLESHOOTING.md` | **Có** (PR #35) | WS không connect, migration fail, Redis down, typecheck loop. 6.7 KB. |
| `docs/CHANGELOG.md` | **Có** (PR #104 + PR #157 + session 9m catch-up) | Full changelog sessions 9d→9l. Session 9m PR thêm sections 9g/9h/9i/9j/9l. ~10 KB. |
| `docs/RELEASE_NOTES.md` | **Có** (PR #120 + PR #157) | Closed beta press kit, roadmap, known issues. 9.8 KB. |
| `docs/PRIVACY.md` | **Có** (PR #151 session 9k) | Closed-beta data retention policy. 9.3 KB. |
| `docs/TOS.md` | **Có** (PR #151 session 9k) | Closed-beta tester agreement. 10.3 KB. |
| `docs/BACKUP_RESTORE.md` | **Có** (PR #95) | Postgres backup/restore scripts + ops guide. 7.4 KB. |
| `docs/QA_CHECKLIST.md` | **Có** (PR #50 + PR #113 + PR #152) | Smoke checklist 15 phút + Playwright how-to + pnpm smoke:beta. 13.8 KB. |
| `docs/RUNTIME_SMOKE_9G.md` | **Có** (session 9g) | Runtime smoke test report. 9.2 KB. |
| `docs/AI_HANDOFF_REPORT.md` | **Đang viết (file này)** | — |

---

## 16. Known Issues / Risks

### Critical

| # | Issue | File | Impact | Status / Fix |
|---|---|---|---|---|
| ~~C-TSNARROW-RESOLVEFN~~ | ~~main `0e9c438` typecheck đỏ do vue-tsc narrow `let resolveFn: ((v:unknown)=>void) \| null = null` → `never` qua Promise executor closure — TS2349 ở `GiftCodeView.test.ts:273`.~~ | `apps/web/src/views/__tests__/GiftCodeView.test.ts` | **Cao**: chặn CI mọi PR mới (build job fail) — PR #133 đã hit regression này 30/4 ~07:14 UTC (job_id `73726162152`). | **Resolved** by **PR session 9j task A** (branch `devin/1777533603-fix-main-typecheck-giftcode-resolvefn`) — đổi pattern sang `resolveHolder: { current: ... }` object-property (object property không bị narrow qua closure mutation vì TS treat properties as potentially aliased). Test `busy lock` vẫn pass, typecheck ✅, lint ✅, web vitest 302/302 ✅, build ✅. Chờ CI xanh rồi merge. Future guideline: **không dùng `let` narrow-prone pattern trong test helper** — luôn dùng ref-holder object hoặc `const` với initial placeholder khi cần gán từ Promise executor/callback async. |

_(Trước commit `0e9c438`: Không có lỗi làm app không chạy / mất tiền / auth hỏng. CI xanh ở từng PR #33→#40, ~264 test pass.)_

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
| ~~M6~~ | ~~LogsModule (G3 cũ) chưa build — không có `/logs/me` endpoint.~~ | **Resolved by PR #88** (Merged into main @ `c6da89a`, 29/4 ~14:10 UTC) — `apps/api/src/modules/logs/{logs.service,logs.controller,logs.module}.ts` với `GET /logs/me?type=currency\|item&limit=20&cursor=<opaque>`, keyset pagination `(createdAt DESC, id DESC)`, BigInt serialize as string, character-isolation guard. +20 vitest API integration (cursor encode/decode 6 + listForUser currency 11 + listForUser item 3). **FE consumer Resolved by PR #91** (Merged into main @ `3283e42`, 29/4 ~14:55 UTC) — `apps/web/src/views/ActivityView.vue` + `apps/web/src/api/logs.ts` + sidebar link `帳 Hoạt Động` + i18n vi/en (24 ledger reason + 4 error code) + 10 vitest cover skeleton/empty/delta sign/tab switch/load more/error map. **Status**: Done / Needs runtime smoke (chuỗi M6 BE+FE cần verify với `pnpm dev` + `infra:up` + register/login → `/activity` tab → tab switch + load more). |
| M7 | CSP production-ready nhưng chưa test deploy với CDN/asset domain khác. | **Open** — khi deploy: review `script-src`, `connect-src`. |
| M8 | Admin guard kiểm `role === 'ADMIN' \|\| 'MOD'` — MOD có quyền broad gần ADMIN (grant currency, approve topup, broadcast mail, spawn boss). | **Resolved** by PR E — thêm `@RequireAdmin()` decorator + reflector trong `AdminGuard`; ADMIN-only cho grant / role-set / approve-topup / reject-topup / giftcode-create / giftcode-revoke / mail-send / mail-broadcast / boss-admin-spawn. MOD vẫn được: GET (read) + ban (đã có hierarchy MOD↦PLAYER ở service). 8 unit test thuê reflector cho guard. |
| ~~M9~~ | ~~Settings logout-all không bump `passwordVersion` → access token cũ (15m) vẫn valid ở thiết bị khác.~~ | **Resolved by PR #154 + PR #155** (session 9k task F+G, merged into main) — intentional trade-off đã được document đầy đủ trong `docs/SECURITY.md §1 Authentication` (revoke refresh tokens nhưng không bump `passwordVersion`; access tokens 15-phút TTL vẫn valid trên device khác cho tới khi hết hạn; force-kill ngay phải đổi password hoặc bump `JWT_ACCESS_SECRET` + redeploy). Regression guard test trong `apps/api/src/modules/auth/auth.service.test.ts` lock-in behavior — nếu future code thêm `passwordVersion++` trong `logoutAll()`, test fail và docs cần cập nhật. |
| M10 | Shop không có rate-limit + stock infinite + không daily limit. | **Open** — closed beta acceptable; sau beta thêm `dailyLimit`. |
| ~~M11~~ | ~~`GET /character/profile/:id` không có rate-limit riêng.~~ | **Resolved by PR #62** (Merged into main) — reuse `RateLimiter` interface, DI token `PROFILE_RATE_LIMITER`, key `rl:profile:ip:${ip}`, **120 req/IP/15min**. Files: `apps/api/src/modules/character/{character.controller.ts, character.module.ts, character.controller.test.ts}`. +3 test. |

### Low

| # | Issue | Status / Fix |
|---|---|---|
| L1 | Hard-code VN/EN còn lẻ tẻ. | **Resolved (PR F)** — audit cuối: 554/554 key và vi.json/en.json sync, 400 used key all resolve. Fix 12 key admin vẫn English (`roleLabel`, `tab.audit`, `users.col.role`, `users.banned`, `roleChangeConfirm`, `roleChangedToast`, `topups.col.user/status/note`, `audit.col.actor/action/meta`). Các "identical en≡vi" còn lại (locale names, EXP, HP/MP, WS, OK, Boss, A Linh, currency names) là đúng ý đồ — universal/native term. |
| ~~L2~~ | ~~Market fee 5% hard-code.~~ | **Resolved by PR #69** (Merged into main) — `MARKET_FEE_PCT` env var, validate bounds [0, 0.5], default 0.05. File: `apps/api/src/modules/market/market.service.ts`. |
| ~~L3~~ | ~~Proverbs loading screen chỉ 7 câu — lặp nhanh.~~ | **Resolved by PR L3** (session 9d) — `packages/shared/src/proverbs.ts` mở rộng từ 7 → 64 câu chia 4 chủ đề (tu tâm 16 + hành đạo 16 + bản tính tự nhiên 16 + khí phách quân tử 16). +8 vitest mới (`PROVERBS corpus`: ≥50 câu, no-empty/trim, no-dup, consistent punctuation; `randomProverb` boundary cases rng=0/0.999/0.5 + per-index coverage). Tổng shared 47 → 55. |
| ~~L4~~ | ~~Không có tên item localized.~~ | **Resolved** by **PR #57** — `apps/web/src/lib/itemName.ts` helper + 11 vitest test, dedupe across `MissionView`/`MailView`/`GiftCodeView`/`ShopView`. |
| ~~L5~~ | ~~Một số view chưa skeleton loader.~~ | **Resolved** — `LeaderboardView` + `ProfileView` (PR #67 merged), `MissionView` + `AdminView` (PR #68 merged), `MarketView` (PR #77 merged). Skeleton coverage đầy đủ trên tất cả view chính. |
| ~~L5b~~ | ~~`MissionView.vue` (268 line) chưa có vitest riêng.~~ | **Resolved by PR #82** (Merged into main @ `45e42dc`) — `apps/web/src/views/__tests__/MissionView.test.ts` +9 vitest cover claim button enable/disable, claimed badge, click claim happy path, error handler, WS `mission:progress` apply, sort, tab filter, empty state. |
| ~~L6~~ | ~~Settings dùng `window.confirm()` cho logout-all.~~ | **Resolved by PR #83** (Merged into main @ `78261eb`, 29/4 ~12:50 UTC) — `apps/web/src/components/ui/ConfirmModal.vue` reusable component (Teleport, danger styling, loading lock, Escape/backdrop cancel) + `SettingsView.submitLogoutAll` mở modal thay vì `window.confirm()`. Lint default-prop fix tại commit `ca85265`. +13 vitest ConfirmModal. **Integration test follow-up resolved by PR #85** (Merged into main @ `bbb6718`, 29/4 ~13:02 UTC) — `apps/web/src/views/__tests__/SettingsView.test.ts` mount full SettingsView verify modal wired đúng (7 test). |
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
| `POST /api/_auth/forgot-password` + `POST /api/_auth/reset-password` | **Có** (PR #101 BE + #102 FE + #103 timing fix, Merged @ `3c1aa39`) — `auth.service.ts` + `ForgotPasswordView.vue` + `ResetPasswordView.vue` + 23 vitest + Mailhog scaffold. | — |
| `POST /api/_auth/verify-email` | Thiếu | Closed beta không cần |
| `GET /api/leaderboard/{power,topup,sect}` | **Power**: đã có (PR #59 — `GET /leaderboard?limit=50` top by realm+power, clamp 1≤limit≤50). Topup/sect chưa có. | Power done; topup/sect Nice-to-have post-beta. |
| `WS mission:progress` (server-push tracker) | **Có** (PR #63 BE emitter throttle 500ms + PR #65 FE handler `MissionView`) | — |
| ~~`GET /api/logs/me` (G3 cũ)~~ | ~~Thiếu~~ | **Resolved by PR #88** (Merged into main @ `c6da89a`) — `apps/api/src/modules/logs/` module + 20 vitest. **FE `/activity` tab consumer**: Resolved by PR #91 (Merged into main @ `3283e42`) — `apps/web/src/views/ActivityView.vue` + 10 vitest. |
| `POST /api/admin/inventory/revoke` (`ADMIN_REVOKE` ledger) | **Có** (PR #66 — endpoint + 9 vitest) | — |
| `GET /api/mail/unread-count` (M7 hydrate badge) | **Có** (PR #71) | — |
| `GET /api/admin/economy/alerts` (smart admin) | **Có** (PR #54) | — |
| `GET /api/admin/economy/audit-ledger` (smart admin, on-demand audit) | **Có** (PR #112, Merged into main @ `f4e67f4`) — `apps/api/src/modules/admin/ledger-audit.ts` + endpoint + AdminView panel violet-500 + 6 BE vitest + 3 FE vitest. | — |
| `POST /api/_auth/register` rate-limit per-IP | **Có** (PR #60 — 5/15min) | — |
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

**Đã có bootstrap script (PR #33)**: `pnpm --filter @xuantoi/api bootstrap` — tạo admin đầu tiên từ `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` trong `apps/api/.env` + 3 sect mặc định. Idempotent — chạy lại không lỗi.

Nếu cần promote user khác hoặc chưa chạy bootstrap, có 2 cách thủ công:

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
- **Set role** — ~~mất quyền ADMIN nếu tự demote chính mình~~ **Resolved**: FE chặn self-demote (tooltip `selfDemoteBlocked` + disabled) + BE guard `CANNOT_TARGET_SELF` (test `topup-admin.service.test.ts`).

---

## 20. Recommended Next Roadmap

### Immediate (session 9n — sau khi session 9m đóng PR #160/#161/#162/#163/#164 merged vào main @ `d332a18`, 30/4 ~11:51 UTC)

**Session 9m close-out (5/5 PR Merged)**:

- 1. **Docs audit refresh session 9m kickoff** — Merged PR #160 @ `873a0a3`.
- 2. **Docs CHANGELOG catch-up sessions 9g/9h/9i/9j/9l** — Merged PR #161 @ `9c1e63a`.
- 3. **test(api): topup.service +17 vitest economy safety** — Merged PR #162 @ `0f56438`.
- 4. **test(api): email.service +14 vitest unit (no DB needed)** — Merged PR #163 @ `ba17380`.
- 5. **test(api): giftcode-race +5 vitest concurrent (double-grant prevention)** — Merged PR #164 @ `d332a18`.

**Session 9n-A done**: PR #165 audit refresh merged @ `4b5b799`. **Session 9n-B done**: PR #166 audit-ledger CLI `--json` merged @ `0b1b6da`. **Session 9n-C (this PR)**: smart admin economy alerts thresholds env-tunable + 22 vitest unit + ADMIN_GUIDE §11.3 + `.env.example` docs. Then continue with highest-priority code task.

**Backlog còn lại (post-9n-C, an toàn nếu credit còn)** — ưu tiên theo §22 priority order (Critical/High > runtime smoke > missing API/page > economy safety > E2E > admin/security > docs > i18n/UX > smart beta > post-beta):

1. ~~**Smart audit helper script `audit:ledger`**~~ — **Done PR #76 BE + PR #112 endpoint + PR #166 `--json` + unit tests**. Pure logic ở `apps/api/src/modules/admin/ledger-audit.ts`; CLI wrapper ở `apps/api/scripts/audit-ledger.ts`; admin endpoint `GET /admin/economy/audit-ledger`. Cron example in `docs/ADMIN_GUIDE.md §11`.

1b. ~~**Smart admin economy alerts thresholds env-tunable**~~ — **Done this session PR #167 (in-flight)**. `ECONOMY_ALERTS_DEFAULT_STALE_HOURS` / `_MIN_` / `_MAX_` override. Doc ở `ADMIN_GUIDE §11.3`, `.env.example`.

2. **API service tests còn thiếu (sau 9m)** — kiểm tra coverage gap:
   - `mail.service.test.ts` mở rộng WS `mail:new` integration end-to-end.
   - `chat.service.test.ts` Redis failover branch.
   - `boss.service.test.ts` spawn cron auto branch (chưa có feature, skip).
   - `cultivation.processor.test.ts` multi-instance lock.
   - **Risk 🟢 thấp** — test-only. **Priority**: medium (test gap trong §12).

3. **i18n parity audit cho mission/mail/giftcode/admin keys mới sau 9j** — grep `\['"\`].*[À-ỹ].*['"\`]\` trong .vue/.ts để bắt VN hard-code còn sót. **Risk 🟢 thấp** — docs/i18n only.

4. **Mobile responsive smoke** — viewport <375px audit cho AppShell + AdminView + InventoryView. Chưa có test E2E mobile-specific. **Risk 🟢 thấp** — Playwright config viewport.

5. **Smart admin bulk actions** — multi-select user ban/grant với confirm modal + audit log. **Risk 🟡** — admin UI mới + API mới + admin seed test mở rộng. **Priority**: medium nếu không có Critical/High blocker.

6. **`M7` CSP CDN prod verify** — chỉ khi deploy staging/prod, cần env thật. **Scope out** nếu không deploy.

7. **`M10` shop daily limit (post-beta)** — model `ShopBuyDailyCounter` + reset cron → mỗi item key có `dailyLimit`, mặc định null = unlimited. **Risk 🟡** — schema change, cần migration + seed logic update + test coverage mới. **Priority**: post-beta nếu chưa cần.

8. **Performance page-load benchmark** `/leaderboard` + `/admin` users tab khi >100 user. **Risk 🟢 thấp** — ops-only.

9. **Smart admin: economy alerts thresholds tunable env** — hiện tại hard-code threshold (`STALE_PENDING_TOPUP_HOURS=72`, etc.). Thêm `.env` override + test. **Risk 🟢 thấp** — config only.

10. **PWA offline shell verify** — chạy lighthouse offline, ghi nhận cache strategy còn miss endpoint nào. **Risk 🟢 thấp** — docs/audit only.

---

### Past session 9i (đã merged trên main, giữ lại để reference; không cần action)

**Top priority (session 9i sẽ tự làm theo thứ tự, **xanh rồi mới qua**)**:

A. ~~**Docs audit refresh session 9i**~~ — **Done by PR #119** (Merged into main @ `8ecfa72`, 30/4 ~06:21 UTC, CI 5/5 ✅).

A2. **Docs audit refresh session 9i progress** — **In-flight PR (này)** — bump snapshot `e8c85df`, chuyển PR #119..#122 sang Merged, ghi PR #123/#124 Pending merge, bump baseline web vitest 207 → 236 (30 file), mở task G/H/I.

B. ~~**`docs/RELEASE_NOTES.md` bootstrap (closed beta press kit)**~~ — **Done by PR #120** (Merged into main 30/4 ~06:23 UTC, CI 4/4 ✅).

C. ~~**Smart admin giftcode active badge**~~ — **Done by PR #121** (Merged into main 30/4 ~06:25 UTC, CI 5/5 ✅) — `apps/web/src/lib/giftcodeBadge.ts` `countActiveUnused()` helper + 7 vitest + AdminView badge cyan-500 trên nav.

D. ~~**Smart UX polish — toast duration policy by severity**~~ — **Done by PR #122** (Merged into main @ `e8c85df`, 30/4 ~06:32 UTC, CI 5/5 ✅) — `apps/web/src/lib/toastDuration.ts` `resolveToastDuration()` + `TOAST_DURATION_MS` policy (info 3000 / success 3500 / warning 5000 / error 6000) + 9 vitest.

E. **Smart admin — admin user export CSV** — **Pending merge PR #123** (CI in-flight) — `apps/api/src/modules/admin/user-csv.ts` pure helper RFC 4180 + `exportUsers()` service + `GET /admin/users.csv` `@RequireAdmin()` endpoint + audit `user.exportCsv` + `adminExportUsersCsv()` FE wrapper + AdminView Export CSV button + 15 vitest.

F. **Test coverage — HomeView smoke tests** — **Pending merge PR #124** (CI in-flight) — `apps/web/src/views/__tests__/HomeView.test.ts` 9 vitest cover onMounted routing branches (chưa auth/no character/có character/throw) + render + cultivate/breakthrough actions.

G. ~~**Test coverage — AppShell skeleton tests**~~ — **Done by PR #126** (Merged into main 30/4 ~07:30 UTC, CI 5/5 ✅) — `apps/web/src/components/shell/__tests__/AppShell.test.ts` 15 vitest cover mobile nav toggle (3) + sidebar badges (5) + staff-only/cultivating/WS/logout (7).

H. ~~**Smart admin — giftcode revoke UI flow**~~ — **Done by PR #127** (Merged into main @ `8a2be4a`, 30/4 ~07:50 UTC, CI 5/5 ✅) — `apps/web/src/lib/giftcodeRevoke.ts` `computeGiftcodeRevokeImpact()` + `mapGiftcodeRevokeErrorKey()` + 12 vitest + ConfirmModal danger style trong AdminView (impact preview: usage/expiry/warning) + 5 i18n key (vi/en). **Devin Review follow-up PR #129** sửa fallback UNAUTHENTICATED/FORBIDDEN/ADMIN_ONLY (đang Pending merge).

J. **Smart helper — extractApiErrorCode pure error extractor** — **Pending merge PR #128** (CI in-flight) — `apps/web/src/lib/apiError.ts` + 17 vitest + adopt AdminView `handleErr` + AuthView 3 callsite. Bao phủ shape: direct / axios `response.data.code` / ES2022 `cause` / legacy `original` / null/primitive/empty/non-string reject.

K. **Migration — adopt extractApiErrorCode trong 14 view còn lại** (next):
  - TopupView, GiftCodeView, ResetPasswordView, MissionView, ShopView, MarketView, InventoryView, SettingsView (×2), SectView, DungeonView, BossView, MailView, LeaderboardView, ForgotPasswordView, ActivityView, ChatPanel.
  - Tách thành 2-3 PR nhỏ (gameplay views / auth views / admin/chat) để giữ scope rõ.
  - Risk: 🟢 thấp, refactor đơn thuần. Khi audit i18n verify lại error code key vẫn render đúng.

I. **Beta runtime smoke matrix end-to-end** (Playwright `E2E_FULL=1`):
  - Mở rộng `apps/web/e2e/golden.spec.ts` cover: register → onboarding → cultivate 60s tick → claim daily login → claim 1 mission → buy 1 shop item → check inventory → đọc 1 mail → mở leaderboard → admin login mock (skip nếu chưa có admin auth) → admin user export CSV download (smoke PR #123).
  - Document trong `docs/QA_CHECKLIST.md` cách chạy local matrix.
  - Risk: 🟡 vừa — phụ thuộc infra docker compose; có thể flaky.

**Backlog (post-9i, an toàn nếu cần lấy thêm)**:
- `M9` document SECURITY.md trường hợp logout-all không bump `passwordVersion` (đã verify SECURITY.md hiện có mục đó nếu nổi bật; nếu không → bổ sung).
- `M10` shop daily limit (post-beta) — model `ShopBuyDailyCounter` + reset cron → mỗi item key có `dailyLimit`, mặc định null = unlimited.
- Smart admin: bulk actions cho user list (multi-select ban, multi-select grant currency với confirm).
- Smart QA: thêm `pnpm smoke:beta` script chạy 5-phút smoke (register → tu luyện → claim mission → buy shop → mail → boss).
- Docs: `docs/PRIVACY.md` (closed beta data retention), `docs/TOS.md` (closed beta tester agreement).
- Performance: page-load benchmark cho `/leaderboard` + `/admin` users tab khi >100 user (cursor pagination đã có nhưng FE chưa stress test).

---

**Session 9h items (đã merged trên main, giữ lại để reference; không cần action)**:

A. ~~**Docs audit refresh session 9h**~~ — **Done by PR #111** (Merged into main @ `43f626e`, 30/4 ~04:25 UTC, CI 4/4 ✅).
B. ~~**Replay orphan commit `7e27aa9` — admin audit-ledger endpoint + UI**~~ — **Done by PR #112** (Merged into main @ `f4e67f4`, 30/4 ~04:35 UTC, CI 5/5 ✅) — `apps/api/src/modules/admin/{ledger-audit.ts,admin.service.ts,admin.controller.ts,admin-audit-ledger.test.ts}` + `apps/web/src/api/admin.ts` + `AdminView.vue` panel violet-500 + i18n vi/en + 6 BE vitest + 3 FE vitest.
C. ~~**Playwright golden expand — daily login + leaderboard tabs (gated `E2E_FULL=1`)**~~ — **Done by PR #113** (Merged into main @ `8cdb93c`, 30/4 ~04:45 UTC, CI 5/5 ✅) — `apps/web/e2e/golden.spec.ts` +95 line + `docs/QA_CHECKLIST.md` +25 line how-to.
D. ~~**Smart onboarding expand — Leaderboard + Mail visit tracking (4→6 step)**~~ — **Done by PR #114** (Merged into main @ `885e56c`, 30/4 ~05:00 UTC, CI 5/5 ✅) — `apps/web/src/lib/onboardingVisits.ts` SSR-safe localStorage helper + `OnboardingChecklist.vue` 4→6 step + `LeaderboardView.vue` + `MailView.vue` markVisited onMounted + +6 vitest + +3 OnboardingChecklist test refactor.
E. ~~**Smart admin economy report — top 10 whales + circulation**~~ — **Done by PR #115** (Merged into main @ `6f18ce6`, 30/4 ~05:15 UTC, CI 5/5 ✅) — `GET /admin/economy/report` + AdminView Stats panel cyan + 5 stat cards + 2 cột top whales + i18n 13 key/locale + 6 BE vitest + 3 FE vitest.
F. ~~**Smart admin users filter expand — currency range + realmKey**~~ — **Done by PR #116** (Merged into main @ `7b6f927`, 30/4 ~05:30 UTC, CI 5/5 ✅) — `admin.service.ts listUsers()` +18 line filter + `admin.controller.ts @Get('users')` +30 line parse + +60 UI + i18n +6 key + 5 BE vitest + 5 FE vitest.
G. ~~**Smart admin recent activity widget — Stats tab inline last 5 audit entries**~~ — **Done by PR #117** (Merged into main @ `0fc1431`, 30/4 ~05:49 UTC, CI 5/5 ✅) — `AdminView.vue` recentActivity panel violet-500 + i18n +9 key/locale.
H. ~~**Smart admin tab badge — pending topup count**~~ — **Done by PR #118** (Merged into main @ `27552a8`, 30/4 ~06:18 UTC, CI 5/5 ✅) — `AdminView.vue` `pendingTopupCount` ref + load trong `refreshStats()` + 60s poll qua `refreshAlertsOnly()` + helper `refreshPendingTopupCount()` fire-and-forget gọi sau approve/reject (Devin Review fix `BUG_pr-review-job-3a340907d3a248428c84dde15b39402f_0001`) + badge amber-500 nav button "Nạp Tiên Ngọc" + i18n +1 key/locale `admin.topups.pendingBadgeTooltip`.

---

**Session 9g items (đã merged trên main, giữ lại để reference; không cần action)**:

A. ~~**Docs audit refresh session 9g**~~ — **Done by PR #105** (Merged into main @ `a907eb1`, 29/4 ~19:00 UTC, CI 4/4 ✅).
B. ~~**FE Admin Inventory Revoke UI**~~ — **Done by PR #106** (Merged into main @ `7d1965e`, 29/4 ~19:09 UTC, CI 5/5 ✅) — helper `adminRevokeInventory(...)` + nút "Thu hồi item" + modal AdminView Users tab + 7 vitest + i18n vi/en. L7 FE đóng.
C. ~~**Smart UX polish + i18n parity guard**~~ — **Done by PR #107** (Merged into main @ `82f2020`, 29/4 ~19:30 UTC, CI 5/5 ✅) — wire `badges.breakthroughReady` thành sidebar dot indicator violet-400 + i18n parity test (6 vitest enforce vi/en symmetric + ICU placeholder parity). Web vitest 168 → 174 (file 21 → 22).
D. ~~**Runtime smoke tích hợp full session 9d→9g**~~ — **Done by PR #108** (Merged into main @ `0a6c664`, 29/4 ~19:45 UTC, CI 5/5 ✅) — 41 endpoint flow verified, 0 Critical/High bugs, evidence in `docs/RUNTIME_SMOKE_9G.md`. F1 (Low) + F2 (info) findings recorded.
E.a. ~~**Smart admin economy alerts badge + 60s polling**~~ — **Done by PR #109** (Merged into main @ `58fa69d`, 29/4 ~19:50 UTC, CI 5/5 ✅) — helper `countEconomyAlerts` + `alertSeverity`, badge red dot trên nav Stats, auto-poll 60s, +13 vitest. Web vitest 174 → 187 (file 22 → 23).
F1. ~~**`apps/api/.env.example` SMTP_FROM quote fix**~~ — **Done by PR #110** (Merged into main @ `4c214eb`, 29/4 ~19:55 UTC, CI 5/5 ✅).

---

**Session 9f items (đã merged trên main, giữ lại để reference; không cần action)**:

A. ~~**Docs audit refresh**~~ — **Done by PR #98** (Merged into main @ `4072a3d`, 29/4 ~17:18 UTC, CI 4/4 ✅).
B. ~~**FE LeaderboardView tabs Power/Topup/Sect**~~ — **Done by PR #99** (Merged into main @ `5a93d22`, 29/4 ~17:35 UTC, CI 5/5 ✅) — consume BE PR #94, 3 tab + lazy-fetch + i18n vi/en + 10 vitest, web 133→137.
C. ~~**Self-demote prevention (admin)**~~ — **Done by PR #100** (Merged into main @ `47d34b5`, 29/4 ~17:45 UTC, CI 5/5 ✅) — FE guards `AdminView.vue` + helper `adminGuards.ts` (12 vitest pure) + BE vitest +2 lock-in. Web vitest 137→149.
D. ~~**forgot/reset-password full stack**~~ — **Done by PR #101 + PR #102** (Merged into main @ `6f3faf4`, 29/4 ~18:35 UTC) — BE endpoints + EmailService Mailhog scaffold + FE views + AuthView "Quên huyền pháp?" link + 11 BE vitest + 12 FE vitest. Đã apply Devin Review fix r3163113344 (token format `<id>.<secret>` O(1) lookup) trước merge.
E. ~~**forgotPassword timing side-channel mitigation**~~ — **Done by PR #103** (Merged into main @ `3c1aa39`, 29/4 ~18:55 UTC, CI 5/5 ✅) — Devin Review post-merge fix r3163261711: thêm `argon2.hash` giả cho path không-có-user/banned để response time tương đương path-có-user. +1 vitest timing parity.
F. ~~**`docs/CHANGELOG.md` bootstrap**~~ — **Done by PR #104** (Merged into main @ `c026f37`, 29/4 ~18:40 UTC, CI 5/5 ✅) — Keep-a-Changelog format adapted closed-beta, gom highlight PR #33→#103 thành section session 9d/9e/9f + Unreleased + Earlier. Mark §15 docs gap CHANGELOG.md → "Có (PR #104)".

---

**Legacy items (đã merged trên main, giữ lại để reference; không cần action)**:



1. ~~**M9 — Daily login reward**~~ — **Done by PR #80** (Merged into main @ `ec37f10`, 29/4 ~10:25 UTC). Status: **Done / Needs runtime smoke** (chưa test live UI: login → Home → DailyLoginCard click claim → toast → +100 LT + streak badge).
2. ~~**G22 — Admin giftcode FE panel**~~ — **Done by PR #81** (Merged into main @ `c4f3468`, 29/4 ~10:31 UTC). Status: **Done / Needs runtime smoke**.
3. ~~**L5 — MissionView claim flow vitest**~~ — **Done by PR #82** (Merged into main @ `45e42dc`, 29/4 ~12:30 UTC). +9 vitest.
4. ~~**L6 — Logout-all confirm modal**~~ — **Done by PR #83** (component, Merged into main @ `78261eb`) + **PR #85** (integration vitest, Merged into main @ `bbb6718`).
5. ~~**G23 — Giftcode duplicate code → CODE_EXISTS error code**~~ — **Done by PR #84** (Merged into main @ `05b05c0`, 29/4 ~13:25 UTC).
6. ~~**L3 — Proverbs corpus expansion**~~ — **Done by PR #87** (Merged into main @ `89e3fb6`, 29/4 session 9d, CI 5/5 ✅) — expand 7 → 64 câu chia 4 chủ đề + 8 vitest invariants.
7. ~~**M6 — `GET /logs/me` endpoint (BE)**~~ — **Done by PR #88** (Merged into main @ `c6da89a`, 29/4 ~14:10 UTC, CI 5/5 ✅) — module BE + 20 vitest API.
8. ~~**M6 — FE `/activity` tab consumer**~~ — **Done by PR #91** (Merged into main @ `3283e42`, 29/4 ~14:55 UTC, CI 5/5 ✅) — `apps/web/src/views/ActivityView.vue` + sidebar link + 10 vitest.
9. ~~**Docs refresh API.md / QA_CHECKLIST.md / ADMIN_GUIDE.md / TROUBLESHOOTING.md**~~ — **Done by PR #89** (API.md `537a4d6`) + **PR #90** (QA_CHECKLIST.md + ADMIN_GUIDE.md + TROUBLESHOOTING.md `1cbf349`).
10. **(NEW) Runtime smoke tích hợp toàn bộ PR #46→#91 merge cascade** — **Needs runtime smoke**. Checklist (15 phút, theo `docs/QA_CHECKLIST.md`): register/login (verify rate-limit 5/IP/15min), HomeView (next-action panel + onboarding checklist + DailyLoginCard claim flow), sidebar badges polling 60s, leaderboard render top 50 + tap-name → profile, admin economy alerts panel, mission claim + WS `mission:progress` real-time, mail unread badge hydrate trên login, NPC shop buy + ledger row, market post/cancel/buy với `MARKET_FEE_PCT` env, admin giftcode panel filter q/status + create + revoke (PR #81 + duplicate error rõ PR #84 `CODE_EXISTS`), admin user filter role+banned, admin audit filter action+actor, admin topup filter date+email, admin inventory revoke + `ADMIN_REVOKE` ledger, `pnpm audit:ledger` script, MarketView skeleton, SettingsView logout-all confirm modal, AuthView proverbs corpus đa dạng (PR #87), **`/activity` tab — currency tab + item tab + load more cursor + delta sign coloring + reason i18n + NO_CHARACTER guard** (PR #91 M6 FE consumer).
11. ~~**`GET /api/leaderboard/topup` + `/sect`**~~ — **BE Done by PR #94** (Merged into main @ `fed47a6` session 9e, CI 5/5 ✅) — `apps/api/src/modules/leaderboard/{service,controller,test}.ts` thêm `topByTopup` (groupBy TopupOrder APPROVED, sum tienNgocAmount desc, exclude banned, skip user không char) + `topBySect` (Sect findMany order treasuryLinhThach desc → level desc → createdAt asc, leaderName + sectKey + memberCount). API: `GET /api/leaderboard/topup?limit=N` + `GET /api/leaderboard/sect?limit=N`. Test: +13 vitest (api 369→382). **FE consumer (LeaderboardView tab Power/Topup/Sect) chưa làm** — PR riêng FE only (ưu tiên cao nhất session 9f).
12. **(NEW Top Priority) `POST /api/_auth/forgot-password` + `reset-password` + email scaffold qua Mailhog** (closed beta nice-to-have): self-service reset password thay vì admin DB flow. Risk thấp (chỉ thêm endpoint + token model). Value cao cho beta UX.
13. ~~**Backup/restore script Postgres** + `docs/BACKUP_RESTORE.md`~~ — **Done by PR #95** (Merged into main session 9e, CI 5/5 ✅ + Devin Review credential mask fix) + **PR #96** (Merged @ `253c4b1` session 9e — SIGPIPE-safe verify + pg_terminate_backend trước DROP) — `scripts/backup-db.sh` + `scripts/restore-db.sh` + `pnpm backup:db` + `pnpm restore:db` npm scripts + `docs/BACKUP_RESTORE.md` (TL;DR + workflow + cron mẫu + disaster recovery checklist). Tested live: backup 21 table → 5966 byte gzip → restore success. Credentials masked trong stdout/log (Devin Review fix).
14. ~~**Mobile responsive iPhone SE viewport (375×667)**~~ — **Partial Done by PR #97** (Merged into main @ `ee933ad` session 9e, CI 5/5 ✅) — AppShell hamburger + drawer sidebar `md:hidden` toggle với aria-label `shell.nav.toggle` (vi/en) + watch route auto-close + backdrop click; AdminView 4 table (users/topup/audit/giftcode) wrap `overflow-x-auto` + `min-w-[640px]/[560px]`. **Còn lại (post-PR #97)**: MissionView/MarketView đã dùng flex-wrap (acceptable nhưng chưa runtime verify trên emulator), ActivityView entry layout chưa kiểm tra → follow-up PR sau khi runtime smoke. **Needs runtime smoke** trên Chrome DevTools mobile emulator hoặc thiết bị thật iPhone SE.
15. **M10 — Shop daily limit** + per-item rate-limit (post-beta nice-to-have).
16. **M7 — CSP production CDN review** (chỉ khi triển khai prod).
17. **M9 (auth) — Settings logout-all `passwordVersion` bump** (intentional trade-off post-beta — document trong `docs/SECURITY.md` hiện đã có).

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

### Session 9j (đã đóng, cascade merged cascade vào main `2521672 → e342513`)

| PR | Task | Status |
|---|---|---|
| #134 | task A — fix C-TSNARROW-RESOLVEFN typecheck red | **Merged into main** @ `2521672` |
| #135 | task B — TopupView + MailView 24 vitest | **Merged into main** @ `fa8082a` |
| ~~#136~~ | ~~task C — InventoryView 15 vitest~~ | **Merged vào branch stale (#135 base) — KHÔNG vào main**; replay qua #138 |
| #137 | task D — ShopView 19 vitest | **Merged into main** @ `2ed8c29` |
| #138 | task E — replay InventoryView vitest → main | **Merged into main** @ `6f060fe` |
| #139 | task F — AuthView 14 vitest | **Merged into main** @ `4c7c87e` |
| #140 | task G — OnboardingView 16 vitest | **Merged into main** @ `6529652` |
| #141 | task H — DungeonView 13 vitest | **Merged into main** @ `3f631db` |
| #142 | task I — SectView 12 vitest | **Merged into main** @ `ee68539` |
| #143 | task J — NotFoundView + router manifest 8 vitest | **Merged into main** @ `e91bbb4` |
| #144 | task K — BossView 12 vitest | **Merged into main** @ `d79bf6c` |
| #145 | task L — ChatPanel + LocaleSwitcher 17 vitest | **Merged into main** @ `62f7ee3` |
| #146 | task M / K3.11 — MButton + MToast 14 vitest | **Merged into main** @ `178ec14` |
| #147 | task N — shared shop + topup catalog 19 vitest | **Merged into main** @ `d14ae2c` |
| #148 | task O — shared BOSSES catalog 22 vitest | **Merged into main** @ `e342513` |

### Session 9k (đã đóng, 7/7 PR merged vào main `5a815b3 → 2e54a1e`)

| PR | Task | Status |
|---|---|---|
| #149 | task A — audit refresh session 9k kickoff | **Merged into main** @ `5a815b3` |
| #150 | task C — AdminView 18 vitest | **Merged into main** @ `f1214a3` |
| #151 | task D — docs PRIVACY.md + TOS.md | **Merged into main** @ `50a9884` |
| #152 | task E — pnpm smoke:beta CLI | **Merged into main** @ `d19e8d1` |
| #153 | task B — Playwright E2E_FULL +3 test | **Merged into main** @ `cfebbb2` |
| #154 | task F — docs SECURITY.md §1 logout-all | **Merged into main** @ `16b8739` |
| #155 | task G — test logoutAll passwordVersion guard (M9 lock) | **Merged into main** @ `2e54a1e` |

### Session 9l (đã đóng, 4/4 PR merged vào main `739b10a → f103485`)

| PR | Task | Status |
|---|---|---|
| #156 | task 1 — audit refresh session 9l kickoff | **Merged into main** @ `739b10a` |
| #157 | task 2 — docs RELEASE_NOTES + CHANGELOG 9k close-out | **Merged into main** @ `64d02fd` |
| #158 | task 3 — handoff M9 Resolved in §16 | **Merged into main** @ `a1079dc` |
| #159 | task 4 — UI primitive tests ConfirmModal + Skeleton | **Merged into main** @ `f103485` |

### Session 9m (đã đóng, 5/5 PR merged vào main `873a0a3 → d332a18`)

| PR | Task | Status |
|---|---|---|
| #160 | session 9m-A — docs(handoff): audit refresh fix stale §2/§13/§15/§17/§19 | **Merged into main** @ `873a0a3` |
| #161 | session 9m-B — docs(changelog): catch-up sessions 9g/9h/9i/9j/9l | **Merged into main** @ `9c1e63a` |
| #162 | session 9m-C — test(api): topup.service +17 vitest economy safety | **Merged into main** @ `0f56438` |
| #163 | session 9m-D — test(api): email.service +14 vitest unit | **Merged into main** @ `ba17380` |
| #164 | session 9m-E — test(api): giftcode-race +5 vitest concurrent | **Merged into main** @ `d332a18` |

### Session 9n (current)

| PR | Task | Status |
|---|---|---|
| #165 | session 9n-A — docs(handoff): audit refresh post-9m close-out | **Merged into main** @ `4b5b799` |
| #166 | session 9n-B — feat(api,docs): audit-ledger CLI --json + unit tests + ADMIN_GUIDE §11 | **Merged into main** @ `0b1b6da` |

#### PR session 9n-C (in-flight, this PR) — `feat(api,docs): smart admin economy alerts thresholds — ECONOMY_ALERTS_DEFAULT_STALE_HOURS / _MIN_ / _MAX_ env override + 22 vitest unit + ADMIN_GUIDE §11.3 + .env.example`
- **Branch**: `devin/1777552393-economy-alerts-env-thresholds`. **Base**: `main` @ `0b1b6da` (post PR #166 merge). **Status**: in-flight.
- **Files**: `apps/api/src/modules/admin/economy-alerts-config.ts` (new pure helper); `apps/api/src/modules/admin/economy-alerts-config.test.ts` (new 22 vitest); `apps/api/src/modules/admin/admin.controller.ts` (inject ConfigService + resolve bounds + clampStaleHours); `apps/web/src/api/admin.ts` (bounds optional field); `apps/api/.env.example`; `docs/ADMIN_GUIDE.md` (+§11.3); `docs/AI_HANDOFF_REPORT.md`.
- **Tests added**: 22 vitest unit (no DB).
- **CI status (local 30/4 ~12:40 UTC)**: typecheck ✅ / lint ✅ / new vitest 22/22 ✅ / shared 96/96 ✅ / web 509/509 ✅.
- **Risk**: 🟢 thấp — controller behavior preserved cho query in-range; default behavior unchanged khi env absent; response field `data.bounds` additive.
- **Rollback**: revert single PR.

#### Sẽ làm tiếp (session 9n) — sau khi PR session 9n-C merge

- **session 9n-D (priority #1)**: API test gap — `mail.service.test.ts` mở rộng WS `mail:new` integration; `chat.service.test.ts` Redis failover; `cultivation.processor.test.ts` multi-instance lock.
- **session 9n-E**: i18n parity audit cho keys mới session 9j (mission/mail/giftcode/admin) — grep VN hard-code còn sót.
- **session 9n-F**: Mobile responsive smoke — viewport <375px audit cho AppShell + AdminView + InventoryView qua Playwright config.
- **session 9n-G**: Admin quick-action filter polish — bulk CSV export UX, topup approve batch confirm.

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

### Pending (session 9i — sau khi PR #111..#118 cascade vào main 30/4 ~06:18 UTC)

#### PR session 9i-A (in-flight, this PR #119) — `docs(handoff): session 9i audit refresh — bump snapshot 27552a8 + mark PR #111..#118 Merged + sync baseline web vitest 207/207 + add session 9i roadmap`
- **Branch**: `devin/1777528782-audit-session-9i-refresh-pr117`. **Base**: ban đầu `main` @ `0fc1431`; rebase lên `main` @ `27552a8` (post PR #118 merge). **Status**: docs-only, in-flight.
- **File**: `docs/AI_HANDOFF_REPORT.md` (header §0/§2/Recent Changes/§12 baseline/§20 roadmap session 9i/§21 PR Plan).
- **Tests added**: 0 (docs-only).
- **CI status (local)**: typecheck ✅ / lint ✅ / shared 55/55 ✅ / web 207/207 ✅. Build/api skipped (docs-only).
- **Risk**: 0 (docs-only).
- **Rollback**: revert single PR.

#### PR session 9i-B (planned, after 9i-A merge) — `docs: bootstrap docs/RELEASE_NOTES.md (closed-beta-1 press kit)`
- **Branch**: TBD `devin/<ts>-docs-release-notes-bootstrap`. **Base**: `main` post-9i-A.
- **Plan**: tạo `docs/RELEASE_NOTES.md` mới — closed-beta-1 user-facing changelog (no PR number, focus user value). Sections: version, date, Highlights (Daily login claim, Leaderboard Power/Topup/Sect, Forgot/Reset password, Economy safety alerts, Mobile responsive AppShell, Smart admin tooling), Known limitations (no Pet/Wife/Arena/Event/PvP/Payment), Known issues (M7/M9/M10), How to report bugs (email/discord placeholder).
- **File**: `docs/RELEASE_NOTES.md` (mới, ~120-180 line).
- **Risk**: 0 (docs-only).
- **Rollback**: revert single PR.

#### PR session 9i-C (planned, after 9i-B merge) — `feat(web): smart admin giftcode unredeemed badge + helper + tests`
- **Branch**: TBD `devin/<ts>-admin-giftcode-unused-badge`. **Base**: `main` post-9i-B.
- **Plan**: mở rộng pattern PR #118 cho Giftcode tab. Helper pure `apps/web/src/lib/giftcodeBadge.ts` `countActiveUnused(codes)` (count `code.status === 'ACTIVE' && (code.maxRedeems - code.redeemedCount) > 0`). +4-6 vitest. AdminView: ref + load trong `refreshStats()` (parallel với pending topup load) + poll 60s qua `refreshAlertsOnly()` + re-fetch sau `submitGiftcodeForm()` và `revokeGiftcode()`. Badge amber-500 trên nav "Giftcode" khi count > 0. i18n +1 key.
- **Risk**: thấp — read-only, additive, dùng API có sẵn (`GET /admin/giftcodes?status=ACTIVE`), không touch BE/schema.
- **Rollback**: revert single PR.

#### Past session 9h (đã done):

#### ~~PR #111 (session 9h task A)~~ — `docs(handoff): session 9h audit refresh — bump snapshot 4c214eb + mark PR #109/#110 Merged + sync baseline web vitest 187/187 + add session 9h roadmap` — **Done by PR #111 (Merged into main @ `43f626e`, 30/4 ~04:25 UTC, CI 4/4 ✅)**.

#### ~~PR #112 (session 9h task B)~~ — `feat(admin): replay orphan commit 7e27aa9 — GET /admin/economy/audit-ledger endpoint + AdminView panel button + 6 BE vitest + 3 FE vitest + i18n` — **Done by PR #112 (Merged into main @ `f4e67f4`, 30/4 ~04:35 UTC, CI 5/5 ✅)**.

#### ~~PR #113 (session 9h task C)~~ — `test(web): expand Playwright golden path — daily login claim + leaderboard tabs (gated E2E_FULL=1)` — **Done by PR #113 (Merged into main @ `8cdb93c`, 30/4 ~04:45 UTC, CI 5/5 ✅)**.

#### ~~PR #114 (session 9h task D)~~ — `feat(web): smart onboarding expand — track Leaderboard + Mail visits via localStorage (6-step checklist)` — **Done by PR #114 (Merged into main @ `885e56c`, 30/4 ~05:00 UTC, CI 5/5 ✅)**.

#### ~~PR #115 (session 9h task E)~~ — `feat(admin): smart economy report — top 10 whales (linhThach + tienNgoc) + circulation snapshot via GET /admin/economy/report` — **Done by PR #115 (Merged into main @ `6f18ce6`, 30/4 ~05:15 UTC, CI 5/5 ✅)**.

#### ~~PR #116 (session 9h task F)~~ — `feat(admin): smart users filter expand — currency range (linhThach/tienNgoc) + realmKey via GET /admin/users` — **Done by PR #116 (Merged into main @ `7b6f927`, 30/4 ~05:30 UTC, CI 5/5 ✅)**.

#### ~~PR #117 (session 9h task G)~~ — `feat(admin): smart recent activity widget — inline last 5 audit entries on Stats tab` — **Done by PR #117 (Merged into main @ `0fc1431`, 30/4 ~05:49 UTC, CI 5/5 ✅)**.

#### ~~PR #118 (session 9h task H)~~ — `feat(admin): smart tab badge — pending topup count on Topups tab nav` — **Done by PR #118 (Merged into main @ `27552a8`, 30/4 ~06:18 UTC, CI 5/5 ✅)** — take-over by session 9i: rebase lên `main @ 0fc1431` + Devin Review fix `pendingTopupCount` stale sau approve/reject (helper `refreshPendingTopupCount()` fire-and-forget).

#### Past session 9g (đã done):

#### ~~PR #105 (session 9g task A)~~ — `docs(handoff): session 9g audit refresh` — **Done by PR #105 (Merged into main @ `a907eb1`, 29/4 ~19:00 UTC, CI 4/4 ✅)**.
- **File**: `docs/AI_HANDOFF_REPORT.md` (header §0/§2/Recent Changes/§12/§20/§21).

#### ~~PR #106 (session 9g task B)~~ — `feat(web): admin inventory revoke UI — consume PR #66 BE` — **Done by PR #106 (Merged into main @ `7d1965e`, 29/4 ~19:09 UTC, CI 5/5 ✅)**.

#### ~~PR #107 (session 9g task C)~~ — `feat(web): i18n parity test + wire breakthroughReady sidebar badge + smart UX polish` — **Done by PR #107 (Merged into main @ `82f2020`, 29/4 ~19:30 UTC, CI 5/5 ✅)**.

#### ~~PR #108 (session 9g task D)~~ — `docs(handoff): session 9g task D — runtime smoke 9d→9g integration + report bump 82f2020` — **Done by PR #108 (Merged into main @ `0a6c664`, 29/4 ~19:45 UTC, CI 5/5 ✅)**.

#### ~~PR #109 (session 9g task E.a)~~ — `feat(web): smart admin economy alerts badge + 60s polling — wire AdminView nav` — **Done by PR #109 (Merged into main @ `58fa69d`, 29/4 ~19:50 UTC, CI 5/5 ✅)**.
- **File**: `apps/web/src/lib/adminAlerts.ts` (helper `countEconomyAlerts` + `alertSeverity`), `apps/web/src/views/AdminView.vue` (badge + 60s polling timer + onBeforeUnmount cleanup), `apps/web/src/i18n/{vi,en}.json` (+1 key `admin.alerts.badgeTooltip`), `apps/web/src/lib/__tests__/adminAlerts.test.ts` (+13 vitest).

#### ~~PR #110 (session 9g task F1)~~ — `fix(env): quote SMTP_FROM trong .env.example để bash source .env không fail` — **Done by PR #110 (Merged into main @ `4c214eb`, 29/4 ~19:55 UTC, CI 5/5 ✅)**.
- **File**: `apps/api/.env.example` line 31 quote `SMTP_FROM`.

#### PR A — Smoke E2E + Runtime sanity (Immediate §20.1, historical session 4)
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
