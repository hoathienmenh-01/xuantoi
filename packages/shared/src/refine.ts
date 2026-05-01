/**
 * Catalog refine (Luyện khí) — Phase 11.5.A.
 *
 * Refine = nâng cấp trang bị (weapon/armor/...) qua 15 cấp:
 *   - Level 0 = baseline (không refine).
 *   - Level 1..15 = thêm `statMultiplier` lên `bonuses` của ItemDef.
 *
 * 3 stage:
 *   - **safe** (L1..L5): success rate cao (95% → 75%), fail = no_loss (mất material thôi).
 *   - **risky** (L6..L10): success rate trung bình (60% → 30%), fail = level_minus_one (rớt 1 cấp).
 *   - **extreme** (L11..L15): success rate thấp (20% → 5%), fail = level_minus_one_or_break
 *     (rớt 1 cấp hoặc break — runtime quyết định break% theo `extremeBreakChance`).
 *
 * Material:
 *   - L1..L5 dùng `tinh_thiet` (LINH ore).
 *   - L6..L10 dùng `yeu_dan` (HUYEN ore).
 *   - L11..L15 dùng `han_ngoc` (TIEN ore).
 *
 * Phase 11.5.A = catalog-only — KHÔNG runtime hook, KHÔNG schema migration.
 * Phase 11.5.B sẽ thêm `Equipment.refineLevel: Int @default(0)` + service
 * `refineEquipment(characterId, equipmentId, useProtection)` qua ItemLedger
 * + wire `getRefineStatMultiplier` vào `CharacterStatService.computeStats`.
 *
 * Rule:
 *   - Server-authoritative — server roll RNG (deterministic seed per attempt).
 *   - Idempotency: mỗi attempt = 1 ledger entry (atomic).
 *   - Protection charm: consume on fail to prevent level loss / break.
 */

/**
 * Stage refine — gating success-rate + failure-consequence.
 */
export type RefineStage = 'safe' | 'risky' | 'extreme';

export const REFINE_STAGES: readonly RefineStage[] = ['safe', 'risky', 'extreme'] as const;

/**
 * Hành vi khi refine fail.
 *
 * - `no_loss`: mất material + linh thạch, KHÔNG rớt cấp. Stage `safe`.
 * - `level_minus_one`: rớt 1 cấp (current → current - 1). Stage `risky`.
 * - `level_minus_one_or_break`: hoặc rớt 1 cấp HOẶC equipment break (mất hẳn).
 *   Stage `extreme`. Chance break do `extremeBreakChance` quyết định
 *   (catalog field; runtime roll riêng sau khi đã miss success).
 */
export type RefineFailureBehavior =
  | 'no_loss'
  | 'level_minus_one'
  | 'level_minus_one_or_break';

/**
 * Refine level cap (0 = baseline, 1..15 = các cấp refine).
 */
export const REFINE_MAX_LEVEL = 15;

/**
 * Định nghĩa per-level cho refine attempt từ `level - 1` lên `level`.
 *
 * - `level`: target level (1..15).
 * - `stage`: nhóm theo level range.
 * - `successRate`: 0..1 — chance refine thành công (current → target).
 * - `linhThachCost`: cost mỗi attempt (cả khi fail). Geometric.
 * - `materialKey`: itemKey của material consume mỗi attempt.
 * - `materialQty`: qty consume mỗi attempt.
 * - `statMultiplier`: hệ số nhân lên `ItemBonus` của trang bị tại cấp này
 *   (level 0 = 1.0; cumulative — cấp 15 ~ 3.5×).
 * - `failureBehavior`: xử lý khi fail.
 * - `extremeBreakChance`: 0..1 — chỉ áp dụng `extreme` stage; chance break
 *   sau khi miss success (else fall back về `level_minus_one`).
 */
export interface RefineLevelDef {
  level: number;
  stage: RefineStage;
  successRate: number;
  linhThachCost: number;
  materialKey: string;
  materialQty: number;
  statMultiplier: number;
  failureBehavior: RefineFailureBehavior;
  extremeBreakChance: number;
}

/**
 * Build deterministic refine curve.
 *
 * Layered:
 *   - safe (L1..L5):  success 0.95 → 0.75 (decrease 0.05/level).
 *   - risky (L6..L10): success 0.60 → 0.30 (decrease 0.075/level, with rounding).
 *   - extreme (L11..L15): success 0.20 → 0.05 (decrease 0.0375/level).
 */
function stageOf(level: number): RefineStage {
  if (level <= 5) return 'safe';
  if (level <= 10) return 'risky';
  return 'extreme';
}

function successRateOf(level: number): number {
  if (level <= 5) {
    // L1..L5: 0.95, 0.90, 0.85, 0.80, 0.75
    return 0.95 - (level - 1) * 0.05;
  }
  if (level <= 10) {
    // L6..L10: 0.60, 0.525, 0.45, 0.375, 0.30
    return 0.60 - (level - 6) * 0.075;
  }
  // L11..L15: 0.20, 0.1625, 0.125, 0.0875, 0.05
  return 0.20 - (level - 11) * 0.0375;
}

