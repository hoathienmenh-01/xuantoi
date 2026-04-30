/**
 * i18n parity test cho fallback Error message ở `apps/web/src/api/{auth,shop,character}.ts`.
 *
 * Trước đây các file API hard-code VN message khi BE trả `{ ok: false }` mà
 * không có `data.error` (defensive fallback) — switch sang en vẫn thấy VN.
 * Giờ resolve qua `i18n.global.t('common.apiFallback.<op>')`.
 *
 * Test verify cả 2 locale (vi/en) trả đúng string từ i18n bundle.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();

vi.mock('@/api/client', () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
  },
}));

import { i18n } from '@/i18n';
import { register, login, changePassword, forgotPassword, resetPassword, logoutAll } from '@/api/auth';
import { listNpcShop, buyFromShop } from '@/api/shop';
import { onboard } from '@/api/character';

describe('api fallback error i18n parity', () => {
  let original: string;

  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    original = (i18n.global.locale as unknown as { value: string }).value;
  });

  afterEach(() => {
    (i18n.global.locale as unknown as { value: string }).value = original;
  });

  // Helper: BE trả { ok: false } không có error → fallback Error fires.
  const noErrorEnvelope = { data: { ok: false } };

  describe('locale=vi (default)', () => {
    beforeEach(() => {
      (i18n.global.locale as unknown as { value: string }).value = 'vi';
    });

    it.each([
      ['register', 'Đăng ký thất bại', () => register({ email: 'a@a.com', password: 'x' } as never)],
      ['login', 'Đăng nhập thất bại', () => login({ email: 'a@a.com', password: 'x' } as never)],
      ['changePassword', 'Đổi mật khẩu thất bại', () =>
        changePassword({ oldPassword: 'a', newPassword: 'b' } as never)],
      ['forgotPassword', 'Gửi yêu cầu thất bại', () =>
        forgotPassword({ email: 'a@a.com' } as never)],
      ['resetPassword', 'Đặt lại mật khẩu thất bại', () =>
        resetPassword({ token: 't', newPassword: 'x' } as never)],
      ['logoutAll', 'Đăng xuất tất cả thất bại', () => logoutAll()],
      ['shopBuy', 'Mua thất bại', () => buyFromShop('item:basic', 1)],
      ['onboard', 'Khai đạo thất bại', () => onboard({ name: 'X', sectKey: 'thanh_van' })],
    ])('%s → fallback Error message tiếng Việt', async (_op, expected, fn) => {
      postMock.mockResolvedValueOnce(noErrorEnvelope);
      await expect(fn()).rejects.toThrow(expected);
    });

    it('shopLoad (GET) → "Lấy shop thất bại"', async () => {
      getMock.mockResolvedValueOnce(noErrorEnvelope);
      await expect(listNpcShop()).rejects.toThrow('Lấy shop thất bại');
    });
  });

  describe('locale=en', () => {
    beforeEach(() => {
      (i18n.global.locale as unknown as { value: string }).value = 'en';
    });

    it.each([
      ['register', 'Registration failed', () => register({ email: 'a@a.com', password: 'x' } as never)],
      ['login', 'Login failed', () => login({ email: 'a@a.com', password: 'x' } as never)],
      ['changePassword', 'Change password failed', () =>
        changePassword({ oldPassword: 'a', newPassword: 'b' } as never)],
      ['forgotPassword', 'Send request failed', () =>
        forgotPassword({ email: 'a@a.com' } as never)],
      ['resetPassword', 'Reset password failed', () =>
        resetPassword({ token: 't', newPassword: 'x' } as never)],
      ['logoutAll', 'Logout all failed', () => logoutAll()],
      ['shopBuy', 'Purchase failed', () => buyFromShop('item:basic', 1)],
      ['onboard', 'Onboard failed', () => onboard({ name: 'X', sectKey: 'thanh_van' })],
    ])('%s → fallback Error message English', async (_op, expected, fn) => {
      postMock.mockResolvedValueOnce(noErrorEnvelope);
      await expect(fn()).rejects.toThrow(expected);
    });

    it('shopLoad (GET) → "Load shop failed"', async () => {
      getMock.mockResolvedValueOnce(noErrorEnvelope);
      await expect(listNpcShop()).rejects.toThrow('Load shop failed');
    });
  });

  describe('BE error precedence', () => {
    it('khi data.error có, fallback i18n KHÔNG được dùng', async () => {
      (i18n.global.locale as unknown as { value: string }).value = 'en';
      postMock.mockResolvedValueOnce({
        data: { ok: false, error: { code: 'RATE_LIMITED', message: 'too many' } },
      });
      try {
        await register({ email: 'a@a.com', password: 'x' } as never);
        throw new Error('should have thrown');
      } catch (e: unknown) {
        // BE error là object plain { code, message } — không phải Error instance.
        const err = e as { code?: string; message?: string };
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.message).toBe('too many');
      }
    });
  });
});
