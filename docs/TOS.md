# Xuân Tôi — Điều khoản Dịch vụ (Closed Beta Tester Agreement)

> **Phạm vi**: tài liệu này là thỏa thuận giữa **tester closed beta** và **vận hành team Xuân Tôi** trong giai đoạn closed beta (≤ 50 tester). Khi game ra mắt chính thức, điều khoản này sẽ được rà soát và thay bằng TOS chính thức.
>
> **Không phải hợp đồng thương mại**: closed beta **không nhận thanh toán thật** (chi tiết §3). Tài liệu này chỉ có tính ràng buộc "best-effort" giữa tester và vận hành team, không thay thế luật áp dụng.

---

## 1. Định nghĩa

- **Game**: Xuân Tôi — MUD tu tiên PWA + realtime socket, mã nguồn tại `https://github.com/hoathienmenh-01/xuantoi`.
- **Tester**: người được vận hành team mời tham gia closed beta, có tài khoản active trong bảng `User` của environment closed beta.
- **Vận hành team**: các thành viên được gán `role = ADMIN` hoặc `role = MOD`, có quyền truy cập server closed beta + thực hiện action admin (xem `apps/api/src/modules/admin/`).
- **Environment closed beta**: cụ thể 1 instance Postgres + Redis + API server + web client, không public ngoài whitelist tester (bảo vệ qua email allowlist + rate-limit + auth).

---

## 2. Phạm vi closed beta

- Closed beta là **phiên bản thử nghiệm riêng tư** để kiểm tra gameplay, kinh tế, an ninh, UX trước khi open beta.
- Không đảm bảo uptime. Server có thể down không báo trước để sửa bug / deploy / migrate DB.
- **Wipe dữ liệu**: vận hành team có quyền reset toàn bộ DB giữa các milestone (ví dụ: chuyển từ Phase 8 lên Phase 9). Tester **được thông báo trước ≥ 48 giờ** qua kênh Discord / Zalo / email closed beta.
- Mỗi bug / crash / exploit tester gặp phải có thể được reset bằng cách xoá state nhân vật — không đảm bảo khôi phục dữ liệu cá nhân.

---

## 3. Kinh tế trong game — KHÔNG thanh toán thật

- **Linh Thạch** (tiền chính) và **Tiên Ngọc** (tiền cao cấp) **không có giá trị tiền thật**.
- **Không có cổng thanh toán thật** trong closed beta. Tiên Ngọc được phát qua admin topup thủ công (xem `apps/api/src/modules/topup/`, `AuditLog` ghi lại mọi lần approve).
- Tester **không được chuyển đổi** tiền trong game ra tiền thật ngoài game. Vận hành team **không chấp nhận** bất kỳ giao dịch tiền thật nào liên quan đến Linh Thạch / Tiên Ngọc / item / account trong closed beta.
- Nếu phát hiện tester mua/bán account, currency hoặc item bằng tiền thật → vận hành team có quyền **ban vĩnh viễn** account không bồi thường (xem §6).

---

## 4. Dữ liệu & reset

- Tester chấp nhận rằng dữ liệu (tài khoản, nhân vật, item, tiền trong game, mail, chat, ledger) **có thể bị wipe** giữa các milestone. Xem `docs/PRIVACY.md` §2 để biết retention cụ thể.
- Tester có quyền yêu cầu xoá dữ liệu bất cứ lúc nào theo quy trình `docs/PRIVACY.md` §4.2.
- Backup: vận hành team **cố gắng** backup DB daily (best-effort, không bảo đảm). Chi tiết backup/restore: `docs/BACKUP_RESTORE.md`.
- Không bảo đảm migrate dữ liệu từ closed beta sang open beta. Khi open beta launch, có thể phải tạo lại account.

---

## 5. Hành vi của tester

### 5.1. Được phép
- Chơi game theo design hiện tại.
- Report bug / crash / exploit / UX issue qua kênh Discord/Zalo/email closed beta.
- Đề xuất tính năng qua GitHub issue hoặc kênh closed beta.
- Chia sẻ screenshot / video gameplay cho mục đích cá nhân (không thương mại).

### 5.2. Không được phép
- **Harassment / toxic chat**: chửi tục, tấn công cá nhân, phân biệt chủng tộc / giới tính / tôn giáo trong chat thế giới / sect / PM. Vận hành team có quyền mute / ban không báo trước.
- **Cheat / exploit / bot**: dùng automation, macro, bot, script sửa client để cày tự động hoặc bypass rate-limit. Dùng DevTools để đọc game state cho việc vá lỗi là OK; dùng để gửi request mutation bypass guard là **không OK**.
- **Mua/bán account, currency, item bằng tiền thật** (RMT — Real Money Trading) — xem §3.
- **Reverse engineering** với mục đích phá hoại (phân phối server riêng, gây haiad cho production).
- **DDoS / spam / crawl** server closed beta ngoài pattern chơi bình thường.
- **Chia sẻ account** cho người khác. Một account = một người chơi. Tester phải bảo mật password của mình.
- **Khai thác bug**: nếu tester phát hiện bug làm tăng currency / item bất thường (ví dụ double-claim, negative balance, market exploit) → **bắt buộc** report cho vận hành team trong ≤ 24 giờ, không khai thác cho đến khi fix. Nếu cố tình farm bug → vận hành team có quyền revoke reward + ban account.

