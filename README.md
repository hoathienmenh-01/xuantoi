# Xuân Tôi (xuantoi)

> Game tu tiên MUD phong cách **cổ phong thủy mặc**, web app + PWA. Clone tham khảo Mộng Tu Tiên — đã đổi tên, logo, asset để hợp pháp lý.

## Kiến trúc

Monorepo `pnpm` với 3 package chính:

```
xuantoi/
├── apps/
│   ├── web/        # Vue 3 + Vite + TS + Pinia + Tailwind (PWA)
│   └── api/        # NestJS + Prisma + PostgreSQL + Redis + BullMQ
├── packages/
│   └── shared/     # Type chia sẻ FE/BE (zod schema, REALMS const, ws-events)
├── infra/
│   └── docker-compose.dev.yml
└── .github/workflows/ci.yml
```

## Yêu cầu

- Node.js **>= 20**
- pnpm **>= 9**
- Docker + Docker Compose (cho dev infra: postgres, redis, minio, mailhog)

## Khởi động dev

```bash
# 1. Cài deps
pnpm install

# 2. Bật infra (postgres / redis / minio / mailhog)
pnpm infra:up

# 3. Copy env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Sinh Prisma client + migrate
pnpm --filter @xuantoi/api prisma:generate
pnpm --filter @xuantoi/api exec prisma migrate dev

# 5. Build shared 1 lần (apps/api & apps/web đều consume từ dist/)
pnpm --filter @xuantoi/shared build

# 6. Chạy song song shared (watch) + api + web
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000
- MailHog UI: http://localhost:8025
- MinIO console: http://localhost:9001 (admin / admin12345)

## Test thủ công vòng lặp MVP

Sau khi `pnpm dev` lên ổn:

1. Mở http://localhost:5173 → tạo tài khoản (Đăng Ký).
2. Reload trang → vẫn còn phiên (router guard gọi `/api/_auth/session`, fallback `/_auth/refresh`).
3. Khai mở đạo đồ (3–20 ký tự) → dashboard hiện thông số.
4. Bấm **Bắt Đầu Tu Luyện** → đợi 15–30 giây → EXP tăng (hiển thị có pendingExp do server tính).
5. Reload → EXP vẫn đúng.
6. Bấm **Dừng Tu Luyện** → EXP được lưu vĩnh viễn.
7. Khi đủ EXP → bấm **Đột Phá** → cảnh giới tăng + log "thành công".
8. Thiếu EXP mà bấm Đột Phá → toast "tu vi không đủ" + log "thất bại".
9. **Xuất Quan** (logout) → quay về `/auth`.
10. Đăng nhập lại → dữ liệu nhân vật + log còn nguyên.
11. Sai mật khẩu **5 lần / 15 phút / cùng IP+email** → bị khóa `RATE_LIMITED`.

## API MVP

Tất cả response đều envelope: `{ ok: true, data }` hoặc `{ ok: false, error: { code, message } }`.

| Method & Path                    | Mục đích                                                           |
| -------------------------------- | ------------------------------------------------------------------ |
| POST `/api/_auth/register`       | Đăng ký + set cookie `xt_access` + `xt_refresh`                    |
| POST `/api/_auth/login`          | Đăng nhập (rate-limit 5/15p/IP+email)                              |
| POST `/api/_auth/logout`         | Thu hồi refresh-token, xoá cookie                                  |
| POST `/api/_auth/refresh`        | Xoay cặp token (revoke cũ, cấp mới)                                |
| GET  `/api/_auth/session`        | Lấy `PublicUser` theo access cookie                                |
| POST `/api/_auth/change-password`| Đổi mật khẩu + revoke toàn bộ session cũ                           |
| POST `/api/character/create`     | Tạo nhân vật (1/user, tên 3-20 ký tự, unique)                      |
| GET  `/api/character/me`         | Lấy nhân vật + tu vi hiện tại (có pendingExp khi đang tu luyện)    |
| POST `/api/cultivation/start`    | Bắt đầu tu luyện                                                   |
| POST `/api/cultivation/stop`     | Dừng tu luyện, flush EXP                                           |
| POST `/api/cultivation/tick`     | Snapshot EXP (giữ trạng thái tu luyện)                             |
| POST `/api/cultivation/breakthrough` | Đột phá (kiểm tra EXP cost từ shared helper)                   |
| GET  `/api/logs/me`              | 50 log mới nhất của nhân vật                                       |

Hệ cảnh giới MVP — 10 đại × 9 trọng — định nghĩa ở `packages/shared/src/realms.ts`.
Công thức cost: `cost(realmOrder, stage) = round(100 × 1.45^(stage-1) × 2.2^(realmOrder-1))`.
Tốc độ tu luyện: `0.2 EXP/giây` ở Luyện Khí, +10% mỗi đại cảnh giới kế tiếp.

## Scripts

| Lệnh                | Tác dụng                                       |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Chạy `apps/web` + `apps/api` song song         |
| `pnpm build`        | Build tất cả package                           |
| `pnpm typecheck`    | Kiểm tra type toàn bộ workspace                |
| `pnpm lint`         | ESLint toàn bộ workspace                       |
| `pnpm test`         | Chạy unit test (Vitest cho web, Jest cho api)  |
| `pnpm infra:up`     | Bật postgres / redis / minio / mailhog (Docker)|
| `pnpm infra:down`   | Tắt infra                                      |

## Roadmap (tóm tắt)

- **Phase 0 — Khởi tạo** *(skeleton hiện tại)*: monorepo, infra, CI lint, type chia sẻ.
- **Phase 1 — Auth & PWA shell**: `/auth` 3 tab, argon2id + JWT, service worker, toast.
- **Phase 2 — Game shell + GameHome + State sync**: layout 3 cột, Pinia `game`, WS, cron tu luyện.
- **Phase 3 — Inventory + Map + Boss**.
- **Phase 4 — Mission, Alchemy, Refinery, Pet, Wife**.
- **Phase 5 — Arena + Chat + Mail**.
- **Phase 6 — Sự kiện + Topup + Subscription**.
- **Phase 7 — Admin + Anti-cheat + Tối ưu**.
- **Phase 8 — QA, balance, ra mắt**.

Xem chi tiết spec trong tài liệu `docs/04_TECH_STACK_VA_DATA_MODEL.md` và `docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md` (sẽ đẩy lên sau).

## License

Private — chưa công khai.
