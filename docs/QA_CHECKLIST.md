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
