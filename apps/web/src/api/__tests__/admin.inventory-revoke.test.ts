import { describe, it, expect, beforeEach, vi } from 'vitest';

const postMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import { adminRevokeInventory } from '@/api/admin';

describe('adminRevokeInventory', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('POST /admin/users/:id/inventory/revoke với body { itemKey, qty, reason }', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true, data: { ok: true } } });

    await adminRevokeInventory('user-123', 'BINH_KHI', 5, 'lỗi grant nhầm');

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith('/admin/users/user-123/inventory/revoke', {
      itemKey: 'BINH_KHI',
      qty: 5,
      reason: 'lỗi grant nhầm',
    });
  });

  it('encodeURIComponent userId — ký tự đặc biệt được encode', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true, data: { ok: true } } });

    await adminRevokeInventory('user/with/slash', 'KEY', 1, '');

    expect(postMock).toHaveBeenCalledWith(
      '/admin/users/user%2Fwith%2Fslash/inventory/revoke',
      { itemKey: 'KEY', qty: 1, reason: '' },
    );
  });

  it('throw error với code khi BE trả ok=false', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'qty out of range' },
      },
    });

    await expect(
      adminRevokeInventory('user-1', 'KEY', 1000, ''),
    ).rejects.toMatchObject({
      message: 'qty out of range',
      code: 'INVALID_INPUT',
    });
  });

  it('throw error với code FORBIDDEN khi caller không phải ADMIN (defense-in-depth)', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'admin only' },
      },
    });

    await expect(
      adminRevokeInventory('user-1', 'KEY', 1, ''),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throw UNKNOWN khi BE response thiếu cả data lẫn error', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true } });

    await expect(
      adminRevokeInventory('user-1', 'KEY', 1, ''),
    ).rejects.toMatchObject({ code: 'UNKNOWN', message: 'UNKNOWN' });
  });

  it('reason rỗng được forward nguyên dạng — BE schema cho default ""', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true, data: { ok: true } } });

    await adminRevokeInventory('user-1', 'KEY', 1, '');

    expect(postMock).toHaveBeenCalledWith('/admin/users/user-1/inventory/revoke', {
      itemKey: 'KEY',
      qty: 1,
      reason: '',
    });
  });

  it('qty integer được forward nguyên — không tự ép kiểu (validation thuộc về caller)', async () => {
    postMock.mockResolvedValueOnce({ data: { ok: true, data: { ok: true } } });

    await adminRevokeInventory('user-1', 'KEY', 999, 'reach max');

    const call = postMock.mock.calls[0];
    expect(call?.[1]).toEqual({ itemKey: 'KEY', qty: 999, reason: 'reach max' });
  });
});
