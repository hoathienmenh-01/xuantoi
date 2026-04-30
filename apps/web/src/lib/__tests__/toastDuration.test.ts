import { describe, it, expect } from 'vitest';
import {
  TOAST_DURATION_MS,
  resolveToastDuration,
  type ToastDurationType,
} from '@/lib/toastDuration';

describe('TOAST_DURATION_MS policy', () => {
  it('error >= warning >= success >= info (severity scaling)', () => {
    expect(TOAST_DURATION_MS.error).toBeGreaterThanOrEqual(TOAST_DURATION_MS.warning);
    expect(TOAST_DURATION_MS.warning).toBeGreaterThanOrEqual(TOAST_DURATION_MS.success);
    expect(TOAST_DURATION_MS.success).toBeGreaterThanOrEqual(TOAST_DURATION_MS.info);
  });

  it('all durations are positive integers', () => {
    for (const k of Object.keys(TOAST_DURATION_MS) as ToastDurationType[]) {
      expect(TOAST_DURATION_MS[k]).toBeGreaterThan(0);
      expect(Number.isInteger(TOAST_DURATION_MS[k])).toBe(true);
    }
  });
});

describe('resolveToastDuration', () => {
  it('returns policy value for info', () => {
    expect(resolveToastDuration('info')).toBe(3000);
  });

  it('returns policy value for success', () => {
    expect(resolveToastDuration('success')).toBe(3500);
  });

  it('returns policy value for warning', () => {
    expect(resolveToastDuration('warning')).toBe(5000);
  });

  it('returns policy value for error', () => {
    expect(resolveToastDuration('error')).toBe(6000);
  });

  it('caller override takes precedence', () => {
    expect(resolveToastDuration('error', 100)).toBe(100);
    expect(resolveToastDuration('info', 9999)).toBe(9999);
  });

  it('override 0 is allowed (instant dismiss)', () => {
    expect(resolveToastDuration('info', 0)).toBe(0);
  });

  it('negative override falls back to policy', () => {
    expect(resolveToastDuration('warning', -1)).toBe(5000);
  });

  it('undefined override uses policy', () => {
    expect(resolveToastDuration('error', undefined)).toBe(6000);
  });
});
