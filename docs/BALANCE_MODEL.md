# Xuân Tôi — Balance Model

> **Status**: Long-term balance blueprint (curve, dial, formula).
> Source of truth cho **runtime số liệu hiện tại** là code @ `packages/shared/src/*.ts` + `apps/api/src/modules/*/{*.service,*.processor}.ts` + `docs/BALANCE.md`.
> File này = blueprint dài hạn + tuning rationale; file `BALANCE.md` = bảng tra hiện tại theo code.
> Sister docs: [`GAME_DESIGN_BIBLE.md`](./GAME_DESIGN_BIBLE.md), [`ECONOMY_MODEL.md`](./ECONOMY_MODEL.md), [`CONTENT_PIPELINE.md`](./CONTENT_PIPELINE.md).

Mục tiêu: bất kỳ ai (dev, AI, designer) trước khi chỉnh số (item bonus, skill scale, drop weight, EXP cost, …) phải đọc file này để biết **curve** + **constraint** + **lý do tại sao số đó là số đó**.

---

## 1. NGUYÊN TẮC CHỈNH SỐ

### 1.1 Số liệu = data, không phải code

- Mọi "magic number" balance phải là `const` trong file dedicated, không scatter trong service.
- Nếu nhiều magic number bị lặp → consolidate vào `packages/shared/src/balance-dials.ts` (phase 11).

### 1.2 Tuning theo curve, không theo cảm giác

- Mỗi chỉnh số phải reference 1 curve hoặc 1 invariant.
- Ví dụ tốt: "Tăng `expDrop` của `son_thu_lon` từ 12 → 15 vì thời gian D1 lên `luyenkhi-3` đang chậm 30% so với target 45 phút."
- Ví dụ xấu: "Cảm giác monster này weak quá, tăng HP."

### 1.3 Curve không vỡ retroactive

- Tăng power item LINH-tier → phải verify TIEN/THAN không bị vô nghĩa.
- Giảm cost dungeon → phải verify economy `linhThach` không lạm phát.

### 1.4 Trước khi merge

- Update bảng tra trong `docs/BALANCE.md` (auto-generated TODO phase 11) hoặc `BALANCE_MODEL.md` §3-§7.
- Add 1 unit test với invariant curve check (xem §10 test pattern).

---

## 2. CULTIVATION CURVE

### 2.1 Tick + EXP/tick

Code: `apps/api/src/modules/cultivation/cultivation.processor.ts` + `packages/shared/src/realms.ts` `cultivationRateForRealm`.

```
CULTIVATION_TICK_MS = 30_000  // 30s/tick
CULTIVATION_TICK_BASE_EXP = 5
gain = max(base, round(base * 1.45^order)) + floor(spirit / 4)
```

`order` ∈ [0..27] cho 28 realm.

### 2.2 EXP cost (cap)

```
expCost(order) = round(1000 * 1.6^order)        // stage 1 cap
expCostForStage(realm, stage) = round(expCost(realm.order) * 1.4^(stage - 1))
```

### 2.3 Time-to-realm target (D1 active 1h liên tục)

| Realm | Stage 1 cap | EXP/h (default spirit=8) | Time-to-stage 1 |
|---|---:|---:|---:|
| phamnhan | 1,000 | ~840 | 1.2 h |
| luyenkhi | 1,600 | ~960 | 1.7 h |
| truc_co | ~2,560 | ~1,440 | 1.8 h |
| kim_dan | ~4,096 | ~2,040 | 2.0 h |
| nguyen_anh | ~6,554 | ~2,880 | 2.3 h |
| hoa_than | ~10,486 | ~4,080 | 2.6 h |

Target curve: time-to-realm tăng dần nhưng không quá 4× giữa 2 realm liền kề.

### 2.4 Tunable dial (long-term)

| Dial | File | Hiện tại | Range tunable |
|---|---|---|---|
| `CULTIVATION_TICK_MS` | env / code | 30_000 | 10_000..60_000 (tick frequency) |
| `CULTIVATION_TICK_BASE_EXP` | code | 5 | 3..10 (early game speed) |
| Realm rate scale `1.45^order` | `realms.ts` | 1.45 | 1.3..1.6 (steepness) |
| Cap formula `1000 * 1.6^order` | `realms.ts` | 1.6 | 1.4..1.8 (late-game grind) |

