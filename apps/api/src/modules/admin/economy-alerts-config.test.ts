/**
 * Unit tests cho `economy-alerts-config.ts` — pure helper, không cần
 * Nest/Postgres/Redis. Chạy nhanh trong fast-feedback matrix.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ECONOMY_ALERTS_BOUNDS,
  clampStaleHours,
  parseEnvHours,
  resolveEconomyAlertsBounds,
  type EnvGetter,
} from './economy-alerts-config';

const mkEnv = (map: Record<string, string | undefined>): EnvGetter => {
  return (k) => map[k];
};

describe('parseEnvHours', () => {
  it('missing → fallback', () => {
    expect(parseEnvHours(undefined, 24)).toBe(24);
  });

  it('empty string → fallback', () => {
    expect(parseEnvHours('', 24)).toBe(24);
    expect(parseEnvHours('   ', 24)).toBe(24);
  });

  it('NaN / non-numeric → fallback', () => {
    expect(parseEnvHours('abc', 24)).toBe(24);
  });

  it('0 or negative → fallback (invariant: hours must be positive)', () => {
    expect(parseEnvHours('0', 24)).toBe(24);
    expect(parseEnvHours('-5', 24)).toBe(24);
  });

  it('positive integer → parsed', () => {
    expect(parseEnvHours('48', 24)).toBe(48);
    expect(parseEnvHours('720', 24)).toBe(720);
  });

  it('parseInt leading int portion', () => {
    expect(parseEnvHours('48abc', 24)).toBe(48);
  });
});

describe('resolveEconomyAlertsBounds', () => {
  it('empty env → mặc định (default 24, min 1, max 720)', () => {
    const b = resolveEconomyAlertsBounds(mkEnv({}));
    expect(b).toEqual(DEFAULT_ECONOMY_ALERTS_BOUNDS);
    expect(b.defaultHours).toBe(24);
    expect(b.minHours).toBe(1);
    expect(b.maxHours).toBe(720);
  });

  it('override default qua ECONOMY_ALERTS_DEFAULT_STALE_HOURS', () => {
    const b = resolveEconomyAlertsBounds(
      mkEnv({ ECONOMY_ALERTS_DEFAULT_STALE_HOURS: '48' }),
    );
    expect(b.defaultHours).toBe(48);
    expect(b.minHours).toBe(1);
    expect(b.maxHours).toBe(720);
  });

  it('override max qua ECONOMY_ALERTS_MAX_STALE_HOURS (vd 90 day)', () => {
    const b = resolveEconomyAlertsBounds(
      mkEnv({ ECONOMY_ALERTS_MAX_STALE_HOURS: '2160' }),
    );
    expect(b.maxHours).toBe(2160);
  });

  it('override all three', () => {
    const b = resolveEconomyAlertsBounds(
      mkEnv({
        ECONOMY_ALERTS_DEFAULT_STALE_HOURS: '12',
        ECONOMY_ALERTS_MIN_STALE_HOURS: '2',
        ECONOMY_ALERTS_MAX_STALE_HOURS: '100',
      }),
    );
    expect(b).toEqual({ defaultHours: 12, minHours: 2, maxHours: 100 });
  });

  it('invalid default (> max) → clamp to max + onInvalid callback', () => {
    const warns: string[] = [];
    const b = resolveEconomyAlertsBounds(
      mkEnv({
        ECONOMY_ALERTS_DEFAULT_STALE_HOURS: '9999',
        ECONOMY_ALERTS_MAX_STALE_HOURS: '100',
      }),
      (m) => warns.push(m),
    );
    expect(b.defaultHours).toBe(100);
    expect(b.maxHours).toBe(100);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('> MAX');
  });

  it('invalid default (< min) → clamp to min + onInvalid callback', () => {
    const warns: string[] = [];
    const b = resolveEconomyAlertsBounds(
      mkEnv({
        ECONOMY_ALERTS_DEFAULT_STALE_HOURS: '1',
        ECONOMY_ALERTS_MIN_STALE_HOURS: '5',
      }),
      (m) => warns.push(m),
    );
    expect(b.defaultHours).toBe(5);
    expect(b.minHours).toBe(5);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('< MIN');
  });

  it('invalid max (< min) → clamp max to min + onInvalid', () => {
    const warns: string[] = [];
    const b = resolveEconomyAlertsBounds(
      mkEnv({
        ECONOMY_ALERTS_MIN_STALE_HOURS: '10',
        ECONOMY_ALERTS_MAX_STALE_HOURS: '5',
      }),
      (m) => warns.push(m),
    );
    expect(b.minHours).toBe(10);
    expect(b.maxHours).toBe(10);
    expect(warns.some((w) => w.includes('< MIN'))).toBe(true);
  });

  it('min < 1 bị raise lên 1 (invariant)', () => {
    const b = resolveEconomyAlertsBounds(
      mkEnv({ ECONOMY_ALERTS_MIN_STALE_HOURS: '0' }),
    );
    expect(b.minHours).toBe(1);
  });

  it('onInvalid là optional — không throw khi không truyền', () => {
    expect(() =>
      resolveEconomyAlertsBounds(
        mkEnv({
          ECONOMY_ALERTS_DEFAULT_STALE_HOURS: '9999',
          ECONOMY_ALERTS_MAX_STALE_HOURS: '100',
        }),
      ),
    ).not.toThrow();
  });
});

describe('clampStaleHours', () => {
  const bounds = { defaultHours: 24, minHours: 1, maxHours: 720 };

  it('undefined → default', () => {
    expect(clampStaleHours(undefined, bounds)).toBe(24);
  });

  it('empty string → default', () => {
    expect(clampStaleHours('', bounds)).toBe(24);
  });

  it('NaN → default', () => {
    expect(clampStaleHours('abc', bounds)).toBe(24);
  });

  it('trong bounds → parse exact', () => {
    expect(clampStaleHours('48', bounds)).toBe(48);
  });

  it('below min → clamp up', () => {
    expect(clampStaleHours('0', bounds)).toBe(1);
    expect(clampStaleHours('-10', bounds)).toBe(1);
  });

  it('above max → clamp down', () => {
    expect(clampStaleHours('999999', bounds)).toBe(720);
  });

  it('tôn trọng bounds tùy biến (vd ops set default=48 max=2160)', () => {
    const custom = { defaultHours: 48, minHours: 1, maxHours: 2160 };
    expect(clampStaleHours(undefined, custom)).toBe(48);
    expect(clampStaleHours('1000', custom)).toBe(1000);
    expect(clampStaleHours('3000', custom)).toBe(2160);
  });
});
