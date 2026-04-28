import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DEFAULT_MARKET_FEE_PCT,
  MAX_MARKET_FEE_PCT,
  resolveMarketFeePct,
} from './market.service';

describe('resolveMarketFeePct (G15 — L2 market fee config)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | null = null;

  afterEach(() => {
    warnSpy?.mockRestore();
    warnSpy = null;
  });

  it('undefined / empty → DEFAULT (0.05)', () => {
    expect(resolveMarketFeePct(undefined)).toBe(DEFAULT_MARKET_FEE_PCT);
    expect(resolveMarketFeePct('')).toBe(DEFAULT_MARKET_FEE_PCT);
    expect(resolveMarketFeePct('   ')).toBe(DEFAULT_MARKET_FEE_PCT);
  });

  it('số hợp lệ trong [0, 0.5] → trả về số đó', () => {
    expect(resolveMarketFeePct('0')).toBe(0);
    expect(resolveMarketFeePct('0.05')).toBe(0.05);
    expect(resolveMarketFeePct('0.1')).toBeCloseTo(0.1, 10);
    expect(resolveMarketFeePct('0.5')).toBe(0.5);
  });

  it('non-numeric string → DEFAULT + console.warn', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveMarketFeePct('abc')).toBe(DEFAULT_MARKET_FEE_PCT);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('không phải số hợp lệ'),
    );
  });

  it('số âm → DEFAULT + warn', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveMarketFeePct('-0.01')).toBe(DEFAULT_MARKET_FEE_PCT);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ngoài khoảng'));
  });

  it('số > 0.5 → DEFAULT + warn (chống gõ nhầm 5 thay 0.05)', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveMarketFeePct('5')).toBe(DEFAULT_MARKET_FEE_PCT);
    expect(resolveMarketFeePct('0.6')).toBe(DEFAULT_MARKET_FEE_PCT);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('chính giá trị MAX (0.5) là biên hợp lệ', () => {
    expect(resolveMarketFeePct(String(MAX_MARKET_FEE_PCT))).toBe(MAX_MARKET_FEE_PCT);
  });

  it('NaN literal → DEFAULT', () => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveMarketFeePct('NaN')).toBe(DEFAULT_MARKET_FEE_PCT);
  });
});