**KHÔNG được** hardcode override 1 realm cụ thể (e.g. "luyenkhi rate × 2") — phá monotonic curve.

### 2.5 Buff multiplier (phase 11)

Khi thêm:

- Linh căn: 1.0..1.5× cultivation rate.
- Cultivation method: 1.0..1.3× cultivation rate.
- Sect aura: 1.0..1.2× cultivation rate.
- Pill `tu_vi_dan`: 1.5× cultivation rate trong 1h.

**Stack rule**: multiplicative cap 2.5× tổng (dial). Vượt → cap.

---

## 3. POWER CURVE

### 3.1 Power formula

Hiện trạng (gần đúng):

```
power = base.power + sum(equip.bonuses.atk)
```

Phase 11 chuẩn hoá:

```
power = base.power
       + spirit * 0.5
       + sum(equip.bonuses.atk)
       + cultivationMethod.atkBonus
       + skill.atkBonus            // passive bonus
       + title.atkBonus            // 0 vì cosmetic-only
realmTierMultiplier = 1.0 + (RealmTier.indexOf(realm.tier)) * 0.15
finalPower = round(power * realmTierMultiplier)
```

### 3.2 Power band per realm

Power band = expected power **không trang bị TIEN/THAN** ở realm tương ứng.

| Realm tier | Realm range | Expected power band (no rare) |
|---|---|---:|
| pham (1) | luyenkhi 1-9 | 50..200 |
| pham (2) | truc_co | 200..400 |
| pham (3) | kim_dan | 400..800 |
| pham (4) | nguyen_anh | 800..1,500 |
| pham (5) | hoa_than | 1,500..3,000 |
| pham (6) | luyen_hu | 3,000..6,000 |
| pham (7-10) | hop_the → do_kiep | 6k..50k |
| nhan_tien | nhan_tien → thien_tien | 50k..500k |
| tien_gioi | huyen_tien → chuan_thanh | 500k..10M |
| hon_nguyen+ | thanh_nhan+ | 10M..200M+ |

**Item TIEN/THAN equip có thể boost power lên 2-4× band**, nhưng không vượt band của realm tier kế trên.

### 3.3 Item power budget

| Quality | Max bonus.atk per item | Max bonus.def | Max bonus.hpMax | Max bonus.spirit |
|---|---:|---:|---:|---:|
| PHAM | 10 (luyenkhi-tier) | 8 | 30 | 5 |
| LINH | 25 (truc_co/kim_dan) | 20 | 80 | 12 |
| HUYEN | 60 (kim_dan/nguyen_anh) | 50 | 200 | 30 |
| TIEN | 200 (hoa_than/luyen_hu) | 160 | 800 | 100 |
| THAN | 800 (do_kiep+) | 600 | 3000 | 350 |

**Multi-stat item**: tổng power-equiv ≤ Σ(stat × weight) trong đó weight = atk:1, def:0.8, hpMax:0.05, spirit:1.5.

Ví dụ: TIEN weapon `bonus.atk = 200` → OK. TIEN amulet `bonus.atk = 100, def = 80, spirit = 60` → power-equiv = 100 + 80*0.8 + 60*1.5 = 100 + 64 + 90 = 254 → vượt 200 budget? Tuỳ rule. Đề xuất phase 11 áp budget mềm 1.2× cho off-slot, 1.0× cho weapon main slot.

### 3.4 Set bonus (phase 12)

4-piece set: bonus tổng ≤ 30% power band realm tương ứng.
6-piece set: ≤ 60%.
Không chồng nhiều set cùng lúc (1 character chỉ active 1 set).

---

## 4. COMBAT FORMULA

### 4.1 Damage

Hiện trạng:

```
damage = max(1, atk * (1 + skillBonus) - def * 0.5) * rand(0.85..1.15)
```

`skillBonus` = `skill.atkScale - 1` (e.g. atkScale 2.6 → bonus 1.6).

### 4.2 Phase 11 mở rộng

