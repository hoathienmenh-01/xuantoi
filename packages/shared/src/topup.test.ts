import { describe, it, expect } from 'vitest';
import { TOPUP_PACKAGES, topupPackageByKey } from './topup';

/**
 * TOPUP_PACKAGES catalog integrity (session 9j task N):
 * real-money economy safety. Regression in topup table directly affects
 * revenue — swapped price, negative bonus, or duplicate key would lose
 * money or double-award.
 */

describe('TOPUP_PACKAGES catalog integrity', () => {
  it('có ít nhất 1 package', () => {
    expect(TOPUP_PACKAGES.length).toBeGreaterThan(0);
  });

  it('tất cả key unique (no duplicate)', () => {
    const keys = TOPUP_PACKAGES.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('tất cả package có tienNgoc > 0', () => {
    for (const pkg of TOPUP_PACKAGES) {
      expect(pkg.tienNgoc, `${pkg.key} tienNgoc`).toBeGreaterThan(0);
    }
  });

  it('tất cả package có priceVND > 0', () => {
    for (const pkg of TOPUP_PACKAGES) {
      expect(pkg.priceVND, `${pkg.key} priceVND`).toBeGreaterThan(0);
    }
  });

  it('tất cả package có bonus >= 0 (không âm)', () => {
    for (const pkg of TOPUP_PACKAGES) {
      expect(pkg.bonus, `${pkg.key} bonus`).toBeGreaterThanOrEqual(0);
    }
  });

  it('tất cả package có name + description không rỗng', () => {
    for (const pkg of TOPUP_PACKAGES) {
      expect(pkg.name.trim().length, `${pkg.key} name empty`).toBeGreaterThan(0);
      expect(pkg.description.trim().length, `${pkg.key} desc empty`).toBeGreaterThan(0);
    }
  });

  it('tiên ngọc/giá tăng theo tier (monotonic non-decreasing bởi priceVND)', () => {
    const sorted = [...TOPUP_PACKAGES].sort((a, b) => a.priceVND - b.priceVND);
    for (let i = 1; i < sorted.length; i++) {
      // Gói đắt hơn phải cho tienNgoc >= gói rẻ hơn (tránh trap người dùng)
      expect(
        sorted[i].tienNgoc,
        `${sorted[i].key} (${sorted[i].priceVND}đ) should give >= ${sorted[i - 1].tienNgoc} tienNgoc`,
      ).toBeGreaterThanOrEqual(sorted[i - 1].tienNgoc);
    }
  });

  it('chỉ 1 package được đánh dấu hot (focus promotion)', () => {
    const hotCount = TOPUP_PACKAGES.filter((p) => p.hot).length;
    expect(hotCount).toBeLessThanOrEqual(1);
  });
});

describe('topupPackageByKey()', () => {
  it('resolve known key', () => {
    const first = TOPUP_PACKAGES[0];
    const found = topupPackageByKey(first.key);
    expect(found).toBeDefined();
    expect(found?.name).toBe(first.name);
    expect(found?.priceVND).toBe(first.priceVND);
  });

  it('returns undefined cho unknown key', () => {
    expect(topupPackageByKey('void_xyz_fake')).toBeUndefined();
  });
});
