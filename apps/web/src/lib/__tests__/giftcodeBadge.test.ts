import { describe, it, expect } from 'vitest';
import type { AdminGiftCodeRow } from '@/api/admin';
import { countActiveUnused } from '@/lib/giftcodeBadge';

function makeRow(overrides: Partial<AdminGiftCodeRow> = {}): AdminGiftCodeRow {
  return {
    id: 'g1',
    code: 'WELCOME',
    rewardLinhThach: '0',
    rewardTienNgoc: 0,
    rewardExp: '0',
    rewardItems: [],
    maxRedeems: null,
    redeemCount: 0,
    expiresAt: null,
    revokedAt: null,
    createdAt: '2026-04-30T00:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2026-04-30T12:00:00.000Z');

describe('countActiveUnused', () => {
  it('trả 0 khi mảng rỗng', () => {
    expect(countActiveUnused([], NOW)).toBe(0);
  });

  it('đếm 1 row ACTIVE (không expire, không revoke, không exhaust)', () => {
    expect(countActiveUnused([makeRow()], NOW)).toBe(1);
  });

  it('không đếm row đã revoked', () => {
    const rows = [makeRow({ id: 'a', revokedAt: '2026-04-29T00:00:00.000Z' })];
    expect(countActiveUnused(rows, NOW)).toBe(0);
  });

  it('không đếm row đã expired', () => {
    const rows = [makeRow({ id: 'a', expiresAt: '2026-04-29T00:00:00.000Z' })];
    expect(countActiveUnused(rows, NOW)).toBe(0);
  });

  it('không đếm row đã exhausted (maxRedeems hết)', () => {
    const rows = [makeRow({ id: 'a', maxRedeems: 5, redeemCount: 5 })];
    expect(countActiveUnused(rows, NOW)).toBe(0);
  });

  it('đếm row có maxRedeems còn lại', () => {
    const rows = [makeRow({ id: 'a', maxRedeems: 5, redeemCount: 3 })];
    expect(countActiveUnused(rows, NOW)).toBe(1);
  });

  it('đếm hỗn hợp — chỉ lấy ACTIVE', () => {
    const rows = [
      makeRow({ id: '1' }), // active
      makeRow({ id: '2', revokedAt: '2026-04-29T00:00:00.000Z' }), // revoked
      makeRow({ id: '3', expiresAt: '2026-04-29T00:00:00.000Z' }), // expired
      makeRow({ id: '4', maxRedeems: 1, redeemCount: 1 }), // exhausted
      makeRow({ id: '5', maxRedeems: 10, redeemCount: 2 }), // active w/ remaining
      makeRow({ id: '6', expiresAt: '2026-05-30T00:00:00.000Z' }), // active future expiry
    ];
    expect(countActiveUnused(rows, NOW)).toBe(3);
  });
});