```
damage = max(1, atk * skill.atkScale - def * 0.5)
         * elementMultiplier(skill.element, target.element)  // 0.7..1.3
         * critMultiplier(roll, character.luck)              // 1.0 or 1.5..2.0
         * rand(0.85..1.15)
```

`elementMultiplier`: phase 11 thêm element kim/mộc/thuỷ/hoả/thổ vs hệ thống tu La huyết tế.
`critMultiplier`: roll 1-100 ≤ critChance(luck) → ×1.5..2.0.

### 4.3 Skill cooldown

Phase 11 thêm `cooldownTurns: Int @default(0)` cho skill. Active skill có cooldown:
- Skill thường: 0-2 turns.
- Skill mạnh: 2-4 turns.
- Tuyệt kỹ: 4-6 turns.

Logic combat: skill in cooldown → reject (combat service raise error).

### 4.4 Skill MP cost

```
mpCost <= floor(0.4 * mpMax)  // không skill nào tốn > 40% mpMax
```

### 4.5 Self-heal & blood-cost

Hiện trạng:
- `selfHealRatio ∈ [0, 0.5]` (heal max 50% HP/lượt).
- `selfBloodCost ∈ [0, 0.30]` (huyết tế tốn max 30% HP/lượt).

Curve giữ nguyên phase 11. Cap không tăng.

---

## 5. DUNGEON & DROP CURVE

### 5.1 Stamina entry

| Realm tier (gợi ý) | staminaEntry |
|---|---:|
| pham early (luyenkhi) | 10 |
| pham mid (truc_co/kim_dan) | 20-30 |
| pham late (nguyen_anh+) | 40-60 |
| nhan_tien | 60-80 |
| tien_gioi+ | 80-100 (cap, vì staminaMax = 100 default) |

**Long-term**: staminaMax có thể grow theo physique/realm. Phase 12 evaluate.

### 5.2 Dungeon clear time

Target:
- Early: 2-5 phút (3-5 monster, mỗi monster 5-8 turn).
- Mid: 5-10 phút (5-8 monster).
- Late: 10-20 phút (boss-encounter mid-dungeon).

Nếu clear time vượt target → giảm HP monster hoặc thêm pill HP/MP drop.

### 5.3 Drop curve

Per dungeon clear (full 100% kill chain):

| Tier | Linh thạch drop range | Item drop xác suất |
|---|---:|---|
| Early (son_coc, luyenkhi) | 50-150 | 70% PHAM, 25% LINH, 5% HUYEN |
| Mid (hac_lam, truc_co) | 200-600 | 50% PHAM, 35% LINH, 14% HUYEN, 1% TIEN |
| Mid-late (yeu_thu_dong, kim_dan) | 600-1,500 | 30% PHAM, 40% LINH, 25% HUYEN, 4.5% TIEN, 0.5% THAN |
| Late (phase 10 mới) | 2k..10k | 20% PHAM, 30% LINH, 35% HUYEN, 14% TIEN, 1% THAN |

### 5.4 Drop weight registry

`packages/shared/src/combat.ts` `DUNGEON_LOOT[<key>] = [{ itemKey, weight, qtyMin, qtyMax }, ...]`.

Sum of `weight` không cần = 100; helper `rollDungeonLoot` tự normalize.

Verify pattern (xem `items-dungeon-loot.test.ts`):
- Mỗi entry tham chiếu itemKey hợp lệ.
- Không weight = 0.
- qtyMin ≤ qtyMax.

---

## 6. BOSS CURVE

### 6.1 Boss HP per tier

| Tier | maxHp |
|---|---:|
| Sect-level (phase 13) | 100k..500k |
| World pham | 1M..10M |
| World nhan_tien | 10M..100M |
| World tien_gioi | 100M..1B |
| World hon_nguyen+ | 1B+ (BigInt) |

### 6.2 Boss reward distribute

Hiện tại: linhThach distribute theo % damage. Phase 12 mở rộng:

```
shareRatio = damage[char] / sum(damage[*])
linhThachReward = floor(boss.rewardLinhThach * shareRatio)
itemRoll = rollWithWeight(boss.rewardItems, shareRatio)
```

Top 10 damager guarantee 1 item drop. Bottom 90% probabilistic.

