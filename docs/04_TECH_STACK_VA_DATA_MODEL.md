# PHẦN 4 — STACK CÔNG NGHỆ, CẤU TRÚC THƯ MỤC, DATA MODEL, API

> ⚠️ **Historical blueprint, NOT the current source of truth.**
> Tài liệu này là blueprint gốc trước khi build. **Code hiện tại trên `main` + `docs/AI_HANDOFF_REPORT.md` mới là nguồn sự thật.**
> Mục đích còn lại: đối chiếu thiết kế, data model gốc, ý tưởng feature post-beta. Một số chi tiết (tên thư mục `mongtutien-clone/`, một số API/route, một số schema field) đã thay đổi trong code hiện tại (`xuantoi/`).
> Khi có conflict giữa file này và code/`AI_HANDOFF_REPORT.md`: **tin code & report**, KHÔNG rollback theo file này.

---

> Đây là phần dành cho lập trình viên / AI coder. Đủ để khởi tạo skeleton repo và sinh code.

---

## 1. STACK ĐỀ XUẤT (KHỚP VỚI BUNDLE GỐC)

### 1.1 Frontend
- **Vue 3** (Composition API, `<script setup>`) — bằng chứng: bundle có `useState`, `defineComponent`,
  Pinia (`V4("game", …)`, `V4("gameToast", …)`), Vue Router (`pathMatch(.*)`, `currentRoute`).
- **Pinia** — state management.
- **Vue Router 4** — code-split per route (`./auth-*.js`, `./register-*.js`…).
- **Vite** — build tool (asset hashing rõ ràng: `index-ipxi58iD.js`).
- **TypeScript**.
- **Tailwind CSS** + custom design tokens (m-* utilities), hoặc **UnoCSS**.
- **Workbox** — service worker (PWA, offline fallback).
- **socket.io-client** hoặc **native WebSocket** với reconnect.
- **Axios** cho REST (interceptor xử lý 401 → /auth).
- **vee-validate + zod** cho form validate.
- **floating-ui** cho tooltip / popover.
- **lottie-web** cho animation lò luyện đan / thiên kiếp.

### 1.2 Backend
- **Node.js 20+** + **NestJS** (modular, decorator, dễ chia REST/WS/Cron) hoặc **Fastify** (nhẹ).
- **PostgreSQL 16** — DB chính.
- **Redis 7** — session, online list, rate limit, leaderboard sorted set.
- **BullMQ** — queue (email, sự kiện, boss spawn).
- **Prisma** ORM hoặc **Drizzle**.
- **Argon2id** cho password hashing.
- **JWT** access (15 phút) + refresh token (httpOnly cookie, 30 ngày).
- **Zod** validate input toàn server.
- **Pino** logging.

### 1.3 Hạ tầng
- **Docker Compose** cho dev (postgres, redis, minio, mailhog).
- **CI**: GitHub Actions — lint + test + build + docker push.
- **Hosting đề xuất**:
  - Frontend: Cloudflare Pages / Vercel.
  - Backend: Fly.io / Railway / VPS Hetzner.
  - DB: Neon / Supabase / Postgres tự host.
  - Object storage: Cloudflare R2 / S3 / MinIO (avatar đạo lữ, art boss).

---

## 2. CẤU TRÚC THƯ MỤC

