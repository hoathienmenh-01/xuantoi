/**
 * Pure-unit tests cho `auditResultToJson` — serializer biến `AuditResult`
 * (bigint cho ledgerSum/characterValue/diff) sang `AuditResultJson` (string)
 * để qua được JSON envelope cho admin HTTP endpoint
 * `GET /admin/economy/audit-ledger`.
 *
 * Lý do tồn tại file này: `audit-ledger-format.test.ts` (scripts) test
 * `formatResultJson` của CLI — khác hoàn toàn function khác. Helper
 * `auditResultToJson` của module admin chưa có test riêng → thiếu lock-in
 * cho:
 *   - BigInt → string preserve precision (>= MAX_SAFE_INTEGER vẫn không sai).
 *   - Negative diff (-99n) → "-99".
 *   - Zero (0n) → "0".
 *   - Empty arrays passthrough.
 *   - inventoryDiscrepancies là number → passthrough nguyên shape.
 *   - Top-level scalars (charactersScanned, itemKeysScanned) passthrough.
 *
 * Pure function, không cần DB/Redis.
 */
import { describe, expect, it } from 'vitest';
import {
  auditResultToJson,
  type AuditResult,
} from './ledger-audit';

describe('auditResultToJson — empty result', () => {
  it('clean result: arrays empty, scalars 0', () => {
    const r: AuditResult = {
      charactersScanned: 0,
      itemKeysScanned: 0,
      currencyDiscrepancies: [],
      inventoryDiscrepancies: [],
    };
    expect(auditResultToJson(r)).toEqual({
      charactersScanned: 0,
      itemKeysScanned: 0,
      currencyDiscrepancies: [],
      inventoryDiscrepancies: [],
    });
  });

  it('scalars passthrough cho non-zero', () => {
    const r: AuditResult = {
      charactersScanned: 1234,
      itemKeysScanned: 567,
      currencyDiscrepancies: [],
      inventoryDiscrepancies: [],
    };
    const out = auditResultToJson(r);
    expect(out.charactersScanned).toBe(1234);
    expect(out.itemKeysScanned).toBe(567);
  });
});

describe('auditResultToJson — currency BigInt → string', () => {
  it('positive bigint → "N"', () => {
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 0,
      currencyDiscrepancies: [
        {
          characterId: 'char-a',
          field: 'linhThach',
          ledgerSum: 100n,
          characterValue: 150n,
          diff: 50n,
        },
      ],
      inventoryDiscrepancies: [],
    };
    const out = auditResultToJson(r);
    expect(out.currencyDiscrepancies).toHaveLength(1);
    expect(out.currencyDiscrepancies[0]).toEqual({
      characterId: 'char-a',
      field: 'linhThach',
      ledgerSum: '100',
      characterValue: '150',
      diff: '50',
    });
  });

  it('negative diff → "-N" preserve dấu', () => {
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 0,
      currencyDiscrepancies: [
        {
          characterId: 'char-b',
          field: 'tienNgoc',
          ledgerSum: 200n,
          characterValue: 50n,
          diff: -150n,
        },
      ],
      inventoryDiscrepancies: [],
    };
    expect(auditResultToJson(r).currencyDiscrepancies[0].diff).toBe('-150');
  });

  it('zero bigint (0n) → "0"', () => {
    // Edge case: discrepancy với diff = 0 không thường xảy ra (caller đã filter)
    // nhưng pure helper không assume, vẫn phải serialize đúng.
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 0,
      currencyDiscrepancies: [
        {
          characterId: 'char-c',
          field: 'linhThach',
          ledgerSum: 0n,
          characterValue: 0n,
          diff: 0n,
        },
      ],
      inventoryDiscrepancies: [],
    };
    const d = auditResultToJson(r).currencyDiscrepancies[0];
    expect(d.ledgerSum).toBe('0');
    expect(d.characterValue).toBe('0');
    expect(d.diff).toBe('0');
  });

  it('bigint vượt MAX_SAFE_INTEGER preserve precision (key motivation cho string)', () => {
    // 9_007_199_254_740_993n = MAX_SAFE_INTEGER + 2 — Number(big) sẽ làm tròn
    // sai. String giữ nguyên 19 digit.
    const big = 9_007_199_254_740_993n;
    const bigger = 99_999_999_999_999_999n; // 18 digit
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 0,
      currencyDiscrepancies: [
        {
          characterId: 'char-rich',
          field: 'tienNgoc',
          ledgerSum: big,
          characterValue: bigger,
          diff: bigger - big,
        },
      ],
      inventoryDiscrepancies: [],
    };
    const d = auditResultToJson(r).currencyDiscrepancies[0];
    expect(d.ledgerSum).toBe('9007199254740993');
    expect(d.characterValue).toBe('99999999999999999');
    expect(d.diff).toBe((bigger - big).toString());
    // Verify round-trip preserves precision.
    expect(BigInt(d.ledgerSum)).toBe(big);
    expect(BigInt(d.characterValue)).toBe(bigger);
  });

  it('multiple discrepancies giữ thứ tự + per-row independence', () => {
    const r: AuditResult = {
      charactersScanned: 2,
      itemKeysScanned: 0,
      currencyDiscrepancies: [
        {
          characterId: 'char-a',
          field: 'linhThach',
          ledgerSum: 1n,
          characterValue: 2n,
          diff: 1n,
        },
        {
          characterId: 'char-b',
          field: 'tienNgoc',
          ledgerSum: 100n,
          characterValue: 99n,
          diff: -1n,
        },
        {
          characterId: 'char-a',
          field: 'tienNgoc',
          ledgerSum: 50n,
          characterValue: 50n,
          diff: 0n,
        },
      ],
      inventoryDiscrepancies: [],
    };
    const out = auditResultToJson(r);
    expect(out.currencyDiscrepancies).toHaveLength(3);
    expect(out.currencyDiscrepancies[0].characterId).toBe('char-a');
    expect(out.currencyDiscrepancies[0].field).toBe('linhThach');
    expect(out.currencyDiscrepancies[0].diff).toBe('1');
    expect(out.currencyDiscrepancies[1].characterId).toBe('char-b');
    expect(out.currencyDiscrepancies[1].diff).toBe('-1');
    expect(out.currencyDiscrepancies[2].field).toBe('tienNgoc');
    expect(out.currencyDiscrepancies[2].diff).toBe('0');
  });
});

