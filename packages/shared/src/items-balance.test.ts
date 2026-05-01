/**
 * Items balance + integrity guard (Phase 10 PR-1).
 *
 * Purpose:
 *   - Hard-cap stat budget per quality (atk/def/hpMax/mpMax/spirit) per
 *     `docs/BALANCE_MODEL.md` §3.3 — block silent power creep when
 *     content authors add new items.
 *   - Required-fields check (key/name/description/kind/quality/price)
 *     để mọi item có hiển thị FE và shop logic không null-ref.
 *   - Price ≥ 0 (vendor sell hợp lệ) — anti negative-price exploit.
 *   - Pill effect non-zero (regression nếu copy-paste một pill quên
 *     fill `effect`).
 *   - Equipment có `slot` valid và bonuses non-empty (guard equip
 *     pipeline).
 *   - Description length ≥ 10 (anti placeholder "TODO" / empty).
 */
import { describe, it, expect } from 'vitest';
import { EQUIP_SLOTS, QUALITIES } from './enums';
import { ITEMS, type ItemDef } from './items';

/**
 * Stat caps per quality. Source: docs/BALANCE_MODEL.md §3.3.
 * Number = max **per item** for that single stat. Multi-stat budget
 * (sum of stats × weight) capped softer ở off-slot test bên dưới.
 */
const STAT_CAP: Record<
  ItemDef['quality'],
  { atk: number; def: number; hpMax: number; mpMax: number; spirit: number }
> = {
  PHAM: { atk: 10, def: 8, hpMax: 30, mpMax: 30, spirit: 5 },
  LINH: { atk: 25, def: 20, hpMax: 80, mpMax: 80, spirit: 12 },
  HUYEN: { atk: 60, def: 50, hpMax: 200, mpMax: 200, spirit: 30 },
  TIEN: { atk: 200, def: 160, hpMax: 800, mpMax: 800, spirit: 100 },
  THAN: { atk: 800, def: 600, hpMax: 3000, mpMax: 3000, spirit: 350 },
};

describe('ITEMS — required field contract', () => {
  it('mọi item có key snake_case ASCII, ≥ 2 ký tự', () => {
    for (const item of ITEMS) {
      expect(item.key, `item key invalid: ${JSON.stringify(item.key)}`).toMatch(
        /^[a-z][a-z0-9_]{1,}$/,
      );
    }
  });

  it('mọi item có name không rỗng', () => {
    for (const item of ITEMS) {
      expect(item.name?.length, `item ${item.key} name rỗng`).toBeGreaterThan(0);
    }
  });

  it('mọi item có description ≥ 10 ký tự (anti placeholder)', () => {
    for (const item of ITEMS) {
      expect(
        item.description?.length,
        `item ${item.key} description quá ngắn / rỗng`,
      ).toBeGreaterThanOrEqual(10);
    }
  });

  it('mọi item có quality hợp lệ', () => {
    for (const item of ITEMS) {
      expect(QUALITIES, `item ${item.key} quality lạ`).toContain(item.quality);
    }
  });

  it('mọi item có price ≥ 0 (cho phép = 0 nếu khoá không bán; còn lại > 0)', () => {
    for (const item of ITEMS) {
      expect(item.price, `item ${item.key} price âm`).toBeGreaterThanOrEqual(0);
    }
  });

  it('stackable đúng kiểu boolean', () => {
    for (const item of ITEMS) {
      expect(typeof item.stackable, `item ${item.key} stackable not boolean`).toBe(
        'boolean',
      );
    }
  });
});

