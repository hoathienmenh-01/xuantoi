# QA Smoke Checklist — Xuân Tôi

Manual smoke test checklist trước mỗi release closed beta. Mục tiêu: ~15 phút để 1 QA/operator verify các flow quan trọng nhất còn xanh sau khi deploy.

## 0. Prerequisites

- [ ] Dev server api (port 3000) + web (port 5173) chạy, hoặc staging URL sẵn sàng.
- [ ] Infra: Postgres + Redis + Minio + Mailhog up (`pnpm infra:up` cho local).
- [ ] Migrations applied (`pnpm --filter @xuantoi/api prisma migrate deploy`).
- [ ] Seed data tối thiểu: 3 sect (`thanh_van`, `huyen_thuy`, `tu_la`) + catalog items (shared) + 1 admin account (xem `docs/ADMIN_GUIDE.md`).
- [ ] Browser: Chrome/Firefox, DevTools → Console không có error đỏ khi load `/auth`.

## 1. Auth + Onboarding (5 phút)

- [ ] `/auth` load OK; form "Đăng ký" + "Đăng nhập" hiển thị tiếng Việt mặc định.
- [ ] Register user mới `qa-<timestamp>@xt.local` / password ≥ 8 ký tự → redirect `/onboarding`.
- [ ] Nhập đạo hiệu hợp lệ → chọn 1 sect → tạo character → redirect `/home`.
- [ ] Retry register cùng email → báo `EMAIL_TAKEN` (toast đỏ).
- [ ] Logout → redirect `/auth`. Login lại bằng account vừa tạo → `/home` load thành `character.name` hiện đúng.

## 2. Cultivation + Breakthrough (2 phút)

- [ ] `/home` thấy HP/MP/EXP bar, stat, button **Nhập Định**.
- [ ] Click Nhập Định → toast success; progress bar EXP có sau ≤ 35s (tick 30s).
- [ ] WS status chip góc phải top chuyển `WS ✓` xanh (không phải `WS ×` đỏ).
- [ ] Click Xuất Định → toast; tick dừng.

## 3. Smart Next Action Panel (1 phút, sau PR #49)

- [ ] `/home` hiển thị panel "Đạo Lộ Gợi Ý" phía trên stat grid (nếu user có hint).
- [ ] Nếu user chưa nhập định, panel hiển thị `CULTIVATE_IDLE` (priority 5, màu xám).
- [ ] Nhấn "Đi ngay" trên 1 hint → chuyển đúng route (ví dụ `MISSION_CLAIMABLE` → `/missions`).

## 4. Mission (2 phút)

