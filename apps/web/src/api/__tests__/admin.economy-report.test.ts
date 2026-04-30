import { describe, it, expect, beforeEach, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
  },
}));

import { adminEconomyReport, type AdminEconomyReport } from '@/api/admin';

describe('adminEconomyReport', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('GET /admin/economy/report trả circulation + top arrays khi DB rỗng', async () => {
    const payload: AdminEconomyReport = {
      generatedAt: '2026-04-30T05:00:00.000Z',
      circulation: {
        linhThachTotal: '0',
        tienNgocTotal: 0,
        tienNgocKhoaTotal: 0,
        characterCount: 0,
        cultivatingCount: 0,
      },
      topByLinhThach: [],
      topByTienNgoc: [],
    };
    getMock.mockResolvedValueOnce({ data: { ok: true, data: payload } });

    const r = await adminEconomyReport();

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/admin/economy/report');
    expect(r).toEqual(payload);
  });

  it('parse top whales với linhThach bigint string', async () => {
    const payload: AdminEconomyReport = {
      generatedAt: '2026-04-30T05:00:00.000Z',
      circulation: {
        linhThachTotal: '12345678901234567890',
        tienNgocTotal: 50000,
        tienNgocKhoaTotal: 1000,
        characterCount: 42,
        cultivatingCount: 8,
      },
      topByLinhThach: [
        {
          characterId: 'char-1',
          name: 'BossA',
          realmKey: 'truclo',
          realmStage: 5,
          userEmail: 'a@x.local',
          linhThach: '999999999999',
        },
      ],
      topByTienNgoc: [
        {
          characterId: 'char-2',
          name: 'WhaleB',
          realmKey: 'kimdan',
          realmStage: 1,
          userEmail: 'b@x.local',
          tienNgoc: 5000,
        },
      ],
    };
    getMock.mockResolvedValueOnce({ data: { ok: true, data: payload } });

    const r = await adminEconomyReport();

    expect(r.circulation.linhThachTotal).toBe('12345678901234567890');
    expect(typeof r.circulation.linhThachTotal).toBe('string');
    expect(r.topByLinhThach).toHaveLength(1);
    expect(typeof r.topByLinhThach[0]?.linhThach).toBe('string');
    expect(r.topByLinhThach[0]?.linhThach).toBe('999999999999');
    expect(r.topByTienNgoc[0]?.tienNgoc).toBe(5000);
    expect(r.topByTienNgoc[0]?.realmKey).toBe('kimdan');
  });

  it('throw khi BE trả ok=false', async () => {
    getMock.mockResolvedValueOnce({
      data: { ok: false, error: { code: 'FORBIDDEN' } },
    });

    await expect(adminEconomyReport()).rejects.toBeDefined();
  });
});
