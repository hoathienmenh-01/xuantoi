# Changelog — Xuân Tôi

Tóm tắt **người chơi / vận hành / dev** dễ đọc, theo PR đã merge vào `main`. Định dạng cảm hứng từ [Keep a Changelog](https://keepachangelog.com/) + [Semantic Versioning](https://semver.org/lang/vi/) nhưng adapt cho closed-beta:

- **Closed beta chưa release public** → versioning tạm bằng "session khoảng PR".
- Chi tiết kỹ thuật từng PR (file/path/test) nằm trong `docs/AI_HANDOFF_REPORT.md` mục "Recent Changes". File này chỉ tóm tắt **thay đổi quan trọng cho người dùng/admin**.
- Quy ước section: **Added** / **Changed** / **Fixed** / **Security** / **Docs** / **Internal**.

---

## [Unreleased]

> Pending merge: docs CHANGELOG catch-up sessions 9o + 9p (this PR).

---

## [session 9p — PR #190 → #192, merged 30/4 18:13→18:58 UTC]

### Internal — API pure-unit test coverage push (no runtime change)

- **HealthController.readyz failure paths** (PR #190): +10 vitest (mocked PrismaService.$queryRaw + Redis.ping). Lock-in 503 envelope shape khi DB hoặc Redis fail / Redis trả non-PONG; happy path không gọi `res.status`; error stringify fallback (Error vs non-Error); `version` env override + default. `apps/api/src/modules/health/health.controller.unit.test.ts`. API baseline 619 → 629.
- **admin/ledger-audit `auditResultToJson` JSON serializer** (PR #191): +12 vitest pure-unit cho serializer dùng bởi admin endpoint `GET /admin/economy/audit-ledger`. Lock-in BigInt→string preserve precision khi vượt `Number.MAX_SAFE_INTEGER` (chính lý do tồn tại serializer); negative diff giữ dấu; zero giữ "0"; inventoryDiscrepancies (number) passthrough; JSON.stringify roundtrip safety; no input mutation. `apps/api/src/modules/admin/ledger-audit-json.test.ts`. API baseline 629 → 641.
- **Scheduler ghost-cleanup invariant** (PR #192): +12 vitest pure-unit cho `OpsService.scheduleRecurring` + `MissionScheduler.onModuleInit` (mocked BullMQ Queue). Lock-in: trước add lại job repeatable, MỌI job tên match cũ phải bị `removeRepeatableByKey` (tránh ghost duplication khi hot-reload / interval change); non-match name không xoá nhầm; `add()` 1 lần với `repeat.every` từ constant + `removeOnComplete/removeOnFail` cap 10; constant interval lock (`OPS_PRUNE_INTERVAL_MS === 24h`, `MISSION_RESET_INTERVAL_MS === 10min`). `apps/api/src/modules/ops/ops.service.test.ts` + `apps/api/src/modules/mission/mission.scheduler.test.ts`. API baseline 641 → 653.

### Docs

- **AI_HANDOFF_REPORT** liên tục bumped sau mỗi PR (snapshot, Recent Changes, §21 Session 9p table).

---

## [session 9o — PR #184 → #189, merged 30/4 17:30→17:52 UTC]

### Internal — API service WS / queue test coverage push

- **chat.service WS + history** (PR #186): +11 vitest cho `ChatService` — emit events, room join/leave, history pagination, anti-spam moderation paths. `apps/api/src/modules/chat/chat.service.ws-history.test.ts`. API baseline 597 → 608.
- **mission.processor reset** (PR #187): +8 vitest cho `MissionResetProcessor` — DAILY/WEEKLY window reset, idempotent, không throw khi reset rỗng. `apps/api/src/modules/mission/mission.processor.test.ts`. API baseline 608 → 616.
- **cultivation processor + service** (PR #188): +14 vitest cho `CultivationProcessor` (tick/breakthrough job paths) + `CultivationService` (start/stop/snapshot). Lock-in EXP accumulation, breakthroughReady invariant, ledger atomicity. API baseline 616 → 619.

### Docs

- **Audit refresh session 9o kickoff + progress** (PR #184 / #189): bump snapshot + close-out cascade.

---

## [session 9n+ tail — PR #172 → #179, merged 30/4 13:15→17:00 UTC]

### Added — Tests-only PRs (lock-in coverage, no runtime change)

- **shared catalogs** (PR #173 +40 / #174 +18 / #175 +shared core types): combat formulas, mission templates, item/realm catalog Zod schemas. Shared baseline 96 → 220 vitest.
- **mail WS prune** (PR #176): MailService prune-on-claim invariant.
- **realtime.service** (PR #177): WS service emit + room mapping unit tests.
- **AllExceptionsFilter** (PR #178): error envelope shape lock-in (HTTP code + i18n message key + stack masking).
- **ws/client (web) `resolveWsOrigin`** (PR #179): +15 vitest pure-unit. Web baseline 532 → 547.

### Docs

- **CHANGELOG session 9n catch-up** (PR #172): backfill session 9n entries.

---

## [session 9n — PR #165 → #171, merged 30/4 12:13→13:15 UTC]

### Added

- **Smart audit-ledger CLI** mở rộng `--json` flag (PR #166): `pnpm --filter @xuantoi/api audit:ledger -- --json` cho cron / pipeline parse machine-readable. +13 vitest unit (parseArgs 4 + formatResult 5 + formatResultJson 4) cho pure logic. Doc ở `ADMIN_GUIDE §11`.
- **Smart admin economy alerts thresholds env-tunable** (PR #167): `ECONOMY_ALERTS_DEFAULT_STALE_HOURS` / `_MIN_STALE_HOURS` / `_MAX_STALE_HOURS` env override (mặc định 24h, range 1h..720h). Endpoint `GET /admin/economy/alerts` + UI `apps/web/src/api/admin.ts` adminEconomyAlerts(staleHours?). +22 vitest. Doc `ADMIN_GUIDE §11.3` + `apps/api/.env.example`.
- **Smart economy-alerts CLI** parallel với `audit:ledger` (PR #169): `pnpm --filter @xuantoi/api alerts:economy` + `--json` flag + `--stale-hours=N` flag (override 24h default). Read-only, exit 0/1/2. Extract pure `queryEconomyAlerts()` từ AdminService cho reusability. +18 vitest unit. Doc `ADMIN_GUIDE §11.3`.

### Fixed

- **i18n parity — toast titles** (PR #170): `apps/web/src/stores/toast.ts` Pinia store trước hard-code VN titles (`'Tin tức' / 'Cảnh báo' / 'Lỗi' / 'Thành công' / 'Thiên Đạo Sứ Giả'`) → giờ dùng `i18n.global.t('toast.title.<type>')` (key đã có sẵn ở `vi.json` + `en.json`). User switch sang en thì toast title cũng dịch. +4 vitest cho locale switch (vi/en).
- **i18n parity — api fallback errors** (PR #171): `apps/web/src/api/{auth,shop,character}.ts` trước hard-code VN `new Error('Đăng ký thất bại' / 'Đăng nhập thất bại' / ...)` fallback (9 chỗ) khi BE envelope thiếu `data.error` → giờ dùng helper `fallbackError(op)` wrap `i18n.global.t('common.apiFallback.<op>')`. Added i18n keys `common.apiFallback.{register,login,changePassword,forgotPassword,resetPassword,logoutAll,shopLoad,shopBuy,onboard}` ở vi.json + en.json. +19 vitest cho cả 2 locale + BE error precedence. Web vitest baseline 513 → 532.

### Docs

- **Audit refresh session 9n kickoff** (PR #165): bump snapshot `f103485 → d332a18` post session 9m close-out (PR #160..#164 merged).
- **TROUBLESHOOTING runbook** (PR #168): §15 ledger drift (audit-ledger CLI exit code 1 → diagnose currency vs character balance, item ledger vs InventoryItem.qty); §16 topup stale alerts flood (ECONOMY_ALERTS_*_STALE_HOURS tuning + payment provider integration audit).

### Internal

- Loop autonomous session 9n hoàn tất 7/7 PR merge cascade vào main mà không cần user confirmation cho mỗi task (task A→G). Snapshot `d332a18 → c02573a` (post PR #171).

---

## [session 9m — PR #160 → #164, merged 30/4 11:30→11:51 UTC]

### Docs

- **Audit refresh session 9m kickoff** (PR #160): bump snapshot post session 9l close-out.
- **CHANGELOG catch-up sessions 9g/9h/9i/9j/9l** (PR #161): backfill changelog cho các session đã merge nhưng thiếu trong file này.

### Internal

- **API service test coverage push** (PR #162/#163/#164): +36 vitest economy/auth safety:
  - `topup.service.test.ts` +17 vitest (PR #162): payment confirm idempotency, ledger atomicity, currency conversion.
  - `email.service.test.ts` +14 vitest unit (PR #163): no-DB pure transformer tests cho mail formatting.
  - `giftcode-race.test.ts` +5 vitest concurrent (PR #164): double-grant prevention via DB unique constraint + Promise.allSettled stress test.

---

## [session 9l — PR #156 → #159, merged 30/4 10:30→11:00 UTC]

### Docs

- **Audit refresh session 9l kickoff** (PR #156): bump snapshot `2e54a1e → 739b10a`, session 9k 7/7 PR close-out, session 9l backlog + roadmap.
- **RELEASE_NOTES + CHANGELOG session 9k close-out** (PR #157): mark "Đã hoàn thành trong session 9k" 5 item, chuyển M9 sang "Đã giải quyết", thêm CHANGELOG section session 9k.
- **Handoff M9 Resolved** (PR #158): mark M9 (logout-all passwordVersion) Resolved trong §16 Known Issues.

### Internal

- **UI primitive render tests** (PR #159): ConfirmModal 17 + SkeletonBlock 4 + SkeletonTable 4 vitest. Web baseline `484 → 509` (51 → 54 file).

---

## [session 9k — PR #149 → #155, merged 30/4 09:00→09:35 UTC]

### Added

- **Playwright `E2E_FULL=1` golden smoke expand** (PR #153): +3 best-effort test trong `apps/web/e2e/golden.spec.ts` — `shop buy → inventory reflect new item`, `mail inbox open → read → claim nếu có reward`, `profile /profile/:id public view`. CI mặc định không chạy (giữ nguyên AuthView smoke only); ops bật local qua `E2E_FULL=1 pnpm --filter @xuantoi/web e2e` khi muốn verify pre-release.
- **AdminView render-level smoke tests** (PR #150): 18 vitest bao phủ onMounted role guard (unauth / PLAYER / ADMIN+MOD), tab badge rendering (alertsCount / pendingTopup / activeGiftcode), tab switch fetch (Users / Audit), Export CSV flow (success / truncated warning / UNAUTHENTICATED), Giftcode revoke ConfirmModal wiring (modal open/cancel/confirm, CODE_REVOKED error, REVOKED/EXPIRED state hide). Baseline web `466 → 484` (50 → 51 file).
- **`pnpm smoke:beta` zero-dep ESM CLI** (PR #152): `scripts/smoke-beta.mjs` chạy 16-step HTTP smoke (healthz → register → session → onboard → character/me → cultivate start/stop → daily-login → missions → shop → inventory → mail → leaderboard → logout). Exit 0 khi pass, exit 1 với diagnostic khi fail. Dùng cho CI gate trước release + manual smoke.
- **Regression test — `logoutAll` preserves `passwordVersion`** (PR #155): integration test trong `apps/api/src/modules/auth/auth.service.test.ts` lock-in documented behavior (M9).

### Docs

- **`docs/PRIVACY.md` + `docs/TOS.md`** closed-beta tester agreement (PR #151): data retention (account / login logs / chat 30d / currency ledger / item ledger / topup history), delete-my-data flow, analytics scope, 3rd-party services (chỉ Postgres/Redis); closed-beta tester TOS (scope "beta thử nghiệm", no payment, account revocable, no harassment, report-bugs SLA best-effort, liability limited, data backup).
- **`docs/SECURITY.md §1 Authentication`** (PR #154): thêm bullet document behavior `POST /api/_auth/logout-all` revoke refresh tokens nhưng KHÔNG bump `passwordVersion` → access tokens 15-phút TTL vẫn valid trên device khác cho tới khi hết hạn. Force-kill ngay phải đổi password hoặc bump `JWT_ACCESS_SECRET` (backlog M9 close-out).
- **`docs/QA_CHECKLIST.md §9`** thêm hướng dẫn chạy `pnpm smoke:beta` cho QA.
- **`docs/AI_HANDOFF_REPORT.md`** audit refresh kickoff session 9k (PR #149): bump snapshot `2ed8c29 → e342513`, mark PR #134..#148 tất cả Merged, sync baseline web `302 → 466` (35 → 50 file) + shared `55 → 96` (3 → 6 file), sửa PR #136 status (merged stale branch, replay qua #138).

### Internal

- Loop autonomous session 9k hoàn tất 7/7 PR merge cascade vào main mà không cần user confirmation cho mỗi task (task A→G).

---

## [session 9j — PR #134 → #148, merged 30/4 07:20→08:55 UTC]

### Fixed

- **Critical typecheck fix C-TSNARROW-RESOLVEFN** (PR #134): vue-tsc 2.0+ (TS 5.x) narrow `let` variable capture-by-closure thành `never` trong Promise executor. Fix: đổi `resolveHolder: { current }` object-property pattern. Unblock toàn bộ typecheck pipeline.

### Internal

- **Massive view test coverage push** (PR #135 → #148): 15 PR autonomous loop thêm vitest cho mọi view + shared catalog integrity. Web baseline `207 → 466` (30 → 50 file). Chi tiết:
  - TopupView 10 + MailView 14 vitest (PR #135)
  - ShopView 19 vitest (PR #137)
  - InventoryView 15 vitest (PR #138, replay from stale-base PR #136)
  - AuthView 14 vitest (PR #139)
  - OnboardingView 16 vitest (PR #140)
  - DungeonView 13 vitest (PR #141)
  - SectView 12 vitest (PR #142)
  - NotFoundView + router manifest lockdown 8 vitest (PR #143)
  - BossView 12 vitest (PR #144)
  - ChatPanel + LocaleSwitcher 17 vitest (PR #145)
  - MButton + MToast UI primitive 14 vitest (PR #146)
  - Shared shop + topup catalog integrity 19 vitest (PR #147)
  - Shared BOSSES catalog integrity 22 vitest (PR #148)

---

## [session 9i — PR #119 → #133, merged 30/4 06:21→07:50 UTC]

### Added

- **`docs/RELEASE_NOTES.md` bootstrap** (PR #120): closed beta press kit — feature list, known issues, roadmap lộ trình.
- **Smart admin giftcode active badge** (PR #121): `countActiveUnused()` helper + AdminView nav badge cyan-500 cho active giftcodes. +7 vitest.
- **Smart UX — toast duration policy by severity** (PR #122): `resolveToastDuration()` + `TOAST_DURATION_MS` policy (info 3s / success 3.5s / warning 5s / error 6s). +9 vitest.
- **Admin user export CSV** (PR #123): `GET /admin/users.csv` RFC 4180 format + audit `user.exportCsv` + FE download button. +15 vitest.
- **Smart admin giftcode revoke UI flow** (PR #127 + #129): `computeGiftcodeRevokeImpact()` + ConfirmModal danger style (impact preview: usage/expiry/warning) + error mapping. +12 vitest + 5 i18n key.
- **`extractApiErrorCode` pure error extractor** (PR #128): centralized error code extraction từ mọi error shape (direct/axios/ES2022 cause/legacy). +17 vitest. Adopted trong AdminView + AuthView (PR #133 migration 14 view còn lại).

### Internal

- **HomeView smoke tests** (PR #124): 9 vitest cover onMounted routing branches + render + cultivate/breakthrough. Web baseline `207 → 236`.
- **AppShell skeleton tests** (PR #126): 15 vitest cover mobile nav toggle + sidebar badges + staff-only/cultivating/WS/logout.
- **GiftCodeView tests** (PR #131): render + redeem flow + error mapping vitest.
- **ProfileView tests** (PR #132): render + fetch + error + badges vitest.
- **Adopt `extractApiErrorCode`** (PR #133): migration refactor 14 view để dùng centralized error extractor.

---

## [session 9h — PR #111 → #118, merged 30/4 04:25→06:18 UTC]

### Added

- **Admin audit-ledger endpoint + UI** (PR #112): `GET /admin/economy/audit-ledger` on-demand verify CurrencyLedger consistency. `ledger-audit.ts` pure logic + AdminView panel violet-500. +6 BE vitest + 3 FE vitest.
- **Playwright golden expand** (PR #113): +95 line daily login + leaderboard tabs gated `E2E_FULL=1`. `docs/QA_CHECKLIST.md` how-to thêm.
- **Smart onboarding expand 4→6 step** (PR #114): Leaderboard + Mail visit tracking localStorage helper + `OnboardingChecklist.vue` 6 step. +6 vitest.
- **Smart admin economy report — top 10 whales + circulation** (PR #115): `GET /admin/economy/report` 5 stat cards + top whales table. +6 BE + 3 FE vitest + 13 i18n key.
- **Smart admin users filter expand** (PR #116): currency range + realmKey filter cho `GET /admin/users`. +5 BE + 5 FE vitest + 6 i18n key.
- **Smart admin recent activity widget** (PR #117): Stats tab inline last 5 audit entries panel violet-500. +9 i18n key.
- **Smart admin pending topup badge** (PR #118): `pendingTopupCount` ref + 60s poll + badge amber-500 nav "Nạp Tiên Ngọc". +1 i18n key.

### Docs

- Audit refresh session 9h (PR #111).

---

## [session 9g — PR #105 → #110, merged 29/4 19:00→19:55 UTC]

### Added

- **FE Admin Inventory Revoke UI** (PR #106): nút "Thu hồi item" + modal AdminView Users tab + `adminRevokeInventory()` helper. +7 vitest + i18n vi/en.
- **Smart UX — sidebar breakthrough indicator + i18n parity guard** (PR #107): violet-400 dot khi sắp đột phá + 6 vitest enforce vi/en symmetric + ICU placeholder parity. Web vitest `168 → 174`.
- **Smart admin economy alerts badge** (PR #109): `countEconomyAlerts` helper + red dot badge nav Stats + auto-poll 60s. +13 vitest. Web vitest `174 → 187`.

### Fixed

- **`.env.example` SMTP_FROM quote fix** (PR #110): sửa syntax quote trong file env mẫu.

### Docs

- **Runtime smoke report session 9d→9g** (PR #108): 41 endpoint flow verified, 0 Critical/High bugs. Evidence in `docs/RUNTIME_SMOKE_9G.md`.
- Audit refresh session 9g (PR #105).

---

## [session 9f — PR #98 → #103, merged 29/4 17:18→18:50 UTC]

### Added

- **Self-service forgot/reset password** (PR #101 BE + PR #102 FE, merged @ `6f3faf4`): user có thể tự đặt lại mật khẩu qua email link 30 phút thay vì phải nhờ admin DB. Anti-spam rate-limit 3 yêu cầu/IP/15 phút. Email transactional gửi qua SMTP (dev: Mailhog `localhost:1025/8025`, prod: SMTP thật) hoặc fallback console log nếu chưa cấu hình. Reset thành công sẽ tự revoke mọi phiên đăng nhập của user (bump `passwordVersion` + revoke refresh tokens).
- **Trang FE mới**: `/auth/forgot-password` + `/auth/reset-password` (public, không cần đăng nhập). Tab Login có link "Quên huyền pháp?". Devloper-mode panel hiển thị token cho non-prod để E2E test mà không cần Mailhog UI.
- **Bảng xếp hạng đa tab** (PR #99): tab "Sức Mạnh" (giữ nguyên), thêm tab "Nạp Top" (xếp theo tổng tiên ngọc nạp APPROVED) và tab "Tông Môn" (xếp theo treasury linh thạch + level + tuổi). Lazy-fetch theo tab.

### Security

- Forgot-password endpoint **silent ok cho mọi email** (kể cả không tồn tại) → chống user enumeration.
- **Token format `<id>.<secret>`** (PR #101 in-flight Devin Review fix r3163113344): plaintext token gồm `tokenId.secret` — `tokenId` là PK row (non-secret), `secret` là 32-byte base64url. DB lookup O(1) bằng `findUnique({ id: tokenId })` thay vì scan loop (chống DOS by token-flood).
- **Timing parity** (PR #103 post-merge Devin Review fix r3163261711): nhánh `forgotPassword` cho user-không-tồn-tại/banned thêm `argon2.hash` giả ~100ms để response time tương đương path-có-user → chống enum bằng đo network latency.
- Token reset là plaintext 32-byte URL-safe random; DB chỉ lưu argon2id hash của `secret`. One-shot consume; reset thành công revoke mọi token reset khác của user.

### Changed

- **Admin self-protection** (PR #100): admin/mod không thể tự hạ vai trò của chính mình hoặc tự ban chính mình ở trang `/admin`. UI disable nút + badge "Bạn", BE lock-in qua check `actor.id === target.id`. Loại trừ rủi ro lockout vô tình.

### Docs

- (PR #98) Audit refresh `AI_HANDOFF_REPORT.md`: mark PR #92→#97 đã merged, bump snapshot commit, thêm session 9f roadmap A-D.
- (PR #104) Bootstrap `docs/CHANGELOG.md` (file này) — Keep-a-Changelog format adapted closed-beta.

---

## [session 9e — PR #92 → #97, merged 29/4 16:00→17:18 UTC]

### Added

- **Backup/restore script Postgres** (PR #95 + PR #96): `pnpm backup:db` (custom format gzipped) + `pnpm restore:db` (drop-recreate-restore). Verify bằng `pg_restore --list` SIGPIPE-safe. `pg_terminate_backend` trước DROP. Doc `BACKUP_RESTORE.md` (TL;DR + cron mẫu + disaster recovery checklist).
- **Leaderboard topup + sect endpoints** BE (PR #94): `GET /api/leaderboard/topup` + `GET /api/leaderboard/sect` (BE only, FE consume ở PR #99).

### Changed

- **Mobile responsive iPhone SE 375×667** (PR #97): AppShell sidebar chuyển thành drawer overlay khi `md:hidden`, hamburger toggle, watch route auto-close. AdminView 4 table wrap `overflow-x-auto`.

### Docs

- (PR #92) BETA_CHECKLIST refresh; (PR #93) Audit refresh session 9e.

---

## [session 9d — PR #80 → #91, merged 29/4 10:25→14:55 UTC]

### Added

- **Daily login reward** (PR #80): `DailyLoginCard` ở Home, `RewardClaimLog`-backed idempotent claim; +100 LT + streak count.
- **Admin giftcode FE panel** (PR #81): `/admin` giftcode tab với filter q/status, create + revoke (audit logged).
- **`/activity` — sổ hoạt động** (PR #88 BE + PR #91 FE): user xem `CurrencyLedger` + `ItemLedger` của bản thân với keyset pagination, tab switch currency/item, reason i18n đầy đủ. API `GET /logs/me?type=...&limit=...&cursor=...`.
- **Proverbs corpus mở rộng** (PR #87): màn hình tải mở rộng từ 7 → 64 câu chia 4 chủ đề.
- **Logout-all confirm modal** (PR #83 + PR #85): thay `window.confirm()` bằng modal `ConfirmModal` reusable.

### Fixed

- **Giftcode duplicate code** (PR #84): trả error `CODE_EXISTS` thay vì 500.

### Docs

- (PR #89) `API.md` refresh; (PR #90) `QA_CHECKLIST.md` + `ADMIN_GUIDE.md` + `TROUBLESHOOTING.md` refresh; (PR #86) Audit refresh session 9d.

---

## [Earlier — PR #33 → #79]

> Chi tiết theo PR có trong `docs/AI_HANDOFF_REPORT.md` mục "Recent Changes". Highlight chính:

### Foundation (PR #33 → #45)

- **Bootstrap admin/sect seed** (PR #33), **InventoryService 19 vitest** (PR #34), **Boss admin spawn** (PR #36), **Settings page (đổi password + logout-all)** (PR #37), **Profile page** (PR #38), **Shop page (NPC 11 entry, LT only)** (PR #39), **`ItemLedger` audit table** (PR #40), **Mission reset timezone `Asia/Ho_Chi_Minh`** (PR #42), **Currency/Item ledger actor index** (PR #43).

### Frontend hardening (PR #46 → #59)

- Vitest scaffold (PR #47/#53), Vue tests cho store/auth/toast/badges/NextActionPanel/OnboardingChecklist/itemName/Leaderboard (PR #55→#59).

### Stability + ops (PR #60 → #79)

- Register rate-limit 5/IP/15min (PR #60), Profile rate-limit 120/IP/15min (PR #62), WS `mission:progress` push (PR #63 + #65), Playwright e2e-smoke CI matrix (PR #64), Admin inventory revoke + `ADMIN_REVOKE` ledger (PR #66), Skeleton loaders (PR #67/#68/#77), Market fee env var (PR #69), Admin guard ADMIN-only decorator (PR M8), Mobile responsive AppShell partial (PR #74-77).

---

## Format guideline cho future PR

Khi merge PR, **tự bổ sung 1 dòng** vào section "Unreleased" tương ứng:

```markdown
- **<Tên feature người dùng-facing>** (PR #N): <1 câu mô tả tác động cho user/admin>.
```

Nếu PR thuần internal (refactor/test/CI/docs nhỏ) → ghi vào **Internal** thay vì Added/Changed.

Khi đóng release / milestone → di chuyển nguyên section "Unreleased" thành section có ngày + label session, mở section "Unreleased" mới ở trên cùng.