```
mongtutien-clone/
├── apps/
│   ├── web/                                   # Vue 3 SPA + PWA
│   │   ├── public/
│   │   │   ├── icon.png
│   │   │   ├── favicon_io/
│   │   │   ├── background/
│   │   │   │   ├── auth-bg.webp
│   │   │   │   └── loader.jpg
│   │   │   └── manifest.webmanifest
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── App.vue
│   │   │   ├── router/
│   │   │   │   └── index.ts
│   │   │   ├── stores/                       # Pinia
│   │   │   │   ├── auth.ts
│   │   │   │   ├── game.ts                   # giant store, mirror bundle gốc
│   │   │   │   ├── toast.ts                  # gameToast clone
│   │   │   │   ├── topup.ts
│   │   │   │   └── chat.ts
│   │   │   ├── api/
│   │   │   │   ├── client.ts                 # axios instance + interceptor
│   │   │   │   ├── auth.ts
│   │   │   │   ├── character.ts
│   │   │   │   ├── inventory.ts
│   │   │   │   ├── mail.ts
│   │   │   │   └── admin.ts
│   │   │   ├── ws/
│   │   │   │   ├── socket.ts
│   │   │   │   └── handlers.ts
│   │   │   ├── design/
│   │   │   │   ├── tokens.css
│   │   │   │   ├── m-cursor.css
│   │   │   │   ├── m-progress.css
│   │   │   │   └── m-model.css
│   │   │   ├── components/
│   │   │   │   ├── ui/                       # M-* primitives
│   │   │   │   │   ├── MButton.vue
│   │   │   │   │   ├── MModal.vue
│   │   │   │   │   ├── MProgressLeaf.vue
│   │   │   │   │   ├── MLoading.vue
│   │   │   │   │   └── MToast.vue
│   │   │   │   ├── shell/
│   │   │   │   │   ├── GameShell.vue         # layout 3 cột
│   │   │   │   │   ├── Topbar.vue
│   │   │   │   │   ├── Sidebar.vue
│   │   │   │   │   └── ChatDock.vue
│   │   │   │   ├── home/                     # GameHome
│   │   │   │   ├── map/                      # GameMap, BossList, MysticDungeons, SectConvoy
│   │   │   │   ├── inventory/                # GameInventory, ArtifactPanel
│   │   │   │   ├── mission/                  # GameMission
│   │   │   │   ├── alchemy/                  # GameAlchemy
│   │   │   │   ├── refinery/                 # GameRefinery
│   │   │   │   ├── social/                   # PetPanel, WifePanel, TienDuyenPanel
│   │   │   │   ├── arena/                    # GameArena, RivalryView
│   │   │   │   ├── activities/               # GameActivities, các *Main
│   │   │   │   ├── cultivation/              # CultivationMethodPanel, PathOfDaoView
│   │   │   │   ├── tutorial/                 # Onboarding, GameTutorial
│   │   │   │   ├── market/                   # Market
│   │   │   │   └── mail/
│   │   │   ├── views/                        # Route-level pages
│   │   │   │   ├── AuthView.vue
│   │   │   │   ├── HomeView.vue              # game shell + child route
│   │   │   │   ├── TopupView.vue
│   │   │   │   ├── CheckInventoryView.vue
│   │   │   │   ├── OnlineInspectorView.vue
│   │   │   │   ├── WivesWithDraftView.vue
│   │   │   │   ├── NotFoundView.vue
│   │   │   │   └── admin/
│   │   │   │       ├── AdminLayout.vue
│   │   │   │       ├── DashboardView.vue
│   │   │   │       ├── GiftcodesView.vue
│   │   │   │       ├── MailView.vue
│   │   │   │       ├── PlayersView.vue
│   │   │   │       ├── EquipmentIdentityView.vue
│   │   │   │       ├── RuntimeMetricsView.vue
│   │   │   │       └── TopupView.vue
│   │   │   ├── content/                      # JSON tĩnh
│   │   │   │   ├── realms.json               # 28 cảnh giới × 9 trọng (xem file 03)
│   │   │   │   ├── titles.json               # xưng hiệu mốc
│   │   │   │   ├── proverbs.json             # 7 câu thiền tab Đăng Nhập
│   │   │   │   ├── skills.json
│   │   │   │   ├── items.seed.json
│   │   │   │   └── i18n/vi.json
│   │   │   ├── assets/
│   │   │   │   ├── bg-auth.webp
│   │   │   │   ├── ink-frame.svg
│   │   │   │   └── icons/
│   │   │   └── env.d.ts
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   └── api/                                   # NestJS / Fastify
│       ├── src/
│       │   ├── main.ts
│       │   ├── modules/
│       │   │   ├── auth/         (register/login/refresh/change-pw)
│       │   │   ├── character/    (me, breakthrough, cultivate-tick)
│       │   │   ├── inventory/    (use, equip, sell, search-by-name)
│       │   │   ├── mission/
│       │   │   ├── boss/
│       │   │   ├── arena/
│       │   │   ├── chat/
│       │   │   ├── mail/
│       │   │   ├── market/
│       │   │   ├── topup/
│       │   │   ├── giftcode/
│       │   │   ├── sect/
│       │   │   ├── pet/
│       │   │   ├── wife/
│       │   │   ├── alchemy/
│       │   │   ├── refinery/
│       │   │   ├── event/
│       │   │   ├── leaderboard/
│       │   │   └── admin/
│       │   ├── ws/
│       │   │   ├── game.gateway.ts
│       │   │   └── chat.gateway.ts
│       │   ├── workers/
│       │   │   ├── boss-spawner.cron.ts
│       │   │   ├── stamina-regen.cron.ts
│       │   │   ├── arena-settle.cron.ts
│       │   │   └── event-scheduler.cron.ts
│       │   ├── prisma/
│       │   │   └── schema.prisma
│       │   └── common/
│       │       ├── guards/
│       │       ├── pipes/
│       │       └── filters/
│       └── test/
│
├── packages/
│   └── shared/                                # Type chia sẻ FE/BE (zod schema)
│       ├── src/
│       │   ├── enums.ts
│       │   ├── realms.ts                      # const REALMS = [...]
│       │   ├── ws-events.ts
│       │   └── api-contracts.ts
│       └── package.json
│
├── infra/
│   ├── docker-compose.dev.yml
│   ├── Dockerfile.web
│   ├── Dockerfile.api
│   └── nginx/
│
├── .github/workflows/ci.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 3. DATA MODEL (PRISMA SCHEMA — RÚT GỌN)

```prisma
// schema.prisma

datasource db { provider = "postgresql" url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(PLAYER)
  createdAt    DateTime @default(now())
  lastLoginAt  DateTime?
  banned       Boolean  @default(false)
  character    Character?
  topups       Topup[]
}

enum Role { PLAYER MOD ADMIN }

model Character {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields:[userId], references:[id])
  name            String   @unique
  realmKey        String   // ví dụ "kim_dan"
  realmStage      Int      // 1..9
  title           String?  // "Hư Không Chí Tôn"
  exp             BigInt   @default(0)
  level           Int      @default(1)

  // chỉ số chính
  hp              Int      @default(100)
  hpMax           Int      @default(100)
  mp              Int      @default(50)
  mpMax           Int      @default(50)
  stamina         Int      @default(100)
  staminaMax      Int      @default(100)
  power           Int      @default(10)
  spirit          Int      @default(10)
  speed           Int      @default(10)
  luck            Int      @default(5)
  daoVan          Int      @default(0)

  // currencies
  linhThach       BigInt   @default(0)
  tienNgoc        Int      @default(0)
  tienNgocKhoa    Int      @default(0)
  tienTe          Int      @default(0)
  nguyenThach     Int      @default(0)
  congHien        Int      @default(0)
  congDuc         Int      @default(0)
  chienCongTongMon Int     @default(0)

  settings        Json     @default("{}")
  sectId          String?
  sect            Sect?    @relation(fields:[sectId], references:[id])

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  inventory       InventoryItem[]
  equipped        EquippedItem[]
  pets            Pet[]
  wives           Wife[]
  arenaRecord    ArenaRecord?
  cultivationLogs CultivationLog[]
  missions        MissionProgress[]
  mails           Mail[]
}

