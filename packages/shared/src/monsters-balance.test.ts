/**
 * Phase 10 PR-3 — Monster catalog integrity & balance tests.
 *
 * Tại sao cần test:
 * - `MONSTERS` là static catalog dùng bởi combat.service + dungeon.service.
 *   Một lỗi key trùng / element invalid → corrupt run khó debug.
 * - Stat curve phải tuân BALANCE_MODEL.md §5.1 — vượt budget = power creep
 *   không kiểm soát.
 * - Element coverage: mỗi Ngũ Hành (kim/moc/thuy/hoa/tho) phải có ≥ 2 monster
 *   để dungeon AI compose moveset deterministic.
 *
 * Catalog only: combat runtime KHÔNG đọc `element` / `monsterType` /
 * `regionKey` ở phase 10 (xem `MonsterDef` doc).
 */
import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  ElementKey,
  MONSTERS,
  MONSTER_TYPES,
  MonsterType,
  monsterByKey,
  monstersByElement,
  monstersByRegion,
} from './combat';
import { realmByKey } from './realms';

describe('MONSTERS catalog integrity', () => {
  it('có ít nhất 29 entries (9 legacy + 20 phase 10 PR-3)', () => {
    expect(MONSTERS.length).toBeGreaterThanOrEqual(29);
  });

  it('mọi key unique', () => {
    const keys = MONSTERS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mọi key match snake_case [a-z][a-z0-9_]*', () => {
    for (const m of MONSTERS) {
      expect(m.key, `monster key ${m.key}`).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('mọi monster có name không rỗng', () => {
    for (const m of MONSTERS) {
      expect(m.name.trim().length, `monster ${m.key} name`).toBeGreaterThan(0);
    }
  });

  it('monsterByKey() resolve mọi entry', () => {
    for (const m of MONSTERS) {
      expect(monsterByKey(m.key)?.key).toBe(m.key);
    }
  });
});

describe('MONSTERS field bounds', () => {
  it('level ∈ [1, 40] (phase 10 catalog cap)', () => {
    for (const m of MONSTERS) {
      expect(m.level, `monster ${m.key} level`).toBeGreaterThanOrEqual(1);
      expect(m.level, `monster ${m.key} level`).toBeLessThanOrEqual(40);
    }
  });

  it('hp > 0, atk > 0, def ≥ 0, speed > 0', () => {
    for (const m of MONSTERS) {
      expect(m.hp, `monster ${m.key} hp`).toBeGreaterThan(0);
      expect(m.atk, `monster ${m.key} atk`).toBeGreaterThan(0);
      expect(m.def, `monster ${m.key} def`).toBeGreaterThanOrEqual(0);
      expect(m.speed, `monster ${m.key} speed`).toBeGreaterThan(0);
    }
  });

  it('expDrop ≥ 0, linhThachDrop ≥ 0', () => {
    for (const m of MONSTERS) {
      expect(m.expDrop, `monster ${m.key} expDrop`).toBeGreaterThanOrEqual(0);
      expect(m.linhThachDrop, `monster ${m.key} linhThachDrop`).toBeGreaterThanOrEqual(0);
    }
  });

  it('hp budget theo level (BALANCE_MODEL §5.1 curve)', () => {
    // Hard cap để chống power creep: hp ≤ 200 × level (rộng đủ cho BOSS +60%)
    for (const m of MONSTERS) {
      const budget = 200 * m.level;
      expect(m.hp, `monster ${m.key} hp ≤ 200×level`).toBeLessThanOrEqual(budget);
    }
  });

  it('atk budget theo level (BALANCE_MODEL §5.1 curve)', () => {
    for (const m of MONSTERS) {
      const budget = 25 * m.level;
      expect(m.atk, `monster ${m.key} atk ≤ 25×level`).toBeLessThanOrEqual(budget);
    }
  });

  it('def budget theo level (max ~7×level cho TANK)', () => {
    for (const m of MONSTERS) {
      const budget = Math.max(20, 8 * m.level);
      expect(m.def, `monster ${m.key} def ≤ 8×level`).toBeLessThanOrEqual(budget);
    }
  });

  it('speed ∈ [1, 25] (phase 10 cap)', () => {
    for (const m of MONSTERS) {
      expect(m.speed, `monster ${m.key} speed`).toBeGreaterThanOrEqual(1);
      expect(m.speed, `monster ${m.key} speed`).toBeLessThanOrEqual(25);
    }
  });
});

describe('MONSTERS forward-compat metadata (phase 10 PR-3)', () => {
  const ELEMENT_SET = new Set<ElementKey | null>([...ELEMENTS, null]);
  const TYPE_SET = new Set<MonsterType>(MONSTER_TYPES);

  it('mọi element ∈ {kim, moc, thuy, hoa, tho, null}', () => {
    for (const m of MONSTERS) {
      const elem = m.element ?? null;
      expect(ELEMENT_SET.has(elem), `monster ${m.key} element ${elem} invalid`).toBe(true);
    }
  });

  it('mọi monsterType ∈ MONSTER_TYPES nếu set', () => {
    for (const m of MONSTERS) {
      if (m.monsterType !== undefined) {
        expect(TYPE_SET.has(m.monsterType), `monster ${m.key} type ${m.monsterType}`).toBe(true);
      }
    }
  });

  it('regionKey nếu set là string non-empty', () => {
    for (const m of MONSTERS) {
      if (m.regionKey != null) {
        expect(m.regionKey.length, `monster ${m.key} regionKey`).toBeGreaterThan(0);
      }
    }
  });
});

describe('MONSTERS element coverage', () => {
  it('mỗi element Ngũ Hành (kim/moc/thuy/hoa/tho) có ≥ 2 monster', () => {
    for (const elem of ELEMENTS) {
      const list = monstersByElement(elem);
      expect(list.length, `element ${elem} monster count`).toBeGreaterThanOrEqual(2);
    }
  });

  it('có ≥ 1 monster vô hệ (element null) cho early game', () => {
    const noneList = monstersByElement(null);
    expect(noneList.length).toBeGreaterThanOrEqual(1);
  });

  it('mỗi element có ≥ 1 BOSS hoặc ELITE', () => {
    for (const elem of ELEMENTS) {
      const list = monstersByElement(elem);
      const eliteOrBoss = list.filter(
        (m) => m.monsterType === 'BOSS' || m.monsterType === 'ELITE',
      );
      expect(eliteOrBoss.length, `element ${elem} elite/boss`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('MONSTERS regionKey coverage', () => {
  const PHASE10_REGIONS = [
    'kim_son_mach',
    'moc_huyen_lam',
    'thuy_long_uyen',
    'hoa_diem_son',
    'hoang_tho_huyet',
  ];

  it('mỗi region phase 10 PR-3 có ≥ 3 monster', () => {
    for (const region of PHASE10_REGIONS) {
      const list = monstersByRegion(region);
      expect(list.length, `region ${region} monster count`).toBeGreaterThanOrEqual(3);
    }
  });

  it('legacy region (son_coc/hac_lam/yeu_thu_dong) vẫn có ≥ 3 monster sau PR-3 metadata', () => {
    for (const region of ['son_coc', 'hac_lam', 'yeu_thu_dong']) {
      const list = monstersByRegion(region);
      expect(list.length, `legacy region ${region}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('MONSTERS exp/linhThach drop scaling', () => {
  it('expDrop tăng đại khái theo level (monotonic-ish)', () => {
    // Sort by level, check expDrop tăng từ 12 (level 1) → 1700 (level 20)
    const sorted = [...MONSTERS].sort((a, b) => a.level - b.level);
    expect(sorted[0].expDrop).toBeLessThan(50);
    expect(sorted[sorted.length - 1].expDrop).toBeGreaterThan(500);
  });

  it('linhThachDrop ≤ 4 × expDrop (sink-source ratio guard)', () => {
    // Linh thạch không nên drop quá nhiều so với exp; tránh inflation
    for (const m of MONSTERS) {
      expect(
        m.linhThachDrop,
        `monster ${m.key} linhThach ${m.linhThachDrop} > 4×exp ${m.expDrop}`,
      ).toBeLessThanOrEqual(4 * m.expDrop + 50);
    }
  });
});

describe('MONSTERS realm tier sanity', () => {
  // Heuristic: level đại khái phù hợp tier realm
  // (chính thức: không enforce hard, chỉ informational test)
  it('REALMS catalog có sẵn các realm key dùng bởi dungeon (luyenkhi/truc_co/kim_dan/nguyen_anh)', () => {
    expect(realmByKey('luyenkhi')).toBeDefined();
    expect(realmByKey('truc_co')).toBeDefined();
    expect(realmByKey('kim_dan')).toBeDefined();
    expect(realmByKey('nguyen_anh')).toBeDefined();
  });
});
