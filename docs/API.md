# Xuân Tôi — API Inventory

Tóm tắt mọi endpoint REST + WebSocket event đang có ở `@xuantoi/api`. Mọi response bọc trong `{ ok: boolean, data?: T, error?: { code, message } }` trừ endpoint health/version.

## Auth cookie

- `xt_access` (JWT, 15 phút, httpOnly, SameSite=Lax)
- `xt_refresh` (JWT, 30 ngày, httpOnly, SameSite=Lax)

Đổi mật khẩu / logout → `passwordVersion`++ → access token cũ bị reject ở guard.

## Health & Metadata

| Method | Path       | Auth | Mô tả |
|--------|------------|------|-------|
| GET    | `/healthz` | —    | Liveness. 200 luôn nếu process chạy; trả `uptimeMs` + `ts`. |
| GET    | `/readyz`  | —    | Readiness. Check DB + Redis. 200 ok, 503 khi fail. |
| GET    | `/version` | —    | `{ name, version, commit, node, ts }`. |

## Auth — `AuthController`

| Method | Path                      | Auth | Mô tả |
|--------|---------------------------|------|-------|
| POST   | `/auth/register`          | —    | Body `{ email, password }`. 201 set cookie. |
| POST   | `/auth/login`             | —    | Rate limit 5 fail / 15p / IP+email qua `LoginAttempt`. |
| POST   | `/auth/logout`            | Yes  | Revoke refresh row hiện tại + clear cookie. |
| POST   | `/auth/refresh`           | Yes (xt_refresh) | Rotation + reuse-detection. Sai → revoke cả chain. |
| GET    | `/auth/session`           | Yes  | Trả user + role. |
| POST   | `/auth/change-password`   | Yes  | `passwordVersion`++ → kill mọi phiên. |

## Character — `CharacterController`

| Method | Path                    | Auth | Mô tả |
|--------|-------------------------|------|-------|
| GET    | `/character/me`         | Yes  | Nhân vật của user hoặc `null`. |
| GET    | `/character/state`      | Yes  | Giống `me` + 404 NO_CHARACTER nếu chưa có. |
| POST   | `/character/onboard`    | Yes  | Body `{ name, sectKey }`. |
| POST   | `/character/cultivate`  | Yes  | Body `{ cultivating: boolean }`. Bật/tắt Nhập Định (tick qua cron BullMQ). |
| POST   | `/character/breakthrough` | Yes | Đột phá cảnh giới khi đủ EXP. |

## Cultivation — `CultivationController` (qua `CharacterController` + cron)

Tick EXP thực hiện bởi BullMQ processor `cultivation.processor.ts`. WS event `cultivate:tick` emit per-user khi tick xong.

## Combat PvE — `CombatController`

| Method | Path                  | Auth | Mô tả |
|--------|-----------------------|------|-------|
| POST   | `/combat/engage`      | Yes  | `{ dungeonKey }`. Tạo encounter. |
| POST   | `/combat/turn`        | Yes  | Tấn công 1 lượt; kết thúc → loot + linhThach via ledger. |
| GET    | `/combat/current`     | Yes  | Encounter đang chạy (nếu có). |

## Inventory — `InventoryController`

| Method | Path                     | Auth | Mô tả |
|--------|--------------------------|------|-------|
| GET    | `/inventory/me`          | Yes  | List item + equipped slot. |
| POST   | `/inventory/equip`       | Yes  | `{ itemId, slot }`. |
| POST   | `/inventory/unequip`     | Yes  | `{ slot }`. |
| POST   | `/inventory/use-pill`    | Yes  | Tiêu đan. |

## Market — `MarketController`

| Method | Path                      | Auth | Mô tả |
|--------|---------------------------|------|-------|
| GET    | `/market/listings`        | Yes  | Browse listings. |
| POST   | `/market/listings`        | Yes  | Đăng bán. |
| POST   | `/market/listings/:id/buy` | Yes | Mua — bilateral lock via ledger. |
| POST   | `/market/listings/:id/cancel` | Yes | Huỷ (chỉ chủ listing). |

## Sect & Chat — `SectController`, `ChatController`

| Method | Path                      | Auth | Mô tả |
|--------|---------------------------|------|-------|
| POST   | `/sect/create`            | Yes  | Tạo tông môn. |
| POST   | `/sect/join`              | Yes  | Gia nhập. |
| POST   | `/sect/leave`             | Yes  | Rời. |
| POST   | `/sect/contribute`        | Yes  | Đóng linh thạch → treasury + cống hiến. |
| GET    | `/chat/world?limit=N`     | Yes  | Lịch sử world chat. |
| POST   | `/chat/send`              | Yes  | Gửi. Rate limit 8 msg / 30s / player (Redis). |

## Boss — `BossController`

| Method | Path                | Auth | Mô tả |
|--------|---------------------|------|-------|
| GET    | `/boss/current`     | Yes  | Boss đang active + top 10 damage. |
| POST   | `/boss/:id/attack`  | Yes  | Đánh boss; khi HP ≤ 0 → distribute reward theo rank. |

