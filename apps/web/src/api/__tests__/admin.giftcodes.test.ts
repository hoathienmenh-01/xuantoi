import { describe, it, expect, beforeEach, vi } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import {
  adminCreateGiftcode,
  adminListGiftcodes,
  adminRevokeGiftcode,
  giftCodeStatusOf,
  type AdminGiftCodeRow,
} from '@/api/admin';

function makeRow(overrides: Partial<AdminGiftCodeRow> = {}): AdminGiftCodeRow {
  return {
    id: 'gc-1',
    code: 'WELCOME100',
    rewardLinhThach: '100',
    rewardTienNgoc: 0,
    rewardExp: '0',
    rewardItems: [],
    maxRedeems: null,
    redeemCount: 0,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('giftCodeStatusOf', () => {
  it('REVOKED khi revokedAt có value (ưu tiên nhất)', () => {
    const row = makeRow({ revokedAt: '2026-04-29T00:00:00.000Z' });
    expect(giftCodeStatusOf(row)).toBe('REVOKED');
  });

  it('EXPIRED khi expiresAt < now', () => {
    const row = makeRow({ expiresAt: '2026-04-01T00:00:00.000Z' });
    const now = new Date('2026-04-29T10:00:00.000Z');
    expect(giftCodeStatusOf(row, now)).toBe('EXPIRED');
  });

  it('EXHAUSTED khi maxRedeems hữu hạn và redeemCount đã đạt', () => {
    const row = makeRow({ maxRedeems: 100, redeemCount: 100 });
    expect(giftCodeStatusOf(row)).toBe('EXHAUSTED');
  });

  it('ACTIVE khi không revoked, chưa hết hạn, chưa hết lượt', () => {
    const row = makeRow({
      maxRedeems: 100,
      redeemCount: 5,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
    expect(giftCodeStatusOf(row)).toBe('ACTIVE');
  });

  it('ACTIVE khi maxRedeems = null (không giới hạn) bất kể redeemCount', () => {
    const row = makeRow({ maxRedeems: null, redeemCount: 999_999 });
    expect(giftCodeStatusOf(row)).toBe('ACTIVE');
  });

  it('REVOKED ưu tiên cao hơn EXPIRED khi cả 2 đều set', () => {
    const row = makeRow({
      revokedAt: '2026-04-29T00:00:00.000Z',
      expiresAt: '2026-04-01T00:00:00.000Z',
    });
    expect(giftCodeStatusOf(row)).toBe('REVOKED');
  });
});

describe('adminListGiftcodes', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('gọi GET /admin/giftcodes với q + status params', async () => {
    getMock.mockResolvedValue({ data: { ok: true, data: { codes: [makeRow()] } } });
    await adminListGiftcodes({ q: 'WELCOME', status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/admin/giftcodes', {
      params: { limit: 100, q: 'WELCOME', status: 'ACTIVE' },
    });
  });

  it('không pass params optional khi không có filter', async () => {
    getMock.mockResolvedValue({ data: { ok: true, data: { codes: [] } } });
    const rows = await adminListGiftcodes();
    expect(getMock).toHaveBeenCalledWith('/admin/giftcodes', {
      params: { limit: 100 },
    });
    expect(rows).toEqual([]);
  });

  it('throw khi BE trả ok:false', async () => {
    getMock.mockResolvedValue({
      data: { ok: false, error: { code: 'FORBIDDEN', message: 'no access' } },
    });
    await expect(adminListGiftcodes()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('adminCreateGiftcode + adminRevokeGiftcode', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('POST /admin/giftcodes với body code/linh/ngoc/exp', async () => {
    const created = makeRow({ code: 'NEW123' });
    postMock.mockResolvedValue({ data: { ok: true, data: { code: created } } });
    const r = await adminCreateGiftcode({
      code: 'NEW123',
      rewardLinhThach: '500',
      rewardTienNgoc: 10,
      rewardExp: '0',
    });
    expect(postMock).toHaveBeenCalledWith('/admin/giftcodes', {
      code: 'NEW123',
      rewardLinhThach: '500',
      rewardTienNgoc: 10,
      rewardExp: '0',
    });
    expect(r.code).toBe('NEW123');
  });

  it('POST /admin/giftcodes/:code/revoke encode code an toàn', async () => {
    const revoked = makeRow({ code: 'A_B-C', revokedAt: '2026-04-29T00:00:00.000Z' });
    postMock.mockResolvedValue({ data: { ok: true, data: { code: revoked } } });
    await adminRevokeGiftcode('A_B-C');
    expect(postMock).toHaveBeenCalledWith('/admin/giftcodes/A_B-C/revoke', {});
  });
});