model Sect {
  id          String   @id @default(cuid())
  name        String   @unique
  level       Int      @default(1)
  treasuryLinhThach BigInt @default(0)
  characters  Character[]
  createdAt   DateTime @default(now())
}

model ItemTemplate {
  id          String   @id
  name        String
  quality     Quality
  type        ItemType
  baseStats   Json     // {power:5, speed:2}
  iconUrl     String
  description String
}

enum Quality   { PHAM LINH HUYEN TIEN THAN }
enum ItemType  { WEAPON ARMOR BELT BOOTS HAT TRAM PILL HERB ORE KEY ARTIFACT MISC }

model InventoryItem {
  id          String   @id @default(cuid())
  charId      String
  char        Character @relation(fields:[charId], references:[id])
  templateId  String
  template    ItemTemplate @relation(fields:[templateId], references:[id])
  qty         Int      @default(1)
  enhanceLv   Int      @default(0)
  affixes     Json?
  createdAt   DateTime @default(now())
}

model EquippedItem {
  id          String   @id @default(cuid())
  charId      String
  slot        EquipSlot
  inventoryId String   @unique
  char        Character @relation(fields:[charId], references:[id])
}

enum EquipSlot { WEAPON ARMOR BELT BOOTS HAT TRAM ARTIFACT_1 ARTIFACT_2 ARTIFACT_3 }

model Pet      { id String @id @default(cuid()) charId String element String name String level Int @default(1) skills Json char Character @relation(fields:[charId], references:[id]) }
model Wife     { id String @id @default(cuid()) charId String name String avatarUrl String draftAvatarUrl String? bond Int @default(0) char Character @relation(fields:[charId], references:[id]) }

model BossInstance {
  id        String  @id @default(cuid())
  bossKey   String
  mapKey    String
  hp        BigInt
  hpMax     BigInt
  difficulty Difficulty
  spawnedAt DateTime @default(now())
  endedAt   DateTime?
  killedBy  String?
}
enum Difficulty { THUONG KHO AC_MONG BAO_TAU }

model Mail {
  id        String   @id @default(cuid())
  charId    String
  fromName  String   @default("Thiên Đạo Sứ Giả")
  title     String
  body      String
  rewards   Json?    // [{templateId, qty}]
  isRead    Boolean  @default(false)
  isClaimed Boolean  @default(false)
  createdAt DateTime @default(now())
  expiresAt DateTime?
  char      Character @relation(fields:[charId], references:[id])
}

model ChatMessage {
  id       String  @id @default(cuid())
  channel  String  // "world" | "sect:<id>" | "private:<a>:<b>"
  fromId   String
  fromName String
  text     String
  createdAt DateTime @default(now())
}

model Topup {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields:[userId], references:[id])
  amountVnd   Int
  tienNgoc    Int
  status      TopupStatus @default(PENDING)
  txnRef      String   @unique           // "MTT-<USER_ID>-<RANDOM6>"
  createdAt   DateTime @default(now())
  approvedAt  DateTime?
}
enum TopupStatus { PENDING APPROVED REJECTED }

model GiftCode {
  code      String   @id
  rewards   Json
  usesLeft  Int
  expiresAt DateTime?
  createdAt DateTime @default(now())
}

model GiftCodeRedemption {
  id      String @id @default(cuid())
  code    String
  charId  String
  redeemedAt DateTime @default(now())
  @@unique([code, charId])
}

model CultivationLog {
  id      String @id @default(cuid())
  charId  String
  text    String
  type    String   // "info" | "success" | "warning" | "system"
  createdAt DateTime @default(now())
  char    Character @relation(fields:[charId], references:[id])
}

model MissionProgress {
  id        String @id @default(cuid())
  charId    String
  missionKey String
  progress  Int   @default(0)
  claimed   Boolean @default(false)
  resetAt   DateTime?
  char      Character @relation(fields:[charId], references:[id])
  @@unique([charId, missionKey])
}