describe('ITEMS — equipment integrity', () => {
  const equips = ITEMS.filter((i) => i.slot);

  it('mọi equip có slot ∈ EQUIP_SLOTS', () => {
    for (const item of equips) {
      expect(EQUIP_SLOTS, `item ${item.key} slot không hợp lệ`).toContain(item.slot);
    }
  });

  it('mọi equip có bonuses object non-empty (≥ 1 stat dương)', () => {
    for (const item of equips) {
      expect(item.bonuses, `item ${item.key} thiếu bonuses`).toBeDefined();
      const b = item.bonuses!;
      const sum =
        (b.atk ?? 0) + (b.def ?? 0) + (b.hpMax ?? 0) + (b.mpMax ?? 0) + (b.spirit ?? 0);
      expect(sum, `item ${item.key} bonuses toàn 0`).toBeGreaterThan(0);
    }
  });

  it('không equip nào có bonuses âm', () => {
    for (const item of equips) {
      const b = item.bonuses!;
      const stats: (keyof typeof b)[] = ['atk', 'def', 'hpMax', 'mpMax', 'spirit'];
      for (const k of stats) {
        const v = b[k];
        if (v !== undefined) {
          expect(v, `${item.key}.${String(k)} âm`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('ITEMS — pill / consumable integrity', () => {
  const pills = ITEMS.filter((i) => i.kind.startsWith('PILL'));

  it('mọi pill có effect với ≥ 1 stat dương', () => {
    for (const p of pills) {
      expect(p.effect, `pill ${p.key} thiếu effect`).toBeDefined();
      const e = p.effect!;
      const sum = (e.hp ?? 0) + (e.mp ?? 0) + (e.exp ?? 0);
      expect(sum, `pill ${p.key} effect toàn 0`).toBeGreaterThan(0);
    }
  });

  it('mọi pill stackable = true', () => {
    for (const p of pills) {
      expect(p.stackable, `pill ${p.key} không stackable`).toBe(true);
    }
  });

  it('không pill nào có effect âm', () => {
    for (const p of pills) {
      const e = p.effect!;
      for (const k of ['hp', 'mp', 'exp'] as const) {
        const v = e[k];
        if (v !== undefined) {
          expect(v, `pill ${p.key}.effect.${k} âm`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('ITEMS — stat budget by quality (BALANCE_MODEL §3.3)', () => {
  const equips = ITEMS.filter((i) => i.slot && i.bonuses);

  it('mọi atk bonus ≤ cap quality', () => {
    for (const item of equips) {
      const cap = STAT_CAP[item.quality].atk;
      const v = item.bonuses!.atk ?? 0;
      expect(v, `${item.key} (${item.quality}) atk ${v} > cap ${cap}`).toBeLessThanOrEqual(
        cap,
      );
    }
  });

  it('mọi def bonus ≤ cap quality', () => {
    for (const item of equips) {
      const cap = STAT_CAP[item.quality].def;
      const v = item.bonuses!.def ?? 0;
      expect(v, `${item.key} (${item.quality}) def ${v} > cap ${cap}`).toBeLessThanOrEqual(
        cap,
      );
    }
  });

  it('mọi hpMax bonus ≤ cap quality', () => {
    for (const item of equips) {
      const cap = STAT_CAP[item.quality].hpMax;
      const v = item.bonuses!.hpMax ?? 0;
      expect(
        v,
        `${item.key} (${item.quality}) hpMax ${v} > cap ${cap}`,
      ).toBeLessThanOrEqual(cap);
    }
  });

  it('mọi mpMax bonus ≤ cap quality', () => {
    for (const item of equips) {
      const cap = STAT_CAP[item.quality].mpMax;
      const v = item.bonuses!.mpMax ?? 0;
      expect(
        v,
        `${item.key} (${item.quality}) mpMax ${v} > cap ${cap}`,
      ).toBeLessThanOrEqual(cap);
    }
  });

  it('mọi spirit bonus ≤ cap quality', () => {
    for (const item of equips) {
      const cap = STAT_CAP[item.quality].spirit;
      const v = item.bonuses!.spirit ?? 0;
      expect(
        v,
        `${item.key} (${item.quality}) spirit ${v} > cap ${cap}`,
      ).toBeLessThanOrEqual(cap);
    }
  });

  it('multi-stat power-equiv ≤ 1.2× atk cap (off-slot soft budget)', () => {
    /**
     * Power-equiv weight: atk:1.0 / def:0.8 / hpMax:0.05 / mpMax:0.05 /
     * spirit:1.5 (BALANCE_MODEL §3.3 Multi-stat). Off-slot có thể
     * lệch tối đa 1.2× cap atk của quality. Weapon (slot=WEAPON) vẫn
     * apply cap atk 1.0× ở test atk ở trên — không cần check riêng.
     */
    for (const item of equips) {
      const b = item.bonuses!;
      const eq =
        (b.atk ?? 0) +
        (b.def ?? 0) * 0.8 +
        (b.hpMax ?? 0) * 0.05 +
        (b.mpMax ?? 0) * 0.05 +
        (b.spirit ?? 0) * 1.5;
      const cap = STAT_CAP[item.quality].atk * 1.2;
      expect(
        eq,
        `${item.key} (${item.quality}) power-equiv ${eq.toFixed(1)} > soft cap ${cap}`,
      ).toBeLessThanOrEqual(cap);
    }
  });
});

describe('ITEMS — Phase 10 catalog growth invariant', () => {
  it('catalog size ≥ 80 (Phase 10 PR-1 target: > 30 → 80)', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(80);
  });

  it('mỗi quality có ≥ 3 item (đủ phủ early→late)', () => {
    for (const q of QUALITIES) {
      const count = ITEMS.filter((i) => i.quality === q).length;
      expect(count, `quality ${q} chỉ có ${count} item`).toBeGreaterThanOrEqual(3);
    }
  });

  it('mỗi equip slot có ≥ 2 item (đủ replace khi grind)', () => {
    for (const slot of EQUIP_SLOTS) {
      const count = ITEMS.filter((i) => i.slot === slot).length;
      expect(count, `slot ${slot} chỉ có ${count} item`).toBeGreaterThanOrEqual(2);
    }
  });
});
