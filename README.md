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

Xem chi tiết spec **blueprint gốc** trong [`docs/04_TECH_STACK_VA_DATA_MODEL.md`](./docs/04_TECH_STACK_VA_DATA_MODEL.md) và [`docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md`](./docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md). Lưu ý: 2 file này là **historical blueprint, không phải nguồn sự thật hiện tại** — code trên `main` + [`docs/AI_HANDOFF_REPORT.md`](./docs/AI_HANDOFF_REPORT.md) mới là nguồn sự thật.

## Tài liệu developer

> 👉 **AI/dev mới: bắt đầu ở [`docs/START_HERE.md`](./docs/START_HERE.md)** — file này định tuyến tới đúng doc theo mục đích.

### Start Here for AI / Developers

- [`docs/START_HERE.md`](./docs/START_HERE.md) — **cổng vào docs**, đọc trước tiên. Decision table "muốn X → đọc Y" + reading order theo role + DO/DON'T.
- [`docs/AI_HANDOFF_REPORT.md`](./docs/AI_HANDOFF_REPORT.md) — snapshot trạng thái thật mỗi PR. Đầu file = mới nhất.

### Long-Term Game Design

- [`docs/GAME_DESIGN_BIBLE.md`](./docs/GAME_DESIGN_BIBLE.md) — vision, core loop (5p/D1/D7/D30/late), 13 gameplay system, dependency graph, product principles.
- [`docs/LONG_TERM_ROADMAP.md`](./docs/LONG_TERM_ROADMAP.md) — Phase 9 → Phase 17 với entry/exit criteria, module dependency rule, DO-NOT-BUILD-YET list.
- [`docs/ECONOMY_MODEL.md`](./docs/ECONOMY_MODEL.md) — currency invariants, source/sink map, ledger contract, anti-abuse playbook, recovery procedure.
- [`docs/CONTENT_PIPELINE.md`](./docs/CONTENT_PIPELINE.md) — process thêm content (item/skill/monster/dungeon/mission/boss/quest/event/title/achievement) + naming convention + balance gate.
- [`docs/BALANCE_MODEL.md`](./docs/BALANCE_MODEL.md) — curve (cultivation/EXP/power/drop/boss), dial registry, test pattern, historical decision log.
- [`docs/LIVE_OPS_MODEL.md`](./docs/LIVE_OPS_MODEL.md) — event scheduler, announcement, maintenance window, feature flag, config version, season cadence.

### Operational / Runtime

- [`docs/RUN_LOCAL.md`](./docs/RUN_LOCAL.md) — dựng môi trường dev đầy đủ (infra, migrate, bootstrap, dev server).
- [`docs/DEPLOY.md`](./docs/DEPLOY.md) — deploy api + web ra production (env, build, migrate, smoke checklist).
- [`docs/ADMIN_GUIDE.md`](./docs/ADMIN_GUIDE.md) — admin ops: duyệt topup, grant currency, gift code, mail, ban.
- [`docs/API.md`](./docs/API.md) — danh sách endpoint REST + WS event.
- [`docs/SEEDING.md`](./docs/SEEDING.md) — static catalog Item / Skill / Dungeon / Mission / Realm + cách thêm mới.
- [`docs/SECURITY.md`](./docs/SECURITY.md) — auth, secret, money invariant, threat model.
- [`docs/BACKUP_RESTORE.md`](./docs/BACKUP_RESTORE.md) — quy trình backup / restore DB.
- [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) — lỗi thường gặp khi dev/deploy.

### QA & History

- [`docs/BETA_CHECKLIST.md`](./docs/BETA_CHECKLIST.md) — roadmap & cut-line để chuẩn bị beta.
- [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md) — smoke checklist 15 phút trước mỗi release closed beta.
- [`docs/BALANCE.md`](./docs/BALANCE.md) — công thức EXP / damage / drop + bảng tra 28 cảnh giới (note cũ; xem `BALANCE_MODEL.md` cho long-term).
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — changelog tổng.
- [`docs/RELEASE_NOTES.md`](./docs/RELEASE_NOTES.md) — version note.
- [`docs/04_TECH_STACK_VA_DATA_MODEL.md`](./docs/04_TECH_STACK_VA_DATA_MODEL.md) — historical blueprint (phase 0..8) + §P9 long-term architecture proposal.
- [`docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md`](./docs/05_KICH_BAN_BUILD_VA_PROMPT_AI.md) — historical roadmap (phase 0..8) + §P9 pointer tới `LONG_TERM_ROADMAP.md`.

## License

Private — chưa công khai.