### 5.3. Nội dung user-generated
- Chat, tên nhân vật, tên sect, thông điệp mail tester tạo ra thuộc về tester.
- Nhưng tester cấp cho vận hành team quyền hiển thị các nội dung này trong game cho tester khác + lưu trữ theo retention ở `docs/PRIVACY.md`.
- Vận hành team có quyền xoá / edit / revoke bất kỳ nội dung vi phạm §5.2 mà không báo trước.

---

## 6. Account revocation

- Vận hành team có quyền **khóa (`banned = true`)** hoặc **xoá (anonymize)** account tester bất cứ lúc nào trong closed beta nếu:
  - Tester vi phạm §5.2.
  - Tester không hoạt động ≥ 60 ngày (closed beta ưu tiên tester active).
  - Closed beta kết thúc.
- Khi bị ban, tester vẫn có quyền yêu cầu export dữ liệu theo `docs/PRIVACY.md` §4.1 trong ≤ 30 ngày sau khi ban.
- Không có bồi thường (tiền trong game, item, thời gian chơi) khi account bị ban / xoá / wipe.

---

## 7. Bảo hành & trách nhiệm

### 7.1. Không bảo hành
Closed beta được cung cấp "**AS IS**", không có bảo hành tường minh hay ngụ ý về:
- Uptime / tính khả dụng.
- Độ chính xác dữ liệu.
- Tính an toàn trước mọi attack.
- Tương thích device (closed beta chỉ test trên desktop Chrome / Firefox / Safari current version + Android Chrome; không hỗ trợ iOS Safari cũ / desktop IE).
- Fit-for-purpose cho bất kỳ mục đích cụ thể nào của tester.

### 7.2. Giới hạn trách nhiệm
- Vận hành team **không chịu trách nhiệm** cho bất kỳ thiệt hại nào phát sinh từ việc sử dụng closed beta, bao gồm nhưng không giới hạn: mất thời gian chơi, mất dữ liệu, thiết bị bị chậm, stress khi thua boss, v.v.
- Trách nhiệm pháp lý tối đa của vận hành team với mỗi tester trong closed beta = **0 VND** (không nhận thanh toán thật).

### 7.3. SLA best-effort
- Trả lời bug report / yêu cầu xóa data: **≤ 7 ngày** (best-effort, không ràng buộc pháp lý).
- Khôi phục server khi down: best-effort (đội ngũ là hobby project, không 24/7 oncall).
- Thời gian sửa bug: tuỳ severity (Critical ≤ 48h, High ≤ 7 ngày, Medium/Low khi có thời gian).

---

## 8. Sở hữu trí tuệ

- Game Xuân Tôi (code, art, design, seed catalog) thuộc sở hữu của vận hành team + các contributor open-source theo license repo (xem `LICENSE` file nếu có, hoặc "All rights reserved" nếu chưa có LICENSE).
- Tên "Xuân Tôi", logo, design tu tiên 10-đại-cảnh-giới: thuộc vận hành team.
- Tester không có quyền phân phối lại code / asset ngoài phạm vi closed beta (trừ khi LICENSE cho phép).
- Tester giữ quyền với screenshot / video gameplay cá nhân (xem §5.1).

---

## 9. Luật áp dụng

- Closed beta này vận hành bởi cá nhân / nhóm hobby ở Việt Nam.
- Luật áp dụng: luật Việt Nam (nếu có xung đột).
- Tranh chấp (nếu có) giải quyết qua thỏa thuận trước khi đưa ra tòa. Trong closed beta, tester hiểu rằng đây là **dự án nghiệp dư**, không phải dịch vụ thương mại.

---

## 10. Chấm dứt closed beta

- Vận hành team có quyền **chấm dứt closed beta** bất cứ lúc nào với thông báo trước ≥ 7 ngày.
- Khi closed beta chấm dứt:
  - Dữ liệu có thể được wipe (xem §4).
  - Tester có quyền export dữ liệu cá nhân trong ≤ 30 ngày sau khi chấm dứt.
  - Không có bồi thường tiền/item/account.

---

## 11. Sửa đổi điều khoản

- Vận hành team có quyền sửa điều khoản này bằng cách cập nhật `docs/TOS.md` qua PR vào `main` + cập nhật `docs/AI_HANDOFF_REPORT.md` §Recent Changes.
- Thay đổi **lớn** (ví dụ: thêm thanh toán thật, thay đổi data retention trọng yếu) → thông báo trước ≥ 14 ngày qua kênh closed beta, tester có quyền rời beta nếu không đồng ý.
- Tiếp tục chơi sau khi điều khoản mới có hiệu lực = chấp nhận điều khoản mới.

---

## 12. Liên hệ

- **Bug report / data request / feedback**: kênh Discord / Zalo closed beta (link vận hành team gửi riêng cho từng tester khi mời tham gia).
- **Báo lỗi security nghiêm trọng** (ví dụ: lộ data, lỗ hổng auth): gửi riêng qua kênh private cho admin vận hành team (không public trên Discord/chat, để tránh exploit lan rộng trước khi fix).
- **GitHub issues**: `https://github.com/hoathienmenh-01/xuantoi/issues` — cho bug public / feature request.

---

## 13. Chấp thuận

Bằng cách tạo account và đăng nhập vào environment closed beta, tester xác nhận đã đọc + đồng ý với:
- `docs/TOS.md` (tài liệu này).
- `docs/PRIVACY.md` (chính sách quyền riêng tư closed beta).

Nếu không đồng ý → không tạo account / không đăng nhập, và gửi email cho vận hành team để được remove khỏi whitelist.

---

*Phiên bản tài liệu: closed beta v1. Cập nhật gần nhất: xem `git log docs/TOS.md`.*
