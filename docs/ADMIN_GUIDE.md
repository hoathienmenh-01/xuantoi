# Xuân Tôi — Admin Guide

Tài liệu cho admin/MOD vận hành Xuân Tôi runtime. Mọi thao tác admin đều ghi `AdminAuditLog` (xem `/admin/audit`).

## 1. Cách trở thành admin

| Tình huống | Cách làm |
|---|---|
| Cài đặt mới, chưa có admin nào | Set `INITIAL_ADMIN_EMAIL` + `INITIAL_ADMIN_PASSWORD` trong `apps/api/.env`, chạy `pnpm --filter @xuantoi/api bootstrap`. |
| Đã có 1 admin, muốn cấp cho người khác | Admin hiện tại vào `/admin` → Users → tìm email → nút "Set role: ADMIN". |
| Server chỉ có shell access (chưa có UI admin) | `pnpm --filter @xuantoi/api exec ts-node scripts/promote-admin.ts user@email.local`. |
| SQL trực tiếp (last resort) | `UPDATE "User" SET role = 'ADMIN' WHERE email = 'user@email.local';` |

> **Rule 9** (xem AGENTS / handoff): không bao giờ tự demote admin cuối cùng. FE hiện chưa chặn — cẩn thận khi thao tác.

## 2. Cấu trúc role

| Role | Quyền chính |
|---|---|
| `PLAYER` | User bình thường, chơi game. |
| `MOD` | Hiện đang được treat gần như ADMIN (xem H8 trong handoff — kế hoạch tách quyền sau). |
| `ADMIN` | Toàn quyền — user, topup, gift code, mail, stats, audit. |

Cờ `banned: true` block đăng nhập + revoke refresh token. Đặt qua `/admin/users/:id/ban`.

## 3. Tab admin & việc thường dùng

| Tab UI | Endpoint chính | Dùng khi |
|---|---|---|
| Overview | `GET /admin/stats` | Xem nhanh số user, character, topup approved, ledger total. |
| Users | `/admin/users*` | Tìm user, ban / unban, đổi role, grant currency. |
| Topups | `/admin/topups*` | Duyệt / từ chối đơn nạp. |
| Audit | `/admin/audit` | Xem mọi action admin gần đây. |
| GiftCodes | `/admin/giftcodes*` | Tạo / list / revoke gift code. |
| Mail | `/admin/mail/{send,broadcast}` | Gửi 1 character hoặc broadcast toàn server. |

Đầy đủ endpoint xem `docs/API.md`.

## 4. Quy trình duyệt nạp (topup)

1. Player tạo đơn `POST /topup` → status `PENDING`. Server sinh `transferCode`.
2. Player chuyển khoản với nội dung = `transferCode`.
3. Admin đối soát bank → vào `/admin` → Topups → duyệt:
   - **Approve**: `POST /admin/topups/:id/approve` body `{ note }` → `CurrencyService.applyTx` cộng `tienNgoc` + ghi `CurrencyLedger reason=TOPUP_APPROVED` + audit log. Atomic.
   - **Reject**: `POST /admin/topups/:id/reject` body `{ note }` → status `REJECTED`, không tạo ledger.
4. Đơn `APPROVED` không thể approve lại (idempotent guard).

> Audit log luôn ghi `actorUserId` (= admin) + meta `{ orderId, tienNgoc, note }`. Không có rollback tự động — nếu approve nhầm phải `grant -tienNgoc` thủ công.

## 5. Grant currency

Endpoint `POST /admin/users/:id/grant` body `{ linhThach?, tienNgoc?, reason }`.

- Cộng (delta dương) hoặc trừ (delta âm) qua `CurrencyService.applyTx` → ghi ledger.
- `reason` bắt buộc → search được trong `/admin/audit` + `CurrencyLedger`.
- **Cảnh báo**: chưa có hard cap. Admin có thể cộng 10^18 linhThach → ledger có thể overflow downstream nếu không cẩn thận. **Khuyến nghị** quy ước: 1 lần grant ≤ 10^9 linhThach hoặc 10^7 tienNgoc.

## 6. Gift code

| Trường | Ý nghĩa |
|---|---|
| `code` | Mã hiển thị (uppercase, 4–32 ký tự, unique). |
| `maxRedemptions` | Số lần redeem tối đa toàn server. `null` = không giới hạn. |
| `expiresAt` | Hết hạn tuyệt đối. |
| `rewards` | JSON `{ linhThach, tienNgoc, items: [{itemKey, qty}] }`. |
| `revoked` | `true` → không cho redeem mới. |

Tạo: `POST /admin/giftcodes`. Revoke: `POST /admin/giftcodes/:code/revoke`. Mỗi user chỉ redeem 1 lần / 1 code (`@@unique(giftCodeId, userId)`).

## 7. Mail

- `POST /admin/mail/send` `{ characterId, subject, body, rewards? }` — gửi 1 character.
- `POST /admin/mail/broadcast` `{ subject, body, rewards? }` — gửi tất cả character (heavy: insert N row, async qua queue khuyến nghị nhưng hiện sync).
- Player `POST /mail/:id/claim` để nhận reward (CAS chống double-claim).
- Cron prune mail đã claim > 90 ngày (`OpsService` recurring).

## 8. Boss

- Hiện chỉ có 1 boss active 1 lúc. Không có cron auto spawn → cần spawn thủ công khi muốn mở event (xem H/M2 trong handoff: endpoint admin spawn đang là backlog PR).
- Khi boss DEFEATED: distribute reward theo rank top 1 / top 2-3 / top 4-10 (xem `BossService.distributeRewards`). Không thể redo.

## 9. Audit log

`GET /admin/audit?page=N` — list desc theo `createdAt`, mỗi entry gồm `actorUserId`, `action`, `meta` (JSON). Index `(actorUserId, createdAt)` + `(action, createdAt)` để filter nhanh. Hiện chưa có UI search theo target/action — phải xem qua API.

## 10. Hành động nguy hiểm — checklist trước khi làm

- [ ] **Set role**: chắc chắn email đúng. Không tự demote bản thân nếu là admin duy nhất.
- [ ] **Grant tienNgoc**: chắc chắn delta hợp lý, có `reason` rõ.
- [ ] **Broadcast mail with reward**: 1 lần broadcast = N entry; không thể unsend → phải đọc kỹ subject/body.
- [ ] **Revoke gift code**: redemption đã thành công không bị huỷ — chỉ chặn redeem mới.
- [ ] **Ban**: có ghi audit; user đăng nhập sẽ bị reject + revoke refresh.
- [ ] **Approve topup**: đã đối soát bank? Hợp đồng số tiền và transferCode? Approve không thể rollback tự động.

## 11. Reset môi trường staging

- DB: `prisma migrate reset --force --skip-seed` rồi `pnpm --filter @xuantoi/api bootstrap` (xem `docs/RUN_LOCAL.md`).
- Redis: `redis-cli FLUSHDB` (chỉ với redis dev/staging, **không bao giờ** với production khi còn rate-limit live).
- MinIO: xoá bucket qua console.

## 12. Liên kết

- Vận hành / chạy local: `docs/RUN_LOCAL.md`.
- Deploy production: `docs/DEPLOY.md`.
- Bảo mật: `docs/SECURITY.md`.
- Lỗi thường gặp: `docs/TROUBLESHOOTING.md`.
- Catalog seed: `docs/SEEDING.md`, `docs/BALANCE.md`.
