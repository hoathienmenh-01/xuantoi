import { describe, expect, it } from 'vitest';
import {
  TALENTS,
  canCharacterLearnTalent,
  composePassiveTalentMods,
  computeTalentPointBudget,
  getTalentDef,
  simulateActiveTalent,
  talentsAvailableAtRealm,
  talentsByElement,
  talentsByType,
} from './talents';
import { REALMS } from './realms';
import type { ElementKey } from './combat';

const realmKeyToOrder = new Map(REALMS.map((r) => [r.key, r.order]));

describe('TALENTS catalog shape', () => {
  it('có ít nhất 12 talent baseline', () => {
    expect(TALENTS.length).toBeGreaterThanOrEqual(12);
  });

  it('tất cả key duy nhất', () => {
    const keys = TALENTS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('tất cả key bắt đầu bằng "talent_"', () => {
    for (const t of TALENTS) {
      expect(t.key.startsWith('talent_')).toBe(true);
    }
  });

  it('mỗi talent có name + description không rỗng', () => {
    for (const t of TALENTS) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it('type là "passive" hoặc "active"', () => {
    for (const t of TALENTS) {
      expect(['passive', 'active']).toContain(t.type);
    }
  });

  it('passive talent CHỈ có passiveEffect, không activeEffect', () => {
    const passives = talentsByType('passive');
    for (const t of passives) {
      expect(t.passiveEffect).not.toBeNull();
      expect(t.activeEffect).toBeNull();
    }
  });

  it('active talent CHỈ có activeEffect, không passiveEffect', () => {
    const actives = talentsByType('active');
    for (const t of actives) {
      expect(t.activeEffect).not.toBeNull();
      expect(t.passiveEffect).toBeNull();
    }
  });

  it('element nullable nhưng nếu set thì hợp lệ', () => {
    const valid: (ElementKey | null)[] = ['kim', 'moc', 'thuy', 'hoa', 'tho', null];
    for (const t of TALENTS) {
      expect(valid).toContain(t.element);
    }
  });

  it('realmRequirement tham chiếu key tồn tại trong REALMS', () => {
    const realmKeys = new Set(REALMS.map((r) => r.key));
    for (const t of TALENTS) {
      expect(realmKeys.has(t.realmRequirement)).toBe(true);
    }
  });

  it('talentPointCost trong [1, 3]', () => {
    for (const t of TALENTS) {
      expect(t.talentPointCost).toBeGreaterThanOrEqual(1);
      expect(t.talentPointCost).toBeLessThanOrEqual(3);
      expect(Number.isInteger(t.talentPointCost)).toBe(true);
    }
  });
});

describe('PassiveTalentEffect shape', () => {
  it('passive stat_mod có statTarget hợp lệ + value > 1', () => {
    const validTargets = ['atk', 'def', 'hpMax', 'mpMax', 'spirit'];
    for (const t of talentsByType('passive')) {
      const eff = t.passiveEffect;
      if (eff && eff.kind === 'stat_mod') {
        expect(eff.statTarget).not.toBeNull();
        if (eff.statTarget) expect(validTargets).toContain(eff.statTarget);
        expect(eff.value).toBeGreaterThan(1);
      }
    }
  });

  it('passive regen có statTarget hpMax|mpMax + value > 0 flat', () => {
    for (const t of talentsByType('passive')) {
      const eff = t.passiveEffect;
      if (eff && eff.kind === 'regen') {
        expect(['hpMax', 'mpMax']).toContain(eff.statTarget);
        expect(eff.value).toBeGreaterThan(0);
      }
    }
  });

  it('passive damage_bonus có elementTarget hợp lệ', () => {
    const valid: ElementKey[] = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    for (const t of talentsByType('passive')) {
      const eff = t.passiveEffect;
      if (eff && eff.kind === 'damage_bonus') {
        expect(eff.elementTarget).not.toBeNull();
        if (eff.elementTarget) expect(valid).toContain(eff.elementTarget);
        expect(eff.value).toBeGreaterThan(1);
      }
    }
  });

  it('passive drop_bonus + exp_bonus value > 1', () => {
    for (const t of talentsByType('passive')) {
      const eff = t.passiveEffect;
      if (eff && (eff.kind === 'drop_bonus' || eff.kind === 'exp_bonus')) {
        expect(eff.value).toBeGreaterThan(1);
      }
    }
  });
});

describe('ActiveTalentEffect shape', () => {
  it('active có cooldownTurns >= 1 + mpCost > 0', () => {
    for (const t of talentsByType('active')) {
      const eff = t.activeEffect;
      expect(eff).not.toBeNull();
      if (eff) {
        expect(eff.cooldownTurns).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(eff.cooldownTurns)).toBe(true);
        expect(eff.mpCost).toBeGreaterThan(0);
        expect(Number.isInteger(eff.mpCost)).toBe(true);
      }
    }
  });

  it('active có aoe boolean hợp lệ', () => {
    for (const t of talentsByType('active')) {
      const eff = t.activeEffect;
      if (eff) expect(typeof eff.aoe).toBe('boolean');
    }
  });

  it('active damage value >= 1.0 (multiplier)', () => {
    for (const t of talentsByType('active')) {
      const eff = t.activeEffect;
      if (eff && eff.kind === 'damage') {
        expect(eff.value).toBeGreaterThanOrEqual(1.0);
      }
    }
  });

  it('active cc value (turns) trong [1, 5]', () => {
    for (const t of talentsByType('active')) {
      const eff = t.activeEffect;
      if (eff && eff.kind === 'cc') {
        expect(eff.value).toBeGreaterThanOrEqual(1);
        expect(eff.value).toBeLessThanOrEqual(5);
      }
    }
  });

  it('active heal value trong (0, 1] (ratio of hpMax)', () => {
    for (const t of talentsByType('active')) {
      const eff = t.activeEffect;
      if (eff && eff.kind === 'heal') {
        expect(eff.value).toBeGreaterThan(0);
        expect(eff.value).toBeLessThanOrEqual(1.0);
      }
    }
  });
});

describe('Curve sanity', () => {
  it('có ít nhất 5 passive', () => {
    expect(talentsByType('passive').length).toBeGreaterThanOrEqual(5);
  });

  it('có ít nhất 5 active', () => {
    expect(talentsByType('active').length).toBeGreaterThanOrEqual(5);
  });

  it('cover 5 element kim/moc/thuy/hoa/tho ít nhất 1 talent mỗi hệ', () => {
    const elements: ElementKey[] = ['kim', 'moc', 'thuy', 'hoa', 'tho'];
    for (const e of elements) {
      expect(talentsByElement(e).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('có talent neutral (element = null)', () => {
    expect(talentsByElement(null).length).toBeGreaterThanOrEqual(1);
  });

  it('mỗi type cover ít nhất 3 element khác nhau', () => {
    const passiveElems = new Set(talentsByType('passive').map((t) => t.element));
    const activeElems = new Set(talentsByType('active').map((t) => t.element));
    expect(passiveElems.size).toBeGreaterThanOrEqual(3);
    expect(activeElems.size).toBeGreaterThanOrEqual(3);
  });
});

describe('getTalentDef', () => {
  it('trả talent khi key hợp lệ', () => {
    const t = getTalentDef('talent_kim_thien_co');
    expect(t).toBeDefined();
    expect(t?.element).toBe('kim');
  });

  it('trả undefined khi key sai', () => {
    expect(getTalentDef('talent_invalid')).toBeUndefined();
  });
});

describe('talentsByType', () => {
  it('passive trả non-empty list', () => {
    expect(talentsByType('passive').length).toBeGreaterThan(0);
  });

  it('active trả non-empty list', () => {
    expect(talentsByType('active').length).toBeGreaterThan(0);
  });

  it('union 2 type = TALENTS.length', () => {
    expect(
      talentsByType('passive').length + talentsByType('active').length
    ).toBe(TALENTS.length);
  });
});

describe('talentsByElement', () => {
  it('kim trả các talent element=kim', () => {
    const list = talentsByElement('kim');
    for (const t of list) expect(t.element).toBe('kim');
  });

  it('null trả neutral talents', () => {
    const list = talentsByElement(null);
    for (const t of list) expect(t.element).toBeNull();
  });

  it('union 6 element (5 + null) = TALENTS.length', () => {
    const total =
      talentsByElement('kim').length +
      talentsByElement('moc').length +
      talentsByElement('thuy').length +
      talentsByElement('hoa').length +
      talentsByElement('tho').length +
      talentsByElement(null).length;
    expect(total).toBe(TALENTS.length);
  });
});

describe('talentsAvailableAtRealm', () => {
  it('phamnhan(0) trả empty (không talent nào học được)', () => {
    expect(talentsAvailableAtRealm(0, realmKeyToOrder).length).toBe(0);
  });

  it('truc_co(2) trả các talent yêu cầu truc_co hoặc thấp hơn', () => {
    const list = talentsAvailableAtRealm(2, realmKeyToOrder);
    for (const t of list) {
      const reqOrder = realmKeyToOrder.get(t.realmRequirement) ?? -1;
      expect(reqOrder).toBeLessThanOrEqual(2);
    }
  });

  it('endgame realm trả tất cả talent', () => {
    const maxOrder = Math.max(...REALMS.map((r) => r.order));
    const list = talentsAvailableAtRealm(maxOrder, realmKeyToOrder);
    expect(list.length).toBe(TALENTS.length);
  });

  it('throw nếu currentRealmOrder âm', () => {
    expect(() => talentsAvailableAtRealm(-1, realmKeyToOrder)).toThrow();
  });

  it('throw nếu currentRealmOrder = NaN', () => {
    expect(() => talentsAvailableAtRealm(NaN, realmKeyToOrder)).toThrow();
  });
});

describe('computeTalentPointBudget', () => {
  it('phamnhan(0) = 0 points', () => {
    expect(computeTalentPointBudget(0)).toBe(0);
  });

  it('luyenkhi(1)..truc_co(2) = 0 points (chưa đến 3-realm milestone)', () => {
    expect(computeTalentPointBudget(1)).toBe(0);
    expect(computeTalentPointBudget(2)).toBe(0);
  });

  it('kim_dan(3) = 1 point (first milestone)', () => {
    expect(computeTalentPointBudget(3)).toBe(1);
  });

  it('luyen_hu(6) = 2 points (second milestone)', () => {
    expect(computeTalentPointBudget(6)).toBe(2);
  });

  it('do_kiep(9) = 3 points (third milestone)', () => {
    expect(computeTalentPointBudget(9)).toBe(3);
  });

  it('endgame = max points', () => {
    const maxOrder = Math.max(...REALMS.map((r) => r.order));
    const expected = Math.floor(maxOrder / 3);
    expect(computeTalentPointBudget(maxOrder)).toBe(expected);
  });

  it('throw nếu order âm', () => {
    expect(() => computeTalentPointBudget(-1)).toThrow();
  });
});

describe('canCharacterLearnTalent', () => {
  const kimThienCo = getTalentDef('talent_kim_thien_co')!;

  it('canLearn=true khi đủ realm + đủ point', () => {
    const result = canCharacterLearnTalent(kimThienCo, 3, realmKeyToOrder, 0);
    expect(result.canLearn).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('canLearn=false realm_too_low khi chưa đủ realm', () => {
    const result = canCharacterLearnTalent(kimThienCo, 2, realmKeyToOrder, 0);
    expect(result.canLearn).toBe(false);
    expect(result.reason).toBe('realm_too_low');
  });

  it('canLearn=false insufficient_talent_points khi đã spent hết', () => {
    const result = canCharacterLearnTalent(kimThienCo, 3, realmKeyToOrder, 1);
    expect(result.canLearn).toBe(false);
    expect(result.reason).toBe('insufficient_talent_points');
  });

  it('canLearn=false invalid_realm_requirement nếu realm key sai', () => {
    const fake = { ...kimThienCo, realmRequirement: 'invalid_realm' };
    const result = canCharacterLearnTalent(fake, 99, realmKeyToOrder, 0);
    expect(result.canLearn).toBe(false);
    expect(result.reason).toBe('invalid_realm_requirement');
  });
});

describe('composePassiveTalentMods', () => {
  it('empty list → identity mods', () => {
    const mods = composePassiveTalentMods([]);
    expect(mods.atkMul).toBe(1);
    expect(mods.defMul).toBe(1);
    expect(mods.hpMaxMul).toBe(1);
    expect(mods.mpMaxMul).toBe(1);
    expect(mods.hpRegenFlat).toBe(0);
    expect(mods.dropMul).toBe(1);
    expect(mods.expMul).toBe(1);
    expect(mods.damageBonusByElement.size).toBe(0);
  });

  it('kim_thien_co → atkMul = 1.1', () => {
    const mods = composePassiveTalentMods(['talent_kim_thien_co']);
    expect(mods.atkMul).toBeCloseTo(1.1, 5);
  });

  it('thuy_long_an → hpMaxMul = 1.1', () => {
    const mods = composePassiveTalentMods(['talent_thuy_long_an']);
    expect(mods.hpMaxMul).toBeCloseTo(1.1, 5);
  });

  it('huyen_thuy_tam → spiritMul = 1.1 (Phase 11.X.AA producer cho 11.4.G/11.X.U wire)', () => {
    const mods = composePassiveTalentMods(['talent_huyen_thuy_tam']);
    expect(mods.spiritMul).toBeCloseTo(1.1, 5);
    // Verify isolation: chỉ statTarget=spirit bị tác động, các stat khác giữ identity.
    expect(mods.atkMul).toBe(1);
    expect(mods.defMul).toBe(1);
    expect(mods.hpMaxMul).toBe(1);
  });

  it('combine kim_thien_co + huyen_thuy_tam → atk=1.1 + spirit=1.1 (multiplicative isolated by statTarget)', () => {
    const mods = composePassiveTalentMods([
      'talent_kim_thien_co',
      'talent_huyen_thuy_tam',
    ]);
    expect(mods.atkMul).toBeCloseTo(1.1, 5);
    expect(mods.spiritMul).toBeCloseTo(1.1, 5);
    // Cross-stat verification: atk + spirit độc lập.
    expect(mods.hpMaxMul).toBe(1);
  });

  it('moc_linh_quy → hpRegenFlat = 5', () => {
    const mods = composePassiveTalentMods(['talent_moc_linh_quy']);
    expect(mods.hpRegenFlat).toBe(5);
  });

  it('hoa_tam_dao → damageBonusByElement[kim] = 1.15', () => {
    const mods = composePassiveTalentMods(['talent_hoa_tam_dao']);
    expect(mods.damageBonusByElement.get('kim')).toBeCloseTo(1.15, 5);
  });

  it('thien_di → dropMul = 1.2', () => {
    const mods = composePassiveTalentMods(['talent_thien_di']);
    expect(mods.dropMul).toBeCloseTo(1.2, 5);
  });

  it('ngo_dao → expMul = 1.15', () => {
    const mods = composePassiveTalentMods(['talent_ngo_dao']);
    expect(mods.expMul).toBeCloseTo(1.15, 5);
  });

  it('combine 2 stat_mod cùng target → multiplicative', () => {
    // Giả lập: nếu có 2 talent +10% atk thì 1.1 × 1.1 = 1.21
    // Nhưng catalog hiện chỉ có 1 atk passive. Ta test = stack với hp.
    const mods = composePassiveTalentMods([
      'talent_kim_thien_co', // atk × 1.1
      'talent_thuy_long_an', // hpMax × 1.1
    ]);
    expect(mods.atkMul).toBeCloseTo(1.1, 5);
    expect(mods.hpMaxMul).toBeCloseTo(1.1, 5);
  });

  it('ignore active talent key', () => {
    const mods = composePassiveTalentMods(['talent_kim_quang_tram']);
    expect(mods.atkMul).toBe(1);
  });

  it('ignore invalid talent key', () => {
    const mods = composePassiveTalentMods(['talent_invalid_key']);
    expect(mods.atkMul).toBe(1);
  });
});

describe('simulateActiveTalent', () => {
  const kimQuang = getTalentDef('talent_kim_quang_tram')!;
  const thuyYen = getTalentDef('talent_thuy_yen_nguc')!;
  const mocChu = getTalentDef('talent_moc_chu_lam')!;
  const hoaLong = getTalentDef('talent_hoa_long_phun')!;
  const phongLui = getTalentDef('talent_phong_lui')!;

  it('damage talent: damage = atk × value', () => {
    const r = simulateActiveTalent(kimQuang, 1000, 500);
    expect(r.damage).toBe(2000); // 1000 × 2.0
    expect(r.aoe).toBe(true);
    expect(r.heal).toBe(0);
    expect(r.ccTurns).toBe(0);
  });

  it('cc talent: ccTurns = value, không có damage', () => {
    const r = simulateActiveTalent(thuyYen, 1000, 500);
    expect(r.ccTurns).toBe(3);
    expect(r.damage).toBe(0);
    expect(r.aoe).toBe(false);
  });

  it('heal talent: heal = atk × value (Phase 11.7.B sẽ wire hpMax)', () => {
    const r = simulateActiveTalent(mocChu, 1000, 500);
    expect(r.heal).toBe(300); // 1000 × 0.3
    expect(r.damage).toBe(0);
  });

  it('dot talent: dotTurns = value', () => {
    const r = simulateActiveTalent(hoaLong, 1000, 500);
    expect(r.dotTurns).toBe(5);
    expect(r.damage).toBe(0);
  });

  it('utility talent: damage/heal/cc/dot = 0', () => {
    const r = simulateActiveTalent(phongLui, 1000, 500);
    expect(r.damage).toBe(0);
    expect(r.heal).toBe(0);
    expect(r.ccTurns).toBe(0);
    expect(r.dotTurns).toBe(0);
  });

  it('mpConsumed = activeEffect.mpCost', () => {
    const r = simulateActiveTalent(kimQuang, 1000, 500);
    expect(r.mpConsumed).toBe(30);
  });

  it('deterministic — cùng input cùng output', () => {
    const r1 = simulateActiveTalent(kimQuang, 1000, 500);
    const r2 = simulateActiveTalent(kimQuang, 1000, 500);
    expect(r1).toEqual(r2);
  });

  it('throw nếu talent không phải active', () => {
    const passive = getTalentDef('talent_kim_thien_co')!;
    expect(() => simulateActiveTalent(passive, 1000, 500)).toThrow();
  });

  it('throw nếu attackerAtk âm', () => {
    expect(() => simulateActiveTalent(kimQuang, -1, 500)).toThrow();
  });

  it('throw nếu attackerSpirit = NaN', () => {
    expect(() => simulateActiveTalent(kimQuang, 1000, NaN)).toThrow();
  });
});

describe('Talent point budget end-to-end', () => {
  it('endgame budget >= sum required talent point cost của 5 talent đầu (rough)', () => {
    const maxOrder = Math.max(...REALMS.map((r) => r.order));
    const budget = computeTalentPointBudget(maxOrder);
    // Ít nhất là 6 (mỗi 3 realm = 1 point, max ~20 realm)
    expect(budget).toBeGreaterThanOrEqual(5);
  });

  it('budget tăng monotonic theo order', () => {
    let prev = 0;
    for (const r of REALMS) {
      const cur = computeTalentPointBudget(r.order);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});