### 6.3 Boss spawn cadence (phase 12)

| Boss tier | Spawn interval | Active duration |
|---|---|---|
| Sect boss | 6h | 2h |
| World pham | 3h | 1h |
| World nhan_tien | 6h | 2h |
| World tien_gioi | 12h | 3h |
| World hon_nguyen+ | 24h | 6h |
| Event boss | manual | event duration |

---

## 7. MISSION REWARD CURVE

### 7.1 Daily mission reward target

Target: 1 character D1-D7 hoàn thành full daily set = 50% daily linhThach gain.

| Realm tier | Daily linhThach gain (cultivation+dungeon) | Mission daily reward total | Per mission |
|---|---:|---:|---:|
| luyenkhi | ~5k | ~2.5k | 500/mission × 5 |
| truc_co | ~15k | ~7.5k | 1.5k/mission × 5 |
| kim_dan | ~40k | ~20k | 4k/mission × 5 |
| nguyen_anh | ~100k | ~50k | 10k/mission × 5 |

### 7.2 Weekly mission

Tổng = 2-3× daily total. Distributed over 4-5 mission.

### 7.3 Once mission (story / milestone)

Reward boost lớn (2-5× daily total) vì 1 lần. Set theo milestone.

---

## 8. ECONOMY EQUILIBRIUM (long-term)

### 8.1 Daily linhThach in/out target

Per active player:
- IN: cultivation 30% + dungeon 50% + mission 15% + boss 5%.
- OUT: market buy 30% + refine 25% + repair 5% + alchemy 10% + sect donate 20% + savings 10%.

Nếu 1 source > 60% IN → unhealthy, cần rebalance.

### 8.2 Market price band default

| Item quality | Min price (linhThach/unit) | Max price |
|---|---:|---:|
| PHAM | 10 | 1,000 |
| LINH | 100 | 10,000 |
| HUYEN | 1,000 | 100,000 |
| TIEN | 10,000 | 5,000,000 |
| THAN | 100,000 | 50,000,000 |

Phase 16 áp dụng `MARKET_PRICE_BAND[itemKey]` override per-item.

### 8.3 Topup pack pricing

Hiện tại: `packages/shared/src/topup.ts`. Các dial:
- Pack 1: 10k VND → ? tienNgoc. Ratio tunable theo monetization policy.
- Bonus pack đầu tiên (first-buy bonus) cap 50% gia trị.

**KHÔNG được** dial topup mà không thông qua user/PM (real-money).

---

## 9. BALANCE DIAL REGISTRY (proposed phase 11)

File: `packages/shared/src/balance-dials.ts` (mới).

```ts
export const BALANCE_DIALS = {
  // Cultivation
  CULTIVATION_TICK_MS: 30_000,
  CULTIVATION_TICK_BASE_EXP: 5,
  CULTIVATION_RATE_SCALE: 1.45,         // realm scale exponent base
  CULTIVATION_BUFF_CAP: 2.5,            // multiplier cap khi stack buff

  // Realm cost
  REALM_COST_BASE: 1000,
  REALM_COST_SCALE: 1.6,
  STAGE_COST_SCALE: 1.4,

  // Combat
  COMBAT_RNG_LOW: 0.85,
  COMBAT_RNG_HIGH: 1.15,
  COMBAT_MIN_DAMAGE: 1,
  COMBAT_DEF_FACTOR: 0.5,

  // Stamina
  STAMINA_REGEN_PER_TICK: 3,
  STAMINA_MAX_DEFAULT: 100,

  // Drop
  DROP_RNG_SEED_MODE: 'time',  // 'time' | 'deterministic' (test mode)

  // Economy
  MARKET_TAX_DEFAULT: 0.05,
  REWARD_CAP_LINH_THACH_DAILY_BY_REALM: {
    luyenkhi: BigInt(50_000),
    truc_co: BigInt(150_000),
    // ...
  },
} as const;
```

Override:
1. Static default (file).
2. Env override (e.g. `XT_CULTIVATION_TICK_MS=20000`).
3. Admin live override (FeatureFlag — phase 15).

**KHÔNG được** chỉnh dial trực tiếp trong service code. Mọi service import từ `BALANCE_DIALS`.

