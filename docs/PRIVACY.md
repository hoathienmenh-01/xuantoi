# Xuân Tôi — Chính sách Quyền riêng tư (Closed Beta)

> **Phạm vi**: tài liệu này mô tả dữ liệu người dùng được thu thập, lưu trữ và xử lý trong **giai đoạn closed beta** (≤ 50 tester, không nhận thanh toán thật). Khi game ra mắt chính thức, chính sách này sẽ được rà soát lại và có thể đổi.
>
> **Đối tượng**: tester closed beta được mời, vận hành team (admin/dev), kiểm toán handoff.
>
> **Nguồn sự thật**: code hiện tại trên `main` + `apps/api/prisma/schema.prisma` + `docs/SECURITY.md`. Nếu có xung đột giữa tài liệu này và code, **code là nguồn sự thật**; cập nhật tài liệu trong cùng PR.

---

## 1. Dữ liệu thu thập

Closed beta chỉ thu thập dữ liệu tối thiểu để vận hành game. **Không có** analytics bên thứ 3, **không có** tracking pixel, **không có** SDK quảng cáo.

| Loại dữ liệu | Cột/Bảng chính (Prisma) | Mục đích |
|---|---|---|
| Tài khoản | `User.email`, `User.passwordHash` (argon2id), `User.passwordVersion`, `User.banned`, `User.role` | Đăng nhập / phân quyền / ban |
| Nhân vật | `Character.name`, `Character.realmStage`, `Character.linhThach`, `Character.tienNgoc`, `Character.power` | Gameplay |
| Phiên đăng nhập | `RefreshToken.hashedToken` (argon2), `RefreshToken.ip`, `RefreshToken.userAgent`, `RefreshToken.revokedAt` | Rotation refresh token + reuse-detection |
| Log đăng nhập thất bại | `LoginAttempt.ip`, `LoginAttempt.email`, `LoginAttempt.attemptedAt` | Rate-limit login 5 / 15 phút |
| Chat | `ChatMessage.text`, `ChatMessage.scope` (WORLD/SECT/PRIVATE), `ChatMessage.createdAt` | Tin nhắn hiển thị trong game |
| Ledger tiền | `CurrencyLedger.userId`, `CurrencyLedger.delta`, `CurrencyLedger.reason`, `CurrencyLedger.meta` | Audit dòng tiền (chống double-credit) |
| Ledger vật phẩm | `ItemLedger.userId`, `ItemLedger.itemCode`, `ItemLedger.qtyDelta`, `ItemLedger.reason` | Audit dòng item |
| Lịch sử topup | `Topup.userId`, `Topup.status`, `Topup.amount`, `Topup.note`, `Topup.createdAt`, `Topup.approvedAt` | Admin duyệt topup tiên ngọc (closed beta **không có** thanh toán thật) |
| Mail / Giftcode / Mission | `Mail`, `GiftCode`, `GiftCodeRedemption`, `MissionProgress`, `DailyLoginReward` | Gameplay + chống double-claim |
| Audit admin | `AuditLog.actorId`, `AuditLog.action`, `AuditLog.targetUserId`, `AuditLog.meta`, `AuditLog.createdAt` | Ghi mọi hành động admin (ban, grant, revoke, approve topup…) |

**Không thu thập**:
- Số điện thoại / CMND / địa chỉ nhà.
- Vị trí GPS / địa chỉ IP cho mục đích profiling (IP chỉ lưu trong `RefreshToken` và `LoginAttempt` cho mục đích bảo mật phiên).
- Tên thật / giới tính / tuổi / nghề nghiệp.
- Thông tin thanh toán thật (closed beta **không** có cổng thanh toán thật — xem `docs/SECURITY.md` §2).

---

## 2. Thời hạn lưu trữ (Retention)

| Loại | Thời hạn | Cơ chế |
|---|---|---|
| Chat (`ChatMessage`) | 30 ngày | Cron prune (nếu triển khai) hoặc thủ công. **Chưa** có job tự động prune → backlog `docs/AI_HANDOFF_REPORT.md` §Known Issues. |
| `LoginAttempt` | 30 ngày (rate-limit window = 15 phút, phần còn lại giữ để audit) | Prune thủ công. |
| `RefreshToken` | 30 ngày (TTL JWT refresh) + 30 ngày sau `revokedAt` để audit reuse | Prune thủ công. |
| Mail đã hết hạn (`Mail.expiresAt`) | Xoá soft qua `MailModule.pruneExpired` cron (xem `apps/api/src/modules/mail`) | Tự động. |
| `CurrencyLedger` / `ItemLedger` / `AuditLog` | **Giữ vĩnh viễn trong suốt closed beta** — ledger là nguồn sự thật về dòng tiền/item. Sau beta có thể archive. | Không xoá tự động. |
| `Character` / `User` | Giữ đến khi tài khoản bị xoá (xem §4). | — |
| `Topup` | Giữ vĩnh viễn trong suốt closed beta (audit admin). | Không xoá tự động. |
| Seed data (shop, boss, realm, mission catalog) trong `packages/shared` | Không phải dữ liệu người dùng; giữ theo git history. | — |

**Lưu ý**: Trong closed beta, team vận hành có thể **drop toàn bộ DB** giữa các milestone (ví dụ: reset từ Phase 8 lên Phase 9) — tester đã được thông báo trước khi đăng ký tham gia. Xem `docs/TOS.md` §4.

---

## 3. Cookie / Session

