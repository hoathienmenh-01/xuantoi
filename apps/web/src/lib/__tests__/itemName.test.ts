import { describe, it, expect } from 'vitest';
import { itemName, formatItemReward, formatItemRewardList } from '@/lib/itemName';

describe('itemName', () => {
  it('lookup catalog name khi key tồn tại trong @xuantoi/shared (default VN)', () => {
    expect(itemName('so_kiem')).toBe('Sơ Kiếm');
  });

  it('fallback về raw key khi không tồn tại + không có translator', () => {
    expect(itemName('nonexistent_xyz_999')).toBe('nonexistent_xyz_999');
  });

  it('priority 1: dùng i18n translator nếu có entry items.<key>', () => {
    const t = ((key: string, fallback?: string) => {
      if (key === 'items.so_kiem') return 'Beginner Sword';
      return fallback ?? key;
    }) as (key: string, fallback?: string) => string;
    expect(itemName('so_kiem', t)).toBe('Beginner Sword');
  });

  it('translator missing entry → fallback xuống catalog', () => {
    const t = ((key: string, fallback?: string) => fallback ?? key) as (
      key: string,
      fallback?: string,
    ) => string;
    expect(itemName('so_kiem', t)).toBe('Sơ Kiếm');
  });

  it('translator trả về chính key (vue-i18n missing default) → fallback catalog', () => {
    const t = ((key: string) => key) as (key: string, fallback?: string) => string;
    expect(itemName('so_kiem', t)).toBe('Sơ Kiếm');
  });

  it('translator missing + key cũng không trong catalog → trả raw key', () => {
    const t = ((key: string, fallback?: string) => fallback ?? key) as (
      key: string,
      fallback?: string,
    ) => string;
    expect(itemName('khong_co_thiet', t)).toBe('khong_co_thiet');
  });
});

describe('formatItemReward', () => {
  it('qty=1 không hiện ×', () => {
    expect(formatItemReward({ itemKey: 'so_kiem', qty: 1 })).toBe('Sơ Kiếm');
  });

  it('qty>1 hiện ×n', () => {
    expect(formatItemReward({ itemKey: 'so_kiem', qty: 5 })).toBe('Sơ Kiếm ×5');
  });

  it('với translator override hoạt động đúng', () => {
    const t = ((key: string, fallback?: string) => {
      if (key === 'items.so_kiem') return 'Beginner Sword';
      return fallback ?? key;
    }) as (key: string, fallback?: string) => string;
    expect(formatItemReward({ itemKey: 'so_kiem', qty: 3 }, t)).toBe('Beginner Sword ×3');
  });
});

describe('formatItemRewardList', () => {
  it('join rewards bằng dấu ", "', () => {
    const result = formatItemRewardList([
      { itemKey: 'so_kiem', qty: 1 },
      { itemKey: 'so_kiem', qty: 2 },
    ]);
    expect(result).toBe('Sơ Kiếm, Sơ Kiếm ×2');
  });

  it('empty list trả về empty string', () => {
    expect(formatItemRewardList([])).toBe('');
  });
});
