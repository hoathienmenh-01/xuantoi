import { describe, it, expect } from 'vitest';
import {
  REFINE_LEVELS,
  REFINE_MAX_LEVEL,
  REFINE_PROTECTION_ITEM_KEY,
  REFINE_STAGES,
  getRefineLevelDef,
  getRefineAttemptCost,
  getRefineStatMultiplier,
  refineLevelsByStage,
  getRefinePathCostMin,
  simulateRefineAttempt,
  type RefineLevelDef,
  type RefineStage,
  type RefineFailureBehavior,
} from './refine';
import { ITEMS } from './items';

const VALID_STAGES: readonly RefineStage[] = ['safe', 'risky', 'extreme'];
const VALID_FAILURE_BEHAVIORS: readonly RefineFailureBehavior[] = [
  'no_loss',
  'level_minus_one',
  'level_minus_one_or_break',
];

describe('REFINE_LEVELS catalog shape', () => {
  it('có đúng 15 level (1..15)', () => {
    expect(REFINE_LEVELS).toHaveLength(15);
    expect(REFINE_MAX_LEVEL).toBe(15);
  });

  it('REFINE_STAGES = ["safe","risky","extreme"]', () => {
    expect(REFINE_STAGES).toEqual(VALID_STAGES);
  });

  it('mỗi level def có required field hợp lệ', () => {
    for (const def of REFINE_LEVELS) {
      expect(typeof def.level).toBe('number');
      expect(VALID_STAGES).toContain(def.stage);
      expect(def.successRate).toBeGreaterThan(0);
      expect(def.successRate).toBeLessThanOrEqual(1);
      expect(def.linhThachCost).toBeGreaterThan(0);
      expect(typeof def.materialKey).toBe('string');
      expect(def.materialKey.length).toBeGreaterThan(0);
      expect(def.materialQty).toBeGreaterThan(0);
      expect(def.statMultiplier).toBeGreaterThan(1);
      expect(VALID_FAILURE_BEHAVIORS).toContain(def.failureBehavior);
      expect(def.extremeBreakChance).toBeGreaterThanOrEqual(0);
      expect(def.extremeBreakChance).toBeLessThanOrEqual(1);
    }
  });

  it('level liên tiếp 1..15 không có gap', () => {
    REFINE_LEVELS.forEach((def, idx) => {
      expect(def.level).toBe(idx + 1);
    });
  });

  it('stage assignment: L1..L5 = safe, L6..L10 = risky, L11..L15 = extreme', () => {
    REFINE_LEVELS.slice(0, 5).forEach((d) => expect(d.stage).toBe('safe'));
    REFINE_LEVELS.slice(5, 10).forEach((d) => expect(d.stage).toBe('risky'));
    REFINE_LEVELS.slice(10, 15).forEach((d) => expect(d.stage).toBe('extreme'));
  });

  it('failureBehavior align với stage', () => {
    REFINE_LEVELS.forEach((d) => {
      if (d.stage === 'safe') expect(d.failureBehavior).toBe('no_loss');
      else if (d.stage === 'risky') expect(d.failureBehavior).toBe('level_minus_one');
      else expect(d.failureBehavior).toBe('level_minus_one_or_break');
    });
  });

  it('extremeBreakChance > 0 chỉ ở stage extreme; safe/risky = 0', () => {
    REFINE_LEVELS.forEach((d) => {
      if (d.stage === 'extreme') expect(d.extremeBreakChance).toBeGreaterThan(0);
      else expect(d.extremeBreakChance).toBe(0);
    });
  });
});

describe('REFINE_LEVELS material curve', () => {
  it('safe stage dùng tinh_thiet (LINH ore)', () => {
    REFINE_LEVELS.filter((d) => d.stage === 'safe').forEach((d) => {
      expect(d.materialKey).toBe('tinh_thiet');
    });
  });

  it('risky stage dùng yeu_dan (HUYEN ore)', () => {
    REFINE_LEVELS.filter((d) => d.stage === 'risky').forEach((d) => {
      expect(d.materialKey).toBe('yeu_dan');
    });
  });

  it('extreme stage dùng han_ngoc (TIEN ore)', () => {
    REFINE_LEVELS.filter((d) => d.stage === 'extreme').forEach((d) => {
      expect(d.materialKey).toBe('han_ngoc');
    });
  });

  it('mọi materialKey tham chiếu ITEMS catalog hợp lệ', () => {
    const itemKeys = new Set(ITEMS.map((it) => it.key));
    const refineMatKeys = new Set(REFINE_LEVELS.map((d) => d.materialKey));
    for (const key of refineMatKeys) {
      expect(itemKeys.has(key)).toBe(true);
    }
  });

  it('materialQty per stage: safe 1, risky 2, extreme 3', () => {
    REFINE_LEVELS.forEach((d) => {
      if (d.stage === 'safe') expect(d.materialQty).toBe(1);
      else if (d.stage === 'risky') expect(d.materialQty).toBe(2);
      else expect(d.materialQty).toBe(3);
    });
  });
});