model ArenaRecord {
  id      String @id @default(cuid())
  charId  String @unique
  rank    Int
  rating  Int @default(1500)
  wins    Int @default(0)
  losses  Int @default(0)
  char    Character @relation(fields:[charId], references:[id])
}
```

---

## 4. API CONTRACT (REST)

> Tất cả response: `{ ok: true, data: T }` hoặc `{ ok: false, error: { code, message } }`.

### 4.1 Auth (`/api/_auth`)
| Method | Path                | Body                                      | Trả về                   |
|--------|---------------------|-------------------------------------------|--------------------------|
| POST   | `/register`         | `{email, password}`                       | `{user}` + set cookie    |
| POST   | `/login`            | `{email, password, rememberEmail?}`       | `{user, character?}`     |
| POST   | `/logout`           | —                                         | `{ok}`                   |
| POST   | `/change-password`  | `{oldPassword, newPassword}`              | `{ok}`                   |
| GET    | `/session`          | (cookie)                                  | `{user, character?}`     |

Mã lỗi:
- `INVALID_CREDENTIALS` → "Danh hiệu hoặc huyền pháp không chính xác."
- `EMAIL_TAKEN` → "Danh hiệu đạo đồ đã được khai lập hoặc dữ liệu không hợp lệ."
- `WEAK_PASSWORD` → "Huyền pháp quá yếu."
- `OLD_PASSWORD_WRONG` → "Huyền pháp cũ không đúng hoặc không tìm thấy tài khoản."

### 4.2 Character
| Method | Path                       | Mô tả                          |
|--------|----------------------------|--------------------------------|
| GET    | `/api/character/me`        | full state                     |
| POST   | `/api/character/onboard`   | tạo tên + chọn môn phái khởi đầu |
| POST   | `/api/character/cultivate/start` | bật cày EXP                |
| POST   | `/api/character/cultivate/stop`  |                              |
| POST   | `/api/character/breakthrough`    | đột phá cảnh giới            |
| POST   | `/api/character/tribulation`     | vào trận thiên kiếp           |
| POST   | `/api/character/settings`        | update settings JSON          |

### 4.3 Inventory & Market
- `GET /api/inventory/me`
- `POST /api/inventory/use { itemId }`
- `POST /api/inventory/equip { itemId, slot }`
- `POST /api/inventory/sell { itemId, qty }`
- `GET /api/inventory/by-name?name=<charName>` *(check-inventory page)*
- `GET /api/market` / `POST /api/market/list` / `POST /api/market/buy/:id`

### 4.4 Boss / Arena
- `GET /api/boss/list?map=<key>`
- `POST /api/boss/:id/attack`
- `GET /api/arena/opponents`
- `POST /api/arena/challenge { opponentId }`
- `GET /api/leaderboard?type=power|arena|sect`

### 4.5 Mail / Topup / Gift
- `GET /api/mail` / `POST /api/mail/:id/claim` / `POST /api/mail/:id/read`
- `POST /api/topup/create { amountVnd }` → trả `txnRef`
- `POST /api/giftcode/redeem { code }` → trả rewards

### 4.6 Admin (role=ADMIN)
- `GET /api/admin/players?q=`
- `POST /api/admin/players/:id/ban` / `unban`
- `POST /api/admin/players/:id/grant { currencyKey, qty }`
- `POST /api/admin/giftcodes`
- `POST /api/admin/mail/broadcast { filter, title, body, rewards }`
- `GET /api/admin/runtime-metrics`
- `POST /api/admin/topup/:id/approve | reject`

---

## 5. API CONTRACT (WEBSOCKET)
- Endpoint: `wss://<host>/ws` (cookie auth).
- Frame: `{ type: string, payload: any, ts: number }`
- Reconnect strategy: exponential backoff 1s → 30s, max 10 lần.
- Heartbeat: client gửi `{type:"ping"}` mỗi 25s; server reply `pong`.
- Server-side rate limit: 30 msg / 10s cho `chat:send`.

Sự kiện server → client: xem **file 02 mục 20.1**.
Lệnh client → server: xem **file 02 mục 20.2**.

---

## 6. RATE LIMIT & ANTI-CHEAT

- **Cultivate tick** xác thực server-side: client chỉ gửi heartbeat `cultivate:tick`,
  EXP do server tính theo (timestamp delta × multiplier). Không tin số từ client.
- **Đột phá**: server kiểm tra `exp >= cost && hasItem('Đột Phá Đan')`.
- **Boss attack**: cooldown 1s/lần/người chơi, lock theo Redis `SET NX PX 1000`.
- **Chat**: Redis token bucket 8 msg/30s.
- **Login**: argon2id, fail-attempts → lock 15 phút sau 5 lần (Redis).
- **JWT**: rotate refresh; revoke all sessions khi đổi mật khẩu.
- **CORS**: chỉ origin chính (web client).
- **CSP**: `default-src 'self'; img-src 'self' https://r2.<host>; connect-src 'self' wss://...`.

---

## 7. ENV / SECRET

```
# apps/api/.env
DATABASE_URL=postgresql://mtt:mtt@localhost:5432/mtt
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
SESSION_COOKIE_DOMAIN=mongtutien.example
S3_ENDPOINT=...
S3_BUCKET=mtt-assets
S3_KEY=...
S3_SECRET=...
SMTP_URL=smtp://...
ADMIN_BOOTSTRAP_EMAIL=admin@example.com

# apps/web/.env
VITE_API_BASE=/api
VITE_WS_URL=wss://api.mongtutien.example/ws
```

---

# PHẦN BỔ SUNG — LONG-TERM ARCHITECTURE BLUEPRINT (2026-04 onwards)

> **Status**: Long-term architecture blueprint cho game lớn dài hạn (Phase 9+).
> Phần này được thêm sau, **không thay thế** phần historical phía trên.
> Sister docs:
> - [`GAME_DESIGN_BIBLE.md`](./GAME_DESIGN_BIBLE.md) — vision, core loop, system overview.
> - [`LONG_TERM_ROADMAP.md`](./LONG_TERM_ROADMAP.md) — Phase 9 → Phase 17.
> - [`ECONOMY_MODEL.md`](./ECONOMY_MODEL.md) — currency invariants, anti-abuse.
> - [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md) — process thêm content.
> - [`BALANCE_MODEL.md`](./BALANCE_MODEL.md) — curve + dial.
> - [`LIVE_OPS_MODEL.md`](./LIVE_OPS_MODEL.md) — event scheduler + feature flag.

