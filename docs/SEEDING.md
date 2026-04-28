# Seeding / Static Catalog

Xuân Tôi dùng **static catalog** trong `packages/shared/src/*.ts` thay vì template table trong DB cho Item / Skill / Dungeon / Mission / Realm. Lý do:

- Không cần `prisma migrate` khi chỉ muốn chỉnh số liệu / thêm bản ghi.
- Frontend và backend cùng import một nguồn, type-safe qua TypeScript.
- `pnpm --filter @xuantoi/shared build` sinh ESM+CJS, imports tree-shakable.

DB chỉ lưu **tham chiếu** (foreign key dạng string key) + **runtime state** (inventory qty, progress, …).

## Catalog mục lục

| Loại | File | Helper |
|---|---|---|
| Realm / cảnh giới | `packages/shared/src/realms.ts` | `realmByKey()`, `expCostForStage()`, `nextRealm()`, `cultivationRateForRealm()` |
| Item | `packages/shared/src/items.ts` | `itemByKey()`, `rollDungeonLoot()` |
| Monster + Dungeon + Skill | `packages/shared/src/combat.ts` | `monsterByKey()`, `dungeonByKey()`, `skillByKey()`, `skillsForSect()` |
| Mission | `packages/shared/src/missions.ts` | `missionByKey()`, `missionsByPeriod()` |
| Boss | `packages/shared/src/boss.ts` | (model + `distributeRewards`) |

## Item catalog

30 item, cover 9 `EquipSlot` (WEAPON, ARMOR, BELT, BOOTS, HAT, TRAM, ARTIFACT_1/2/3) + pill (HP/MP/EXP) + ore + artifact.

Phẩm cấp:
- `PHAM` (phàm): cấp thấp, giá rẻ, rớt sơ cấp
- `LINH` (linh): mid-tier, từ trúc cơ / kim đan
- `HUYEN` (huyền): rớt yêu thú động, từ kim đan trở lên
- `TIEN`: drop boss đại hội (phase 7)
- `THAN`: đan thượng phẩm

Thêm item mới:
1. Append entry vào `ITEMS` array trong `items.ts`, chọn `key` snake_case duy nhất.
2. Nếu là trang bị → set `slot`, `bonuses`.
3. Nếu là đan/pill → set `effect`, `stackable: true`.
4. Thêm vào `DUNGEON_LOOT[<dungeon>]` nếu muốn rớt từ dungeon.
5. Nếu là `ItemKind` mới → mở rộng union `ItemKind`.
6. Chạy `pnpm --filter @xuantoi/shared build && pnpm --filter @xuantoi/shared test` để verify `catalog.test.ts` vẫn pass (uniqueness + slot coverage).

## Skill catalog

10 skill total: `basic_attack` (mọi sect) + 3 skill cho mỗi sect (Thanh Vân / Huyền Thuỷ / Tu La).

| Sect | Skills |
|---|---|
| Thanh Vân | `kiem_khi_chem` (1.7×), `tu_hanh_kiem_quyet` (2.6×), `van_kiem_quy_tong` (3.8× tuyệt kỹ) |
| Huyền Thuỷ | `thuy_tieu_phu` (heal 25%), `huyen_bang_khoa_tran` (debuff + heal 15%), `thanh_lien_hoan_sinh` (heal 50%) |
| Tu La | `huyet_te_chi_thuat` (2.4× + 10% blood), `tu_la_chan_that` (3.2× + 20% blood), `huyet_ma_giang_the` (4.5× + 30% blood, tuyệt kỹ) |

Thêm skill:
1. Append vào `SKILLS` trong `combat.ts` với `sect` = `thanh_van` / `huyen_thuy` / `tu_la` / `null` (universal).
2. `atkScale` > 1 tăng damage, `selfHealRatio ∈ [0,1]` hồi % HP, `selfBloodCost ∈ [0,1]` đốt % HP.
3. `mpCost` ≥ 0.
4. Test `catalog.test.ts` tự verify mỗi sect ≥ 2 exclusive + constraint ranges.

## Dungeon / Monster catalog

3 dungeon mặc định (`son_coc`, `hac_lam`, `yeu_thu_dong`) + 9 monster. Loot weight đã set trong `DUNGEON_LOOT`.

Thêm dungeon:
1. Add vào `DUNGEONS` (key, name, description, recommendedRealm, monsters[], staminaEntry).
2. Add monster mới vào `MONSTERS` nếu cần.
3. Add entry vào `DUNGEON_LOOT[<dungeon-key>]` (list `{ itemKey, weight, qtyMin, qtyMax }`).
4. Test verify monster keys resolve về `MONSTERS`.

## Mission catalog

12 mission: **5 DAILY + 4 WEEKLY + 3 ONCE**. Mỗi mission có:
- `key` (snake_case duy nhất)
- `period` (DAILY/WEEKLY/ONCE)
- `goalKind`: GAIN_EXP, CULTIVATE_SECONDS, KILL_MONSTER, CLEAR_DUNGEON, BOSS_HIT, SELL_LISTING, BUY_LISTING, CHAT_MESSAGE, SECT_CONTRIBUTE, BREAKTHROUGH
- `goalAmount` (>0)
- `rewards` (linhThach / tienNgoc / exp / congHien / items[])

**Gameplay hook** (trigger progress, claim reward) **chưa** implement — scope phase sau. PR 5c chỉ seed catalog + FE/BE share key.

Thêm mission:
1. Append vào `MISSIONS` trong `missions.ts`.
2. Reward items phải là `itemKey` đã tồn tại (catalog test verify).
3. Khi implement gameplay hook, cần:
   - DB model `MissionProgress(characterId, missionKey, amount, claimedAt, periodKey)`
   - Service `MissionService.track(characterId, goalKind, amount)` gọi từ cultivation/combat/chat/sect/market services
   - Endpoint `POST /api/mission/claim` ghi CurrencyLedger + inventory grant
   - Cron reset daily/weekly progress

## Realm catalog

28 đại cảnh giới (phamnhan → hu_khong_chi_ton), mỗi realm có 9 trọng (trừ phamnhan và hu_khong_chi_ton = 1 trọng).

Chi tiết balance EXP cost + tốc độ tu luyện: xem [`BALANCE.md`](./BALANCE.md).

## Seeding DB khi deploy

Không có `prisma db seed` script vì tất cả catalog là static in-code. Khi deploy lần đầu:

1. `pnpm --filter @xuantoi/shared build`
2. `pnpm --filter @xuantoi/api exec prisma migrate deploy`
3. `pnpm --filter @xuantoi/api start:prod`

Backend sẽ lookup catalog qua import TypeScript, không cần INSERT template.

Character khởi tạo (khi gọi `POST /api/character/onboard`) được grant:
- 1000 linh thạch
- `so_kiem` + `pham_giap` (equipped)
- realm `phamnhan` stage 1

## Kiểm tra

```bash
pnpm --filter @xuantoi/shared test  # catalog.test.ts verify integrity
pnpm --filter @xuantoi/api test     # service tests dùng itemKey/skillKey/…
pnpm typecheck                      # đảm bảo key mới được type-check
```

Khi thay đổi catalog, luôn chạy 3 lệnh này để bắt regression.