---

## 10. TEST PATTERN

### 10.1 Curve invariant test

```ts
// packages/shared/src/realms.test.ts (mở rộng)
it('cultivation rate is monotonic across realms', () => {
  let prev = 0;
  for (const realm of REALMS) {
    const rate = cultivationRateForRealm(realm.key, 5);
    expect(rate).toBeGreaterThanOrEqual(prev);
    prev = rate;
  }
});

it('expCost(order) is monotonic', () => {
  for (let i = 0; i < REALMS.length - 1; i++) {
    expect(expCost(REALMS[i + 1].order)).toBeGreaterThan(expCost(REALMS[i].order));
  }
});
```

### 10.2 Power band test (phase 11)

```ts
it('item power-equiv stays within quality budget', () => {
  for (const item of ITEMS) {
    const equiv = computePowerEquiv(item);
    expect(equiv).toBeLessThanOrEqual(QUALITY_POWER_BUDGET[item.quality]);
  }
});
```

### 10.3 Drop weight integrity

Đã có `items-dungeon-loot.test.ts`. Mở rộng phase 10:

```ts
it('drop weight produces no entry > 80% probability', () => {
  for (const [dungeonKey, entries] of Object.entries(DUNGEON_LOOT)) {
    const total = sum(entries.map(e => e.weight));
    const maxRatio = max(entries.map(e => e.weight / total));
    expect(maxRatio).toBeLessThanOrEqual(0.8);  // tránh 1 item dominate drop
  }
});
```

### 10.4 Reward gain estimate test (phase 12)

```ts
it('estimated daily linhThach gain per realm is in target band', () => {
  // simulate 24h cultivation + 50 dungeon clear + full daily mission
  const sim = simulateDailyEconomy('kim_dan');
  expect(sim.linhThachIn).toBeGreaterThan(20_000n);
  expect(sim.linhThachIn).toBeLessThan(80_000n);
});
```

### 10.5 `pnpm test:balance` script (phase 11)

Phase 11 thêm script tổng:

```json
"scripts": {
  "test:balance": "pnpm --filter @xuantoi/shared test -- balance"
}
```

Run trước mỗi PR content scale.

---

## 11. HISTORICAL DECISIONS

### 11.1 Tại sao realm rate scale 1.45^order?

- Realm tier giữa (kim_dan-nguyen_anh) phải mất 2-3 ngày active để break.
- Realm tier cao (do_kiep+) phải mất 1+ tuần để break — điểm đến dài hạn.
- 1.45 cho slope vừa phải. Thử 1.6 → quá steep, người chơi thấy "luyenkhi vô nghĩa".
- Thử 1.3 → quá flat, late-game không có cảm giác mạnh lên.

### 11.2 Tại sao tick 30s thay vì 60s?

- 30s đủ ngắn để cảm giác "cộng EXP đều" nhưng không tạo CPU spike.
- Cron BullMQ chạy mỗi 30s scan tất cả `cultivating: true` character.
- Nếu DAU lớn (>10k) → chuyển sang per-character cron hoặc sharding (phase 17).

### 11.3 Tại sao 9 trọng (stage)?

- "Cửu trọng" là motif tu tiên cổ. Số 9 phù hợp văn hoá.
- 9 stage cho mỗi realm = 9 mốc nhỏ trong 1 mốc lớn → cảm giác progression liên tục.
- Phamnhan + hu_khong_chi_ton: 1 stage vì 2 cái này boundary (vào game / endgame).

### 11.4 Tại sao 5 quality (PHAM..THAN)?

- 5 = đủ phân tier mà không quá nhiều slot UI.
- Tăng thành 7-8 (e.g. thêm "huyền cao", "tiên cao") khi phase 12+ nếu cần.

### 11.5 Tại sao `linhThach` BigInt mà `tienNgoc` Int?

- linhThach: late-game cộng triệu/h → vài tỷ trong 1 tháng → vượt Int32 max (2.1 tỷ).
- tienNgoc: nạp tay, không tự sinh nhanh → Int đủ cho cap thực tế.

---

## 12. CHANGELOG

- **2026-04-30** — Initial creation. Author: Devin AI session 9q.