Mục tiêu: AI/dev tiếp theo đọc xong biết **schema + module + API + WS dài hạn dự kiến** mà KHÔNG migrate ngay. Đề xuất, không command.

---

## P9.1 KIẾN TRÚC TỔNG QUAN (xác nhận theo code @ 2026-04)

| Layer | Stack | Status |
|---|---|---|
| Web client | Vue 3 + Vite + Pinia + Tailwind + vue-i18n + PWA (Workbox) | ✅ stable |
| API | NestJS 10 + Prisma 5 + Postgres 16 + Redis 7 + BullMQ + JWT cookie | ✅ stable |
| Realtime | Socket.io 4 over `/ws` namespace, cookie auth | ✅ stable |
| Worker | NestJS scheduler + BullMQ processor (cultivation tick + cleanup) | ✅ stable |
| Shared | `packages/shared` TypeScript catalog (realm/item/skill/monster/dungeon/mission/proverb) | ✅ stable |
| Infra dev | docker-compose: postgres, redis, mailhog | ✅ stable |
| Infra prod | Tuỳ user (out of scope blueprint này — xem `docs/DEPLOY.md`) | TBD |
| Test | vitest (unit + integration), Playwright (E2E), 815 tests baseline | ✅ stable |

KHÔNG đề xuất đổi stack chính. Tất cả mở rộng phía dưới giữ nguyên foundation này.

---

## P9.2 PRISMA SCHEMA — DÀI HẠN (PROPOSAL)

> **Đây là PROPOSAL**. KHÔNG migrate ngay. Phase từng nhóm rõ trong `LONG_TERM_ROADMAP.md`.

### P9.2.1 Hiện trạng (21 model)

`User`, `Character`, `InventoryItem`, `CurrencyLedger`, `ItemLedger`, `MissionProgress`, `Mail`, `Listing`, `Sect`, `ChatMessage`, `WorldBoss`, `BossDamage`, `Encounter`, `GiftCode`, `GiftCodeRedemption`, `DailyLoginClaim`, `TopupOrder`, `AdminAuditLog`, `RefreshToken`, `LoginAttempt`, `PasswordResetToken`.

### P9.2.2 Nhóm: Economy reinforcement (phase 15-16)

| Model | Mục đích | Quan hệ chính | Phase |
|---|---|---|---|
| `RewardClaimLog` | Single-source-of-truth idempotency mọi reward source | `(characterId, sourceType, sourceKey)` unique | 15-16 |
| `EconomyAuditSnapshot` | Snapshot tổng economy daily (inflation tracking) | `asOf` unique | 16 |
| `EconomyAnomaly` | Anomaly tracking (wash trade, large grant, ...) | `kind`, `severity`, `status` index | 16 |
| `MarketPriceBand` | Min/max price per item override (admin-tunable) | `itemKey` unique | 16 |
| `LedgerArchive` | Move ledger row > 90d sang archive (perf) | partition / table | 17 |

Schema tham khảo: xem `ECONOMY_MODEL.md` §8.

### P9.2.3 Nhóm: Progression depth (phase 11)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `CultivationMethod` (catalog static + DB row per char) | Công pháp tu luyện | static catalog + `CharacterCultivationMethod(characterId, methodKey, mastery)` |
| `SkillTemplate` (catalog) + `CharacterSkill` (DB) | Skill upgrade per char | `CharacterSkill(characterId, skillKey, level, xp)` |
| `Talent` (catalog) + `CharacterTalent` (DB) | Thần thông passive | `CharacterTalent(characterId, talentKey, unlockedAt)` |
| `CharacterBuff` | Buff/debuff stack | `(characterId, key, expiresAt, source, stackable)` |
| `Character` field bổ sung | `spiritualRoot: SpiritualRoot @default(PHAM)`, `physique: Int @default(0)`, `refineLevel: Int @default(0)` | Migration bổ sung |
| `EquipChangeLog` (optional) | Audit equip/unequip | `(characterId, slot, oldItemId, newItemId, createdAt)` |

### P9.2.4 Nhóm: Quest + Story (phase 11)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `Quest` | Catalog DB-backed quest chain | `key` unique, `chainKey?`, `requiredQuestKey?` |
| `QuestStep` | Step trong quest | `questId` FK, `stepIndex`, `goalKind`, `goalAmount`, `rewards` JSON |
| `QuestProgress` | Per-character per-quest progress | `(characterId, questId)` unique |
| `StoryChapter` | Chapter narrative | `key` unique, `requiredChapterKey?` |
| `StoryProgress` | Per-character chapter | `(characterId, chapterId)` unique |
| `NpcDialogue` | Dialogue node | `key` unique, `chapterId?`, `nextDialogueKey?` |

### P9.2.5 Nhóm: Map + Dungeon (phase 12)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `MapRegion` | Vùng địa lý mở khoá theo realm | `key` unique, `unlockRealmKey`, `sortOrder` |
| `DungeonTemplate` | Template tạo dungeon run | `key` unique, `regionId` FK, `recommendedRealm`, `lootTableKey` |
| `DungeonRun` | Instance run per character | `(characterId, templateKey, status)`, `seed`, `currentEncounterIndex` |
| `MonsterTemplate` (optional move static → DB) | Cân nhắc theo content cadence | giữ static phase 12; review phase 15 |
| `DropTable` | DB drop weight (admin tune) | `key` unique, `entries` JSON |
| `LootRoll` | Audit trail mọi roll loot | `(characterId, sourceType, sourceKey, itemKey, rolledAt)` |

