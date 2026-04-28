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

## 8. Sect + Boss (2 phút)

- [ ] `/sect` — hiển thị thông tin tông môn đã chọn + danh sách thành viên.
- [ ] Cống hiến linh thạch cho sect → balance trừ đúng, sect treasury tăng.
- [ ] `/boss` — nếu admin đã spawn boss: hiển thị HP bar, nút tấn công.
- [ ] Attack boss → damage vào boss + log xuất hiện ở bảng damage.

## 9. Topup + Giftcode (1 phút)

- [ ] `/topup` — list 3-4 package; click 1 package → hiển thị QR + transferCode.
- [ ] `/giftcode` — nhập 1 code admin vừa tạo → redeem thành công + toast; code repeated → báo `ALREADY_REDEEMED`.

## 10. Admin (1 phút, chỉ khi account là ADMIN)

- [ ] `/admin` load; 5 tab: Overview / Users / Topups / Giftcodes / Mail / Boss / Audit.
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
- [ ] Settings → "Logout tất cả thiết bị" → token hiện tại invalid, redirect `/auth`.

---

## Post-smoke checks

- [ ] Check `/_health/healthz` → `{ ok: true }`.
- [ ] Check `/_health/readyz` → `{ ok: true, db, redis, queue }` đều OK.
- [ ] Check `/_health/version` → commit SHA khớp deploy.
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

Phần lớn check ở section 1-10 có Playwright equivalent đã scaffolded ở `apps/web/e2e/golden.spec.ts`. Chạy `pnpm --filter @xuantoi/web test:e2e` để chạy subset. `E2E_FULL=1 pnpm test:e2e` chạy đầy đủ golden path (sau PR #47).
