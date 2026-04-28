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
pnpm --filter @xuantoi/api prisma:migrate

# 5. Bootstrap admin đầu tiên + 3 tông môn mặc định (idempotent)
#    Đặt INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD trong apps/api/.env trước.
pnpm --filter @xuantoi/api bootstrap

# 6. Chạy song song web + api
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000
- MailHog UI: http://localhost:8025
- MinIO console: http://localhost:9001 (admin / admin12345)

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

## Tài liệu developer

- [`docs/SEEDING.md`](./docs/SEEDING.md) — static catalog Item / Skill / Dungeon / Mission / Realm + cách thêm mới.
- [`docs/BALANCE.md`](./docs/BALANCE.md) — công thức EXP / damage / drop + bảng tra 28 cảnh giới.
- [`docs/BETA_CHECKLIST.md`](./docs/BETA_CHECKLIST.md) — roadmap & cut-line để chuẩn bị beta.

## License

Private — chưa công khai.
