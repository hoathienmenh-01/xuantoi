import { describe, it, expect } from 'vitest';
import {
  TRIBULATIONS,
  TRIBULATION_TYPES,
  TRIBULATION_SEVERITIES,
  getTribulationDef,
  getTribulationForBreakthrough,
  tribulationsByType,
  tribulationsBySeverity,
  simulateTribulationWave,
  simulateTribulation,
  computeTribulationReward,
  computeTribulationFailurePenalty,
  type TribulationType,
  type TribulationSeverity,
  type TribulationDef,
} from './tribulation';
import { REALMS } from './realms';
import { ELEMENTS } from './combat';

const VALID_TYPES: readonly TribulationType[] = ['lei', 'phong', 'bang', 'hoa', 'tam'];
const VALID_SEVERITIES: readonly TribulationSeverity[] = ['minor', 'major', 'heavenly', 'saint'];

describe('TRIBULATIONS catalog shape', () => {
  it('có ít nhất 5 entry baseline (cover minor/major/heavenly/saint)', () => {
    expect(TRIBULATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('TRIBULATION_TYPES = 5 type', () => {
    expect(TRIBULATION_TYPES).toEqual(VALID_TYPES);
  });

  it('TRIBULATION_SEVERITIES = 4 severity', () => {
    expect(TRIBULATION_SEVERITIES).toEqual(VALID_SEVERITIES);
  });

  it('mỗi tribulation key unique', () => {
    const keys = TRIBULATIONS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mỗi tribulation có required field hợp lệ', () => {
    for (const t of TRIBULATIONS) {
      expect(typeof t.key).toBe('string');
      expect(t.key.startsWith('tribulation_')).toBe(true);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(VALID_TYPES).toContain(t.type);
      expect(VALID_SEVERITIES).toContain(t.severity);
      expect(typeof t.fromRealmKey).toBe('string');
      expect(typeof t.toRealmKey).toBe('string');
    }
  });

  it('fromRealmKey + toRealmKey ref REALMS catalog hợp lệ', () => {
    const realmKeys = new Set(REALMS.map((r) => r.key));
    for (const t of TRIBULATIONS) {
      expect(realmKeys.has(t.fromRealmKey)).toBe(true);
      expect(realmKeys.has(t.toRealmKey)).toBe(true);
    }
  });

  it('toRealmKey = realm sau fromRealmKey 1 bậc (order + 1)', () => {
    for (const t of TRIBULATIONS) {
      const from = REALMS.find((r) => r.key === t.fromRealmKey)!;
      const to = REALMS.find((r) => r.key === t.toRealmKey)!;
      expect(to.order).toBe(from.order + 1);
    }
  });
});

describe('TRIBULATIONS waves', () => {
  it('số wave match severity (minor=3, major=5, heavenly=7, saint=9)', () => {
    for (const t of TRIBULATIONS) {
      const expected = { minor: 3, major: 5, heavenly: 7, saint: 9 }[t.severity];
      expect(t.waves.length).toBe(expected);
    }
  });

  it('waveIndex liên tiếp 1..N không gap', () => {
    for (const t of TRIBULATIONS) {
      t.waves.forEach((w, i) => {
        expect(w.waveIndex).toBe(i + 1);
      });
    }
  });

  it('baseDamage monotonic increase per wave (geometric)', () => {
    for (const t of TRIBULATIONS) {
      for (let i = 1; i < t.waves.length; i++) {
        expect(t.waves[i].baseDamage).toBeGreaterThan(t.waves[i - 1].baseDamage);
      }
    }
  });

  it('wave element hợp lệ (ElementKey | null) — `tam` type luôn null element', () => {
    for (const t of TRIBULATIONS) {
      for (const w of t.waves) {
        if (w.element !== null) {
          expect(ELEMENTS).toContain(w.element);
        }
        if (t.type === 'tam') {
          expect(w.element).toBe(null);
        }
      }
    }
  });

  it('accuracyHint trong [0.65, 0.95]', () => {
    for (const t of TRIBULATIONS) {
      for (const w of t.waves) {
        expect(w.accuracyHint).toBeGreaterThanOrEqual(0.65);
        expect(w.accuracyHint).toBeLessThanOrEqual(0.95);
      }
    }
  });
});

describe('TRIBULATIONS reward', () => {
  it('reward.linhThach > 0', () => {
    for (const t of TRIBULATIONS) {
      expect(t.reward.linhThach).toBeGreaterThan(0);
    }
  });

  it('reward.expBonus > 0n (BigInt)', () => {
    for (const t of TRIBULATIONS) {
      expect(t.reward.expBonus).toBeGreaterThan(0n);
    }
  });

  it('reward.titleKey không null cho mọi tribulation', () => {
    for (const t of TRIBULATIONS) {
      expect(t.reward.titleKey).not.toBeNull();
      expect(t.reward.titleKey?.startsWith('tribulation_')).toBe(true);
    }
  });

  it('reward.uniqueDropChance trong [0, 1]', () => {
    for (const t of TRIBULATIONS) {
      expect(t.reward.uniqueDropChance).toBeGreaterThanOrEqual(0);
      expect(t.reward.uniqueDropChance).toBeLessThanOrEqual(1);
    }
  });

  it('uniqueDropItemKey null cho minor/major, set cho heavenly/saint', () => {
    for (const t of TRIBULATIONS) {
      if (t.severity === 'minor' || t.severity === 'major') {
        expect(t.reward.uniqueDropItemKey).toBe(null);
      } else {
        expect(t.reward.uniqueDropItemKey).not.toBeNull();
      }
    }
  });

  it('reward monotonic theo severity (saint > heavenly > major > minor)', () => {
    const minorRewards = TRIBULATIONS.filter((t) => t.severity === 'minor').map((t) => t.reward.linhThach);
    const majorRewards = TRIBULATIONS.filter((t) => t.severity === 'major').map((t) => t.reward.linhThach);
    const heavenlyRewards = TRIBULATIONS.filter((t) => t.severity === 'heavenly').map((t) => t.reward.linhThach);
    const saintRewards = TRIBULATIONS.filter((t) => t.severity === 'saint').map((t) => t.reward.linhThach);
    if (minorRewards.length && majorRewards.length) expect(majorRewards[0]).toBeGreaterThan(minorRewards[0]);
    if (majorRewards.length && heavenlyRewards.length) expect(heavenlyRewards[0]).toBeGreaterThan(majorRewards[0]);
    if (heavenlyRewards.length && saintRewards.length) expect(saintRewards[0]).toBeGreaterThan(heavenlyRewards[0]);
  });
});

describe('TRIBULATIONS failurePenalty', () => {
  it('expLossRatio trong [0, 1]', () => {
    for (const t of TRIBULATIONS) {
      expect(t.failurePenalty.expLossRatio).toBeGreaterThan(0);
      expect(t.failurePenalty.expLossRatio).toBeLessThanOrEqual(1);
    }
  });

  it('cooldownMinutes > 0', () => {
    for (const t of TRIBULATIONS) {
      expect(t.failurePenalty.cooldownMinutes).toBeGreaterThan(0);
    }
  });

  it('taoMaDebuffChance trong [0, 1]', () => {
    for (const t of TRIBULATIONS) {
      expect(t.failurePenalty.taoMaDebuffChance).toBeGreaterThanOrEqual(0);
      expect(t.failurePenalty.taoMaDebuffChance).toBeLessThanOrEqual(1);
    }
  });

  it('penalty monotonic theo severity (saint > heavenly > major > minor)', () => {
    const findFirst = (sev: TribulationSeverity) => TRIBULATIONS.find((t) => t.severity === sev);
    const minor = findFirst('minor');
    const major = findFirst('major');
    const heavenly = findFirst('heavenly');
    const saint = findFirst('saint');
    if (minor && major) expect(major.failurePenalty.expLossRatio).toBeGreaterThan(minor.failurePenalty.expLossRatio);
    if (major && heavenly) expect(heavenly.failurePenalty.expLossRatio).toBeGreaterThan(major.failurePenalty.expLossRatio);
    if (heavenly && saint) expect(saint.failurePenalty.expLossRatio).toBeGreaterThanOrEqual(heavenly.failurePenalty.expLossRatio);
  });
});

describe('getTribulationDef', () => {
  it('lookup key tồn tại', () => {
    const def = getTribulationDef('tribulation_kim_dan_nguyen_anh');
    expect(def).toBeDefined();
    expect(def?.fromRealmKey).toBe('kim_dan');
  });

  it('return undefined cho key không tồn tại', () => {
    expect(getTribulationDef('not_exist')).toBeUndefined();
  });
});

describe('getTribulationForBreakthrough', () => {
  it('lookup transition có kiếp', () => {
    const def = getTribulationForBreakthrough('kim_dan', 'nguyen_anh');
    expect(def).toBeDefined();
    expect(def?.severity).toBe('minor');
  });

  it('return undefined cho transition KHÔNG có kiếp (early realm)', () => {
    expect(getTribulationForBreakthrough('phamnhan', 'luyenkhi')).toBeUndefined();
    expect(getTribulationForBreakthrough('luyenkhi', 'truc_co')).toBeUndefined();
  });

  it('return undefined cho transition KHÔNG hợp lệ', () => {
    expect(getTribulationForBreakthrough('not_a_realm', 'kim_dan')).toBeUndefined();
  });
});

describe('tribulationsByType / tribulationsBySeverity', () => {
  it('tribulationsByType("lei") trả các kiếp lei', () => {
    const lei = tribulationsByType('lei');
    expect(lei.length).toBeGreaterThan(0);
    lei.forEach((t) => expect(t.type).toBe('lei'));
  });

  it('tribulationsByType("tam") trả ít nhất 1 (Tâm Ma)', () => {
    const tam = tribulationsByType('tam');
    expect(tam.length).toBeGreaterThanOrEqual(1);
    tam.forEach((t) => expect(t.type).toBe('tam'));
  });

  it('tribulationsBySeverity("saint") trả endgame kiếp', () => {
    const saint = tribulationsBySeverity('saint');
    expect(saint.length).toBeGreaterThan(0);
    saint.forEach((t) => expect(t.severity).toBe('saint'));
  });

  it('tribulationsBySeverity union = TRIBULATIONS', () => {
    const all = TRIBULATION_SEVERITIES.flatMap((s) => tribulationsBySeverity(s));
    expect(all.length).toBe(TRIBULATIONS.length);
  });
});

describe('simulateTribulationWave', () => {
  const wave = TRIBULATIONS[0].waves[0];

  it('damage = baseDamage × elementResistMultiplier (rounded)', () => {
    const result = simulateTribulationWave(wave, 10000, 1.0);
    expect(result.effectiveDamage).toBe(wave.baseDamage);
  });

  it('strong resist (0.5) → half damage', () => {
    const result = simulateTribulationWave(wave, 10000, 0.5);
    expect(result.effectiveDamage).toBe(Math.round(wave.baseDamage * 0.5));
  });

  it('weak resist (1.5) → 1.5× damage', () => {
    const result = simulateTribulationWave(wave, 10000, 1.5);
    expect(result.effectiveDamage).toBe(Math.round(wave.baseDamage * 1.5));
  });

  it('survived = true khi defenderHp > damage', () => {
    const result = simulateTribulationWave(wave, 100000, 1.0);
    expect(result.survived).toBe(true);
    expect(result.defenderHpAfter).toBeGreaterThan(0);
  });

  it('survived = false khi defenderHp <= damage', () => {
    const result = simulateTribulationWave(wave, 100, 1.0);
    expect(result.survived).toBe(false);
    expect(result.defenderHpAfter).toBe(0);
  });

  it('throw nếu defenderHp không phải số hữu hạn', () => {
    expect(() => simulateTribulationWave(wave, NaN, 1.0)).toThrow();
    expect(() => simulateTribulationWave(wave, Infinity, 1.0)).toThrow();
  });

  it('throw nếu elementResistMultiplier âm hoặc không hữu hạn', () => {
    expect(() => simulateTribulationWave(wave, 10000, -0.5)).toThrow();
    expect(() => simulateTribulationWave(wave, 10000, NaN)).toThrow();
  });
});

describe('simulateTribulation', () => {
  const minorTrib = TRIBULATIONS.find((t) => t.severity === 'minor')!;

  it('character HP cao + resist = 0.5 → success qua tất cả waves', () => {
    const result = simulateTribulation(minorTrib, 1_000_000, () => 0.5);
    expect(result.success).toBe(true);
    expect(result.wavesCompleted).toBe(minorTrib.waves.length);
    expect(result.finalHp).toBeGreaterThan(0);
  });

  it('character HP thấp + resist = 1.0 → fail ở wave nào đó', () => {
    const result = simulateTribulation(minorTrib, 100, () => 1.0);
    expect(result.success).toBe(false);
    expect(result.finalHp).toBe(0);
    expect(result.wavesCompleted).toBeLessThanOrEqual(minorTrib.waves.length);
  });

  it('totalDamage = sum effectiveDamage qua waves đã trải', () => {
    const result = simulateTribulation(minorTrib, 1_000_000, () => 1.0);
    const sum = result.waveResults.reduce((s, w) => s + w.effectiveDamage, 0);
    expect(result.totalDamage).toBe(sum);
  });

  it('elementResistFn được gọi với element của wave', () => {
    const callsLog: Array<string | null> = [];
    simulateTribulation(minorTrib, 1_000_000, (element) => {
      callsLog.push(element);
      return 1.0;
    });
    expect(callsLog.length).toBe(minorTrib.waves.length);
    callsLog.forEach((e, i) => {
      expect(e).toBe(minorTrib.waves[i].element);
    });
  });

  it('deterministic — cùng input cho cùng output (replay-able)', () => {
    const r1 = simulateTribulation(minorTrib, 5000, () => 1.0);
    const r2 = simulateTribulation(minorTrib, 5000, () => 1.0);
    expect(r1).toEqual(r2);
  });

  it('Tâm Ma kiếp (tam type) — element resist function nhận null', () => {
    const tamTrib = TRIBULATIONS.find((t) => t.type === 'tam')!;
    const elements: Array<unknown> = [];
    simulateTribulation(tamTrib, 1_000_000, (e) => {
      elements.push(e);
      return 1.0;
    });
    elements.forEach((e) => expect(e).toBe(null));
  });
});

describe('computeTribulationReward', () => {
  it('trả về reward field từ def', () => {
    const def = TRIBULATIONS[0];
    const reward = computeTribulationReward(def);
    expect(reward.linhThach).toBe(def.reward.linhThach);
    expect(reward.expBonus).toBe(def.reward.expBonus);
    expect(reward.titleKey).toBe(def.reward.titleKey);
    expect(reward.uniqueDropItemKey).toBe(def.reward.uniqueDropItemKey);
    expect(reward.uniqueDropChance).toBe(def.reward.uniqueDropChance);
  });
});

describe('computeTribulationFailurePenalty', () => {
  const minorTrib = TRIBULATIONS.find((t) => t.severity === 'minor')!;
  const heavenlyTrib = TRIBULATIONS.find((t) => t.severity === 'heavenly')!;

  it('expAfter = currentExp × (1 - expLossRatio)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = computeTribulationFailurePenalty(10_000n, minorTrib, now, 0.99);
    // minor expLossRatio = 0.10 → expAfter = 9000n
    expect(result.expAfter).toBe(9000n);
  });

  it('cooldownAt = now + cooldownMinutes × 60_000ms', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const result = computeTribulationFailurePenalty(10_000n, minorTrib, now, 0.99);
    const expectedCooldown = new Date(now.getTime() + minorTrib.failurePenalty.cooldownMinutes * 60_000);
    expect(result.cooldownAt.getTime()).toBe(expectedCooldown.getTime());
  });

  it('taoMaActive = false nếu roll >= chance', () => {
    const now = new Date();
    const result = computeTribulationFailurePenalty(10_000n, minorTrib, now, 0.99);
    expect(result.taoMaActive).toBe(false);
    expect(result.taoMaExpiresAt).toBe(null);
  });

  it('taoMaActive = true nếu roll < chance', () => {
    const now = new Date();
    const result = computeTribulationFailurePenalty(10_000n, heavenlyTrib, now, 0.01);
    // heavenly chance = 0.20, roll 0.01 → trigger
    expect(result.taoMaActive).toBe(true);
    expect(result.taoMaExpiresAt).not.toBeNull();
    if (result.taoMaExpiresAt) {
      const expected = new Date(now.getTime() + heavenlyTrib.failurePenalty.taoMaDebuffDurationMinutes * 60_000);
      expect(result.taoMaExpiresAt.getTime()).toBe(expected.getTime());
    }
  });

  it('throw nếu taoMaRoll out-of-range', () => {
    const now = new Date();
    expect(() => computeTribulationFailurePenalty(10_000n, minorTrib, now, -0.1)).toThrow();
    expect(() => computeTribulationFailurePenalty(10_000n, minorTrib, now, 1.1)).toThrow();
    expect(() => computeTribulationFailurePenalty(10_000n, minorTrib, now, NaN)).toThrow();
  });

  it('expLoss precision OK với BigInt rất lớn', () => {
    const now = new Date();
    // 1_000_000_000n × 0.10 = 100_000_000n
    const result = computeTribulationFailurePenalty(1_000_000_000n, minorTrib, now, 0.99);
    expect(result.expAfter).toBe(900_000_000n);
  });
});

describe('TribulationDef type assertion', () => {
  it('TRIBULATIONS[0] match TribulationDef shape', () => {
    const def: TribulationDef = TRIBULATIONS[0];
    expect(def.key).toBeDefined();
    expect(def.name).toBeDefined();
    expect(def.fromRealmKey).toBeDefined();
    expect(def.toRealmKey).toBeDefined();
    expect(def.type).toBeDefined();
    expect(def.severity).toBeDefined();
    expect(def.waves).toBeDefined();
    expect(def.reward).toBeDefined();
    expect(def.failurePenalty).toBeDefined();
  });
});