function linhThachCostOf(level: number): number {
  // Geometric ~1.6x per level, anchored 100 LinhThach at L1.
  // L1=100, L5≈655, L10≈6872, L15≈72076.
  return Math.round(100 * Math.pow(1.6, level - 1));
}

function materialKeyOf(stage: RefineStage): string {
  switch (stage) {
    case 'safe':
      return 'tinh_thiet';
    case 'risky':
      return 'yeu_dan';
    case 'extreme':
      return 'han_ngoc';
  }
}

function materialQtyOf(level: number): number {
  // Per-stage flat: safe 1, risky 2, extreme 3 ore per attempt.
  const stage = stageOf(level);
  if (stage === 'safe') return 1;
  if (stage === 'risky') return 2;
  return 3;
}

function statMultiplierOf(level: number): number {
  // Cumulative; +0.10/level safe, +0.15/level risky, +0.20/level extreme.
  // L0=1.00, L5=1.50, L10=2.25, L15=3.25.
  if (level === 0) return 1.0;
  let mult = 1.0;
  for (let lv = 1; lv <= level; lv++) {
    const stg = stageOf(lv);
    if (stg === 'safe') mult += 0.10;
    else if (stg === 'risky') mult += 0.15;
    else mult += 0.20;
  }
  // Round to 2 decimals (avoid float drift).
  return Math.round(mult * 100) / 100;
}

function failureBehaviorOf(stage: RefineStage): RefineFailureBehavior {
  if (stage === 'safe') return 'no_loss';
  if (stage === 'risky') return 'level_minus_one';
  return 'level_minus_one_or_break';
}

function extremeBreakChanceOf(level: number): number {
  if (stageOf(level) !== 'extreme') return 0;
  // L11=0.10, L12=0.15, L13=0.20, L14=0.30, L15=0.40.
  const idx = level - 11;
  return [0.10, 0.15, 0.20, 0.30, 0.40][idx];
}

/**
 * REFINE_LEVELS: readonly catalog 15 cấp.
 */
export const REFINE_LEVELS: readonly RefineLevelDef[] = Array.from({ length: REFINE_MAX_LEVEL }, (_, i) => {
  const level = i + 1;
  const stage = stageOf(level);
  return {
    level,
    stage,
    successRate: successRateOf(level),
    linhThachCost: linhThachCostOf(level),
    materialKey: materialKeyOf(stage),
    materialQty: materialQtyOf(level),
    statMultiplier: statMultiplierOf(level),
    failureBehavior: failureBehaviorOf(stage),
    extremeBreakChance: extremeBreakChanceOf(level),
  };
});

/**
 * Optional protection charm — consume on fail to prevent level loss / break.
 *
 * Phase 11.5.A catalog-only (item key chưa add vào ITEMS). Phase 11.5.B sẽ
 * add item `refine_protection_charm` (HUYEN MISC consumable) + wire vào
 * runtime service.
 */
export const REFINE_PROTECTION_ITEM_KEY = 'refine_protection_charm';

/**
 * Lookup refine level def. Throws nếu level out-of-range.
 */
export function getRefineLevelDef(level: number): RefineLevelDef {
  if (!Number.isInteger(level) || level < 1 || level > REFINE_MAX_LEVEL) {
    throw new Error(`refine level out of range: ${level} (must be 1..${REFINE_MAX_LEVEL})`);
  }
  return REFINE_LEVELS[level - 1];
}

/**
 * Cost preview cho 1 attempt từ `currentLevel` → `currentLevel + 1`.
 * Throws nếu currentLevel out-of-range (0..14).
 */
export function getRefineAttemptCost(currentLevel: number): {
  linhThachCost: number;
  materialKey: string;
  materialQty: number;
} {
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= REFINE_MAX_LEVEL) {
    throw new Error(
      `refine current level out of range: ${currentLevel} (must be 0..${REFINE_MAX_LEVEL - 1})`,
    );
  }
  const def = getRefineLevelDef(currentLevel + 1);
  return {
    linhThachCost: def.linhThachCost,
    materialKey: def.materialKey,
    materialQty: def.materialQty,
  };
}

/**
 * Stat multiplier cho equipment ở `level`. Level 0 = baseline (1.0).
 * Throws nếu level out-of-range (0..15).
 */
export function getRefineStatMultiplier(level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > REFINE_MAX_LEVEL) {
    throw new Error(`refine level out of range: ${level} (must be 0..${REFINE_MAX_LEVEL})`);
  }
  if (level === 0) return 1.0;
  return REFINE_LEVELS[level - 1].statMultiplier;
}

/**
 * Filter REFINE_LEVELS theo stage.
 */
