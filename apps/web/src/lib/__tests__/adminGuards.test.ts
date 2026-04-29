import { describe, it, expect } from 'vitest';
import {
  isSelfTarget,
  canChangeRole,
  canTargetUser,
} from '@/lib/adminGuards';

describe('isSelfTarget', () => {
  it('true khi actor và target trùng id', () => {
    expect(isSelfTarget('u1', 'u1')).toBe(true);
  });
  it('false khi khác id', () => {
    expect(isSelfTarget('u1', 'u2')).toBe(false);
  });
  it('false khi actor null/undefined', () => {
    expect(isSelfTarget(null, 'u1')).toBe(false);
    expect(isSelfTarget(undefined, 'u1')).toBe(false);
  });
  it('false khi target null/undefined', () => {
    expect(isSelfTarget('u1', null)).toBe(false);
    expect(isSelfTarget('u1', undefined)).toBe(false);
  });
});

describe('canChangeRole', () => {
  it('allowed khi ADMIN đổi role user khác', () => {
    expect(
      canChangeRole({ actorRole: 'ADMIN', actorUserId: 'a1', targetUserId: 'u1' }),
    ).toEqual({ allowed: true });
  });
  it('NOT_ADMIN khi MOD cố đổi role', () => {
    expect(
      canChangeRole({ actorRole: 'MOD', actorUserId: 'a1', targetUserId: 'u1' }),
    ).toEqual({ allowed: false, reason: 'NOT_ADMIN' });
  });
  it('NOT_ADMIN khi PLAYER cố đổi role', () => {
    expect(
      canChangeRole({
        actorRole: 'PLAYER',
        actorUserId: 'a1',
        targetUserId: 'u1',
      }),
    ).toEqual({ allowed: false, reason: 'NOT_ADMIN' });
  });
  it('NOT_ADMIN khi actorRole null/undefined', () => {
    expect(
      canChangeRole({ actorRole: null, actorUserId: 'a1', targetUserId: 'u1' }),
    ).toEqual({ allowed: false, reason: 'NOT_ADMIN' });
    expect(
      canChangeRole({
        actorRole: undefined,
        actorUserId: 'a1',
        targetUserId: 'u1',
      }),
    ).toEqual({ allowed: false, reason: 'NOT_ADMIN' });
  });
  it('SELF_TARGET khi ADMIN cố đổi role chính mình (CRITICAL — chống lock-out)', () => {
    expect(
      canChangeRole({ actorRole: 'ADMIN', actorUserId: 'a1', targetUserId: 'a1' }),
    ).toEqual({ allowed: false, reason: 'SELF_TARGET' });
  });
});

describe('canTargetUser', () => {
  it('allowed khi target khác actor', () => {
    expect(canTargetUser({ actorUserId: 'a1', targetUserId: 'u1' })).toEqual({
      allowed: true,
    });
  });
  it('SELF_TARGET khi tự ban / grant chính mình', () => {
    expect(canTargetUser({ actorUserId: 'a1', targetUserId: 'a1' })).toEqual({
      allowed: false,
      reason: 'SELF_TARGET',
    });
  });
  it('allowed khi actorUserId null (chưa hydrate auth) — BE sẽ chặn', () => {
    expect(canTargetUser({ actorUserId: null, targetUserId: 'u1' })).toEqual({
      allowed: true,
    });
  });
});
