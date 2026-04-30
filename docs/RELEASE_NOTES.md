# Release Notes — Xuân Tôi

> **Đối tượng đọc**: closed beta playtester, QA tester, công đồng.
>
> File này tập trung vào **giá trị người chơi nhận được**: tính năng mới, cải thiện trải nghiệm, vấn đề đã biết. Không liệt kê PR number, file path hay chi tiết kỹ thuật — phần đó nằm trong [`docs/CHANGELOG.md`](./CHANGELOG.md) (theo session) và [`docs/AI_HANDOFF_REPORT.md`](./AI_HANDOFF_REPORT.md) (đầy đủ chi tiết).
>
> Quy ước version: closed-beta-1 = build hiện tại trên `main` tại thời điểm closed beta đợt 1 mở. Sau khi mở rộng playtester, version sẽ tăng theo từng đợt patch.

---

## [closed-beta-1] — 30/4/2026

> **Trạng thái**: bản dựng đã sẵn sàng cho closed beta. Đã hoàn thành chuỗi tính năng tu luyện, nhiệm vụ, túi đồ, chợ, boss, quản lý admin, an toàn kinh tế. Đã verify lint/typecheck/test 207/207 trên FE và bộ test backend ~401 case.

### ⭐ Điểm nổi bật

- **Tu luyện theo cảnh giới**: 17 cảnh giới đầy đủ (Phàm Nhân → Hỗn Độn) với hệ số EXP/đột phá đã cân bằng. Tự tính EXP per second theo Linh Khí cảnh giới, hệ số tông môn, đan dược.
- **Đột phá thông minh**: hệ thống hiển thị badge "Sẵn sàng đột phá" + dot indicator sidebar khi nhân vật đủ điều kiện. Giảm thời gian quay lại UI để check thủ công.
- **Bảng xếp hạng đa chiều**: 3 tab — Sức Mạnh (battle power), Nạp Top (tổng tiên ngọc nạp APPROVED), Tông Môn (treasury linh thạch + level + tuổi). Lazy-fetch theo tab giảm tải server.
- **Đăng nhập hằng ngày**: nhận thưởng linh thạch / tiên ngọc / EXP mỗi ngày qua thẻ "Điểm danh hôm nay" trên trang chính. Bonus theo streak. Idempotent — claim 1 lần/ngày, không spam.
- **Quên / đặt lại mật khẩu**: tự đặt lại qua email link 30 phút mà không cần báo admin. Anti-spam rate-limit 3 yêu cầu/IP/15 phút. Email gửi qua SMTP thật (closed beta cấu hình Mailhog cho dev). Reset thành công logout-all mọi thiết bị tránh bị tấn công bằng token cũ.
- **An toàn kinh tế**: hệ thống cảnh báo bất thường tự động kiểm tra ledger linh thạch/tiên ngọc + stock kho/inventory mỗi vào trang admin. Admin có nút "Chạy audit" để chạy đối soát thủ công. Cảnh báo dot đỏ khi có đơn topup pending hoặc currency âm.
- **Mua bán chợ giữa người chơi**: list/buy/cancel/expire/disable theo địa chỉ ví linh thạch + tiên ngọc. Phí giao dịch cấu hình env `MARKET_FEE_PCT`. Skeleton loader khi đợi list dài.
- **Túi đồ**: equip / unequip / consume tự động cộng power, hiển thị 7 trạng thái item. Admin có thể thu hồi item (audit log đầy đủ).
- **Hệ thống nhiệm vụ**: nhận / claim / reset theo timezone Asia/Ho_Chi_Minh. Badge thông báo nhiệm vụ chưa nhận thưởng. WebSocket realtime update khi diễn biến thay đổi.
- **Boss thế giới**: open/close cycle, damage tracking, settle reward đa người. Notification badge khi boss đang mở.
- **Hộp thư trong game**: send mail kèm reward attachment. Badge unread count. Idempotent claim — nhận 1 lần.
- **Mã quà tặng (giftcode)**: admin tạo mã LT/TN/EXP/maxRedeems/expiresInDays + revoke. User redeem 1 lần/mã. Audit log đầy đủ.
- **Tông môn cơ bản**: tạo / join / leave / treasury linh thạch.

### 🛡️ An toàn & vận hành

- **Admin self-protection**: admin/mod không thể tự hạ vai trò mình hoặc tự ban mình. UI disable nút + badge "Bạn", BE lock-in.
- **Rate-limit auth nhạy cảm**: register, forgot-password, reset-password đều có per-IP rate-limit (Redis distributed prod, in-memory fallback dev).
- **Audit log admin đầy đủ**: mọi grant currency / revoke item / approve topup / approve giftcode / ban user đều ghi audit với actor + target + before/after + lý do. Filter theo actor/action/target/khoảng thời gian. Recent Activity widget hiển thị 5 thao tác gần nhất ngay trang Stats.
- **Pending topup badge**: tab Topups hiển thị số đơn nạp đang chờ duyệt → admin biết ngay có việc cần xử lý mà không phải vào từng tab kiểm tra. Re-fetch sau approve/reject để badge update ngay.
- **Mobile responsive**: drawer sidebar trên mobile, AdminView table scroll-x trên màn nhỏ.
- **Backup / restore database**: script `pnpm backup:db` + `pnpm restore:db` đã verify reliable trên Postgres 15+ (SIGPIPE-safe + pg_terminate_backend trước restore tránh lock).

### 🧭 Hỗ trợ người chơi mới

