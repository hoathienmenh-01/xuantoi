# Balance — EXP / Damage / Drop

Tài liệu cân bằng cho Xuân Tôi. Dùng để re-tune nhanh mà không phải đọc code.

## Tu luyện (Cultivation)

### Tick

- Cron `cultivation-tick` chạy mỗi **30 giây** (`CULTIVATION_TICK_MS = 30_000`).
- Mỗi tick cộng EXP cho mọi character có `cultivating = true`.
- Kèm regen stamina `+3 / tick` (cap `staminaMax`) cho **tất cả** character.

### Công thức EXP/tick

```ts
gain = cultivationRateForRealm(realmKey, CULTIVATION_TICK_BASE_EXP) + floor(spirit / 4)

cultivationRateForRealm(realmKey, base) =
  max(base, round(base * 1.45^order))
```

- `CULTIVATION_TICK_BASE_EXP = 5`
- `order` là `RealmDef.order` (phamnhan = 0 → hu_khong_chi_ton = 27).
- `spirit` là chỉ số nhân vật. Default mới = 8.

### Bảng rate theo realm (base=5, spirit=0)

| Order | Realm | Rate/tick | Per hour (120 tick) |
|---|---|---:|---:|
| 0 | phamnhan | 5 | 600 |
| 1 | luyenkhi | 7 | 840 |
| 2 | truc_co | 11 | 1,320 |
| 3 | kim_dan | 15 | 1,800 |
| 4 | nguyen_anh | 22 | 2,640 |
| 5 | hoa_than | 32 | 3,840 |
| 6 | luyen_hu | 46 | 5,520 |
| 7 | hop_the | 67 | 8,040 |
| 8 | dai_thua | 98 | 11,760 |
| 9 | do_kiep | 142 | 17,040 |
| 10 | nhan_tien | 205 | 24,600 |
| 15 | thai_at_kim_tien | 1,317 | 158,040 |
| 17 | chuan_thanh | 2,768 | 332,160 |
| 20 | dao_quan | 8,440 | 1,012,800 |
| 25 | vo_chung | 54,097 | 6,491,640 |
| 27 | hu_khong_chi_ton | 113,738 | 13,648,560 |

## EXP cost (cap) để đột phá

### Công thức

```ts
expCost(order)         = round(1000 * 1.6^order)
expCostForStage(realm, stage) = round(expCost(realm.order) * 1.4^(stage - 1))
```

- `stage` ∈ [1..9]. Stage 9 KHÔNG auto-break; cần gọi `POST /api/character/breakthrough` để qua realm kế.
- Stage 1..8 auto-break trong cùng realm nếu EXP vượt cap.

### Bảng cap stage 1 theo realm

| Order | Realm | Stage 1 cap | Tổng (all 9 stages) |
|---|---|---:|---:|
| 0 | phamnhan | 1,000 | (1 stage) |
| 1 | luyenkhi | 1,600 | ~17,500 |
| 3 | kim_dan | 4,096 | ~45,000 |
| 5 | hoa_than | 10,486 | ~115,000 |
| 10 | nhan_tien | 109,951 | ~1.2M |
| 15 | thai_at_kim_tien | 1,152,922 | ~12.6M |
| 20 | dao_quan | 12,089,258 | ~132M |
| 25 | vo_chung | 126,765,060 | ~1.4B |
| 27 | hu_khong_chi_ton | 324,518,554 | (1 stage) |

### Thời gian stage 1 (tick 30s, default spirit)

| Realm | Giờ |
|---|---:|
| phamnhan | 1.67h |
| luyenkhi | 1.90h |
| kim_dan | 2.28h |
| hoa_than | 2.73h |
| nhan_tien | 4.47h |
| chuan_thanh | 10.01h |
| dao_quan | 16.00h |
| vo_chung | 19.54h |
| hu_khong_chi_ton | 23.78h |

Test `thời gian từng realm stage 1 reachable (<24h)` verify property này. Nếu tuning giảm exponent (1.45 → 1.4) thì property có thể break → cần rerun test.

### Cách tune

- **Nhanh hơn toàn bộ**: tăng `CULTIVATION_TICK_BASE_EXP` (`packages/shared/src/ws-events.ts`). Ví dụ 5 → 10 cắt đôi mọi thời gian.
- **Chậm hơn late-game**: giảm exponent `CULTIVATION_RATE_REALM_MULT` (`packages/shared/src/realms.ts`). 1.45 → 1.40 = late-game ~gấp đôi thời gian.
- **Chậm hơn toàn bộ**: tăng cả `expCost` base (1000 → 2000, đi đôi với tăng `CULTIVATION_RATE_REALM_MULT` base).

Luôn rerun `pnpm --filter @xuantoi/shared test` sau mỗi thay đổi để đảm bảo balance property còn đúng.

## Combat

### Damage formula

```ts
damage = max(1, round((atk * scale - def * 0.5) * (0.85..1.15)))
```

- `atk`, `def` là từ Character + equip bonuses.
- `scale` là `atkScale` của skill (basic = 1.0).
- Variance ±15% mỗi đòn.

### Stamina

- `STAMINA_PER_ACTION = 5` (trừ khi combat action).
- `STAMINA_REGEN_PER_TICK = 3` (cộng mỗi tick cultivation).
- Cap `staminaMax` (default 100).

### Dungeon entry

Mỗi dungeon có `staminaEntry`:

| Dungeon | Realm đề nghị | Stamina |
|---|---|---:|
| son_coc | luyenkhi | 10 |
| hac_lam | truc_co | 18 |
| yeu_thu_dong | kim_dan | 28 |

## Drop rate

`rollDungeonLoot(dungeonKey, count=2)` chọn `count` entry từ `DUNGEON_LOOT[dungeonKey]` theo weight.

Xem bảng weight chi tiết trong `packages/shared/src/items.ts`. Ví dụ `son_coc`:

| Item | Weight | Qty |
|---|---:|---|
| so_kiem | 8 | 1 |
| pham_giap | 8 | 1 |
| huyet_chi_dan | 30 | 1-3 |
| linh_lo_dan | 12 | 1-2 |

Total weight 58 → `huyet_chi_dan` drop rate = 30/58 ≈ 52%/lần roll.

## Boss (World Boss, phase 7)

Xem `packages/shared/src/boss.ts` — balance ngoài scope file này. Distribute rewards top1 / top2-3 / top4-10 theo `bossList.ts` (không có trong repo hiện tại; sẽ seed phase sau).

## Currency

- `linhThach` (BigInt) — tiêu trong Market, Sect contribute, Dungeon entry (future), Skill upgrade (future).
- `tienNgoc` (Int) — mua bằng Topup + Admin grant. Dùng premium features.
- Mọi mutation đi qua `CurrencyService.add/subtract/transfer` ghi `CurrencyLedger` (PR #14).

## Test matrix

| Test | File | Verify |
|---|---|---|
| Balance property | `realms.test.ts` | ≤24h/stage 1, rate đơn điệu |
| Item slot coverage | `catalog.test.ts` | 9 EquipSlot có ≥ 1 item |
| Mission reward consistency | `catalog.test.ts` | Reward itemKey resolve được |
| Cultivation tick | `cultivation.processor.test.ts` | Gain chính xác, auto-break |
| Combat damage | `combat.service.test.ts` | Formula + loot grant |

Chạy `pnpm test` trước mỗi PR tuning.