- [ ] `/missions` load, list 4-5 mission DAILY + 1-2 WEEKLY.
- [ ] Progress bar mỗi mission hiển thị đúng `currentAmount / goalAmount`.
- [ ] Mission đã đạt goal nhưng chưa claim → button "Nhận" active; click → currency/linh thạch tăng + toast.
- [ ] Mission sau claim: disable button, move xuống dưới hoặc fade.
- [ ] WS push: mở 2 tab cùng user → claim ở tab 1 → tab 2 progress bar update real-time (event `mission:progress`, throttle 500ms — PR #63).

## 4b. Daily Login Reward (1 phút, sau PR #80, M9)

- [ ] `/home` (hoặc tab Hoạt động) hiển thị card "Điểm danh hôm nay" với streak hiện tại + reward kế tiếp (LinhThạch).
- [ ] Button "Nhận" active nếu `canClaimToday=true`; click → +100 LT (lần đầu) + toast "Đã nhận".
- [ ] Click "Nhận" lần 2 cùng ngày → response `{ claimed: false }`, không cộng thêm currency, button disabled.
- [ ] Reset theo `MISSION_RESET_TZ` (default `Asia/Ho_Chi_Minh`) — sang 00:00 VN ngày kế tiếp button bật lại.

## 5. Mail (2 phút)

- [ ] `/mail` inbox load; nếu có thư mới thì badge đỏ trên nav hiển thị số.
- [ ] Click thư → đánh dấu đã đọc (badge giảm); body + subject hiển thị đúng.
- [ ] Thư có reward: button "Nhận quà" → toast + reward vào inventory / currency.
- [ ] Thư đã claim: badge ẩn hoặc label "Đã nhận".

## 6. Combat + Inventory (3 phút)

- [ ] `/dungeon` list 3 dungeon (luyen_khi_duong_1/2/3). Click vào 1 dungeon → vào encounter.
- [ ] HP monster giảm sau mỗi action attack; nếu thắng → loot drop vào inventory; nếu thua → HP character về max (respawn).
- [ ] `/inventory` hiển thị item vừa loot; drag/click equip → stat power/atk thay đổi đúng.
- [ ] Sell item (nếu có) → linh thạch tăng đúng theo catalog `price`.

## 7. Market + Shop (2 phút)

- [ ] `/market` list listing — có thể empty ngày đầu.
- [ ] `/shop` NPC — list ≥ 5 item; click "Mua" → linh thạch trừ đúng, item vào inventory.
- [ ] (Optional) Đăng 1 item lên `/market` — sau đó cancel → item trở về inventory.

## 7b. Leaderboard (1 phút, sau PR #59)

- [ ] `/leaderboard` (hoặc tab tương ứng) hiển thị top theo `(realm, power)` desc, default 50 entry.
- [ ] Mỗi row: rank, tên character, sect, realm/stage, power.
- [ ] Click vào tên → chuyển `/character/profile/:id` (PR #62 — public profile, rate limit per-IP 120/15min).

## 8. Sect + Boss (2 phút)

- [ ] `/sect` — hiển thị thông tin tông môn đã chọn + danh sách thành viên.
- [ ] Cống hiến linh thạch cho sect → balance trừ đúng, sect treasury tăng.
- [ ] `/boss` — nếu admin đã spawn boss: hiển thị HP bar, nút tấn công.
- [ ] Attack boss → damage vào boss + log xuất hiện ở bảng damage.

## 9. Topup + Giftcode (1 phút)

- [ ] `/topup` — list 3-4 package; click 1 package → hiển thị QR + transferCode.
- [ ] `/giftcode` — nhập 1 code admin vừa tạo → redeem thành công + toast; code repeated → báo `ALREADY_REDEEMED`.

## 10. Admin (1 phút, chỉ khi account là ADMIN)

- [ ] `/admin` load; 7 tab: Overview / Users / Topups / Giftcodes / Mail / Boss / Audit.
- [ ] Tab Giftcodes: filter `q + status` (PR #81 G22) — search code, filter `ACTIVE/REVOKED/EXPIRED`; create giftcode mới với `code` đã tồn tại → response error `CODE_EXISTS` (PR #84 G23) hiển thị toast tiếng Việt rõ ràng.
- [ ] Tab Topups: filter `q + from + to` (search email + date range).
- [ ] Tab Users: filter `role + banned`; click 1 user → tab Inventory → click "Revoke" item → ledger entry `ADMIN_REVOKE` xuất hiện trong tab Audit (PR #66).
- [ ] Tab Overview: economy alerts panel hiển thị nếu có anomaly (currency âm, ledger inconsistent — PR #54).
- [ ] Tab Users: list user; role change work cho ADMIN (sau PR #48, MOD chỉ ban được PLAYER).
- [ ] Tab Topups: approve 1 pending → user thấy tiên ngọc tăng.
- [ ] Tab Audit: log có entry vừa tạo (role change + topup approve).
- [ ] Admin role PLAYER → `/admin` redirect `/home` + toast `FORBIDDEN`.

## 11. Responsive + i18n (1 phút)

- [ ] Resize browser về mobile (iPhone SE 375×667) — sidebar ẩn, topbar stack.
- [ ] Click LocaleSwitcher → chuyển EN; các toast + button label đổi sang English.

## 12. Session integrity

- [ ] Refresh (`F5`) khi đã login → còn nguyên session, character load tự động.
- [ ] Đổi password ở `/settings` → session cũ revoke, redirect `/auth`.
- [ ] Settings → "Logout tất cả thiết bị" → **mở confirm modal** (PR #83 L6 — không phải `window.confirm`); click "Huỷ" → modal đóng, không gọi API; click "Xác nhận" → token hiện tại invalid, redirect `/auth`.
- [ ] Mở 2 tab cùng user → "Logout tất cả" ở tab 1 → tab 2 next request → 401 → redirect `/auth`.

## 13. Audit log self-view (1 phút, sau PR #88, M6)

- [ ] Tab/page "Hoạt động" gọi `GET /logs/me?type=currency&limit=20` → list giao dịch LinhThạch/TiênNgọc gần nhất, đúng thứ tự `createdAt DESC`.
- [ ] Switch type=`item` → list ItemLedger với `qtyDelta` có dấu (+/-) đúng theo equip/use/buy/admin revoke.
- [ ] Cuộn xuống cuối list → fetch nextCursor → trang 2 không trùng/sót entry.
- [ ] User A không thể thấy log của user B (test bằng cookie swap).

---

## Post-smoke checks

- [ ] Check `GET /api/healthz` → `{ ok: true, uptimeMs, ts }`.
- [ ] Check `GET /api/readyz` → `{ ok: true }` (200) hoặc `503` nếu DB/Redis fail.
- [ ] Check `GET /api/version` → `{ name, version, commit, node, ts }` — `commit` SHA khớp deploy.
- [ ] Admin audit log tab không có `ERROR`/`CRITICAL` entry.
- [ ] Browser DevTools → Network tab không có request 5xx (4xx cho unauthenticated là OK).

---

## Nếu phát hiện lỗi

1. Ghi lại **URL** + **User ID** + **thời gian** + **steps reproduce**.
2. Chụp screenshot + copy console log + copy network request body (redact token/cookie).
3. Ghi vào `docs/AI_HANDOFF_REPORT.md` §Known Issues với severity phù hợp.
4. Nếu Critical → block release, mở PR fix ngay.
5. Nếu High → fix trong 24h.
6. Nếu Medium/Low → backlog, fix trong release tiếp theo.

## Automation

Phần lớn check ở section 1-10 có Playwright equivalent đã scaffolded ở `apps/web/e2e/golden.spec.ts`. Mặc định CI chạy chỉ smoke test (`auth page renders`) — full golden path gated bởi env `E2E_FULL=1`.

### Chạy full golden path local

```bash
# Tab 1: bật infra + api + web
pnpm infra:up
pnpm --filter @xuantoi/api exec prisma migrate deploy
pnpm --filter @xuantoi/api dev    # port 3000
# Tab 2:
pnpm --filter @xuantoi/web dev    # port 5173
# Tab 3 (hoặc sau khi tab 1+2 ready):
PLAYWRIGHT_BASE_URL=http://localhost:5173 PLAYWRIGHT_SKIP_WEBSERVER=1 \
  E2E_FULL=1 pnpm --filter @xuantoi/web e2e
```

### Test cases hiện có

**Session 9h-C baseline** (3 test):
- `register → onboard → home → cultivate → mission claim` — flow gốc.
- `daily login claim — first claim today (M9 / G7)` — verify DailyLoginCard render + click "Nhận thưởng hôm nay" không crash.
- `leaderboard tabs — Power / Topup / Sect render danh sách` — verify 3 tab `/leaderboard` switch không crash.

**Session 9k task B expand** (+3 test):
- `shop buy → inventory reflect new item` — /shop render, click nút "Mua" đầu tiên (best-effort, skip nếu INSUFFICIENT_FUNDS), rồi /inventory verify render.
- `mail inbox open → read → claim nếu có reward` — /mail render, nếu có mail row thì click để đọc, nếu có nút "Nhận thưởng" thì click claim.
- `profile /profile/:id public view` — thử click link profile từ leaderboard; fallback direct navigate `/profile/<fake_id>` verify không crash (NotFound/empty state OK).

Tất cả test mới dùng style "best-effort smoke" — `if (await el.isVisible()) await el.click()` thay vì strict assert, để không fail khi state DB khác (ví dụ admin chưa có topup data → tab Topup empty list vẫn ok). Final assertion luôn là `expect(page).toHaveURL(...)` để chắc page không crash.

### CI gate

CI matrix `e2e-smoke` ở `.github/workflows/ci.yml` chạy `pnpm --filter @xuantoi/web exec playwright test --project=chromium` với Postgres+Redis services + build api+web. Vì `E2E_FULL` không set trong CI, **chỉ describe `AuthView smoke` chạy** (1 test: `auth page renders`). Describe `Golden path — full stack required` skip toàn bộ. Full golden path **không** chạy CI mặc định để tránh flaky network/timing. Chạy local trước khi mở PR thay đổi auth / onboarding / home / missions / daily-login / leaderboard.

## 9. `pnpm smoke:beta` CLI (session 9k task E)

**Mục đích**: smoke nhanh ≤ 2 phút end-to-end qua HTTP thuần (không cần browser). Dùng khi muốn verify API vẫn xanh sau deploy mà không phụ thuộc web build / Playwright.

### Chạy local

```bash
# 1. Lên infra
pnpm infra:up
pnpm --filter @xuantoi/api prisma migrate deploy
pnpm --filter @xuantoi/api bootstrap   # seed 3 sect + admin

# 2. Start API (terminal riêng)
pnpm --filter @xuantoi/api dev

# 3. Chạy smoke ở terminal khác
pnpm smoke:beta
```

Exit 0 = all green. Exit 1 = có step fail kèm stderr diagnostic (status code + response body + step name).

### Env overrides

| Env | Default | Công dụng |
|---|---|---|
| `SMOKE_API_BASE` | `http://localhost:3000` | API root (không có `/api` trailing). Dùng khi smoke staging. |
| `SMOKE_TIMEOUT_MS` | `10000` | Timeout per-request (ms). |
| `SMOKE_VERBOSE` | `0` | Set `1` để log request/response body (debug). |
| `SMOKE_SECT_KEY` | `thanh_van` | Sect khi onboard (`thanh_van` / `huyen_thuy` / `tu_la`). |
| `SMOKE_BUY_ITEM` | `huyet_chi_dan` | Item shop để buy (phải trong NPC_SHOP + currency LINH_THACH). |

### Các step

1. `GET /api/healthz` — API up.
2. `POST /api/_auth/register` — tạo user random.
3. `GET /api/_auth/session` — verify login.
4. `POST /api/character/onboard` — tạo character.
5. `GET /api/character/me` — lấy starting linhThach.
6. `POST /api/character/cultivate {cultivating:true}` — start tick.
7. `POST /api/character/cultivate {cultivating:false}` — stop tick (tránh leak).
8. `GET /api/daily-login/me` + `POST /api/daily-login/claim` — skip nếu ALREADY_CLAIMED.
9. `GET /api/missions/me` + `POST /api/missions/claim` — skip nếu không có mission complete.
10. `GET /api/shop/npc` — list catalog.
11. `GET /api/inventory` (before buy).
12. `POST /api/shop/buy` — skip nếu không đủ tiền.
13. `GET /api/inventory` (after buy).
14. `GET /api/mail/me` + `POST /:id/read` + `POST /:id/claim` — skip nếu không có mail.
15. `GET /api/leaderboard/power` — verify entries là array.
16. `POST /api/_auth/logout` — cleanup.

### Không có dependency mới

Script là file ESM `.mjs` (`scripts/smoke-beta.mjs`) dùng native `fetch` + `AbortController` Node 20+. Không install `tsx` / `ts-node` / axios.

### Giới hạn

- Không verify WS `cultivate:tick` push (smoke HTTP-only). Dùng Playwright `E2E_FULL=1` để cover WS (session 9k task B).
- Không verify admin flow (ban/grant/revoke). Dùng Playwright + admin account seed để cover.
- Không test concurrency / race condition. Chỉ happy-path sequential.
- Không cleanup user đã tạo — khi smoke nhiều lần, DB accumulate `smoke-*@smoke.invalid` user. Dùng SQL `DELETE FROM "User" WHERE email LIKE 'smoke-%@smoke.invalid'` để cleanup (xem `docs/ADMIN_GUIDE.md` cẩn thận foreign-key).

## 10. `pnpm smoke:economy` CLI (session 9q-5)

**Mục đích**: smoke runtime ≤ 5 phút verify các invariant kinh tế trong [`docs/ECONOMY_MODEL.md`](./ECONOMY_MODEL.md) §3 còn nguyên trước khi mở rộng Phase 10 content scale (items/skills/missions/boss pack). Phòng regression khi reward/shop/mail code mới bypass `CurrencyService` hoặc grant double.

Khác `smoke:beta`: focus vào **ledger consistency** + **idempotency** + **anti double-spend** thay vì coverage flow gameplay rộng. Khác `pnpm --filter @xuantoi/api audit:ledger`: smoke **perform mutations** (register → onboard → claim → buy) rồi verify ledger row được ghi đúng — audit:ledger chỉ read-only sau-fact.

### Khi nào chạy

- **BẮT BUỘC** trước khi mở Phase 10 content PR (PR-1..5: items/skills/monsters/missions/boss pack). Paste 20-step output `pass / fail` vào PR body.
- **KHUYẾN NGHỊ** sau merge bất kỳ PR đụng tới `apps/api/src/modules/character/currency.service.ts`, `apps/api/src/modules/inventory/inventory.service.ts`, `apps/api/src/modules/shop/shop.service.ts`, `apps/api/src/modules/daily-login/daily-login.service.ts`, `apps/api/src/modules/mail/mail.service.ts`, `apps/api/src/modules/giftcode/giftcode.service.ts` — bất kỳ code path mutate `linhThach` / `tienNgoc` / `InventoryItem.qty`.
- **BẮT BUỘC** ngay trước release tag closed beta v0.x (cùng `smoke:beta` + Playwright golden path).

### Chạy local

```bash
# 1. Lên infra (Postgres + Redis)
pnpm infra:up
pnpm --filter @xuantoi/api prisma migrate deploy
pnpm --filter @xuantoi/api bootstrap          # seed 3 sect

# 2. Start API ở terminal riêng (cần env từ apps/api/.env)
pnpm --filter @xuantoi/api dev                # listen :3000

# 3. Terminal khác — chạy smoke
pnpm smoke:economy
```

**Pass criteria**: exit code `0`, dòng cuối `done: 20 pass / 0 fail / 20 total`.
**Fail criteria**: exit code `1`, có ít nhất 1 step `FAIL` với invariant message dạng `INVARIANT vi phạm: SUM(...) ≠ Character.linhThach`. Khi fail, **DỪNG mở Phase 10 PR** và mở 1 PR riêng fix root cause trước.

### Env overrides

| Env | Default | Công dụng |
|---|---|---|
| `SMOKE_API_BASE` | `http://localhost:3000` | API root. |
| `SMOKE_TIMEOUT_MS` | `10000` | Timeout per-request (ms). |
| `SMOKE_VERBOSE` | `0` | Set `1` để log request/response (debug). |
| `SMOKE_SECT_KEY` | `thanh_van` | Sect onboard (`thanh_van` / `huyen_thuy` / `tu_la`). |
| `SMOKE_BUY_ITEM` | `huyet_chi_dan` | Item shop để buy. Phải trong `NPC_SHOP` + currency `LINH_THACH`. Có fallback tự chọn item LINH_THACH rẻ nhất nếu key custom không có. |

### 20 step

1. `GET /api/healthz`.
2. `POST /api/_auth/register` — random email `smoke-econ-*@smoke.invalid`.
3. `POST /api/character/onboard`.
4. `GET /api/character/me` — snapshot starting linhThach (= 0 theo schema default).
5. `GET /api/logs/me?type=currency` — verify `SUM(delta) == startingLinhThach` (empty hoặc khớp nếu future thêm welcome bonus).
6. `GET /api/logs/me?type=item` — verify shape array.
7. `GET /api/daily-login/me` — verify `nextRewardLinhThach > 0`.
8. `POST /api/daily-login/claim` — first call: `claimed=true` ⇒ `linhThachDelta > 0`, hoặc `claimed=false` (đã claim hôm nay).
9. `GET /api/character/me` — verify `linhThach` tăng đúng `dailyClaimDelta` (hoặc unchanged nếu idempotent path).
10. `GET /api/logs/me?type=currency` — verify `SUM(CurrencyLedger) == Character.linhThach`; nếu `claimed=true` thì có ≥ 1 row `reason=DAILY_LOGIN`, `currency=LINH_THACH`, `delta == DAILY_LOGIN_LINH_THACH`.
11. `POST /api/daily-login/claim` lần 2 — verify `claimed=false`, balance unchanged, ZERO ledger row mới.
12. `GET /api/shop/npc` — tìm `BUY_ITEM` LINH_THACH (fallback: rẻ nhất user mua nổi).
13. `POST /api/shop/buy` 1 item — verify response shape (`itemKey`, `qty`, `totalPrice`, `currency=LINH_THACH`).
14. `GET /api/character/me` — verify `linhThach` giảm đúng `totalPrice`.
15. `GET /api/logs/me?type=currency` — verify ≥ 1 row `reason=SHOP_BUY`, `delta = -totalPrice`, `refType='NPC_SHOP'`, `refId=itemKey`.
16. `GET /api/logs/me?type=item` — verify ≥ 1 row `reason=SHOP_BUY`, `qtyDelta = +qty`, `refType='NPC_SHOP'`.
17. `GET /api/inventory` — verify `Inventory.qty == SUM(ItemLedger.qtyDelta)` per `(character, itemKey)`. Verify `Inventory.qty >= 0` cho mọi item.
18. `POST /api/shop/buy` qty=99 (= 2475 LT) khi balance ~75 LT — verify status ≠ 200, balance unchanged, ZERO CurrencyLedger / ItemLedger row mới (atomic rollback).
19. `GET /api/character/me` + `GET /api/logs/me?type=currency` — final verify `SUM(CurrencyLedger) == Character.linhThach`, `linhThach >= 0`.
20. `POST /api/_auth/logout`.

### CI gating

Smoke `pnpm smoke:economy` **KHÔNG vào CI flow** vì cần API + DB + Redis live cùng process. CI hiện chạy:
- `unit` job: typecheck/lint/vitest/build trên Postgres+Redis service nhưng KHÔNG `pnpm dev`.
- `e2e-smoke` job: Playwright trên build artifact `vite preview`, KHÔNG có API.

Mở rộng CI để chạy `smoke:economy` cần job mới — start API trong background trước Playwright (giống local). **Deferred** vì chi phí maintenance > giá trị (smoke đã verify chỗ ledger consistency mà unit tests đã cover invariants tương đương trong `currency.service.test.ts` + `shop.service.test.ts` + `daily-login.service.test.ts`). Smoke chính xác là để **integration check** trước release / Phase boundary, không phải replace unit tests.

### Deferred sub-checks

- **Mail double-claim**: cần admin grant mail trước → smoke phải login admin (cần secret `INITIAL_ADMIN_PASSWORD`). Defer cho session sau khi smoke admin được thiết kế. Hiện tại unit test `mail.service.test.ts` đã cover `Mail.claimedAt IS NULL` invariant.
- **Giftcode double-redeem**: cần admin tạo gift code trước. Cùng lý do defer như mail. Unit test `giftcode-race.test.ts` đã cover unique `(giftCodeId, userId)` constraint dưới concurrency.
- **Mission claim double-claim**: cần wait cultivate tick → mission complete (15-30s ngẫu nhiên). Defer vì smoke phải tăng timeout đáng kể. `mission.service.test.ts` đã cover `MissionProgress.claimed` flag idempotency.
- **Cross-character anomaly**: smoke chỉ tạo 1 user → không scan toàn DB. Dùng `pnpm --filter @xuantoi/api audit:ledger` (read-only, scan all) cho check cross-user định kỳ.

### Không có dependency mới

Script là `scripts/smoke-economy.mjs` (~470 dòng ESM), dùng native `fetch` + `AbortController` Node 20+. KHÔNG install thêm `tsx`/`ts-node`/`axios`/`@prisma/client` cho runtime smoke. Chỉ verify qua HTTP `/api/character/me`, `/api/logs/me`, `/api/inventory`, `/api/shop/*`, `/api/daily-login/*` (đã có từ PR #88 cho `/logs/me` self-audit).

### Giới hạn

- Không cleanup user — như `smoke:beta`. Cleanup: `DELETE FROM "User" WHERE email LIKE 'smoke-econ-%@smoke.invalid'` (cẩn thận FK → `Character`, `CurrencyLedger`, `ItemLedger`, `DailyLoginClaim`, ...).
- Không cover currency `TIEN_NGOC` (premium). Topup flow cần admin approve → ngoài scope smoke ẩn danh.
- Không cover `CONG_HIEN` / `CHIEN_CONG_TONG_MON` (sect war), `NGUYEN_THACH` (refine). Phase 9 closed beta chưa expose endpoint trực tiếp.

## 11. `pnpm smoke:ws` CLI (session 9q-6)

**Mục đích**: smoke runtime ≤ 30s verify các invariant realtime của `RealtimeGateway` (`apps/api/src/modules/realtime/realtime.gateway.ts`) còn nguyên trước khi mở rộng Phase 10 content scale (đặc biệt skill / mission / boss / dungeon mới đều push qua WS). Phòng regression khi:

- Logic auth cookie `xt_access` thay đổi → user A nhận frame `state:update` của user B (privacy regression).
- Refactor `RealtimeService.emitToUser/broadcast/emitToRoom` → frame duplicate hoặc miss.
- Change `MISSION_PROGRESS_PUSH_THROTTLE_MS` (default 500ms, [`packages/shared/src/ws-events.ts`](../packages/shared/src/ws-events.ts)) → spam mission track flood WS.
- `cultivation.processor.ts` đổi shape payload `cultivate:tick` → FE crash khi parse.
- Reconnect path bug → user reconnect bằng cookie cũ vẫn dính userId map của session trước → broadcast leak.

Khác `smoke:economy`: focus vào **realtime safety + WS auth + push throttle** thay vì ledger consistency. Khác vitest `realtime.gateway.test.ts` (14 case unit): smoke chạy NestApp full + cookie auth thật (không stub JWT) + 2 user A/B isolated cookie jar + reconnect path qua socket.io-client thật.

### Khi nào chạy

- **BẮT BUỘC** trước khi merge bất kỳ PR đụng:
  - `apps/api/src/modules/realtime/realtime.gateway.ts` / `realtime.service.ts`.
  - `apps/api/src/modules/mission/mission-ws.emitter.ts` (throttle).
  - `apps/api/src/modules/chat/chat.service.ts` (broadcast WORLD / room SECT).
  - `apps/api/src/modules/cultivation/cultivation.processor.ts` (BullMQ tick + emit).
  - `apps/api/src/modules/character/character.service.ts` (`emitToUser('state:update', …)` từ onboard/cultivate/breakthrough).
  - `packages/shared/src/ws-events.ts` (`WsEventType` / `WsFrame` / `MISSION_PROGRESS_PUSH_THROTTLE_MS` / `CULTIVATION_TICK_MS`).
- **KHUYẾN NGHỊ** trước khi mở Phase 10 content PR (PR-1..5: items/skills/monsters/missions/boss pack) — content mới track mission progress nhiều hơn → throttle phải còn nguyên.
- **BẮT BUỘC** ngay trước release tag closed beta v0.x (cùng `smoke:beta` + `smoke:economy` + Playwright golden path).

### Chạy local

```bash
# 1. Lên infra (Postgres + Redis cho BullMQ tick scheduler)
pnpm infra:up
pnpm --filter @xuantoi/api prisma migrate deploy

# 2. Start API ở terminal riêng (cần env từ apps/api/.env)
pnpm --filter @xuantoi/api dev                # listen :3000, WS path /ws

# 3. Terminal khác — chạy smoke (default: SKIP cultivate:tick — nhanh ~5s)
pnpm smoke:ws

# 4. (Optional) Bật cultivate:tick check (cộng ~30-40s đợi BullMQ tick):
SMOKE_WAIT_TICK_MS=40000 pnpm smoke:ws
```

**Pass criteria**: exit code `0`, dòng cuối `done: 19 pass / 0 fail / 19 total in <ms>`.

**Fail criteria**: exit code `1`, có ít nhất 1 step `FAIL` với invariant message dạng `INVARIANT vi phạm: emitToUser leak qua user khác — B nhận N state:update của A`. Khi fail, **DỪNG mở Phase 10 PR** và mở 1 PR riêng fix root cause trước.

### Env overrides

| Env | Default | Công dụng |
|---|---|---|
| `SMOKE_API_BASE` | `http://localhost:3000` | API root. WS origin = `scheme://host:port` (path `/ws` cố định). |
| `SMOKE_TIMEOUT_MS` | `10000` | Timeout per HTTP request (ms). |
| `SMOKE_WS_TIMEOUT_MS` | `4000` | Timeout WS connect / wait frame (ms). |
| `SMOKE_THROTTLE_MS` | `500` | Phải khớp `MISSION_PROGRESS_PUSH_THROTTLE_MS` trong [`packages/shared/src/ws-events.ts`](../packages/shared/src/ws-events.ts). Khi shared bump throttle, override đây. |
| `SMOKE_WAIT_TICK_MS` | `0` | `0` = SKIP cultivate:tick step (default, smoke nhanh). Đặt `≥ 35000` để chờ BullMQ tick (`CULTIVATION_TICK_MS=30000` + buffer). |
| `SMOKE_VERBOSE` | `0` | Set `1` để log HTTP request/response + WS frame inbound (debug). |
| `SMOKE_SECT_KEY` | `thanh_van` | Sect onboard cho 2 user. |

### 19 step (default — `SMOKE_WAIT_TICK_MS=0`)

1. `GET /api/healthz`.
2. Setup user A — `POST /api/_auth/register` (random email `smoke-ws-A-*@smoke.invalid`) → `POST /api/character/onboard` → `GET /api/character/me`.
3. Setup user B — same flow, cookie jar độc lập.
4. WS auth: thiếu cookie → server `client.emit('error') + disconnect(true)` → `sock.connected === false` sau 1.5s.
5. WS connect A với cookie `xt_access` → `sock.connected === true`, `sock.id` non-empty.
6. WS connect B với cookie `xt_access` → connect OK.
7. `ping` → `pong` ack callback roundtrip — verify shape `WsFrame { type:'pong', payload:{}, ts:number }`.
8. **state:update isolation** — `POST /api/character/cultivate {cultivating:true}` (user A) → A nhận `state:update` (`payload.id == characterId(A)`, `cultivating === true`); đợi 150ms — B **KHÔNG** nhận frame nào (verify `emitToUser` không leak).
9. **chat:msg broadcast** — `POST /api/chat/world` (user A) → cả A và B nhận đúng 1 frame `chat:msg` với `payload.id` cùng row, `payload.text` khớp, `payload.senderId == characterId(A)`, `payload.channel === 'WORLD'`.
10. **chat:msg no duplicate** — 1 send → đúng 1 frame trong cửa sổ 600ms (capture array).
11. **mission:progress throttle** — spam 5 `POST /api/chat/world` trong cửa sổ < 500ms (mỗi send tracks `CHAT_MESSAGE` mission → `MissionWsEmitter.tryEmit`) → ≤ 1 frame `mission:progress`. Nếu env quá chậm (5 send ≥ 500ms) → step skip với note.
12. **mission:progress next window** — wait > 500ms+200ms → 1 send → ≤ 1 frame (window reset).
13. **reconnect A (disconnect + reconnect)** — `disconnect()` → `newSock(jarA)` → connect OK + `sock.id` mới khác cũ.
14. **reconnect A — state:update vẫn deliver** — `POST /api/character/cultivate {cultivating:false}` → A nhận `state:update` với `cultivating === false` (userId map intact sau reconnect).
15. **reconnect A — chat:msg broadcast vẫn deliver** — user B gửi → A nhận đúng 1 frame, không duplicate frame leak từ session cũ.
16. **cultivate:tick (gated)** — chỉ chạy khi `SMOKE_WAIT_TICK_MS > 0`. Bật cultivating=true → đợi BullMQ tick processor emit `cultivate:tick` (cron `CULTIVATION_TICK_MS=30s`) → assert payload shape `{ characterId, expGained:string-numeric, exp, expNext, realmKey, realmStage:number, brokeThrough:boolean }`. Cleanup: tắt cultivating sau khi nhận.
17. **logout A** — `POST /api/_auth/logout` → cookie jar A mất `xt_access`.
18. **after logout — WS reconnect fail** — `newSock(jarA)` → server disconnect (`sock.connected === false` sau 1.5s).
19. Cleanup: logout B + clean disconnect cả 2 socket.

### CI gating

`pnpm smoke:ws` KHÔNG vào CI flow vì cần API + DB + Redis (BullMQ scheduler) live cùng process. CI hiện chạy unit + Playwright build-artifact, KHÔNG chạy `pnpm dev`. Script là **manual/gated**.

Khi PR đụng các file thuộc danh sách "BẮT BUỘC" ở §11 trên, reviewer **phải** request:
- Output `pnpm smoke:ws` (default — 19/19 PASS) trong PR body.
- Khi PR đụng `cultivation.processor.ts` hoặc shared `CultivateTickPayload` → output thêm `SMOKE_WAIT_TICK_MS=40000 pnpm smoke:ws` (cultivate:tick PASS).

### Deferred sub-checks (không có trong smoke này)

- **Multi-tab same user**: 1 user mở 2 tab → 1 trigger emit phải deliver cả 2 socket. `realtime.gateway.test.ts` cover gián tiếp qua `userSockets: Map<string, Set<string>>` set logic. Defer vì cần spawn 2 socket cùng cookie jar — phức tạp với socket.io-client `forceNew`.
- **Sect room broadcast**: smoke chỉ test WORLD broadcast. SECT room test cần seed sect + auto-join logic — gateway test đã cover (`sock.join('sect:<id>')` + `emitToRoom`).
- **JWT expired path**: cần expired JWT thật (TTL 0). `realtime.gateway.test.ts` đã cover. Skip trong smoke runtime để giữ < 30s.
- **Race condition rapid reconnect**: disconnect → reconnect 5x trong 1s. Không phải invariant gameplay critical. Defer.

### Không có dependency mới

Script là `scripts/smoke-ws.mjs` (~700 dòng ESM), dùng native `fetch` + `AbortController` Node 20+ + `socket.io-client` load qua `createRequire(apps/api/package.json)` từ workspace dep đã có (`@xuantoi/api` devDep + `@xuantoi/web` dep). KHÔNG install thêm dep ở root.

### Giới hạn

- Không cleanup user — như `smoke:beta` / `smoke:economy`. Cleanup: `DELETE FROM "User" WHERE email LIKE 'smoke-ws-%@smoke.invalid'` (cẩn thận FK).
- Không cover `state:update` từ breakthrough (cần exp ≥ cost realm 9 — không thực tế trong < 30s smoke).
- Không cover `chat:msg` SECT room (cần seed sect + assign character, defer).
- Không cover BullMQ failure path (tick processor crash) — cần test framework integration sâu hơn, defer.
- Rate limit `/api/_auth/register` = 5/IP/15 phút. Smoke tạo 2 user → có thể chạy 2 lần liên tiếp, lần 3 sẽ 429. Khi cần test nhiều, flush key Redis: `docker exec xuantoi-redis redis-cli --scan --pattern 'rl:register*' | xargs -r docker exec -i xuantoi-redis redis-cli DEL`.

---

## 12. Playwright Golden Path E2E (`pnpm --filter @xuantoi/web e2e`, session 9q-7 → 9q-8)

### Mục tiêu

Verify **closed beta core loop end-to-end UI flow** ([`BETA_CHECKLIST.md`](./BETA_CHECKLIST.md) §QA + Launch — register → onboarding → cultivate → daily login → mission → market/shop browse → chat → leaderboard → profile → logout → shop **buy** → inventory **equip** → mail → dungeon list → settings) trong môi trường full stack thật. Bắt regression UI/route/store/i18n mà vitest component test cô lập + smoke server-side không phát hiện được. Cụ thể:

- Vue Router push/replace + route guard (chưa onboard → `/onboarding`, đã onboard → `/home`).
- Pinia store hydration sau navigation (character store, shop store, mission store).
- i18n button text mismatch (FE binding sai key → user click không thấy gì).
- WS push `chat:msg` deliver vào UI feed end-to-end (không chỉ server emit như `smoke:ws`).
- Onboarding 4-step state machine không bị stuck ở step nào.
- AppShell logout button → `POST /_auth/logout` → cookie clear → redirect `/auth`.

Khác `smoke:beta`/`smoke:economy`/`smoke:ws`: focus vào **UI rendering + user interaction path**, không chỉ HTTP/WS contract.

### Khi nào chạy

- **BẮT BUỘC** trước khi merge bất kỳ PR đụng:
  - `apps/web/src/views/AuthView.vue` / `OnboardingView.vue` / `HomeView.vue` / `MissionView.vue` / `ShopView.vue` / `InventoryView.vue` / `LeaderboardView.vue` / `ProfileView.vue` / `MailView.vue` / `DungeonView.vue` / `SettingsView.vue`.
  - `apps/web/src/components/shell/AppShell.vue` / `ChatPanel.vue`.
  - `apps/web/src/router/*` (route guard logic, redirect rules).
  - `apps/web/src/stores/character.ts` / `auth.ts` (hydration + ws push consumption).
  - `apps/web/src/i18n/vi.json` (key naming → button text mismatch).
  - `apps/api/src/modules/auth/*` (register/login/logout flow, cookie set/clear).
  - `apps/api/src/modules/character/*` (onboard endpoint contract).
- **KHUYẾN NGHỊ** trước release tag closed beta v0.x (cùng `smoke:beta` + `smoke:economy` + `smoke:ws`).

### Chạy local

```bash
# 1. Lên infra (Postgres + Redis cho BullMQ + auth rate limiter)
pnpm infra:up
pnpm --filter @xuantoi/api prisma migrate deploy

# 2. Start API ở terminal riêng (cần env từ apps/api/.env)
pnpm --filter @xuantoi/api dev                # listen :3000

# 3. Start Web dev ở terminal khác
pnpm --filter @xuantoi/web dev                # listen :5173, proxy /api → :3000

# 4. Terminal khác — chạy E2E full
PLAYWRIGHT_BASE_URL=http://localhost:5173 \
PLAYWRIGHT_SKIP_WEBSERVER=1 \
E2E_FULL=1 \
pnpm --filter @xuantoi/web e2e --reporter=list
```

**Pass criteria**: exit code `0`, dòng cuối `<N> passed (<time>s)` với N = 16 (suite full sau 9q-8) hoặc N = 1 (smoke-only, không set `E2E_FULL=1`).

**Fail criteria**: exit code `1`, có ít nhất 1 spec `failed`. Khi fail, **DỪNG mở Phase 10 PR** và mở 1 PR riêng fix root cause trước. Trace + screenshot lưu ở `apps/web/test-results/`.

### Env overrides

| Env | Default | Công dụng |
|---|---|---|
| `PLAYWRIGHT_BASE_URL` | `http://localhost:4173` | URL Web dev/preview server. Dùng `:5173` cho `pnpm dev`, `:4173` cho `pnpm preview` (default Playwright config tự spawn `vite preview`). |
| `PLAYWRIGHT_SKIP_WEBSERVER` | `0` | `1` để Playwright KHÔNG spawn `vite preview` (khi đã có `pnpm dev` chạy sẵn). |
| `E2E_FULL` | unset | `1` để chạy full 16 spec (sau 9q-8, tăng từ 11). Không set → chỉ chạy 1 spec smoke `AuthView` (không cần backend). |
| `API_BASE_URL` | `http://localhost:3000` | API root cho `helpers.ts` seed user qua `page.request`. |
| `REDIS_URL` | `redis://localhost:6379` | Redis cho `flushAuthRateLimits()` xoá `rl:register:*` / `rl:login:*` / `rl:forgot-password:*` trước mỗi spec. |

### Spec breakdown (16 spec, tổng ~22–25s)

**Spec 1–11 (PR #210, session 9q-7)**:

1. **AuthView smoke** (no backend) — form input render + 3 tab button. Luôn chạy, không cần `E2E_FULL`.
2. **Register UI → 4-step onboarding → /home** — full UI flow (3.5s).
3. **Cultivate toggle ON/OFF** — UI label `Nhập Định` ↔ `Xuất Định` + cross-check `/api/character/me.cultivating` flip.
4. **Daily login claim** — claim button → text `Đạo hữu đã nhận quà hôm nay` + `linhThach > 0`.
5. **Mission view tabs** — `Hằng Ngày` / `Hằng Tuần` / `Thiên Kiếp` click không crash.
6. **Shop browse + insufficient-funds disable** — fresh char 0 LT → mọi nút `Mua` `toBeDisabled`.
7. **Inventory empty state** — text `Túi đồ trống`.
8. **Chat WORLD send** — fill input + click `Gửi` → message render trong feed (verify ws end-to-end qua UI).
9. **Leaderboard 3 tab** — `[data-testid="leaderboard-tab-power|topup|sect"]` click + URL persist.
10. **Profile public view ownId** — `/profile/{characterId}` render char name.
11. **Logout** — click `Xuất Quan` → redirect `/auth`.

**Spec 12–16 (this PR, session 9q-8)**:

12. **Shop buy LINH_THACH (UI)** — register + onboard + claim daily login (+100 LT) qua API → goto `/shop` → tìm card "Sơ Kiếm" 30 LT → click `Mua` → `linhThach -= 30` cross-check qua `/api/character/me` poll trong 6s + verify inventory có 1 Sơ Kiếm qua `/api/inventory`.
13. **Inventory equip UI** — setup buy `so_kiem` qua API helper → goto `/inventory` → click `Mang` (i18n `inventory.equip`) → `expect.poll` API `equippedSlot === 'WEAPON'` trong 6s + UI button `Tháo` (i18n `inventory.takeOff`) hiện ra cho slot đã equip.
14. **Mail empty state** — fresh char goto `/mail` → heading `Thiên Đạo Thư Các` (i18n `mail.title`) + empty `Hộp thư trống rỗng` (i18n `mail.empty`) visible.
15. **Dungeon list visible + entry enabled** — fresh char goto `/dungeon` → heading `Luyện Khí Đường` + 3 dungeon catalog (Sơn Cốc / Hắc Lâm / Yêu Thú Động) + Sơn Cốc enter button `Khai ải` (i18n `dungeon.enter`) enabled (fresh stamina 100 ≥ Sơn Cốc staminaEntry 10) + cross-check API `character.stamina ≥ 10`. **KHÔNG enter combat** (random damage RNG + multi-monster turn-based → flaky, defer thành `smoke:combat` riêng).
16. **Settings page load** — goto `/settings` → heading `Tâm Pháp Đường` (i18n `settings.title`) + email seed render đúng + 3 input password (change-password section) visible.

### Flow chưa cover (defer)

- **Cultivation breakthrough end-to-end** — cần exp ≥ realm cost, không thực tế trong < 30s suite. Defer thành `smoke:cultivation` riêng.
- **Cultivation tick (BullMQ 30s)** — đã cover ngoài Playwright bằng `pnpm smoke:ws` với `SMOKE_WAIT_TICK_MS=40000` ($§11 file này).
- **Dungeon enter+clear+loot end-to-end** — random RNG damage + multi-monster turn-based → flaky. Defer thành `smoke:combat` riêng.
- **Mail claim attachment** — cần admin send mail. Defer cùng `smoke:admin`.
- **Inventory use HP pill** — fresh char hp full → no observable change. Defer.
- **Giftcode redeem** — cần admin create giftcode. Defer cùng `smoke:admin`.
- **Multi-tab same user real-time sync** — cần spawn 2 BrowserContext, phức tạp. Defer.
- **Topup IAP simulator** — cần env IAP sandbox. Defer ngoài beta scope.

### Rate limiter caveat

`apps/api/src/modules/auth/auth.service.ts` hardcode `REGISTER_RATE_LIMIT_MAX=5/IP/15min`. Suite chạy tạo 11 user mới cùng IP localhost → **bắt buộc flush Redis key trước mỗi spec**, helper tự lo qua `flushAuthRateLimits()` ở `globalSetup` + `test.beforeEach`. Nếu Redis unreachable, helper chỉ `console.warn` và return → suite vẫn chạy nhưng có thể fail 429 sau spec thứ 5. Manual flush:

```bash
docker exec xuantoi-redis redis-cli --scan --pattern 'rl:register:*' \
  | xargs -r docker exec -i xuantoi-redis redis-cli DEL
```

### CI gating

Playwright golden path chạy trong CI qua workflow gated `.github/workflows/e2e-full.yml` — KHÔNG required mọi PR (giữ CI nhanh), nhưng tự động trigger khi PR đụng FE / BE / shared / lockfile. Workflow chính `ci.yml` vẫn giữ nguyên: `build` job (typecheck/lint/test/build, có Postgres + Redis service) + `e2e-smoke` job (build artifact `vite preview` + 1 spec `AuthView` smoke, KHÔNG cần backend) — đó là CI bắt buộc. Workflow `e2e-full.yml` là **layer thứ 2** chạy 16 spec full-stack với Postgres + Redis + API + Web dev cùng chạy.

**Trigger workflow `e2e-full.yml`** (xem `.github/workflows/e2e-full.yml`):

| Trigger | Khi nào |
|---|---|
| `workflow_dispatch` | Bất kỳ ai có quyền Actions có thể chạy manual từ tab Actions → "e2e-full" → "Run workflow" (chọn branch). Dùng để smoke trước khi merge một PR docs-only / unrelated path. |
| `pull_request` (path-filtered) | PR đụng `apps/web/**`, `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `package.json`, hoặc chính `.github/workflows/e2e-full.yml`. |
| `push` to `main` (path-filtered) | Khi PR merge vào main hoặc ai đó push thẳng (KHÔNG khuyến khích). Cùng path filter với `pull_request`. |

**Concurrency**: `cancel-in-progress` theo `${{ github.workflow }}-${{ github.ref }}` — push commit mới lên cùng PR sẽ huỷ run cũ, tiết kiệm CI minutes.

**Workflow steps** (~5–8 phút cold cache, ~3–5 phút khi đã cache Playwright browsers):

1. Checkout + setup pnpm + Node 20.
2. `pnpm install --frozen-lockfile=false`.
3. `pnpm --filter @xuantoi/api prisma:generate` + `pnpm --filter @xuantoi/api exec prisma migrate deploy` (no seed/bootstrap cần — sect tự upsert qua `character/onboard`, shop catalog từ `packages/shared`).
4. `pnpm --filter @xuantoi/shared build` + `pnpm --filter @xuantoi/api build`.
5. Cache + install Playwright Chromium (cache key dựa `apps/web/package.json` + `pnpm-lock.yaml` hash).
6. Start API (`node apps/api/dist/src/main.js` background) → wait `/api/healthz` 60s + `/api/readyz` 30s.
7. Start Web (`pnpm --filter @xuantoi/web dev` background, vite dev :5173 proxy `/api` + `/ws` → :3000) → wait `:5173` 60s.
8. Run `PLAYWRIGHT_BASE_URL=http://localhost:5173 PLAYWRIGHT_SKIP_WEBSERVER=1 E2E_FULL=1 E2E_API_BASE=http://localhost:3000 pnpm --filter @xuantoi/web exec playwright test --project=chromium --reporter=list`.
9. On failure: upload `apps/web/test-results/` + `apps/web/playwright-report/` + `.ci-logs/api.log` + `.ci-logs/web.log` thành artifact `playwright-full-{run_id}-{run_attempt}` retention 7d.

**Env workflow**:

- `DATABASE_URL=postgresql://mtt:mtt@localhost:5432/mtt?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` = ephemeral CI placeholder (`ci-e2e-*-not-for-prod-*`, KHÔNG trùng `change-me-*` / `dev-*-secret` blacklist).
- `NODE_ENV=development` → CORS dev fallback cho phép `http://localhost:5173`, helmet CSP off (vite dev cần inline script).
- `MAIL_TRANSPORT=console` (forgot-password test chưa cover, không cần SMTP).
- `MISSION_RESET_TZ=Asia/Ho_Chi_Minh`, `SESSION_COOKIE_DOMAIN=localhost`, `WEB_PUBLIC_URL=http://localhost:5173`.

**Pass criteria CI**: workflow `e2e-full.yml` → green; `Run Playwright golden path (E2E_FULL=1)` step exit 0, dòng cuối `16 passed (<time>s)`.

**Fail criteria CI**: 1+ spec fail → workflow đỏ. Reviewer download artifact `playwright-full-{run_id}-{run_attempt}` để xem trace + screenshot + server log. KHÔNG được skip spec hoặc tắt workflow để PR xanh giả; root-cause + fix trước.

**Khi PR đụng `apps/web/**` / `apps/api/**` / `packages/shared/**`**: reviewer phải verify workflow `e2e-full` xanh trong PR Status Checks. Nếu workflow KHÔNG run (PR docs-only), chạy manual qua `workflow_dispatch` nếu cần xác nhận.

**Verified status (post #212 merge, session 9r-2)**: workflow đã chạy thật trên main HEAD `6fd1120` (run `25203605650`) — 1m35s tổng (Playwright step 20s với browsers cache hit), 16/16 spec pass, GREEN. PR #212 ban đầu run cold-cache ~5–8 phút; sau khi cache Playwright browsers stick (key dựa `apps/web/package.json` + `pnpm-lock.yaml`), warm runs ổn định ~1m30s–2m. Cancel-in-progress concurrency hoạt động đúng (push lên cùng PR huỷ run cũ).

**Roadmap (post-PR này)**:
- Sau 2–3 tuần stable, đánh giá có nên upgrade `e2e-full` thành required check trong branch protection rules.
- Nếu tiếp tục stable, xem xét add 1 spec `forgot-password` (cần SMTP Mailhog service container).

### Deferred sub-checks (không có trong spec hiện tại)

- **Cultivation breakthrough end-to-end**: cần exp ≥ cost realm — không thực tế trong < 30s suite. Defer cho `smoke:cultivation` riêng.
- **Combat dungeon**: cần seed monster + skill — defer cho Phase 10 content content QA.
- **Sect join/leave**: cần seed sect ≥ 2 + member quota — defer.
- **Boss fight**: cần seed boss + party — defer.
- **Mail receive + claim attachment**: cần admin send mail — defer cùng `smoke:admin`.
- **Giftcode redeem**: cần admin create giftcode — defer cùng `smoke:admin`.
- **Multi-tab same user real-time sync**: cần spawn 2 BrowserContext với cookie share — phức tạp, defer.
- **Topup IAP simulator**: cần env IAP sandbox — defer ngoài beta scope.

### Không có dependency mới

`apps/web/e2e/helpers.ts` (~200 lines) + `apps/web/e2e/global-setup.ts` (~30 lines) + `apps/web/e2e/golden.spec.ts` (rewrite) — Playwright + ioredis đã là devDep workspace. ioredis load qua `createRequire(apps/api/package.json)` từ `apps/api/node_modules`. KHÔNG install thêm dep ở root.

### Giới hạn

- Không cleanup user — như `smoke:beta` / `smoke:economy` / `smoke:ws`. Cleanup: `DELETE FROM "User" WHERE email LIKE 'e2e_%@local.test'` (cẩn thận FK cascade tới Character/Inventory/CurrencyLedger).
- 11 spec chạy `--workers=1` (default Playwright config khi `webServer` không spawn) để tránh DB write conflict — nếu cần parallel, thêm `--workers=N` với DB schema riêng cho mỗi worker.
- Timing assertion (`waitCharacter` polling 200ms × 30 = 6s) có thể flaky trên CI runner chậm — local Linux máy dev pass < 50ms mỗi poll.
