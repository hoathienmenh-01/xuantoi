import { describe, expect, it } from 'vitest';
import {
  REALMS,
  getBreakthroughCost,
  getCultivationExpPerSec,
  getNextRealmStage,
  getRealmStageName,
  realmByKey,
} from './realms';

describe('REALMS', () => {
  it('có đúng 10 đại cảnh giới + mỗi cảnh 9 trọng', () => {
    expect(REALMS).toHaveLength(10);
    for (const r of REALMS) {
      expect(r.stages).toBe(9);
    }
  });

  it('tên đúng 10 đại cảnh giới MVP', () => {
    expect(REALMS.map((r) => r.name)).toEqual([
      'Luyện Khí',
      'Trúc Cơ',
      'Kim Đan',
      'Nguyên Anh',
      'Hoá Thần',
      'Luyện Hư',
      'Hợp Thể',
      'Đại Thừa',
      'Độ Kiếp',
      'Chân Tiên',
    ]);
  });
});

describe('getRealmStageName', () => {
  it('trả về "Luyện Khí Nhất Trọng" cho stage 1', () => {
    expect(getRealmStageName('luyen_khi', 1)).toBe('Luyện Khí Nhất Trọng');
  });
  it('trả về "Kim Đan Tam Trọng" cho stage 3', () => {
    expect(getRealmStageName('kim_dan', 3)).toBe('Kim Đan Tam Trọng');
  });
  it('clamp stage > 9 về Cửu', () => {
    expect(getRealmStageName('luyen_khi', 99)).toBe('Luyện Khí Cửu Trọng');
  });
  it('realm không tồn tại trả về "Vô Danh"', () => {
    expect(getRealmStageName('xxx', 1)).toBe('Vô Danh');
  });
});

describe('getBreakthroughCost', () => {
  it('Luyện Khí Nhất → Nhị = 100', () => {
    expect(getBreakthroughCost('luyen_khi', 1)).toBe(100n);
  });
  it('Luyện Khí Nhị → Tam = 100 * 1.45 = 145', () => {
    expect(getBreakthroughCost('luyen_khi', 2)).toBe(145n);
  });
  it('Trúc Cơ Nhất → Nhị = 100 * 2.2 = 220', () => {
    expect(getBreakthroughCost('truc_co', 1)).toBe(220n);
  });
  it('Kim Đan Nhất → Nhị = 100 * 2.2^2 = 484', () => {
    expect(getBreakthroughCost('kim_dan', 1)).toBe(484n);
  });
  it('Chân Tiên (đỉnh) Cửu Trọng → 0n', () => {
    expect(getBreakthroughCost('chan_tien', 9)).toBe(0n);
  });
});

describe('getNextRealmStage', () => {
  it('Luyện Khí stage 1 → stage 2', () => {
    expect(getNextRealmStage('luyen_khi', 1)).toEqual({
      realmKey: 'luyen_khi',
      stage: 2,
    });
  });
  it('Luyện Khí stage 9 → Trúc Cơ stage 1', () => {
    expect(getNextRealmStage('luyen_khi', 9)).toEqual({
      realmKey: 'truc_co',
      stage: 1,
    });
  });
  it('Chân Tiên stage 9 → null (đã đỉnh)', () => {
    expect(getNextRealmStage('chan_tien', 9)).toBeNull();
  });
  it('realm không tồn tại → null', () => {
    expect(getNextRealmStage('xxx', 1)).toBeNull();
  });
});

describe('getCultivationExpPerSec', () => {
  it('Luyện Khí = 0.2 EXP/giây = 1 EXP / 5 giây', () => {
    expect(getCultivationExpPerSec('luyen_khi')).toBeCloseTo(0.2, 5);
  });
  it('Trúc Cơ = 0.22 EXP/giây (+10% so với Luyện Khí)', () => {
    expect(getCultivationExpPerSec('truc_co')).toBeCloseTo(0.22, 5);
  });
  it('realm không tồn tại fallback Luyện Khí', () => {
    expect(getCultivationExpPerSec('xxx')).toBeCloseTo(0.2, 5);
  });
});

describe('realmByKey', () => {
  it('lookup theo key đúng thứ tự', () => {
    expect(realmByKey('luyen_khi')?.order).toBe(1);
    expect(realmByKey('chan_tien')?.order).toBe(10);
  });
});