## Topup & Admin — `TopupController`, `AdminController`

| Method | Path                               | Auth  | Mô tả |
|--------|------------------------------------|-------|-------|
| POST   | `/topup`                           | Yes   | Tạo đơn `{ tienNgocAmount, proofMessage }`. |
| GET    | `/topup/mine`                      | Yes   | Lịch sử đơn của user. |
| GET    | `/admin/users?q=&page=`            | ADMIN | List user. |
| POST   | `/admin/users/:id/ban`             | ADMIN | `{ banned }`. |
| POST   | `/admin/users/:id/role`            | ADMIN | `{ role }`. |
| POST   | `/admin/users/:id/grant`           | ADMIN | `{ linhThach, tienNgoc, reason }` — qua CurrencyService. |
| GET    | `/admin/topups?page=&status=`      | ADMIN | List đơn topup. |
| POST   | `/admin/topups/:id/approve`        | ADMIN | `{ note }` → credit tienNgoc + ledger. |
| POST   | `/admin/topups/:id/reject`         | ADMIN | `{ note }`. |
| GET    | `/admin/audit?page=`               | ADMIN | Audit log. |

## Giftcode (PR E)

| Method | Path                                   | Auth  | Mô tả |
|--------|----------------------------------------|-------|-------|
| POST   | `/giftcodes/redeem`                    | Yes   | `{ code }` → trao reward, 1 user / 1 code. |
| GET    | `/admin/giftcodes?limit=`              | ADMIN | List codes + stats. |
| POST   | `/admin/giftcodes`                     | ADMIN | Tạo code. |
| POST   | `/admin/giftcodes/:code/revoke`        | ADMIN | Vô hiệu hoá. |

## Mission (PR B)

| Method | Path                          | Auth | Mô tả |
|--------|-------------------------------|------|-------|
| GET    | `/missions/me`                | Yes  | Progress daily/weekly/once của player. |
| POST   | `/missions/:id/claim`         | Yes  | Nhận thưởng khi target đã đạt. |

## Mail (PR D)

| Method | Path                    | Auth  | Mô tả |
|--------|-------------------------|-------|-------|
| GET    | `/mail/me`              | Yes   | Inbox (≤100 mail desc). |
| POST   | `/mail/:id/read`        | Yes   | Đánh dấu đã đọc. |
| POST   | `/mail/:id/claim`       | Yes   | Nhận thưởng; CAS chống double-claim. |
| POST   | `/admin/mail/send`      | ADMIN | Gửi cho 1 character. |
| POST   | `/admin/mail/broadcast` | ADMIN | Gửi toàn server. |

## WebSocket — `/ws` (RealtimeGateway)

Auth từ cookie `xt_access` (ưu tiên) hoặc `handshake.auth.token`.

| Event                | Direction      | Payload |
|----------------------|----------------|---------|
| `cultivate:tick`     | server → user  | `{ exp, realm, cultivating }` per tick. |
| `chat:msg`           | server → room  | `{ id, characterName, channel, body, createdAt }`. |
| `boss:update`        | server → all   | HP + top damager sau attack. |
| `market:listing:new` | server → all   | Listing mới. |
| `mail:new`           | server → user  | (kế hoạch) Khi admin gửi mail mới. |

## Error codes (chuẩn hoá)

- Auth: `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `RATE_LIMITED`, `PASSWORD_CHANGED`, `REUSED_REFRESH_TOKEN`, `BANNED`.
- Character: `NO_CHARACTER`, `NAME_TAKEN`, `NOT_ENOUGH_EXP`, `NOT_IN_CULTIVATION`.
- Combat: `IN_COMBAT`, `NO_ENCOUNTER`, `ENCOUNTER_NOT_ACTIVE`.
- Market: `ITEM_NOT_FOUND`, `NOT_OWNER`, `NOT_ENOUGH_FUNDS`, `LISTING_SOLD`.
- Sect: `ALREADY_IN_SECT`, `NOT_IN_SECT`, `NOT_ENOUGH_FUNDS`.
- Boss: `NO_ACTIVE_BOSS`, `BOSS_DEAD`, `COOLDOWN`.
- Topup/Admin: `TOO_MANY_PENDING`, `ALREADY_PROCESSED`, `FORBIDDEN`, `NOT_FOUND`.
- Giftcode: `CODE_NOT_FOUND`, `CODE_EXPIRED`, `CODE_REVOKED`, `CODE_EXHAUSTED`, `ALREADY_REDEEMED`, `NO_CHARACTER`, `INVALID_INPUT`.
- Mail: `MAIL_NOT_FOUND`, `MAIL_EXPIRED`, `MAIL_ALREADY_CLAIMED`, `MAIL_NO_REWARD`, `NO_CHARACTER`.
- Mission: `MISSION_NOT_FOUND`, `MISSION_ALREADY_CLAIMED`, `MISSION_NOT_READY`.

## Environment

Xem `.env.example`. Production khởi chạy sẽ assert `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` ≥ 32 ký tự; nếu thiếu sẽ refuse start.