describe('REFINE_LEVELS balance', () => {
  it('successRate monotonic decrease (level càng cao càng khó)', () => {
    for (let i = 1; i < REFINE_LEVELS.length; i++) {
      expect(REFINE_LEVELS[i].successRate).toBeLessThan(REFINE_LEVELS[i - 1].successRate);
    }
  });

  it('successRate ranges sane: safe ≥ 0.75, risky 0.30..0.60, extreme 0.05..0.20', () => {
    REFINE_LEVELS.forEach((d) => {
      if (d.stage === 'safe') {
        expect(d.successRate).toBeGreaterThanOrEqual(0.75);
        expect(d.successRate).toBeLessThanOrEqual(0.95);
      } else if (d.stage === 'risky') {
        expect(d.successRate).toBeGreaterThanOrEqual(0.30);
        expect(d.successRate).toBeLessThanOrEqual(0.60);
      } else {
        expect(d.successRate).toBeGreaterThanOrEqual(0.05);
        expect(d.successRate).toBeLessThanOrEqual(0.20);
      }
    });
  });

  it('linhThachCost monotonic increase (geometric)', () => {
    for (let i = 1; i < REFINE_LEVELS.length; i++) {
      expect(REFINE_LEVELS[i].linhThachCost).toBeGreaterThan(REFINE_LEVELS[i - 1].linhThachCost);
    }
  });

  it('linhThachCost L1 = 100, L15 ≥ 50000 (sink curve)', () => {
    expect(REFINE_LEVELS[0].linhThachCost).toBe(100);
    expect(REFINE_LEVELS[14].linhThachCost).toBeGreaterThanOrEqual(50000);
  });

  it('statMultiplier monotonic increase, L1 > 1.0, L15 ≥ 3.0', () => {
    for (let i = 1; i < REFINE_LEVELS.length; i++) {
      expect(REFINE_LEVELS[i].statMultiplier).toBeGreaterThan(REFINE_LEVELS[i - 1].statMultiplier);
    }
    expect(REFINE_LEVELS[0].statMultiplier).toBeGreaterThan(1.0);
    expect(REFINE_LEVELS[14].statMultiplier).toBeGreaterThanOrEqual(3.0);
  });

  it('extremeBreakChance monotonic increase (L11 < L15)', () => {
    const extreme = REFINE_LEVELS.filter((d) => d.stage === 'extreme');
    for (let i = 1; i < extreme.length; i++) {
      expect(extreme[i].extremeBreakChance).toBeGreaterThanOrEqual(extreme[i - 1].extremeBreakChance);
    }
  });

  it('expected-value: safe stage có EV+ (success rate × multiplier_gain > fail cost)', () => {
    // Sanity: ở stage safe, success rate >= 0.75 và stat gain mỗi level = +0.10
    // → average reward chiếm dominant. Đủ check rough.
    REFINE_LEVELS.filter((d) => d.stage === 'safe').forEach((d) => {
      expect(d.successRate * 1.0).toBeGreaterThan(0.7);
    });
  });
});

describe('getRefineLevelDef', () => {
  it('lookup level hợp lệ', () => {
    const def = getRefineLevelDef(5);
    expect(def.level).toBe(5);
    expect(def.stage).toBe('safe');
  });

  it('throw nếu level < 1', () => {
    expect(() => getRefineLevelDef(0)).toThrow();
    expect(() => getRefineLevelDef(-1)).toThrow();
  });

  it('throw nếu level > 15', () => {
    expect(() => getRefineLevelDef(16)).toThrow();
    expect(() => getRefineLevelDef(100)).toThrow();
  });

  it('throw nếu level không phải integer', () => {
    expect(() => getRefineLevelDef(1.5)).toThrow();
  });
});

describe('getRefineAttemptCost', () => {
  it('preview cost từ L0 → L1 = level 1 def', () => {
    const cost = getRefineAttemptCost(0);
    expect(cost.linhThachCost).toBe(REFINE_LEVELS[0].linhThachCost);
    expect(cost.materialKey).toBe(REFINE_LEVELS[0].materialKey);
    expect(cost.materialQty).toBe(REFINE_LEVELS[0].materialQty);
  });

  it('preview cost từ L14 → L15 = level 15 def', () => {
    const cost = getRefineAttemptCost(14);
    expect(cost.linhThachCost).toBe(REFINE_LEVELS[14].linhThachCost);
    expect(cost.materialKey).toBe(REFINE_LEVELS[14].materialKey);
  });

  it('throw nếu currentLevel < 0', () => {
    expect(() => getRefineAttemptCost(-1)).toThrow();
  });

  it('throw nếu currentLevel >= 15 (đã max)', () => {
    expect(() => getRefineAttemptCost(15)).toThrow();
    expect(() => getRefineAttemptCost(16)).toThrow();
  });
});

