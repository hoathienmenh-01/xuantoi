/**
 * Unit tests cho audit-ledger CLI helpers — `parseArgs`, `formatResult`,
 * `formatResultJson`. Pure functions, không cần DB/Redis.
 *
 * Test riêng với `audit-ledger.test.ts` (integration vào real Postgres) để
 * có thể chạy nhanh trong môi trường thiếu DB (vd local dev chưa
 * `pnpm infra:up`, hoặc dùng để CI fast-feedback).
 */
import { describe, expect, it } from 'vitest';
import {
  formatResult,
  formatResultJson,
  parseArgs,
  type AuditResult,
} from './audit-ledger';

const cleanResult: AuditResult = {
  charactersScanned: 0,
  itemKeysScanned: 0,
  currencyDiscrepancies: [],
  inventoryDiscrepancies: [],
};

const dirtyResult: AuditResult = {
  charactersScanned: 3,
  itemKeysScanned: 5,
  currencyDiscrepancies: [
    {
      characterId: 'char-a',
      field: 'linhThach',
      ledgerSum: 100n,
      characterValue: 150n,
      diff: 50n,
    },
    {
      characterId: 'char-b',
      field: 'tienNgoc',
      ledgerSum: 9_999_999_999_999_999_999n,
      characterValue: 9_999_999_999_999_999_900n,
      diff: -99n,
    },
  ],
  inventoryDiscrepancies: [
    {
      characterId: 'char-a',
      itemKey: 'EQUIP:SWORD_T1',
      ledgerSum: 1,
      inventorySum: 2,
      diff: 1,
    },
  ],
};

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------
describe('parseArgs', () => {
  it('returns json=false khi argv rỗng', () => {
    expect(parseArgs([])).toEqual({ json: false });
  });

  it('returns json=true khi có --json', () => {
    expect(parseArgs(['--json'])).toEqual({ json: true });
  });

  it('returns json=true khi --json đứng sau flag khác', () => {
    expect(parseArgs(['--verbose', '--json'])).toEqual({ json: true });
  });

  it('returns json=false khi flag khác có chuỗi tương tự', () => {
    expect(parseArgs(['--jsonpath', '/tmp/x.json'])).toEqual({ json: false });
  });
});

// ---------------------------------------------------------------------------
// formatResult — human-readable
// ---------------------------------------------------------------------------
describe('formatResult', () => {
  it('clean result: in 3 dòng "Scanned" + "Currency: OK" + "Inventory: OK"', () => {
    const out = formatResult(cleanResult);
    expect(out).toContain('Scanned: 0 characters, 0 (char, item) pairs.');
    expect(out).toContain('Currency: OK (no discrepancies).');
    expect(out).toContain('Inventory: OK (no discrepancies).');
    expect(out.split('\n')).toHaveLength(3);
  });

  it('dirty result: in header DISCREPANCIES + chi tiết từng row', () => {
    const out = formatResult(dirtyResult);
    expect(out).toContain('Scanned: 3 characters, 5 (char, item) pairs.');
    expect(out).toContain('Currency DISCREPANCIES: 2');
    expect(out).toContain('char=char-a field=linhThach ledger=100 character=150 diff=50');
    expect(out).toContain('char=char-b field=tienNgoc ledger=9999999999999999999 character=9999999999999999900 diff=-99');
    expect(out).toContain('Inventory DISCREPANCIES: 1');
    expect(out).toContain('char=char-a item=EQUIP:SWORD_T1 ledgerSum=1 inventorySum=2 diff=1');
  });

  it('chỉ có currency discrepancy: vẫn in "Inventory: OK"', () => {
    const r: AuditResult = {
      ...cleanResult,
      charactersScanned: 1,
      currencyDiscrepancies: dirtyResult.currencyDiscrepancies.slice(0, 1),
    };
    const out = formatResult(r);
    expect(out).toContain('Currency DISCREPANCIES: 1');
    expect(out).toContain('Inventory: OK (no discrepancies).');
  });

  it('chỉ có inventory discrepancy: vẫn in "Currency: OK"', () => {
    const r: AuditResult = {
      ...cleanResult,
      itemKeysScanned: 1,
      inventoryDiscrepancies: dirtyResult.inventoryDiscrepancies,
    };
    const out = formatResult(r);
    expect(out).toContain('Currency: OK (no discrepancies).');
    expect(out).toContain('Inventory DISCREPANCIES: 1');
  });

  it('preserves itemKey containing colon', () => {
    const r: AuditResult = {
      ...cleanResult,
      itemKeysScanned: 1,
      inventoryDiscrepancies: [
        {
          characterId: 'c1',
          itemKey: 'PILL:HEAL_S',
          ledgerSum: 5,
          inventorySum: 3,
          diff: -2,
        },
      ],
    };
    const out = formatResult(r);
    expect(out).toContain('item=PILL:HEAL_S');
  });
});

// ---------------------------------------------------------------------------
// formatResultJson — machine-parseable
// ---------------------------------------------------------------------------
describe('formatResultJson', () => {
  it('clean result: parse được JSON, summary.ok=true, totalDiscrepancies=0', () => {
    const json = formatResultJson(cleanResult);
    const parsed = JSON.parse(json);
    expect(parsed.summary.ok).toBe(true);
    expect(parsed.summary.totalDiscrepancies).toBe(0);
    expect(parsed.summary.currencyDiscrepancies).toBe(0);
    expect(parsed.summary.inventoryDiscrepancies).toBe(0);
    expect(parsed.summary.charactersScanned).toBe(0);
    expect(parsed.summary.itemKeysScanned).toBe(0);
    expect(parsed.currencyDiscrepancies).toEqual([]);
    expect(parsed.inventoryDiscrepancies).toEqual([]);
  });

  it('dirty result: summary.ok=false, count khớp, BigInt serialize sang string giữ chính xác', () => {
    const json = formatResultJson(dirtyResult);
    const parsed = JSON.parse(json);
    expect(parsed.summary.ok).toBe(false);
    expect(parsed.summary.totalDiscrepancies).toBe(3);
    expect(parsed.summary.currencyDiscrepancies).toBe(2);
    expect(parsed.summary.inventoryDiscrepancies).toBe(1);
    expect(parsed.summary.charactersScanned).toBe(3);
    expect(parsed.summary.itemKeysScanned).toBe(5);

    expect(parsed.currencyDiscrepancies[0]).toEqual({
      characterId: 'char-a',
      field: 'linhThach',
      ledgerSum: '100',
      characterValue: '150',
      diff: '50',
    });
    // BigInt > Number.MAX_SAFE_INTEGER phải giữ nguyên độ chính xác qua string.
    expect(parsed.currencyDiscrepancies[1].ledgerSum).toBe('9999999999999999999');
    expect(parsed.currencyDiscrepancies[1].characterValue).toBe('9999999999999999900');
    expect(parsed.currencyDiscrepancies[1].diff).toBe('-99');

    expect(parsed.inventoryDiscrepancies[0]).toEqual({
      characterId: 'char-a',
      itemKey: 'EQUIP:SWORD_T1',
      ledgerSum: 1,
      inventorySum: 2,
      diff: 1,
    });
  });

  it('không throw trên BigInt (regression — JSON.stringify mặc định throw on BigInt)', () => {
    expect(() => formatResultJson(dirtyResult)).not.toThrow();
  });

  it('output là valid JSON (parse round-trip)', () => {
    const json = formatResultJson(dirtyResult);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
