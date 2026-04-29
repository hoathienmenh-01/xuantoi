import { describe, it, expect, beforeEach, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
  },
}));

import { adminAuditLedger, type AdminLedgerAudit } from '@/api/admin';

describe('adminAuditLedger', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('GET /admin/economy/audit-ledger trả AuditResultJson khi clean', async () => {
    const payload: AdminLedgerAudit = {
      charactersScanned: 5,
      itemKeysScanned: 12,
      currencyDiscrepancies: [],
      inventoryDiscrepancies: [],
    };
    getMock.mockResolvedValueOnce({ data: { ok: true, data: payload } });

    const r = await adminAuditLedger();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/admin/economy/audit-ledger');
    expect(r).toEqual(payload);
  });

  it('parse currency + inventory discrepancies với bigint string', async () => {
    const payload: AdminLedgerAudit = {
      charactersScanned: 1,
      itemKeysScanned: 1,
      currencyDiscrepancies: [
        {
          characterId: 'char-abc',
          field: 'linhThach',
          ledgerSum: '50',
          characterValue: '100',
          diff: '50',
        },
      ],
      inventoryDiscrepancies: [
        {
          characterId: 'char-abc',
          itemKey: 'sword',
          ledgerSum: 3,
          inventorySum: 5,
          diff: 2,
        },
      ],
    };
    getMock.mockResolvedValueOnce({ data: { ok: true, data: payload } });

    const r = await adminAuditLedger();

    expect(r.currencyDiscrepancies).toHaveLength(1);
    expect(r.currencyDiscrepancies[0]?.field).toBe('linhThach');
    // bigint trả về dạng string
    expect(typeof r.currencyDiscrepancies[0]?.ledgerSum).toBe('string');
    expect(r.currencyDiscrepancies[0]?.ledgerSum).toBe('50');
    expect(r.inventoryDiscrepancies).toHaveLength(1);
    expect(r.inventoryDiscrepancies[0]?.diff).toBe(2);
  });

  it('throw khi BE trả ok=false', async () => {
    getMock.mockResolvedValueOnce({
      data: { ok: false, error: { code: 'FORBIDDEN' } },
    });

    await expect(adminAuditLedger()).rejects.toBeDefined();
  });
});
