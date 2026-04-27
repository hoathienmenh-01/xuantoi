import { describe, expect, it } from 'vitest';
import {
  REALMS,
  realmByKey,
  fullRealmName,
  expCostForStage,
  nextRealm,
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
