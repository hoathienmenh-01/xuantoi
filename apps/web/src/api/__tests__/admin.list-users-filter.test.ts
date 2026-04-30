import { describe, it, expect, beforeEach, vi } from 'vitest';

const getMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: vi.fn(),
  },
}));

import { adminListUsers } from '@/api/admin';

describe('adminListUsers (9h-F — smart filter expand)', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({
      data: { ok: true, data: { rows: [], total: 0, page: 0, pageSize: 20 } },
    });
  });

  it('không truyền filter → params chỉ có q + page', async () => {
    await adminListUsers('hello', 0);
    expect(getMock).toHaveBeenCalledWith('/admin/users', {
      params: { q: 'hello', page: 0 },
    });
  });

  it('truyền linhThachMin/Max + tienNgocMin/Max + realmKey → đầy đủ params', async () => {
    await adminListUsers('', 0, {
      linhThachMin: '1000',
      linhThachMax: '99999',
      tienNgocMin: 50,
      tienNgocMax: 5000,
      realmKey: 'truclo',
    });
    expect(getMock).toHaveBeenCalledWith('/admin/users', {
      params: {
        q: '',
        page: 0,
        linhThachMin: '1000',
        linhThachMax: '99999',
        tienNgocMin: 50,
        tienNgocMax: 5000,
        realmKey: 'truclo',
      },
    });
  });

  it('chỉ linhThachMin → chỉ params đó set', async () => {
    await adminListUsers('', 0, { linhThachMin: '500' });
    const call = getMock.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(call.params).toMatchObject({ linhThachMin: '500' });
    expect(call.params.linhThachMax).toBeUndefined();
    expect(call.params.tienNgocMin).toBeUndefined();
    expect(call.params.realmKey).toBeUndefined();
  });

  it('combine với role + banned + range', async () => {
    await adminListUsers('hi', 1, {
      role: 'PLAYER',
      banned: false,
      linhThachMin: '100',
      realmKey: 'kimdan',
    });
    expect(getMock).toHaveBeenCalledWith('/admin/users', {
      params: {
        q: 'hi',
        page: 1,
        role: 'PLAYER',
        banned: 'false',
        linhThachMin: '100',
        realmKey: 'kimdan',
      },
    });
  });

  it('tienNgocMin = 0 vẫn truyền (boundary)', async () => {
    await adminListUsers('', 0, { tienNgocMin: 0 });
    const call = getMock.mock.calls[0]?.[1] as { params: Record<string, unknown> };
    expect(call.params.tienNgocMin).toBe(0);
  });
});
