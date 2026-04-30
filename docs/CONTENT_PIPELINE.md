# Xuân Tôi — Content Pipeline

> **Status**: Long-term content pipeline. Source of truth cho **process** thêm content (item, skill, monster, dungeon, mission, boss, quest, event, title, achievement).
> Code on `main` + `packages/shared/src/*.ts` là source of truth cho **catalog hiện tại**.
> Sister docs: [`GAME_DESIGN_BIBLE.md`](./GAME_DESIGN_BIBLE.md), [`BALANCE_MODEL.md`](./BALANCE_MODEL.md), [`SEEDING.md`](./SEEDING.md).

Mục tiêu: thêm content **không phá CI**, **không lệch curve**, **không miss i18n**, **không quên ledger path**.

---

## 1. CONTENT INVENTORY (hiện trạng)

| Loại | File | Số lượng hiện tại | Phase mở rộng |
|---|---|---|---|
| Realm | `packages/shared/src/realms.ts` | 28 đại cảnh giới | Static, ít thay đổi |
| Proverb | `packages/shared/src/proverbs.ts` | 7 câu | Có thể thêm dần |
| Item | `packages/shared/src/items.ts` | 30 item | Phase 10: → 80-100 |
| Skill | `packages/shared/src/combat.ts` `SKILLS` | 10 skill | Phase 10-11: → 25-30 |
| Monster | `packages/shared/src/combat.ts` `MONSTERS` | 9 monster | Phase 10: → 30 |
| Dungeon | `packages/shared/src/combat.ts` `DUNGEONS` + `DUNGEON_LOOT` | 3 dungeon | Phase 10: → 8-10 |
| Mission | `packages/shared/src/missions.ts` | 12 mission | Phase 10: → 65+ |
| Boss | `packages/shared/src/boss.ts` | 0 named (chỉ helper) | Phase 10: → 10 named |
| Topup pack | `packages/shared/src/topup.ts` | (đã có) | Tunable theo monetization |
| Shop pack | `packages/shared/src/shop.ts` | (đã có) | Tunable |
| **Quest chain** | (chưa có) | 0 | Phase 11 — DB-backed |
| **Story chapter** | (chưa có) | 0 | Phase 11 — DB-backed |
| **Map region** | (chưa có) | 0 | Phase 12 — DB-backed |
| **DungeonTemplate** | (chưa có, dùng static `DungeonDef`) | — | Phase 12 — migrate sang DB |
| **Title** | (`Character.title` là free string) | 0 catalog | Phase 11 — static catalog |
| **Achievement** | (chưa có) | 0 | Phase 11 — static catalog + DB progress |
| **EventConfig** | (chưa có) | 0 | Phase 15 — DB-backed |

---

## 2. STATIC vs DB CATALOG

### 2.1 Khi nào static (TS file)

- Content thay đổi **thấp tần** (1-2 tuần / lần) hoặc **không thay đổi sau release**.
- Cần FE + BE share cùng key + type-safe (TypeScript).
- Không cần admin tune live.

Example: **realm**, **item**, **skill**, **monster**, **dungeon**, **mission**, **proverb**, **title** (cosmetic), **achievement**.

### 2.2 Khi nào DB

- Content cần **admin tune live** (e.g. event reward, drop weight).
- Content có **runtime state** per character (e.g. quest progress, achievement progress).
- Content có **lifecycle** (start/end, status).