### P9.2.6 Nhóm: Sect 2.0 (phase 13)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `SectMember` (tách từ `Character.sectId`) | Role + join time | `(sectId, characterId)` unique, `role: SectRole` |
| `SectContributionLedger` | Audit `congHien` gain/spend | tương tự `CurrencyLedger` |
| `SectTreasuryLedger` | Audit `Sect.treasuryLinhThach` | giống pattern |
| `SectMission` (catalog static) + `SectMissionProgress` (DB) | Mission scoped sect | tương tự daily/weekly |
| `WorldBoss.scopeKey` (mở rộng field) | `'world'` cho hiện tại; `<sectId>` cho sect boss | migration thêm field |
| `SectWar`, `SectWarMatch` | Sect war season async | `seasonId`, `sectAId`, `sectBId`, `result`, `score` |
| `SectAuditLog` (hoặc reuse `AdminAuditLog`) | Audit role change, kick, promote | tuỳ chọn |

### P9.2.7 Nhóm: Arena (phase 14)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `Season` | Generic season holder (arena, sect war, battle pass) | `key`, `kind`, `status`, `startsAt`, `endsAt` |
| `SeasonProgress` | Per-character per-season state | `(seasonId, characterId)` unique, `eloRating?`, `wins`, `losses`, JSON |
| `SeasonRewardClaim` | Idempotent end-of-season reward | `(seasonId, characterId, tier)` unique |
| `CharacterCombatSnapshot` | Defensive snapshot deterministic | `(characterId, seasonId)` unique, `snapshotJson`, `version` |
| `ArenaMatch` | Match log | `(seasonId, attackerId, defenderId, result, createdAt)` |

### P9.2.8 Nhóm: Live ops (phase 15)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `EventConfig` | Event live | `key` unique, `kind`, `status`, `startsAt`, `endsAt` |
| `EventProgress` | Per-character event progress | `(eventId, characterId)` unique |
| `EventRewardClaim` | Idempotent claim | `(eventId, characterId, tier)` unique |
| `Announcement` | WS broadcast | `level`, `startsAt`, `endsAt` |
| `MaintenanceWindow` | Maintenance mode | `mode`, `startsAt`, `endsAt` |
| `FeatureFlag` | Module on/off | `key` unique, `scope`, `scopePayload` JSON |
| `ConfigVersion` | Snapshot config trước update (rollback) | `kind`, `refKey`, `payloadJson`, `createdAt` |

Schema chi tiết: xem `LIVE_OPS_MODEL.md` §3-7.

### P9.2.9 Nhóm: Social / moderation (phase 11)

| Model | Mục đích | Quan hệ |
|---|---|---|
| `PlayerReport` | User report user | `(reporterId, targetId, reason, evidence, status)` |
| `ChatModerationLog` | Auto-mod flag | `(messageId, reason, action)` |
| `BlockList` | Per-user block | `(blockerUserId, blockedUserId)` unique |

### P9.2.10 Tổng hợp model count

- Hiện tại: **21 model**.
- Phase 11 thêm: **~10 model** (cultivation method, skill template/char, talent, buff, quest, story, NPC, equip log, player report, chat mod log).
- Phase 12 thêm: **~6 model** (map region, dungeon template, dungeon run, monster template optional, drop table, loot roll).
- Phase 13 thêm: **~7 model** (sect member, contribution ledger, treasury ledger, sect mission progress, sect war, sect war match, sect audit log).
- Phase 14 thêm: **~5 model** (season, season progress, season reward claim, combat snapshot, arena match).
- Phase 15 thêm: **~7 model** (event config, event progress, event reward claim, announcement, maintenance window, feature flag, config version).
- Phase 16 thêm: **~4 model** (reward claim log unified, audit snapshot, anomaly, market price band).

→ **Tổng dự kiến cuối Phase 16**: ~60 model. Postgres + Prisma đủ sức (đã chứng minh ở MMO scale).

---

## P9.3 API ROADMAP (REST)

### P9.3.1 Hiện trạng (MVP)

Xem `docs/API.md`. Tóm tắt: 18 module API đã ship.

### P9.3.2 Mở rộng phase 11

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/cultivation-method/list` | GET | List công pháp catalog |
| `/api/cultivation-method/learn` | POST | Học method (consume item) |
| `/api/cultivation-method/me` | GET | Method đang luyện |
| `/api/skill/list` | GET | Catalog skill |
| `/api/skill/me` | GET | Skill đã unlock + level |
| `/api/skill/upgrade` | POST | Upgrade level (consume skill book) |
| `/api/talent/me` | GET | Talent đã unlock |
| `/api/talent/unlock` | POST | Unlock talent (consume point) |
| `/api/alchemy/recipes` | GET | List recipe |
| `/api/alchemy/craft` | POST | Craft pill (consume materials) |
| `/api/refinery/recipes` | GET | List refine recipe |
| `/api/refinery/refine` | POST | Refine equipment |
| `/api/character/buffs` | GET | Active buff list |

### P9.3.3 Mở rộng phase 12

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/map/regions` | GET | List region với unlock status |
| `/api/dungeon/templates` | GET | List template per region |
| `/api/dungeon/run/start` | POST | Tạo run |
| `/api/dungeon/run/:id` | GET | Get run state |
| `/api/dungeon/run/:id/next` | POST | Next encounter trong run |
| `/api/dungeon/run/:id/claim` | POST | Claim end-run reward |
| `/api/loot/me` | GET | Loot history (audit) |

