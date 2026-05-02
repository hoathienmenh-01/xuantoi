import { describe, it, expect } from 'vitest';
import {
  GEMS,
  GEM_GRADES,
  GemGrade,
  getGemDef,
  gemsByElement,
  gemsByGrade,
  composeSocketBonus,
  combineGems,
  canSocketGem,
  gemUpgradePathCost,
  socketCapacityForQuality,
} from './gems';
import { ELEMENTS, type ElementKey } from './combat';

describe('GEMS catalog shape', () => {
  it('có đúng 25 gem (5 element × 5 grade)', () => {
    expect(GEMS).toHaveLength(25);
  });

  it('mọi gem có key unique', () => {
    const keys = GEMS.map((g) => g.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('mọi gem có required fields non-empty', () => {
    for (const g of GEMS) {
      expect(g.key).toMatch(/^gem_(kim|moc|thuy|hoa|tho)_(pham|linh|huyen|tien|than)$/);
      expect(g.name.length).toBeGreaterThan(0);
      expect(g.description.length).toBeGreaterThan(0);
      expect(ELEMENTS).toContain(g.element);
      expect(GEM_GRADES).toContain(g.grade);
      expect(g.compatibleSlots.length).toBeGreaterThan(0);
      expect(g.price).toBeGreaterThan(0);
      expect(['sect_shop', 'dungeon_drop', 'boss_drop', 'event', 'craft', 'starter']).toContain(
        g.source
      );
    }
  });

  it('mọi gem có ít nhất 1 stat trong bonus', () => {
    for (const g of GEMS) {
      const totalStats = Object.values(g.bonus).reduce(
        (sum, v) => sum + Math.abs(v ?? 0),
        0
      );
      expect(totalStats).toBeGreaterThan(0);
    }
  });

  it('mọi gem THAN có nextTierKey = null; gem PHAM/LINH/HUYEN/TIEN có nextTierKey trỏ tới gem cùng element grade kế tiếp', () => {
    for (const g of GEMS) {
      if (g.grade === 'THAN') {
        expect(g.nextTierKey).toBeNull();
      } else {
        expect(g.nextTierKey).toBeTruthy();
        const next = getGemDef(g.nextTierKey!);
        expect(next).toBeDefined();
        expect(next!.element).toBe(g.element);
        const fromIdx = GEM_GRADES.indexOf(g.grade);
        const nextIdx = GEM_GRADES.indexOf(next!.grade);
        expect(nextIdx).toBe(fromIdx + 1);
      }
    }
  });
});

describe('GEMS coverage', () => {
  it('mỗi element (Kim/Mộc/Thuỷ/Hoả/Thổ) có đúng 5 gem (5 grade)', () => {
    for (const element of ELEMENTS) {
      const list = gemsByElement(element);
      expect(list).toHaveLength(GEM_GRADES.length);
      // Mỗi grade xuất hiện đúng 1 lần
      const grades = list.map((g) => g.grade);
      expect(new Set(grades).size).toBe(GEM_GRADES.length);
    }
  });

  it('mỗi grade có đúng 5 gem (5 element)', () => {
    for (const grade of GEM_GRADES) {
      const list = gemsByGrade(grade);
      expect(list).toHaveLength(ELEMENTS.length);
    }
  });
});

describe('GEMS balance', () => {
  it('price monotonic strictly increasing theo grade per element', () => {
    for (const element of ELEMENTS) {
      const sorted = gemsByElement(element).sort(
        (a, b) => GEM_GRADES.indexOf(a.grade) - GEM_GRADES.indexOf(b.grade)
      );
      let last = 0;
      for (const g of sorted) {
        expect(g.price).toBeGreaterThan(last);
        last = g.price;
      }
    }
  });

  it('atk bonus monotonic non-decreasing theo grade cho element atk-type (Kim/Hoả)', () => {
    for (const element of ['kim', 'hoa'] as ElementKey[]) {
      const sorted = gemsByElement(element).sort(
        (a, b) => GEM_GRADES.indexOf(a.grade) - GEM_GRADES.indexOf(b.grade)
      );
      let last = 0;
      for (const g of sorted) {
        const atk = g.bonus.atk ?? 0;
        expect(atk).toBeGreaterThanOrEqual(last);
        last = atk;
      }
    }
  });

  it('def bonus monotonic non-decreasing theo grade cho Thổ', () => {
    const sorted = gemsByElement('tho').sort(
      (a, b) => GEM_GRADES.indexOf(a.grade) - GEM_GRADES.indexOf(b.grade)
    );
    let last = 0;
    for (const g of sorted) {
      const def = g.bonus.def ?? 0;
      expect(def).toBeGreaterThanOrEqual(last);
      last = def;
    }
  });

  it('hpMax bonus monotonic non-decreasing theo grade cho Mộc', () => {
    const sorted = gemsByElement('moc').sort(
      (a, b) => GEM_GRADES.indexOf(a.grade) - GEM_GRADES.indexOf(b.grade)
    );
    let last = 0;
    for (const g of sorted) {
      const hp = g.bonus.hpMax ?? 0;
      expect(hp).toBeGreaterThanOrEqual(last);
      last = hp;
    }
  });

  it('mpMax bonus monotonic non-decreasing theo grade cho Thuỷ', () => {
    const sorted = gemsByElement('thuy').sort(
      (a, b) => GEM_GRADES.indexOf(a.grade) - GEM_GRADES.indexOf(b.grade)
    );
    let last = 0;
    for (const g of sorted) {
      const mp = g.bonus.mpMax ?? 0;
      expect(mp).toBeGreaterThanOrEqual(last);
      last = mp;
    }
  });

  it('Hoả gem có def trade-off (def < 0 — gem Hoả rủi ro phòng thủ)', () => {
    for (const g of gemsByElement('hoa')) {
      const def = g.bonus.def ?? 0;
      expect(def).toBeLessThan(0);
    }
  });

  it('combine sink rule: 3× bonus của 1 gem grade thấp > bonus của 1 gem grade cao (combine = sink, không pure upgrade)', () => {
    // Kim element atk: PHAM=3, LINH=5  → 3×3=9 > 5 ✓
    const phamKim = getGemDef('gem_kim_pham')!;
    const linhKim = getGemDef('gem_kim_linh')!;
    expect((phamKim.bonus.atk ?? 0) * 3).toBeGreaterThan(linhKim.bonus.atk ?? 0);

    // Mộc element hpMax: PHAM=15, LINH=24 → 3×15=45 > 24 ✓
    const phamMoc = getGemDef('gem_moc_pham')!;
    const linhMoc = getGemDef('gem_moc_linh')!;
    expect((phamMoc.bonus.hpMax ?? 0) * 3).toBeGreaterThan(linhMoc.bonus.hpMax ?? 0);
  });

  it('compatibleSlots phù hợp với element (Kim → WEAPON, Mộc → ARMOR/HAT, Thổ → ARMOR/BELT/BOOTS, Thuỷ → ARTIFACT/TRAM, Hoả → WEAPON/ARTIFACT)', () => {
    const expected: Record<ElementKey, string[]> = {
      kim: ['WEAPON'],
      moc: ['ARMOR', 'HAT'],
      thuy: ['ARTIFACT', 'TRAM'],
      hoa: ['WEAPON', 'ARTIFACT'],
      tho: ['ARMOR', 'BELT', 'BOOTS'],
    };
    for (const element of ELEMENTS) {
      for (const g of gemsByElement(element)) {
        expect([...g.compatibleSlots].sort()).toEqual(expected[element].sort());
      }
    }
  });
});

describe('helpers', () => {
  it('getGemDef trả về gem đúng theo key', () => {
    const g = getGemDef('gem_kim_pham');
    expect(g).toBeDefined();
    expect(g!.element).toBe('kim');
    expect(g!.grade).toBe('PHAM');
  });

  it('getGemDef trả undefined với key không tồn tại', () => {
    expect(getGemDef('khong_co_gem')).toBeUndefined();
  });

  it('gemsByElement filter đúng element', () => {
    const list = gemsByElement('thuy');
    expect(list.length).toBe(GEM_GRADES.length);
    for (const g of list) {
      expect(g.element).toBe('thuy');
    }
  });

  it('gemsByGrade filter đúng grade', () => {
    const list = gemsByGrade('TIEN' as GemGrade);
    expect(list.length).toBe(ELEMENTS.length);
    for (const g of list) {
      expect(g.grade).toBe('TIEN');
    }
  });
});

describe('composeSocketBonus', () => {
  it('empty array trả empty bonus', () => {
    expect(composeSocketBonus([])).toEqual({});
  });

  it('1 gem trả về bonus của gem đó (chỉ trim zero fields)', () => {
    const result = composeSocketBonus(['gem_kim_pham']);
    const gem = getGemDef('gem_kim_pham')!;
    if (gem.bonus.atk) expect(result.atk).toBe(gem.bonus.atk);
    if (gem.bonus.spirit) expect(result.spirit).toBe(gem.bonus.spirit);
  });

  it('3× cùng gem → bonus ×3', () => {
    const result = composeSocketBonus(['gem_kim_pham', 'gem_kim_pham', 'gem_kim_pham']);
    const gem = getGemDef('gem_kim_pham')!;
    expect(result.atk).toBe((gem.bonus.atk ?? 0) * 3);
    expect(result.spirit).toBe((gem.bonus.spirit ?? 0) * 3);
  });

  it('mix gem khác element → tổng additive đúng từng stat', () => {
    const result = composeSocketBonus(['gem_kim_pham', 'gem_moc_pham', 'gem_tho_pham']);
    const kim = getGemDef('gem_kim_pham')!;
    const moc = getGemDef('gem_moc_pham')!;
    const tho = getGemDef('gem_tho_pham')!;
    expect(result.atk).toBe(kim.bonus.atk ?? 0);
    expect(result.hpMax).toBe((moc.bonus.hpMax ?? 0) + (tho.bonus.hpMax ?? 0));
    expect(result.def).toBe(tho.bonus.def ?? 0);
  });

  it('skip key không tồn tại (graceful)', () => {
    const result = composeSocketBonus(['gem_kim_pham', 'gem_unknown_xxx']);
    const gem = getGemDef('gem_kim_pham')!;
    expect(result.atk).toBe(gem.bonus.atk ?? 0);
  });
});

describe('combineGems', () => {
  it('3× PHAM → 1× LINH cùng element', () => {
    const result = combineGems('gem_kim_pham');
    expect(result).not.toBeNull();
    expect(result!.srcKey).toBe('gem_kim_pham');
    expect(result!.srcQtyConsumed).toBe(3);
    expect(result!.resultKey).toBe('gem_kim_linh');
    expect(result!.resultQtyGained).toBe(1);
  });

  it('3× TIEN → 1× THAN', () => {
    const result = combineGems('gem_thuy_tien');
    expect(result).not.toBeNull();
    expect(result!.resultKey).toBe('gem_thuy_than');
  });

  it('THAN không combine được nữa (return null)', () => {
    expect(combineGems('gem_kim_than')).toBeNull();
  });

  it('key không tồn tại trả null', () => {
    expect(combineGems('khong_co')).toBeNull();
  });
});

describe('canSocketGem', () => {
  it('Kim gem socket WEAPON → true', () => {
    expect(canSocketGem('gem_kim_pham', 'WEAPON')).toBe(true);
  });

  it('Kim gem socket ARMOR → false (Kim chỉ WEAPON)', () => {
    expect(canSocketGem('gem_kim_pham', 'ARMOR')).toBe(false);
  });

  it('Mộc gem socket ARMOR → true; HAT → true; WEAPON → false', () => {
    expect(canSocketGem('gem_moc_linh', 'ARMOR')).toBe(true);
    expect(canSocketGem('gem_moc_linh', 'HAT')).toBe(true);
    expect(canSocketGem('gem_moc_linh', 'WEAPON')).toBe(false);
  });

  it('Hoả gem socket WEAPON / ARTIFACT → true', () => {
    expect(canSocketGem('gem_hoa_huyen', 'WEAPON')).toBe(true);
    expect(canSocketGem('gem_hoa_huyen', 'ARTIFACT')).toBe(true);
  });

  it('key không tồn tại → false', () => {
    expect(canSocketGem('khong_co', 'WEAPON')).toBe(false);
  });
});

describe('gemUpgradePathCost', () => {
  it('PHAM → LINH: 3 gem, 1 step', () => {
    const cost = gemUpgradePathCost('gem_kim_pham', 'gem_kim_linh');
    expect(cost.gemsRequired).toBe(3);
    expect(cost.pathSteps).toBe(1);
  });

  it('PHAM → HUYEN: 9 gem, 2 step (3^2)', () => {
    const cost = gemUpgradePathCost('gem_kim_pham', 'gem_kim_huyen');
    expect(cost.gemsRequired).toBe(9);
    expect(cost.pathSteps).toBe(2);
  });

  it('PHAM → THAN: 81 gem, 4 step (3^4)', () => {
    const cost = gemUpgradePathCost('gem_kim_pham', 'gem_kim_than');
    expect(cost.gemsRequired).toBe(81);
    expect(cost.pathSteps).toBe(4);
  });

  it('throw nếu element mismatch', () => {
    expect(() => gemUpgradePathCost('gem_kim_pham', 'gem_moc_linh')).toThrow(
      /element mismatch/
    );
  });

  it('throw nếu toGrade <= fromGrade', () => {
    expect(() => gemUpgradePathCost('gem_kim_linh', 'gem_kim_pham')).toThrow(/<=/);
    expect(() => gemUpgradePathCost('gem_kim_linh', 'gem_kim_linh')).toThrow(/<=/);
  });

  it('throw nếu key không tồn tại', () => {
    expect(() => gemUpgradePathCost('xxx', 'gem_kim_linh')).toThrow(/unknown fromKey/);
    expect(() => gemUpgradePathCost('gem_kim_pham', 'xxx')).toThrow(/unknown toKey/);
  });
});

describe('socketCapacityForQuality (Phase 11.4.B)', () => {
  it('PHAM = 0, LINH = 1, HUYEN = 2, TIEN = 3, THAN = 4', () => {
    expect(socketCapacityForQuality('PHAM')).toBe(0);
    expect(socketCapacityForQuality('LINH')).toBe(1);
    expect(socketCapacityForQuality('HUYEN')).toBe(2);
    expect(socketCapacityForQuality('TIEN')).toBe(3);
    expect(socketCapacityForQuality('THAN')).toBe(4);
  });

  it('capacity tăng monotonically theo grade tier', () => {
    const grades: GemGrade[] = ['PHAM', 'LINH', 'HUYEN', 'TIEN', 'THAN'];
    for (let i = 1; i < grades.length; i++) {
      expect(socketCapacityForQuality(grades[i])).toBeGreaterThan(
        socketCapacityForQuality(grades[i - 1]),
      );
    }
  });

  it('capacity tối đa = 4 (THAN tier)', () => {
    for (const grade of GEM_GRADES) {
      expect(socketCapacityForQuality(grade)).toBeLessThanOrEqual(4);
      expect(socketCapacityForQuality(grade)).toBeGreaterThanOrEqual(0);
    }
  });
});