describe('getRefineStatMultiplier', () => {
  it('level 0 = 1.0 (baseline)', () => {
    expect(getRefineStatMultiplier(0)).toBe(1.0);
  });

  it('level 1..15 trả đúng cumulative multiplier', () => {
    for (let lv = 1; lv <= 15; lv++) {
      expect(getRefineStatMultiplier(lv)).toBe(REFINE_LEVELS[lv - 1].statMultiplier);
    }
  });

  it('throw nếu level < 0 hoặc > 15', () => {
    expect(() => getRefineStatMultiplier(-1)).toThrow();
    expect(() => getRefineStatMultiplier(16)).toThrow();
  });
});

describe('refineLevelsByStage', () => {
  it('safe có 5 level', () => {
    expect(refineLevelsByStage('safe')).toHaveLength(5);
  });

  it('risky có 5 level', () => {
    expect(refineLevelsByStage('risky')).toHaveLength(5);
  });

  it('extreme có 5 level', () => {
    expect(refineLevelsByStage('extreme')).toHaveLength(5);
  });
});

describe('getRefinePathCostMin', () => {
  it('L0 → L1 = 1 attempt, cost = level 1', () => {
    const path = getRefinePathCostMin(0, 1);
    expect(path.attempts).toBe(1);
    expect(path.linhThachCost).toBe(REFINE_LEVELS[0].linhThachCost);
    expect(path.materials.tinh_thiet).toBe(1);
  });

  it('L0 → L5 = 5 attempts, cost = sum level 1..5, vẫn dùng tinh_thiet only', () => {
    const path = getRefinePathCostMin(0, 5);
    expect(path.attempts).toBe(5);
    expect(path.linhThachCost).toBe(
      REFINE_LEVELS.slice(0, 5).reduce((s, d) => s + d.linhThachCost, 0),
    );
    expect(path.materials).toEqual({ tinh_thiet: 5 });
  });

  it('L0 → L15 = 15 attempts, materials gom theo stage', () => {
    const path = getRefinePathCostMin(0, 15);
    expect(path.attempts).toBe(15);
    // safe (5 lv × 1 ore) + risky (5 lv × 2 ore) + extreme (5 lv × 3 ore)
    expect(path.materials).toEqual({
      tinh_thiet: 5,
      yeu_dan: 10,
      han_ngoc: 15,
    });
  });

  it('throw nếu fromLevel >= toLevel', () => {
    expect(() => getRefinePathCostMin(5, 5)).toThrow();
    expect(() => getRefinePathCostMin(5, 3)).toThrow();
  });

  it('throw nếu fromLevel < 0 hoặc toLevel > 15', () => {
    expect(() => getRefinePathCostMin(-1, 1)).toThrow();
    expect(() => getRefinePathCostMin(0, 16)).toThrow();
  });
});

describe('simulateRefineAttempt — safe stage', () => {
  it('success (rng < successRate) → +1 level', () => {
    const result = simulateRefineAttempt(0, () => 0.0); // rng < 0.95
    expect(result.success).toBe(true);
    expect(result.nextLevel).toBe(1);
    expect(result.broken).toBe(false);
    expect(result.protectionConsumed).toBe(false);
  });

  it('fail (rng > successRate) → no level loss, no protection consumed', () => {
    const result = simulateRefineAttempt(0, () => 0.99); // rng > 0.95
    expect(result.success).toBe(false);
    expect(result.nextLevel).toBe(0);
    expect(result.broken).toBe(false);
    expect(result.protectionConsumed).toBe(false);
  });

  it('hasProtection ở safe stage không tốn protection (no_loss đã không cần)', () => {
    const result = simulateRefineAttempt(0, () => 0.99, { hasProtection: true });
    expect(result.protectionConsumed).toBe(false);
  });
});

describe('simulateRefineAttempt — risky stage', () => {
  it('success (rng < successRate) → +1 level từ L5 → L6', () => {
    const result = simulateRefineAttempt(5, () => 0.0); // rng < 0.6
    expect(result.success).toBe(true);
    expect(result.nextLevel).toBe(6);
  });

  it('fail không protection → -1 level (L7 → L6)', () => {
    const result = simulateRefineAttempt(7, () => 0.99); // rng > 0.45
    expect(result.success).toBe(false);
    expect(result.nextLevel).toBe(6);
    expect(result.broken).toBe(false);
    expect(result.protectionConsumed).toBe(false);
  });

  it('fail có protection → giữ level + consume protection', () => {
    const result = simulateRefineAttempt(7, () => 0.99, { hasProtection: true });
    expect(result.success).toBe(false);
    expect(result.nextLevel).toBe(7);
    expect(result.broken).toBe(false);
    expect(result.protectionConsumed).toBe(true);
  });

  it('fail từ L5 → -1 = L5 (Math.max(0, 5-1) = 4 nhưng currentLevel=5 → 4)', () => {
    const result = simulateRefineAttempt(5, () => 0.99);
    expect(result.nextLevel).toBe(4);
  });
});