- **Onboarding checklist 6 bước**: tạo nhân vật → tu luyện lần đầu → nhận nhiệm vụ → kiểm tra túi đồ → ghé Bảng xếp hạng → kiểm tra Hộp thư. Local progress lưu localStorage không mất khi đóng tab. Empty state thông minh hướng dẫn bước tiếp theo.
- **Next Action panel**: gợi ý "Nên làm gì tiếp?" dựa trên trạng thái — sắp đột phá, có nhiệm vụ chờ thưởng, có thư chưa đọc, daily login chưa nhận, boss đang mở.
- **Tooltip cảnh giới + EXP progress**: hiển thị % tới đột phá tiếp theo trên Sidebar.
- **Toast thông báo nhất quán**: success / error / info / warning với icon + màu thống nhất, auto-dismiss 3.5s.

### 🌐 Đa ngôn ngữ

- **Tiếng Việt + English**: i18n parity guard tự kiểm tra mọi key tồn tại đủ ở cả 2 locale + cùng số lượng ICU placeholder. Tránh sót key gây UI vỡ.
- Copy tiếng Việt đậm chất tiên hiệp (ví dụ: "Quên huyền pháp?" thay "Quên mật khẩu?", "Linh Thạch / Tiên Ngọc" thay "Coin / Gem").

---

## ⚠️ Giới hạn closed beta đợt 1

Closed beta đợt 1 **không** bao gồm:

- **Pet system**: không có pet/đồng hành. Sẽ làm sau closed beta.
- **Wife / Companion**: không có hệ thống đạo lữ. Sẽ làm sau.
- **Arena PvP**: không có đấu trường người chơi. Bảng xếp hạng Sức Mạnh chỉ là leaderboard read-only, chưa có đánh trực tiếp.
- **Battle Pass / Event mùa**: không có. Sẽ làm sau.
- **Payment thật**: closed beta dùng giả lập topup admin-approved. Không có cổng thanh toán thật. Người chơi tạo phiếu nạp với mã chuyển khoản → admin duyệt thủ công ghi nhận tiên ngọc.
- **Cross-server / Marketplace nâng cao**: không có. Chợ chỉ trong cùng server.
- **Gacha / Lootbox phức tạp**: không có. Hệ thống thưởng chỉ ở giftcode + boss + mission + daily login.

---

## 🐞 Vấn đề đã biết (closed beta đợt 1)

Mức độ Critical/High đã giải quyết hết. Còn lại Medium/Low đã document trong báo cáo kỹ thuật:

| Mã | Mức độ | Mô tả ngắn | Workaround |
|---|---|---|---|
| M7 | Medium | CSP cho CDN tài nguyên ảnh chỉ verify khi prod deploy | Tạm thời dev/closed-beta cho phép `img-src 'self' data:`. |
| M10 | Medium | Shop daily limit chưa có (post-beta nice-to-have) | Tạm thời shop unlimited. Sẽ thêm `dailyLimit` per item key sau closed beta. |

**Đã giải quyết** (update session 9k, 30/4/2026):

- **M9** Logout-all intentional behavior — đã document đầy đủ trong [`docs/SECURITY.md §1`](./SECURITY.md) (logout-all revoke refresh tokens nhưng không bump `passwordVersion`; access tokens 15-phút TTL còn lại tự hết hạn). Có regression test integration guard trong `apps/api/src/modules/auth/auth.service.test.ts` để lock behavior.

Không có vấn đề Critical/High còn mở.

---

## 📨 Cách báo lỗi & feedback

- **Discord cộng đồng**: TBD (sẽ cập nhật sau closed beta đợt 1).
- **Email QA**: TBD (sẽ cập nhật sau closed beta đợt 1).
- **In-game**: dùng tab Settings → "Báo lỗi" (TBD — sẽ thêm form gửi log + screenshot trong đợt patch closed-beta-2).
- **GitHub Issues** (đối với playtester có quyền): https://github.com/hoathienmenh-01/xuantoi/issues — gắn label `closed-beta-1`.

Khi báo lỗi, hãy kèm:

1. Bản dựng (xem footer: closed-beta-1 + commit hash).
2. Tài khoản test (email/handle, **KHÔNG** kèm mật khẩu).
3. Bước tái hiện chi tiết.
4. Screenshot/recording nếu UI.
5. Console log nếu lỗi JS (mở DevTools tab Console).

---

## 🔮 Lộ trình closed-beta-2 (dự kiến)

**Đã hoàn thành trong session 9k** (30/4/2026):

- ✓ Smart admin user export CSV — đã có trong AdminView (PR cũ + render-level tests PR #150).
- ✓ `pnpm smoke:beta` script — `scripts/smoke-beta.mjs` zero-dep ESM 16-step HTTP smoke (PR #152).
- ✓ `docs/PRIVACY.md` + `docs/TOS.md` closed-beta tester agreement (PR #151).
- ✓ Playwright golden E2E_FULL expand — shop buy / mail read / profile view (PR #153).
- ✓ AdminView render-level smoke — 18 vitest role guard + tab badge + export CSV + giftcode revoke (PR #150).

**Còn lại cho closed-beta-2**:

- **Achievement nhỏ** với idempotent claim.
- **Smart admin bulk actions** (multi-select ban / multi-select grant currency).
- **Smart UX polish toast duration** (info=3000ms, success=3500ms, warning=5000ms, error=6000ms).
- **Test coverage expand**: GameHomeView + AppShell skeleton tests.
- **In-game báo lỗi form**: tab Settings → form gửi log + screenshot.
- **Shop daily limit per item** (M10).

Mọi thay đổi trên `main` đã merge sẽ được liệt kê trong [`docs/CHANGELOG.md`](./CHANGELOG.md) theo session.