| Cookie | TTL | Mục đích | Flags |
|---|---|---|---|
| `xt_access` | 15 phút | JWT access token | `httpOnly`, `SameSite=Lax`, `Secure` (production) |
| `xt_refresh` | 30 ngày | JWT refresh token (rotation) | `httpOnly`, `SameSite=Lax`, `Secure` (production) |

Không có cookie analytics / advertising / 3rd-party. Chi tiết: `docs/SECURITY.md` §8.

---

## 4. Quyền của tester

### 4.1. Xem dữ liệu của mình
- Đăng nhập + vào `/profile/:id` — hiện public profile.
- Đăng nhập + vào `/mail`, `/missions`, `/giftcode`, `/leaderboard/power` — dữ liệu cá nhân.
- Muốn lấy **toàn bộ dump JSON** của account mình → gửi email cho vận hành team (địa chỉ trong `docs/TOS.md` §Liên hệ). Vận hành team sẽ export từ Postgres trong ≤ 7 ngày (SLA best-effort closed beta).

### 4.2. Yêu cầu xoá dữ liệu ("Delete my data")
Closed beta flow (chưa có UI self-serve):
1. Tester gửi yêu cầu qua email (địa chỉ trong `docs/TOS.md` §Liên hệ) hoặc báo trong kênh Discord / Zalo closed beta.
2. Admin chạy script SQL:
   ```sql
   -- Anonymize account (giữ ledger để không phá invariant)
   UPDATE "User" SET email = 'deleted-' || id || '@example.invalid',
                     "passwordHash" = '',
                     banned = true
    WHERE id = :userId;
   UPDATE "Character" SET name = 'Đã xóa' WHERE "userId" = :userId;
   DELETE FROM "ChatMessage" WHERE "userId" = :userId;
   DELETE FROM "RefreshToken" WHERE "userId" = :userId;
   ```
3. Ledger (`CurrencyLedger`, `ItemLedger`, `AuditLog`, `Topup`) **không xóa** — giữ để bảo toàn invariant sổ cái. User đã anonymize, tên hiển thị = "Đã xóa".
4. Admin xác nhận hoàn tất qua email ≤ 7 ngày.

> Lý do không `DELETE FROM User`: xoá cứng sẽ làm break foreign key ở ledger tables (`CurrencyLedger.userId → User.id`). Anonymize là cách an toàn trong closed beta. Sau beta sẽ bổ sung flow xoá cứng kèm archive ledger.

### 4.3. Sửa dữ liệu
- Đổi mật khẩu: `/settings` → `Đổi mật khẩu`. Sẽ kill toàn bộ phiên (xem `docs/SECURITY.md` §1).
- Đổi email: **chưa có** UI. Gửi email cho vận hành team.
- Đổi tên nhân vật: **chưa có** (closed beta). Nếu có lỗi (trùng tên / từ nhạy cảm) → admin đổi thủ công.

---

## 5. Bảo mật

Chi tiết kiểm soát an ninh: `docs/SECURITY.md`. Tóm tắt:
- Password hash argon2id (`memoryCost = 64 MiB, timeCost = 3`).
- JWT secrets production bắt buộc ≥ 32 ký tự, không phải placeholder.
- Refresh rotation + reuse-detection (copy token → revoke cả chain).
- `passwordVersion` check — đổi mật khẩu kill mọi phiên.
- Rate-limit login 5 / 15 phút / (IP + email).
- Helmet + CSP production strict (`default-src 'self'`, `script-src 'self'`).
- CORS production bắt buộc whitelist domain.
- Ledger audit cho mọi mutation tiền / item.
- Admin action audit log (`AuditLog`).

Chưa có: SSL pinning client, hardware MFA, end-to-end encryption chat (closed beta scope).

---

## 6. Bên thứ 3

Closed beta **không gửi dữ liệu user cho bên thứ 3 nào** ngoài hạ tầng vận hành:
- **Postgres** (self-host hoặc managed Postgres do vận hành team chọn) — lưu tất cả data.
- **Redis** (self-host hoặc managed Redis) — cache session, rate-limit, BullMQ queue.
- **Hosting** (tuỳ vận hành team chọn: VPS / Fly.io / Railway / self-host). Nhà cung cấp hạ tầng có truy cập kỹ thuật vào server — bắt buộc phải có NDA với vận hành team trước khi grant production access.

**Không có**:
- Google Analytics / Meta Pixel / Mixpanel / Amplitude / PostHog / Sentry (session replay tắt).
- SDK quảng cáo.
- Chatbot AI bên thứ 3 gắn vào game client.
- Captcha của bên thứ 3 (hiện dùng rate-limit thay vì captcha).

Nếu trong tương lai cần thêm provider (ví dụ Sentry error tracking), tài liệu này sẽ được cập nhật **trước khi** tích hợp.

---

## 7. Cập nhật chính sách

- Mọi thay đổi chính sách này **phải** qua PR vào `main` + cập nhật `docs/AI_HANDOFF_REPORT.md` §Recent Changes.
- Thay đổi lớn (thu thập dữ liệu mới, đổi retention, thêm bên thứ 3) → vận hành team gửi email tới toàn bộ tester trước khi áp dụng.
- Tester có quyền rời beta nếu không đồng ý với thay đổi (xem §4.2 yêu cầu xoá dữ liệu).

---

## 8. Liên hệ

Xem `docs/TOS.md` §Liên hệ. Vận hành team closed beta trả lời trong ≤ 7 ngày (SLA best-effort, không ràng buộc pháp lý trong giai đoạn beta).

---

*Phiên bản tài liệu: closed beta v1. Cập nhật gần nhất: xem `git log docs/PRIVACY.md`.*