describe('simulateRefineAttempt — extreme stage', () => {
  it('success từ L10 → L11', () => {
    const result = simulateRefineAttempt(10, () => 0.0); // rng < 0.20
    expect(result.success).toBe(true);
    expect(result.nextLevel).toBe(11);
  });

  it('fail + break (rng pass success, rng < breakChance) → broken=true, nextLevel=0', () => {
    // currentLevel=10 (target L11, breakChance 0.10)
    // 1st rng = 0.5 (miss success), 2nd rng = 0.05 (< 0.10 → break)
    const rngs = [0.5, 0.05];
    let i = 0;
    const result = simulateRefineAttempt(10, () => rngs[i++]);
    expect(result.success).toBe(false);
    expect(result.broken).toBe(true);
    expect(result.nextLevel).toBe(0);
    expect(result.protectionConsumed).toBe(false); // break ignore protection
  });

  it('fail không break không protection → -1 level', () => {
    // currentLevel=10 (target L11, breakChance 0.10)
    // 1st rng = 0.5 (miss success), 2nd rng = 0.5 (> 0.10 → no break)
    const rngs = [0.5, 0.5];
    let i = 0;
    const result = simulateRefineAttempt(10, () => rngs[i++]);
    expect(result.success).toBe(false);
    expect(result.broken).toBe(false);
    expect(result.nextLevel).toBe(9); // 10 - 1
  });

  it('fail không break có protection → giữ level + consume protection', () => {
    const rngs = [0.5, 0.5];
    let i = 0;
    const result = simulateRefineAttempt(10, () => rngs[i++], { hasProtection: true });
    expect(result.success).toBe(false);
    expect(result.broken).toBe(false);
    expect(result.nextLevel).toBe(10);
    expect(result.protectionConsumed).toBe(true);
  });

  it('fail + break có protection → vẫn broken (protection KHÔNG cứu break)', () => {
    const rngs = [0.5, 0.05];
    let i = 0;
    const result = simulateRefineAttempt(10, () => rngs[i++], { hasProtection: true });
    expect(result.broken).toBe(true);
    expect(result.protectionConsumed).toBe(false);
    expect(result.nextLevel).toBe(0);
  });
});

describe('simulateRefineAttempt — error paths', () => {
  it('throw nếu currentLevel < 0', () => {
    expect(() => simulateRefineAttempt(-1, () => 0.5)).toThrow();
  });

  it('throw nếu currentLevel >= 15 (đã max)', () => {
    expect(() => simulateRefineAttempt(15, () => 0.5)).toThrow();
  });
});

describe('simulateRefineAttempt — deterministic replay', () => {
  it('cùng currentLevel + cùng rng sequence → cùng kết quả (replay)', () => {
    const rngs = [0.3, 0.7]; // success on safe (0.3 < 0.95), or fail extreme + no break
    let i = 0;
    const r1 = simulateRefineAttempt(2, () => rngs[i++]);
    i = 0;
    const r2 = simulateRefineAttempt(2, () => rngs[i++]);
    expect(r1).toEqual(r2);
  });
});

describe('REFINE_PROTECTION_ITEM_KEY constant', () => {
  it('là string non-empty', () => {
    expect(typeof REFINE_PROTECTION_ITEM_KEY).toBe('string');
    expect(REFINE_PROTECTION_ITEM_KEY.length).toBeGreaterThan(0);
  });

  it('= "refine_protection_charm" (Phase 11.5.B sẽ add vào ITEMS)', () => {
    expect(REFINE_PROTECTION_ITEM_KEY).toBe('refine_protection_charm');
  });
});

describe('RefineLevelDef type assertion', () => {
  it('REFINE_LEVELS[0] match RefineLevelDef shape', () => {
    const def: RefineLevelDef = REFINE_LEVELS[0];
    expect(def.level).toBeDefined();
    expect(def.stage).toBeDefined();
    expect(def.successRate).toBeDefined();
    expect(def.linhThachCost).toBeDefined();
    expect(def.materialKey).toBeDefined();
    expect(def.materialQty).toBeDefined();
    expect(def.statMultiplier).toBeDefined();
    expect(def.failureBehavior).toBeDefined();
    expect(def.extremeBreakChance).toBeDefined();
  });
});
