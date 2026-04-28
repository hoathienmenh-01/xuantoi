# Beta Launch Checklist

Checklist để promote beta (closed 50 users → open). Tick khi xong.

## ✅ Đã hoàn thành

### Phase 0-1 — Hạ tầng + Auth
- [x] Monorepo pnpm workspace (`apps/api`, `apps/web`, `packages/shared`)
- [x] `@xuantoi/shared` dual ESM/CJS export (tsup)
- [x] Prisma migration baseline Phase 0-8
- [x] NestJS + Vite + Pinia + Vue 3 boot
- [x] Auth đầy đủ: register / login / logout / session / refresh / change-password
- [x] argon2id + JWT access 15m + refresh 30d httpOnly
- [x] Refresh token rotation + reuse-detection revoke all
- [x] Rate limit login 5/15m qua `LoginAttempt`
- [x] `passwordVersion` check ở JWT guard (đổi mật khẩu kill mọi phiên)
- [x] `helmet`, CORS env-based
- [x] Production assert JWT secrets
- [x] `AllExceptionsFilter` envelope `{ ok, data | error }`
- [x] `AuthErrorCode` chuẩn hoá

### Phase 2 — Nhập Định + WebSocket
- [x] BullMQ cron tu luyện (30s tick)
- [x] RealtimeGateway `/ws` cookie auth
- [x] Live `cultivate:tick` + `chat:msg` push (fix G1+G2)

### Phase 3-8 — Modules
- [x] Combat PvE (Luyện Khí Đường + 3 dungeon + 9 monster)
- [x] Inventory + Equipment (9 slots)
- [x] Market P2P Phường Thị (listing + buy)
- [x] Sect + Chat thế giới
- [x] World Boss + distribute rewards
- [x] Admin panel (grant/ban/set realm) + Topup tiên ngọc
- [x] `CurrencyService` + `CurrencyLedger` audit trail

### Testing
- [x] 17 shared + 77 api = 94 test. Real Postgres integration.
- [x] WS integration test (real socket.io-client)
- [x] CI postgres service xanh

### UX / i18n / PWA
- [x] vue-i18n VI + EN (13 view)
- [x] Locale switcher + persist localStorage
- [x] PWA manifest + PNG icons 192/512/maskable + apple-touch-icon
- [x] Workbox precache

### Content / Balance
- [x] 28 cảnh giới × 9 trọng (`packages/shared/src/realms.ts`)
- [x] `cultivationRateForRealm` scale 1.45^order — property test ≤24h/stage 1
- [x] 30 item cover 9 EquipSlot + pill + ore + artifact
- [x] 10 skill (3/sect + basic_attack)
- [x] 12 mission (5 daily + 4 weekly + 3 once)

### Docs
- [x] `docs/SEEDING.md` catalog + cách thêm mới
- [x] `docs/BALANCE.md` formula + bảng tra
- [x] `docs/BETA_CHECKLIST.md` (file này)

## 🔲 Chưa làm — roadmap beta

### Gameplay features
- [ ] **MissionProgress**: DB model + track hook + `POST /api/mission/claim`. Catalog đã có, chỉ thiếu gameplay.
- [ ] **Buff system**: item buff + sect buff + event rate (×N) nhân vào `cultivationRateForRealm`.
- [ ] **Equipment reforge / enchant**: upgrade bonuses trên item.
- [ ] **PvP cốc đấu**: Phase 9 (ngoài scope beta).
- [ ] **LogsModule**: player history (tu luyện, drop, topup) — G3 gap report.
- [ ] **Mail system**: admin gửi mail + reward (có model trong schema chưa wire FE).
- [ ] **Gift code**: admin tạo code, player redeem (có trong doc 05).

### Hardening + ops
- [ ] **LoginAttempt prune cron**: xoá record > 90 ngày (TTL).
- [ ] **RefreshToken cleanup cron**: purge expired/revoked > 30 ngày.
- [ ] **helmet CSP**: bật lại production với policy chặt (hiện `contentSecurityPolicy: false` để dev không vỡ).
- [ ] **Redis rate limit chat**: hiện chat không rate limit (spec yêu cầu 8 msg / 30s).
- [ ] **Sentry / error tracking**: wire DSN.
- [ ] **Structured logs** (pino/winston) + log shipping.
- [ ] **Metrics**: Prometheus endpoint / Grafana dashboard cho cultivation tick, combat, WS conn.
- [ ] **Backup DB daily** + test restore.
- [ ] **Health check endpoints** `/health`, `/ready`.

### Nội dung
- [ ] Balance 28 realm EXP/drop dựa feedback playtest thực.
- [ ] Thêm dungeon tier cao (hoa_than, luyen_hu, hop_the, đại_thừa, do_kiep).
- [ ] Skill cho realm >= nhan_tien (hiện skills chỉ sect-based, chưa realm-based).
- [ ] Full boss list (hiện chỉ có model, chưa có seed bosses theo tier).
- [ ] 60+ xưng hiệu mốc (doc 05 liệt kê `titles.json`).
- [ ] i18n EN gap: còn một số view có thể sót (cần grep full).

### QA
- [ ] Load test 1000 socket + 500 RPS (k6 / Artillery).
- [ ] Playwright E2E: register → onboarding → cày 30s → đột phá → inventory (doc 05).
- [ ] A Linh onboarding bilingual (có placeholder nhưng chưa text full).

### Launch
- [ ] Terms of Service + Privacy Policy.
- [ ] Discord / community channel.
- [ ] Closed beta 50 user recruitment.
- [ ] Feedback survey form.
- [ ] Bug bounty / log channel.

## Cut-line cho beta

**Bắt buộc trước beta**:
- MissionProgress gameplay (nếu không thì mission UI vô tác dụng)
- Mail system (admin cần công cụ thông báo sự cố)
- Gift code (marketing)
- LogsModule (player audit)
- Backup daily + restore test
- Rate limit chat Redis

**Có thể defer đến hậu beta**:
- PvP
- Reforge/enchant
- Realm-based skills
- Buff/debuff system mở rộng
- Metrics / Sentry (optional nếu self-hosted quy mô nhỏ)

---

_Last updated: 2026-04-28 bởi Devin session. Cập nhật file này mỗi khi đóng PR lớn._
