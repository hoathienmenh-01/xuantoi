import { describe, it, expect } from 'vitest';
import {
  computeGiftcodeRevokeImpact,
  mapGiftcodeRevokeErrorKey,
} from '@/lib/giftcodeRevoke';

describe('computeGiftcodeRevokeImpact', () => {
  const now = new Date('2026-04-30T08:00:00.000Z');

  it('trả "redeemUsage" "0 / 100" và remaining 100 khi chưa ai dùng', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'WELCOME',
      redeemCount: 0,
      maxRedeems: 100,
      expiresAt: null,
      now,
    });
    expect(r.code).toBe('WELCOME');
    expect(r.redeemUsage).toBe('0 / 100');
    expect(r.remaining).toBe(100);
    expect(r.expiryStatus).toBe('no-expiry');
    expect(r.expiresAt).toBeNull();
  });

  it('maxRedeems null ⇒ remaining null + usage hiển thị "X / ∞"', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'INF',
      redeemCount: 50,
      maxRedeems: null,
      expiresAt: null,
      now,
    });
    expect(r.redeemUsage).toBe('50 / ∞');
    expect(r.remaining).toBeNull();
  });

  it('redeemCount > maxRedeems (data corrupt) ⇒ remaining clamp về 0, không âm', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'OVER',
      redeemCount: 150,
      maxRedeems: 100,
      expiresAt: null,
      now,
    });
    expect(r.remaining).toBe(0);
  });

  it('expiresAt < now ⇒ "expired"', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'OLD',
      redeemCount: 5,
      maxRedeems: 10,
      expiresAt: '2026-04-29T00:00:00.000Z',
      now,
    });
    expect(r.expiryStatus).toBe('expired');
  });

  it('expiresAt < now + 24h ⇒ "expires-soon"', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'SOON',
      redeemCount: 0,
      maxRedeems: 10,
      expiresAt: '2026-04-30T20:00:00.000Z', // +12h
      now,
    });
    expect(r.expiryStatus).toBe('expires-soon');
  });

  it('expiresAt > now + 24h ⇒ "active"', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'LONG',
      redeemCount: 0,
      maxRedeems: 10,
      expiresAt: '2026-05-15T00:00:00.000Z',
      now,
    });
    expect(r.expiryStatus).toBe('active');
  });

  it('expiresAt invalid string ⇒ "no-expiry" và expiresAt null', () => {
    const r = computeGiftcodeRevokeImpact({
      code: 'BAD',
      redeemCount: 0,
      maxRedeems: 10,
      expiresAt: 'not-a-date',
      now,
    });
    expect(r.expiryStatus).toBe('no-expiry');
    expect(r.expiresAt).toBeNull();
  });

  it('không truyền `now` ⇒ dùng new Date() và không throw', () => {
    expect(() =>
      computeGiftcodeRevokeImpact({
        code: 'NOW',
        redeemCount: 0,
        maxRedeems: 10,
        expiresAt: null,
      }),
    ).not.toThrow();
  });
});

describe('mapGiftcodeRevokeErrorKey', () => {
  it('CODE_NOT_FOUND ⇒ admin.errors.CODE_NOT_FOUND', () => {
    expect(mapGiftcodeRevokeErrorKey('CODE_NOT_FOUND')).toBe(
      'admin.errors.CODE_NOT_FOUND',
    );
  });

  it('CODE_REVOKED ⇒ admin.errors.CODE_REVOKED (idempotent state)', () => {
    expect(mapGiftcodeRevokeErrorKey('CODE_REVOKED')).toBe(
      'admin.errors.CODE_REVOKED',
    );
  });

  it('unknown code ⇒ admin.errors.UNKNOWN', () => {
    expect(mapGiftcodeRevokeErrorKey('FOO_BAR')).toBe('admin.errors.UNKNOWN');
  });

  it('undefined / empty ⇒ admin.errors.UNKNOWN', () => {
    expect(mapGiftcodeRevokeErrorKey(undefined)).toBe('admin.errors.UNKNOWN');
    expect(mapGiftcodeRevokeErrorKey('')).toBe('admin.errors.UNKNOWN');
  });
});