### P9.3.4 Mở rộng phase 13 (Sect 2.0)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/sect/members` | GET | List member theo role |
| `/api/sect/promote` | POST | Promote member (leader/elder only) |
| `/api/sect/kick` | POST | Kick member |
| `/api/sect/contribution/me` | GET | Contribution history |
| `/api/sect/treasury/log` | GET | Treasury log (leader/elder) |
| `/api/sect/mission/list` | GET | Mission active |
| `/api/sect/mission/claim` | POST | Claim |
| `/api/sect/shop/list` | GET | Sect shop catalog |
| `/api/sect/shop/buy` | POST | Buy with congHien |
| `/api/sect/boss/list` | GET | Sect boss active |
| `/api/sect/war/active` | GET | Sect war hiện tại |
| `/api/sect/war/attack` | POST | Tấn công sect khác |

### P9.3.5 Mở rộng phase 14 (Arena)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/arena/season` | GET | Season hiện tại + ELO của tôi |
| `/api/arena/snapshot` | POST | Submit defensive snapshot |
| `/api/arena/find-opponents` | GET | Match 5 opponent close ELO |
| `/api/arena/attack/:opponentId` | POST | Tấn công, simulate combat server-side |
| `/api/arena/history` | GET | Match history |
| `/api/season/reward/claim` | POST | Claim end-season reward |

### P9.3.6 Mở rộng phase 15 (Live ops)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/events/active` | GET | Public list event đang ACTIVE |
| `/api/events/:id` | GET | Event detail |
| `/api/events/:id/progress/me` | GET | Progress tôi |
| `/api/events/:id/claim/:tier` | POST | Claim tier reward |
| `/api/announcements/active` | GET | Public list announcement |
| `/api/admin/events` | GET POST | Admin CRUD event |
| `/api/admin/events/:id/start` | POST | Start scheduled event sớm |
| `/api/admin/events/:id/cancel` | POST | Cancel event |
| `/api/admin/announcements` | GET POST | Admin CRUD announcement |
| `/api/admin/maintenance` | GET POST | Admin schedule maintenance |
| `/api/admin/feature-flags` | GET POST | Admin toggle flag |
| `/api/admin/config-versions/:kind/:refKey` | GET | List version |
| `/api/admin/config-versions/:id/rollback` | POST | Rollback |

### P9.3.7 Mở rộng phase 16 (Economy audit)

| Endpoint | Method | Mô tả |
|---|---|---|
| `/api/admin/economy/report` | GET | Report tổng (filter from/to/currency) |
| `/api/admin/economy/anomalies` | GET POST | List + resolve |
| `/api/admin/economy/snapshot/run` | POST | Trigger snapshot manual |
| `/api/admin/market/price-bands` | GET POST | CRUD price band override |

---

## P9.4 WEBSOCKET ROADMAP

### P9.4.1 Hiện trạng

- `cultivate:tick`
- `chat:msg`
- `mission:progress`

### P9.4.2 Mở rộng

| Event | Phase | Direction | Mô tả |
|---|---|---|---|
| `mail:unread` | 9 | S→C | Có mail mới |
| `boss:spawn` | 12 | S→C | Boss xuất hiện |
| `boss:hp_update` | 12 | S→C | HP update (throttle 1/sec) |
| `boss:defeated` | 12 | S→C | Boss đã defeat |
| `market:listing_update` | 16 | S→C | Listing mới (rate-limit) |
| `event:start` | 15 | S→C | Event chuyển ACTIVE |
| `event:end` | 15 | S→C | Event ENDED |
| `announcement:show` | 15 | S→C | Marquee announcement |
| `sect:update` | 13 | S→C | Sect-internal event (member join/leave/promote) |
| `season:start` / `season:end` | 14 | S→C | Season lifecycle |
| `maintenance:notice` | 15 | S→C | Maintenance upcoming/active |
| `admin:alert` | 16 | S→C (admin only) | Anomaly detected |

Naming: `<resource>:<verb>` snake_case. Verb past cho event đã xảy ra, present cho live state.

---

## P9.5 BULLMQ JOB ROADMAP

### P9.5.1 Hiện trạng

- `cultivation-tick` repeatable 30s.
- Cleanup jobs (expired refresh token, expired mail).

### P9.5.2 Mở rộng

| Job | Phase | Cadence | Mô tả |
|---|---|---|---|
| `mission-reset-daily` | 9 (verify) | 04:00 daily Asia/Ho_Chi_Minh | Reset DAILY mission |
| `mission-reset-weekly` | 9 (verify) | Mon 00:00 | Reset WEEKLY |
| `event-lifecycle` | 15 | 30s | DRAFT→SCHEDULED→ACTIVE→ENDED transitions |
| `boss-spawn` | 12 | per-region schedule | Auto-spawn world boss |
| `season-rollover` | 14 | end-of-season | Compute reward + reset ELO |
| `sect-war-rollover` | 13 | end-of-season | Compute sect war result |
| `economy-audit-snapshot` | 16 | 02:00 daily | Take snapshot |
| `economy-anomaly-scan` | 16 | hourly | Scan ledger 24h cho anomaly |
| `maintenance-lifecycle` | 15 | 30s | Active/cancel maintenance window |
| `feature-flag-cache-invalidate` | 15 | on-update | Invalidate Redis FF cache |
| `topup-pending-cleanup` | 9 | hourly | Cancel topup PENDING > 7 ngày |

---

## P9.6 RATE LIMIT ROADMAP

### P9.6.1 Hiện trạng

- `/auth/login`, `/auth/register`: 5/15p/IP.
- `/chat/world`: 8/30s.
- `/chat/sect`: 16/30s.

