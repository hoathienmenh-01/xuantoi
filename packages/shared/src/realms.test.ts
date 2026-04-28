import { describe, expect, it } from 'vitest';
import {
  REALMS,
  realmByKey,
  fullRealmName,
  expCostForStage,
  nextRealm,
  cultivationRateForRealm,
} from './realms';

describe('REALMS export', () => {
  it('có ít nhất 10 đại cảnh giới (luyện khí trở lên)', () => {
    expect(REALMS.length).toBeGreaterThanOrEqual(10);
  });

  it('Luyện Khí có 9 trọng', () => {
    const r = realmByKey('luyenkhi');
    expect(r).toBeTruthy();
    expect(r!.stages).toBe(9);
  });
});

describe('fullRealmName', () => {
  it('trả về "Luyện Khí Nhất Trọng" cho stage 1', () => {
    expect(fullRealmName(realmByKey('luyenkhi')!, 1)).toBe('Luyện Khí Nhất Trọng');
  });
  it('trả về "Kim Đan Tam Trọng" cho stage 3', () => {
    expect(fullRealmName(realmByKey('kim_dan')!, 3)).toBe('Kim Đan Tam Trọng');
  });
  it('clamp stage > 9 về Cửu Trọng', () => {
    expect(fullRealmName(realmByKey('luyenkhi')!, 99)).toBe('Luyện Khí Cửu Trọng');
  });
  it('cảnh giới 1 trọng (Phàm Nhân) chỉ hiển thị tên', () => {
    expect(fullRealmName(realmByKey('phamnhan')!, 1)).toBe('Phàm Nhân');
  });
});

describe('expCostForStage', () => {
  it('Luyện Khí trọng 1 = base expCost', () => {
    const r = realmByKey('luyenkhi')!;
    expect(expCostForStage(r, 1)).toBe(r.expCost);
  });
  it('Luyện Khí trọng 2 = base × 1.4 (rounded)', () => {
    const r = realmByKey('luyenkhi')!;
    const expected = BigInt(Math.round(Number(r.expCost) * 1.4));
    expect(expCostForStage(r, 2)).toBe(expected);
  });
  it('overload string: realm không tồn tại trả về null', () => {
    expect(expCostForStage('xxx', 1)).toBeNull();
  });
  it('overload string: trả BigInt cho key hợp lệ', () => {
    expect(typeof expCostForStage('luyenkhi', 1)).toBe('bigint');
  });
});

describe('REALMS balance — full 28 đại cảnh giới (phamnhan..hu_khong_chi_ton)', () => {
  it('có đủ 28 entry', () => {
    expect(REALMS.length).toBe(28);
  });

  it('order tăng liên tục 0..27', () => {
    const orders = REALMS.map((r) => r.order).sort((a, b) => a - b);
    for (let i = 0; i < orders.length; i++) {
      expect(orders[i]).toBe(i);
    }
  });

  it('key duy nhất, name duy nhất', () => {
    const keys = REALMS.map((r) => r.key);
    const names = REALMS.map((r) => r.name);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('expCost đơn điệu tăng theo order (1.6^order)', () => {
    for (let i = 1; i < REALMS.length; i++) {
      expect(REALMS[i].expCost).toBeGreaterThan(REALMS[i - 1].expCost);
    }
  });

  it('expCostForStage tăng 1.4× mỗi trọng', () => {
    const r = realmByKey('kim_dan')!;
    for (let s = 1; s < 9; s++) {
      const cur = Number(expCostForStage(r, s));
      const next = Number(expCostForStage(r, s + 1));
      // tolerance ±1 vì round
      expect(next / cur).toBeCloseTo(1.4, 1);
    }
  });
});

describe('cultivationRateForRealm (5d balance)', () => {
  const BASE = 5;

  it('phamnhan (order 0) → base rate', () => {
    expect(cultivationRateForRealm('phamnhan', BASE)).toBe(BASE);
  });

  it('luyenkhi (order 1) → 7 EXP/tick', () => {
    expect(cultivationRateForRealm('luyenkhi', BASE)).toBe(7);
  });

  it('kim_dan (order 3) → 15 EXP/tick', () => {
    expect(cultivationRateForRealm('kim_dan', BASE)).toBe(15);
  });

  it('nhan_tien (order 10) → ~205 EXP/tick', () => {
    expect(cultivationRateForRealm('nhan_tien', BASE)).toBeGreaterThan(150);
    expect(cultivationRateForRealm('nhan_tien', BASE)).toBeLessThan(300);
  });

  it('hu_khong_chi_ton (order 27) → >100k EXP/tick', () => {
    expect(cultivationRateForRealm('hu_khong_chi_ton', BASE)).toBeGreaterThan(
      100_000,
    );
    expect(cultivationRateForRealm('hu_khong_chi_ton', BASE)).toBeLessThan(
      200_000,
    );
  });

  it('key không tồn tại trả base rate', () => {
    expect(cultivationRateForRealm('xxx', BASE)).toBe(BASE);
  });

  it('rate tăng đơn điệu theo order', () => {
    const rates = REALMS.map((r) => cultivationRateForRealm(r.key, BASE));
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });

  it('thời gian từng realm stage 1 reachable (<24h ở tick 30s mặc định)', () => {
    // tick cycle 30s → 120 ticks/hour
    for (const r of REALMS) {
      if (r.order === 0) continue; // phamnhan stage 1 = 1000 EXP vẫn OK
      const rate = cultivationRateForRealm(r.key, BASE);
      const cap = Number(expCostForStage(r, 1));
      const ticks = cap / rate;
      const hours = ticks / 120;
      // Mỗi realm first stage <= 24 hours tu luyện mặc định (không multiplier)
      expect(hours).toBeLessThanOrEqual(24);
    }
  });
});

describe('nextRealm', () => {
  it('Luyện Khí → Trúc Cơ', () => {
    expect(nextRealm('luyenkhi')?.key).toBe('truc_co');
  });
  it('Trúc Cơ → Kim Đan', () => {
    expect(nextRealm('truc_co')?.key).toBe('kim_dan');
  });
  it('cảnh giới đỉnh trả null', () => {
    expect(nextRealm('hu_khong_chi_ton')).toBeNull();
  });
  it('key không tồn tại trả null', () => {
    expect(nextRealm('xxx')).toBeNull();
  });
});
