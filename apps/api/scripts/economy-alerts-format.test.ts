/**
 * Unit tests cho CLI helpers ở `economy-alerts.ts` — pure, no DB.
 */
import { describe, expect, it } from 'vitest';
import {
  CliArgError,
  DEFAULT_STALE_HOURS,
  formatResult,
  formatResultJson,
  parseArgs,
  type EconomyAlertsResult,
} from './economy-alerts';

const cleanResult: EconomyAlertsResult = {
  negativeCurrency: [],
  negativeInventory: [],
  stalePendingTopups: [],
  staleHours: 24,
  generatedAt: '2026-04-30T12:00:00.000Z',
};

const dirtyResult: EconomyAlertsResult = {
  negativeCurrency: [
    {
      characterId: 'char-1',
      name: 'Player A',
      userEmail: 'a@example.com',
      linhThach: '-100',
      tienNgoc: -5,
      tienNgocKhoa: 0,
    },
  ],
  negativeInventory: [
    {
      inventoryItemId: 'inv-1',
      characterId: 'char-2',
      characterName: 'Player B',
      itemKey: 'sword:basic',
      qty: -1,
    },
  ],
  stalePendingTopups: [
    {
      id: 'topup-1',
      userEmail: 'b@example.com',
      packageKey: 'pkg-100',
      tienNgocAmount: 100,
      createdAt: '2026-04-29T00:00:00.000Z',
      ageHours: 36,
    },
    {
      id: 'topup-2',
      userEmail: 'c@example.com',
      packageKey: 'pkg-500',
      tienNgocAmount: 500,
      createdAt: '2026-04-29T00:00:00.000Z',
      ageHours: 36,
    },
  ],
  staleHours: 24,
  generatedAt: '2026-04-30T12:00:00.000Z',
};

describe('parseArgs', () => {
  it('argv rỗng → defaults (json=false, staleHours=24)', () => {
    expect(parseArgs([])).toEqual({ json: false, staleHours: DEFAULT_STALE_HOURS });
  });

  it('--json bật json=true', () => {
    expect(parseArgs(['--json'])).toEqual({ json: true, staleHours: 24 });
  });

  it('--stale-hours=48 (equals form) parse đúng', () => {
    expect(parseArgs(['--stale-hours=48'])).toEqual({ json: false, staleHours: 48 });
  });

  it('--stale-hours 48 (space form) parse đúng', () => {
    expect(parseArgs(['--stale-hours', '48'])).toEqual({ json: false, staleHours: 48 });
  });

  it('combine --json + --stale-hours=72', () => {
    expect(parseArgs(['--json', '--stale-hours=72'])).toEqual({
      json: true,
      staleHours: 72,
    });
  });

  it('order independent', () => {
    expect(parseArgs(['--stale-hours=72', '--json'])).toEqual({
      json: true,
      staleHours: 72,
    });
  });

  it('ignore unknown flag', () => {
    expect(parseArgs(['--unknown', '--json'])).toEqual({
      json: true,
      staleHours: 24,
    });
  });

  it('--stale-hours=0 throw CliArgError (must be positive)', () => {
    expect(() => parseArgs(['--stale-hours=0'])).toThrow(CliArgError);
  });

  it('--stale-hours=-5 throw CliArgError (must be positive)', () => {
    expect(() => parseArgs(['--stale-hours=-5'])).toThrow(CliArgError);
  });

  it('--stale-hours=abc throw CliArgError (NaN)', () => {
    expect(() => parseArgs(['--stale-hours=abc'])).toThrow(CliArgError);
  });

  it('--stale-hours không có value throw CliArgError', () => {
    expect(() => parseArgs(['--stale-hours'])).toThrow(CliArgError);
  });
});

describe('formatResult', () => {
  it('clean result: 3 dòng "OK" cho từng category + header', () => {
    const out = formatResult(cleanResult);
    expect(out).toContain('Economy alerts (staleHours=24');
    expect(out).toContain('Negative currency: OK (none).');
    expect(out).toContain('Negative inventory: OK (none).');
    expect(out).toContain('Stale pending topups: OK (none).');
  });

  it('dirty result: count + chi tiết từng dòng', () => {
    const out = formatResult(dirtyResult);
    expect(out).toContain('Negative currency: 1');
    expect(out).toContain('char=char-1 name=Player A email=a@example.com linhThach=-100');
    expect(out).toContain('Negative inventory: 1');
    expect(out).toContain('item=sword:basic qty=-1');
    expect(out).toContain('Stale pending topups: 2');
    expect(out).toContain('topup=topup-1');
    expect(out).toContain('topup=topup-2');
  });

  it('itemKey với dấu `:` được giữ nguyên (không escape)', () => {
    const out = formatResult(dirtyResult);
    expect(out).toContain('sword:basic');
  });
});

describe('formatResultJson', () => {
  it('clean: JSON parse được, summary.ok=true, total=0', () => {
    const json = formatResultJson(cleanResult);
    const parsed = JSON.parse(json);
    expect(parsed.summary.ok).toBe(true);
    expect(parsed.summary.total).toBe(0);
    expect(parsed.summary.negativeCurrency).toBe(0);
    expect(parsed.summary.negativeInventory).toBe(0);
    expect(parsed.summary.stalePendingTopups).toBe(0);
    expect(parsed.staleHours).toBe(24);
  });

  it('dirty: summary count khớp, ok=false, mảng giữ nguyên item', () => {
    const json = formatResultJson(dirtyResult);
    const parsed = JSON.parse(json);
    expect(parsed.summary.ok).toBe(false);
    expect(parsed.summary.total).toBe(4);
    expect(parsed.summary.negativeCurrency).toBe(1);
    expect(parsed.summary.negativeInventory).toBe(1);
    expect(parsed.summary.stalePendingTopups).toBe(2);
    expect(parsed.negativeCurrency[0].characterId).toBe('char-1');
    expect(parsed.negativeCurrency[0].linhThach).toBe('-100');
    expect(parsed.stalePendingTopups[0].id).toBe('topup-1');
    expect(parsed.stalePendingTopups[1].id).toBe('topup-2');
  });

  it('JSON valid (parse-able, không throw)', () => {
    expect(() => JSON.parse(formatResultJson(dirtyResult))).not.toThrow();
  });

  it('giữ string `linhThach` (đã serialize từ BigInt) — không cast sang number', () => {
    const r: EconomyAlertsResult = {
      ...cleanResult,
      negativeCurrency: [
        {
          characterId: 'c',
          name: 'X',
          userEmail: 'x@e.com',
          linhThach: '-9999999999999999999', // > Number.MAX_SAFE_INTEGER
          tienNgoc: 0,
          tienNgocKhoa: 0,
        },
      ],
    };
    const parsed = JSON.parse(formatResultJson(r));
    expect(parsed.negativeCurrency[0].linhThach).toBe('-9999999999999999999');
    expect(typeof parsed.negativeCurrency[0].linhThach).toBe('string');
  });
});