Example: **EventConfig**, **MapRegion**, **DungeonTemplate** (instances qua `DungeonRun`), **Quest**+`QuestProgress`, **StoryChapter**+`NpcDialogue`, **MarketPriceBand`.

### 2.3 Hybrid

Một số catalog có thể **static define** + **DB override per environment**:

- `MARKET_PRICE_BAND` static default; admin có thể override per item qua DB row.
- `ECONOMY_DIALS` (xem `ECONOMY_MODEL.md` §6.3) — static default, env override, admin UI override (phase 15).

---

## 3. CONTENT FIELD CONTRACT

Mỗi content type có 1 contract chung:

### 3.1 Required fields

| Field | Type | Mô tả |
|---|---|---|
| `key` | `string` (snake_case) | Unique trong loại đó. **Immutable sau release** đầu tiên. |
| `nameVi` | `string` | Tên VI hiển thị. (Hiện một số catalog dùng `name` cho VI default — chuẩn hoá phase 10.) |
| `nameEn` | `string` | Tên EN hiển thị. (Hiện một số chưa có — bổ sung phase 10.) |
| `description` | `string` | VI flavor + mechanics summary. |
| `descriptionEn` | `string` | EN. |
| `tier` / `quality` | enum | PHAM/LINH/HUYEN/TIEN/THAN nếu áp dụng. |

### 3.2 Optional fields tuỳ loại

| Loại | Fields đặc trưng |
|---|---|
| Item | `kind`, `slot?`, `bonuses?`, `effect?`, `stackable`, `priceLinhThach?` |
| Skill | `sect?`, `atkScale`, `mpCost`, `cooldownTurns?`, `selfHealRatio?`, `selfBloodCost?` |
| Monster | `level`, `hp`, `atk`, `def`, `speed`, `expDrop`, `linhThachDrop` |
| Dungeon | `recommendedRealm`, `monsters[]`, `staminaEntry` |
| Mission | `period`, `goalKind`, `goalAmount`, `rewards`, `requiredRealmKey?` |
| Boss | `level`, `maxHp`, `atk`, `def`, `rewardLinhThach`, `rewardItems[]`, `spawnIntervalMin?` |
| Quest (phase 11) | `chainKey`, `stepIndex`, `requiredQuestKey?`, `rewards`, `dialogueKey?` |
| Event (phase 15) | `kind`, `configJson`, `startsAt`, `endsAt`, `rewardTiers[]` |

### 3.3 Audit fields (không bao giờ để FE input)

- `createdAt: DateTime` — auto.
- `createdByAdminId: String?` — set bởi server từ JWT.
- `updatedAt: DateTime` — auto.

---

## 4. PROCESS THÊM CONTENT MỚI

### 4.1 Item

**Step-by-step**:

1. Mở `packages/shared/src/items.ts`.
2. Append entry vào `ITEMS` array. `key` snake_case unique.
3. Set `kind`, `quality`, `stackable`, `slot` (nếu equip), `bonuses` (nếu equip), `effect` (nếu pill), `priceLinhThach` (gợi ý vendor sell).
4. Thêm tên EN ở i18n catalog (phase 10 sẽ tách `nameVi`/`nameEn` thành field).
5. Nếu là drop từ dungeon → thêm vào `DUNGEON_LOOT[<dungeon-key>]` với `weight`, `qtyMin`, `qtyMax`.
6. Add balance note (comment) — tại sao chọn power level này.
7. Run:
   ```bash
   pnpm --filter @xuantoi/shared build
   pnpm --filter @xuantoi/shared test
   ```
8. PR title: `feat(shared): item pack <name> (+N item)`.

**Quality gate**:

- `catalog.test.ts` pass: key uniqueness, slot coverage.
- Power không vượt curve (xem `BALANCE_MODEL.md` §3 power-by-realm).
- i18n: VI + EN.

### 4.2 Skill

1. Mở `packages/shared/src/combat.ts`.
2. Append vào `SKILLS` với `sect: 'thanh_van' | 'huyen_thuy' | 'tu_la' | null`.
3. Set `atkScale`, `mpCost`, `cooldownTurns` (nếu phase 11 đã merge cooldown), `selfHealRatio`, `selfBloodCost`.
4. Tên EN.
5. Test pass.
6. PR title: `feat(shared): skill pack <name> (+N skill)`.

### 4.3 Monster + Dungeon

1. Append `MONSTERS` (nếu cần monster mới).
2. Append `DUNGEONS` (nếu cần dungeon mới):
   - `key`, `name`, `description`, `recommendedRealm`, `monsters: ['key1', 'key2', ...]` theo thứ tự.
   - `staminaEntry` đề xuất theo realm (xem `BALANCE_MODEL.md`).
3. Append `DUNGEON_LOOT[<key>]` với weight + qty range.
4. Test pass.
5. PR title: `feat(shared): dungeon <name> + N monster`.

### 4.4 Mission

1. Mở `packages/shared/src/missions.ts`.
2. Append `MISSIONS` array.
3. Reward `items[]` phải tham chiếu `itemKey` đã tồn tại.
4. `goalKind` phải nằm trong list (xem code).
5. **Lưu ý mission gameplay hook**: hiện chỉ catalog. Khi gameplay hook merged (phase 11+), mission service sẽ track progress theo `goalKind`. Trước đó, mission claim không trigger được (FE hiển thị greyed). Đảm bảo PR mission gameplay hook đi kèm khi nâng catalog mạnh.
6. PR title: `feat(shared): mission pack <theme> (+N mission)`.

### 4.5 Boss

1. Mở `packages/shared/src/boss.ts` (mở rộng) hoặc tạo `boss-catalog.ts` mới.
2. Define `BossDef`:
   ```ts
   export interface BossDef {
     key: string;
     nameVi: string;
     nameEn: string;
     level: number;
     maxHp: bigint;
     atk: number;
     def: number;
     rewardLinhThach: bigint;
     rewardItems: Array<{ itemKey: string; weight: number; qtyMin: number; qtyMax: number }>;
     spawnIntervalMin?: number;  // phase 12: auto-spawn
     regionKey?: string;          // phase 12
   }
   ```
3. Append `BOSSES` array.
4. Test pass.
5. PR title: `feat(shared): boss pack <theme> (+N boss)`.

### 4.6 Quest chain (phase 11+)

DB-backed. Process khác:

1. Tạo Prisma migration:
   ```prisma
   model Quest { ... }
   model QuestStep { ... }
   model QuestProgress { ... }
   ```
2. Migration phải có rollback note.
3. Seed file mới: `apps/api/prisma/seed-quests.ts` (idempotent).
4. Service: `quest.service.ts` track progress.
5. Test idempotency claim.
6. PR title: `feat(api): quest chain <chain-name> (+N quest +M step)`.

### 4.7 Story chapter / NPC dialogue (phase 11+)

DB-backed.

1. Migration: `StoryChapter`, `NpcDialogue`.
2. Seed file: `apps/api/prisma/seed-story.ts`.
3. NPC dialogue có thể có branching qua `nextDialogueKey` field.
4. PR title: `feat(api): story chapter <chapter-name>`.

### 4.8 Event config (phase 15)

DB-backed.

1. Admin tạo qua UI (không seed code).
2. Schema xem `LIVE_OPS_MODEL.md` §3.
3. PR là cho **infra** (model + service + admin UI), không cho từng event content.
4. Content: admin nhập qua UI.

### 4.9 Title / Achievement (phase 11+)

Static.

1. Tạo `packages/shared/src/titles.ts` + `packages/shared/src/achievements.ts`.
2. Title: `key`, `nameVi`, `nameEn`, `descriptionVi`, `descriptionEn`, `tier`, `unlockHint` (text gợi ý).
3. Achievement: `key`, `nameVi`, `nameEn`, `tier`, `goalKind`, `goalAmount`, `rewardTitle?`, `rewardLinhThach?`.
4. Achievement progress lưu DB `AchievementProgress`.
5. PR title: `feat(shared): title pack <theme>` / `feat(shared): achievement pack <theme>`.

---

## 5. NAMING CONVENTION

### 5.1 Key format

- `snake_case` ASCII only.
- KHÔNG dấu tiếng Việt (e.g. dùng `kim_dan` không `kim_đan`).
- Prefix theo loại nếu cần disambiguate:
  - Item: `<kind>_<flavor>_<tier>` (e.g. `kiem_thanh_van_linh`).
  - Skill: `<sect>_<flavor>` (e.g. `thanh_van_kiem_quyet`).
  - Monster: `<flavor>` (e.g. `huyet_lang`).
  - Dungeon: `<location>` (e.g. `son_coc`).
  - Mission: `<period>_<flavor>` (e.g. `daily_cultivate_5min`).
  - Boss: `<flavor>` (e.g. `huyet_ma_chua`).

### 5.2 VI/EN naming

- VI: Hán Việt thuần (xem `GAME_DESIGN_BIBLE.md` §A.5). Tránh tiếng Anh giữa câu.
- EN: pinyin/phiên âm cho tên riêng (e.g. "Thanh Vân" → "Thanh Van" hoặc "Azure Cloud" — quyết định theo glossary, KHÔNG ad-hoc).
- Glossary: tạo file `packages/shared/i18n-glossary.md` (phase 10) ghi mapping VI ↔ EN cho 50+ thuật ngữ tu tiên thường dùng.

### 5.3 Description style

- 2-3 câu: 1 câu flavor + 1-2 câu mechanics.
- Ví dụ tốt:
  > "Kiếm Thanh Vân — đệ nhất kiếm pháp Thanh Vân Tông. Tăng 30% sát thương kiếm khi đối thủ HP < 50%. Tiêu hao 20 MP."
- Ví dụ xấu (quá dài, không mechanics rõ):
  > "Kiếm Thanh Vân do Tổ Sư Thanh Vân tu luyện ngàn năm tạo nên, ánh sáng xanh biếc khi xuất kiếm…"

---

## 6. BALANCE GATE

Trước khi merge content PR, verify (xem `BALANCE_MODEL.md`):

### 6.1 Item

- Power tổng (atk + def + hp + spirit×0.5) không vượt **band power** cho realm tier mục tiêu (BALANCE_MODEL §3).
- Quality vs power tương xứng (PHAM ≤ 1× base, LINH ≤ 1.5×, HUYEN ≤ 2.5×, TIEN ≤ 4×, THAN ≤ 6×).
- Pill: HP/MP/EXP gain không quá 50% max của realm tương ứng.

### 6.2 Skill

- `atkScale` ≤ 5 (skill cao nhất).
- `mpCost` đủ để skill spam mỗi 2-3 lượt (không mỗi lượt).
- `selfBloodCost` ≤ 0.30 (huyết tế cap 30%).

### 6.3 Monster

- HP/atk theo curve realm: monster cho `luyenkhi-3` không nên có HP của `kim_dan-3`.
- `expDrop` đủ để 30 lần kill = 1 stage break.
- `linhThachDrop` đủ để dungeon clear = 1 dungeon clear ≈ 100 linhThach (early), 1000+ (late).

### 6.4 Dungeon

- `staminaEntry` đề xuất 10-30 (early), 30-60 (mid), 60-100 (late).
- Clear time mục tiêu: 2-5 phút (early), 5-10 phút (mid), 10-20 phút (late).

### 6.5 Mission

- Daily: hoàn thành full set 5 mission = 30-60 phút active.
- Weekly: 1 mission ≈ 1-2h active spread over week.
- Reward proportional: daily 5-10% daily linhThach gain, weekly 30-50%.

### 6.6 Boss

- HP scale theo realm tier (xem `BALANCE_MODEL.md` §6).
- Drop reward đủ để 1 lần kill ≈ 1 ngày dungeon farm.

---

## 7. SEED IDEMPOTENCY

### 7.1 Static catalog

Static = code, không cần seed. Build TS → ESM/CJS → import.

### 7.2 DB content

Mỗi DB content (Quest, Story, EventConfig) cần:

- Seed file `apps/api/prisma/seed-<content-type>.ts`.
- Idempotent: re-run seed không tạo duplicate. Dùng `upsert` với `key` unique.
- CLI: `pnpm --filter @xuantoi/api seed:<content-type>` (e.g. `seed:quests`).

Pattern:

```ts
for (const quest of QUESTS) {
  await prisma.quest.upsert({
    where: { key: quest.key },
    create: quest,
    update: { /* chỉ update mutable fields */ },
  });
}
```

KHÔNG được:

- Xoá row cũ trước seed (mất progress).
- Mutate `key` (immutable).

---

## 8. I18N FLOW

### 8.1 VI/EN parity

Mỗi content có VI + EN. Bắt buộc.

Hiện trạng: `packages/shared/src/items.ts` etc. dùng `name` (VI). Phase 10 sẽ:

1. Rename `name` → `nameVi`.
2. Add `nameEn`.
3. Cùng cho `description` → `descriptionVi` + `descriptionEn`.
4. FE consume qua `useI18n()` với fallback VI nếu EN trống.

### 8.2 Test parity

Phase 10 thêm `i18n-parity.test.ts`:

```ts
for (const item of ITEMS) {
  expect(item.nameVi).toBeTruthy();
  expect(item.nameEn).toBeTruthy();
  expect(item.descriptionVi).toBeTruthy();
  expect(item.descriptionEn).toBeTruthy();
}
```

Pattern lặp lại cho skill, monster, dungeon, mission, boss, title, achievement.

### 8.3 Glossary

`packages/shared/i18n-glossary.md` (phase 10) ghi mapping ổn định cho từ thường dùng:

| VI | EN (chính thức) | Notes |
|---|---|---|
| Tu tiên | Cultivation | — |
| Cảnh giới | Realm | — |
| Trọng (1..9) | Stage | — |
| Đột phá | Breakthrough | — |
| Tông môn | Sect | — |
| Linh thạch | Spirit Stone | — |
| Tiên ngọc | Immortal Jade | — |
| Đan dược | Pill / Elixir | — |
| Phù lục | Talisman | — |
| Trận pháp | Formation | — |
| Bí cảnh | Secret Realm | — |
| Yêu thú | Demon Beast | — |
| Thiên kiếp | Heavenly Tribulation | — |
| Tâm ma | Heart Demon | — |

(Mở rộng dần theo content scale.)

---

## 9. CONTENT REVIEW WORKFLOW

### 9.1 Pre-PR checklist

- [ ] Catalog test pass.
- [ ] Balance check vs `BALANCE_MODEL.md`.
- [ ] i18n VI + EN.
- [ ] Description style đúng.
- [ ] Key snake_case, ASCII, unique.
- [ ] Seed idempotent (nếu DB).
- [ ] Migration rollback note (nếu DB).

### 9.2 Reviewer checklist

- [ ] Power không phá curve.
- [ ] Đặt đúng nơi (static vs DB).
- [ ] Naming consistent với glossary.
- [ ] Drop weight reasonable (không 100% drop hoặc 0.001%).
- [ ] Reward idempotent (nếu có claim path).

### 9.3 Post-merge

- [ ] Cập nhật `docs/CHANGELOG.md`.
- [ ] Cập nhật `docs/AI_HANDOFF_REPORT.md` baseline test count.
- [ ] (Optional) Cập nhật `docs/SEEDING.md` nếu có new helper.

---

## 10. ADMIN CONTENT TOOLS (long-term)

Phase 15+ admin có thể:

- Tạo / chỉnh / kết thúc EventConfig.
- Tạo / revoke GiftCode (đã có).
- Gửi mail (đã có).
- (Phase 12) Override DungeonTemplate weight live.
- (Phase 16) Tune ECONOMY_DIALS qua FeatureFlag config.

KHÔNG có (cố ý):

- Admin chỉnh static catalog (item/skill/monster) live → phải qua deploy code (giữ static = invariant guarantee).
- Admin grant > X linhThach mà không cần 2nd admin approve (phase 16).

---

## 11. CHANGELOG

- **2026-04-30** — Initial creation. Author: Devin AI session 9q.