describe('auditResultToJson — inventoryDiscrepancies passthrough', () => {
  it('inventory discrepancies passthrough (number không serialize)', () => {
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 1,
      currencyDiscrepancies: [],
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
    const out = auditResultToJson(r);
    expect(out.inventoryDiscrepancies).toEqual([
      {
        characterId: 'char-a',
        itemKey: 'EQUIP:SWORD_T1',
        ledgerSum: 1,
        inventorySum: 2,
        diff: 1,
      },
    ]);
    // Đảm bảo các field vẫn là number (không bị string-ify nhầm).
    expect(typeof out.inventoryDiscrepancies[0].ledgerSum).toBe('number');
    expect(typeof out.inventoryDiscrepancies[0].inventorySum).toBe('number');
    expect(typeof out.inventoryDiscrepancies[0].diff).toBe('number');
  });

  it('inventory negative diff preserved', () => {
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 1,
      currencyDiscrepancies: [],
      inventoryDiscrepancies: [
        {
          characterId: 'char-a',
          itemKey: 'CON:ELIXIR',
          ledgerSum: 5,
          inventorySum: 3,
          diff: -2,
        },
      ],
    };
    expect(auditResultToJson(r).inventoryDiscrepancies[0].diff).toBe(-2);
  });

  it('itemKey với separator ":" trong giữa key vẫn passthrough nguyên', () => {
    // Defensive: itemKey "EQUIP:WEAPON:T1" có 2 separator — passthrough thẳng,
    // không bị parse nhầm.
    const r: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 1,
      currencyDiscrepancies: [],
      inventoryDiscrepancies: [
        {
          characterId: 'char-x',
          itemKey: 'EQUIP:WEAPON:T1',
          ledgerSum: 0,
          inventorySum: 1,
          diff: 1,
        },
      ],
    };
    expect(auditResultToJson(r).inventoryDiscrepancies[0].itemKey).toBe(
      'EQUIP:WEAPON:T1',
    );
  });
});

describe('auditResultToJson — JSON envelope safety', () => {
  it('JSON.stringify roundtrip preserve all fields', () => {
    // Real-world usage: admin endpoint trả `auditResultToJson(...)` qua HTTP
    // → bắt buộc qua được JSON.stringify mà không lỗi BigInt.
    const r: AuditResult = {
      charactersScanned: 5,
      itemKeysScanned: 3,
      currencyDiscrepancies: [
        {
          characterId: 'char-a',
          field: 'linhThach',
          ledgerSum: 100n,
          characterValue: 150n,
          diff: 50n,
        },
      ],
      inventoryDiscrepancies: [
        {
          characterId: 'char-a',
          itemKey: 'EQUIP:SWORD',
          ledgerSum: 1,
          inventorySum: 2,
          diff: 1,
        },
      ],
    };
    const json = auditResultToJson(r);
    // Không throw "Do not know how to serialize a BigInt".
    const str = JSON.stringify(json);
    expect(typeof str).toBe('string');
    const parsed = JSON.parse(str);
    expect(parsed).toEqual(json);
  });

  it('không mutate input AuditResult', () => {
    const orig: AuditResult = {
      charactersScanned: 1,
      itemKeysScanned: 1,
      currencyDiscrepancies: [
        {
          characterId: 'char-a',
          field: 'linhThach',
          ledgerSum: 100n,
          characterValue: 150n,
          diff: 50n,
        },
      ],
      inventoryDiscrepancies: [
        {
          characterId: 'char-a',
          itemKey: 'EQUIP:SWORD',
          ledgerSum: 1,
          inventorySum: 2,
          diff: 1,
        },
      ],
    };
    const before = JSON.stringify({
      ...orig,
      currencyDiscrepancies: orig.currencyDiscrepancies.map((d) => ({
        ...d,
        ledgerSum: d.ledgerSum.toString(),
        characterValue: d.characterValue.toString(),
        diff: d.diff.toString(),
      })),
    });
    auditResultToJson(orig);
    const after = JSON.stringify({
      ...orig,
      currencyDiscrepancies: orig.currencyDiscrepancies.map((d) => ({
        ...d,
        ledgerSum: d.ledgerSum.toString(),
        characterValue: d.characterValue.toString(),
        diff: d.diff.toString(),
      })),
    });
    // Same shape after — input không bị mutate.
    expect(after).toBe(before);
    // Ledger sum vẫn là bigint.
    expect(typeof orig.currencyDiscrepancies[0].ledgerSum).toBe('bigint');
  });
});
