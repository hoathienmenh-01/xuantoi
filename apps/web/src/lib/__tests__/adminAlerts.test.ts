import { describe, it, expect } from 'vitest';
import type { AdminEconomyAlerts } from '@/api/admin';
import { countEconomyAlerts, alertSeverity } from '@/lib/adminAlerts';

function makeAlerts(overrides: Partial<AdminEconomyAlerts> = {}): AdminEconomyAlerts {
  return {
    negativeCurrency: [],
    negativeInventory: [],
    stalePendingTopups: [],
    staleHours: 24,
    generatedAt: '2026-04-29T19:30:00.000Z',
    ...overrides,
  };
}

describe('countEconomyAlerts', () => {
  it('trả 0 khi alerts null', () => {
    expect(countEconomyAlerts(null)).toBe(0);
  });

  it('trả 0 khi alerts undefined', () => {
    expect(countEconomyAlerts(undefined)).toBe(0);
  });

  it('trả 0 khi tất cả mảng rỗng', () => {
    expect(countEconomyAlerts(makeAlerts())).toBe(0);
  });

  it('cộng đủ 3 nguồn cảnh báo', () => {
    const a = makeAlerts({
      negativeCurrency: [
        {
          characterId: 'c1',
          name: 'A',
          userEmail: 'a@x',
          linhThach: '-100',
          tienNgoc: -5,
          tienNgocKhoa: 0,
        },
      ],
      negativeInventory: [
        { inventoryItemId: 'i1', characterId: 'c1', characterName: 'A', itemKey: 'k', qty: -1 },
        { inventoryItemId: 'i2', characterId: 'c2', characterName: 'B', itemKey: 'k', qty: 0 },
      ],
      stalePendingTopups: [
        {
          id: 't1',
          userEmail: 'a@x',
          packageKey: 'p10',
          tienNgocAmount: 100,
          createdAt: '2026-04-28T00:00:00Z',
          ageHours: 30,
        },
      ],
    });
    expect(countEconomyAlerts(a)).toBe(4); // 1 + 2 + 1
  });

  it('chỉ negativeCurrency', () => {
    const a = makeAlerts({
      negativeCurrency: [
        {
          characterId: 'c1',
          name: 'A',
          userEmail: 'a@x',
          linhThach: '-1',
          tienNgoc: 0,
          tienNgocKhoa: 0,
        },
      ],
    });
    expect(countEconomyAlerts(a)).toBe(1);
  });
});

describe('alertSeverity', () => {
  it('count 0 → none', () => {
    expect(alertSeverity(0)).toBe('none');
  });

  it('count âm (defensive) → none', () => {
    expect(alertSeverity(-3)).toBe('none');
  });

  it('count 1 → low', () => {
    expect(alertSeverity(1)).toBe('low');
  });

  it('count 2 → low (boundary)', () => {
    expect(alertSeverity(2)).toBe('low');
  });

  it('count 3 → medium (boundary)', () => {
    expect(alertSeverity(3)).toBe('medium');
  });

  it('count 9 → medium (boundary)', () => {
    expect(alertSeverity(9)).toBe('medium');
  });

  it('count 10 → high (boundary)', () => {
    expect(alertSeverity(10)).toBe('high');
  });

  it('count rất lớn → high', () => {
    expect(alertSeverity(9999)).toBe('high');
  });
});