### P9.6.2 Mở rộng

| Endpoint | Limit |
|---|---|
| `/character/breakthrough` | 5/min/character |
| `/market/list` | 10/min + 50 listing/day cap |
| `/market/buy` | 30/min |
| `/giftcode/redeem` | 10/min |
| `/topup/order` | 5/h |
| `/dungeon/run/start` | 10/min |
| `/arena/attack/*` | 10/min + 50 attack/day |
| `/sect/war/attack` | 5/min + 20 attack/day |

Backed by Redis token bucket (pattern reuse từ chat).

---

## P9.7 TEST INFRA ROADMAP

### P9.7.1 Hiện trạng

- vitest unit + integration: 815 tests baseline.
- Playwright E2E (golden path).
- `pnpm smoke:beta` HTTP smoke.

### P9.7.2 Đề xuất

| Script | Phase | Mô tả |
|---|---|---|
| `pnpm test:catalog` | 10 | Subset shared tests cho catalog integrity (item/skill/monster/dungeon/mission/boss) |
| `pnpm test:balance` | 11 | Curve invariant tests |
| `pnpm smoke:economy` | 9-16 | End-to-end ledger consistency: cultivate → boss → mail → market → claim → audit |
| `pnpm smoke:admin` | 9 | Admin grant + mail send + giftcode create + audit log assert |
| `pnpm smoke:ws` | 9 | WS connect + tick + reconnect + rate limit |
| `pnpm audit:ledger` | 9 (verify, đã có) | CLI verify ledger total = character balance |

---

## P9.8 ENV / SECRET (LONG-TERM)

Biến mới khả dụng (TBD theo phase):

```
# apps/api/.env (long-term)
EVENT_LIFECYCLE_INTERVAL_MS=30000      # phase 15
ECONOMY_ANOMALY_SCAN_CRON=0 * * * *    # phase 16
ECONOMY_AUDIT_SNAPSHOT_CRON=0 2 * * *  # phase 16
FEATURE_FLAG_CACHE_TTL_SEC=30          # phase 15
MAINTENANCE_LIFECYCLE_INTERVAL_MS=30000 # phase 15
ADMIN_LARGE_GRANT_THRESHOLD_LINH_THACH=10000000  # phase 16
SUPER_ADMIN_USER_ID=                    # phase 16 (super-admin alert recipient)
PAYMENT_PROVIDER=manual                 # phase 17 (manual | stripe | vnpay | momo)
```

---

## P9.9 MIGRATION SAFETY RULES

> AI/dev tiếp theo ĐỌC KỸ. Vi phạm = data loss.

1. **Không xoá field**. Chỉ deprecate (đặt `@deprecated` comment + ngừng dùng ở code mới). Xoá field khi không có ledger row reference (tối thiểu 6 tháng sau deprecate).
2. **Không rename field** trừ khi có 2-step migration (add new + dual write + remove old).
3. **Không thay đổi enum value cũ**. Chỉ thêm enum mới (Postgres enum migration cần special handling).
4. **Không thêm `@unique` constraint** trên field đã có data trùng. Migration phải clean data trước.
5. **Mọi migration phải có rollback note** trong PR description: cách revert nếu fail.
6. **Backup DB trước khi prod migrate**. `pnpm backup:db` rồi mới `pnpm prisma migrate deploy`.
7. **Migration test trên staging trước**. Schema drift giữa staging vs prod = bug critical.
8. **Migration name phải descriptive**. `<YYYYMMDDHHMMSS>_add_event_config` không `<...>_misc`.
9. **Một migration = một concern**. Không gom 5 thay đổi không liên quan.

---

## P9.10 DECISION LOG

| Quyết định | Lý do | Phase đưa ra |
|---|---|---|
| Giữ Postgres + Prisma, không chuyển NoSQL | Schema relation phức tạp, transaction quan trọng cho economy | Phase 0 |
| Static catalog TS thay vì DB-backed | Type-safe + tree-shake + no migration cho thay đổi catalog | Phase 0 |
| Cookie auth thay JWT header | XSS protection + simpler refresh | Phase 1 |
| Socket.io thay native WS | Reconnect built-in + rooms abstraction | Phase 2 |
| BullMQ Redis-backed thay nestjs-schedule pure | Persist job + retry + scaling | Phase 2 |
| Tách `tienNgocKhoa` (locked premium) | Compliance: event reward không "trade-able" như topup | Phase 4 |
| Ledger-based economy ngay từ MVP | Chống cheat + audit + recovery — đắt nếu add sau | Phase 4-5 |
| Admin role split MOD/ADMIN | MOD ban user, ADMIN approve topup. Khác trách nhiệm | Phase 7 |
| Async PvP (arena) trước real-time PvP | Real-time tốn infra, async đủ cho cultivation game | Phase 14 (đề xuất) |
| Static catalog cho monster (không DB) phase 12 | Content cadence chấp nhận được. Move sang DB chỉ khi cần admin tune live | Phase 12 |
| Single `RewardClaimLog` unified phase 15-16 | Hiện idempotency phân tán mỗi module — dễ miss khi thêm source mới | Phase 15-16 |
| Dùng Prisma raw SQL cho query phức tạp khi cần | Prisma Client không đủ mạnh cho aggregate complex (e.g. economy report) | Phase 16 |

---

## P9.11 CHANGELOG

- **2026-04-30** — Bổ sung phần "Long-term architecture blueprint" (P9.x). Author: Devin AI session 9q (docs blueprint refresh).