export function refineLevelsByStage(stage: RefineStage): readonly RefineLevelDef[] {
  return REFINE_LEVELS.filter((d) => d.stage === stage);
}

/**
 * Total cost preview để refine từ `fromLevel` lên `toLevel` GIẢ ĐỊNH thành công 100% (no fail).
 * Dùng cho UI preview "best-case" / planning calculator.
 *
 * Returns sum của linhThach + materialQty grouped by materialKey.
 * Throws nếu range invalid.
 */
export function getRefinePathCostMin(fromLevel: number, toLevel: number): {
  linhThachCost: number;
  materials: Record<string, number>;
  attempts: number;
} {
  if (!Number.isInteger(fromLevel) || fromLevel < 0 || fromLevel >= REFINE_MAX_LEVEL) {
    throw new Error(`fromLevel out of range: ${fromLevel} (must be 0..${REFINE_MAX_LEVEL - 1})`);
  }
  if (!Number.isInteger(toLevel) || toLevel <= fromLevel || toLevel > REFINE_MAX_LEVEL) {
    throw new Error(
      `toLevel out of range: ${toLevel} (must be ${fromLevel + 1}..${REFINE_MAX_LEVEL})`,
    );
  }
  let linhThachCost = 0;
  const materials: Record<string, number> = {};
  for (let lv = fromLevel + 1; lv <= toLevel; lv++) {
    const def = REFINE_LEVELS[lv - 1];
    linhThachCost += def.linhThachCost;
    materials[def.materialKey] = (materials[def.materialKey] ?? 0) + def.materialQty;
  }
  return {
    linhThachCost,
    materials,
    attempts: toLevel - fromLevel,
  };
}

/**
 * Kết quả 1 attempt refine.
 *
 * - `success`: roll < successRate.
 * - `nextLevel`: level sau attempt (success → +1; fail safe → no change;
 *   fail risky → -1; fail extreme + break → -1; fail extreme + no-break → -1).
 * - `broken`: chỉ true khi extreme stage fail + miss break-roll.
 * - `protectionConsumed`: true nếu hasProtection + fail (protection cứu).
 */
export interface RefineAttemptResult {
  success: boolean;
  nextLevel: number;
  broken: boolean;
  protectionConsumed: boolean;
}

/**
 * Simulate 1 refine attempt deterministically (server roll).
 *
 * @param currentLevel current refine level (0..14)
 * @param rng deterministic RNG source (returns [0, 1)). Phase 11.5.B sẽ
 *   wire `seedrandom(attemptId)` để replay-able. Vitest pass `() => 0.123` ...
 * @param opts.hasProtection nếu true, fail consume protection thay vì áp
 *   `failureBehavior` lên equipment (trừ break — break luôn xảy ra nếu đã
 *   miss break-roll, protection chỉ bảo vệ level-loss).
 *
 * Server-authoritative — KHÔNG cho client gọi.
 */
export function simulateRefineAttempt(
  currentLevel: number,
  rng: () => number,
  opts?: { hasProtection?: boolean },
): RefineAttemptResult {
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel >= REFINE_MAX_LEVEL) {
    throw new Error(
      `simulateRefineAttempt currentLevel out of range: ${currentLevel} (must be 0..${REFINE_MAX_LEVEL - 1})`,
    );
  }
  const def = REFINE_LEVELS[currentLevel];
  const successRoll = rng();
  const success = successRoll < def.successRate;
  if (success) {
    return {
      success: true,
      nextLevel: currentLevel + 1,
      broken: false,
      protectionConsumed: false,
    };
  }
  // Fail path
  const hasProtection = opts?.hasProtection === true;
  if (def.failureBehavior === 'no_loss') {
    // Safe stage — no level loss. Protection unused (nothing to protect).
    return {
      success: false,
      nextLevel: currentLevel,
      broken: false,
      protectionConsumed: false,
    };
  }
  if (def.failureBehavior === 'level_minus_one') {
    // Risky stage — level -1 unless protection.
    if (hasProtection) {
      return {
        success: false,
        nextLevel: currentLevel,
        broken: false,
        protectionConsumed: true,
      };
    }
    return {
      success: false,
      nextLevel: Math.max(0, currentLevel - 1),
      broken: false,
      protectionConsumed: false,
    };
  }
  // extreme stage — level_minus_one_or_break
  const breakRoll = rng();
  const broken = breakRoll < def.extremeBreakChance;
  if (broken) {
    // Protection KHÔNG cứu break (extreme intent: high-risk-high-reward).
    return {
      success: false,
      nextLevel: 0,
      broken: true,
      protectionConsumed: false,
    };
  }
  // Extreme fail without break = level -1 (protection cứu).
  if (hasProtection) {
    return {
      success: false,
      nextLevel: currentLevel,
      broken: false,
      protectionConsumed: true,
    };
  }
  return {
    success: false,
    nextLevel: Math.max(0, currentLevel - 1),
    broken: false,
    protectionConsumed: false,
  };
}
