import { describe, it, expect } from 'vitest';

import {
  ApiOk,
  ApiErr,
  Email,
  Password,
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  PublicUser,
  AuthErrorCode,
  AUTH_ERROR_VI,
} from './api-contracts';
import { z } from 'zod';

/**
 * `api-contracts.ts` là zod schema lock cho REST API auth. BE dùng để validate
 * input, FE dùng để type-check response. Schema error = runtime 500 hoặc
 * invalid form submit. Test khoá shape + error precedence + i18n map.
 */
describe('api-contracts', () => {
  describe('ApiOk / ApiErr envelope', () => {
    it('ApiOk wraps arbitrary schema', () => {
      const schema = ApiOk(z.object({ name: z.string() }));
      const parsed = schema.parse({ ok: true, data: { name: 'foo' } });
      expect(parsed.ok).toBe(true);
      expect(parsed.data.name).toBe('foo');
    });

    it('ApiOk rejects ok:false', () => {
      const schema = ApiOk(z.object({ name: z.string() }));
      expect(() => schema.parse({ ok: false, data: { name: 'x' } })).toThrow();
    });

    it('ApiErr has error.code + error.message', () => {
      const parsed = ApiErr.parse({
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Sai' },
      });
      expect(parsed.error.code).toBe('INVALID_CREDENTIALS');
      expect(parsed.error.message).toBe('Sai');
    });

    it('ApiErr rejects missing code/message', () => {
      expect(() => ApiErr.parse({ ok: false, error: { code: 'X' } })).toThrow();
      expect(() => ApiErr.parse({ ok: false, error: { message: 'X' } })).toThrow();
      expect(() => ApiErr.parse({ ok: false })).toThrow();
    });

    it('ApiErr rejects ok:true', () => {
      expect(() =>
        ApiErr.parse({ ok: true, error: { code: 'X', message: 'Y' } }),
      ).toThrow();
    });
  });

  describe('Email validator', () => {
    it('accepts well-formed email', () => {
      expect(Email.parse('user@example.com')).toBe('user@example.com');
      expect(Email.parse('a.b+c@sub.domain.co')).toBe('a.b+c@sub.domain.co');
    });

    it('rejects malformed input', () => {
      expect(() => Email.parse('not-an-email')).toThrow();
      expect(() => Email.parse('missing@tld')).toThrow();
      expect(() => Email.parse('')).toThrow();
    });
  });

  describe('Password validator', () => {
    it('accepts 8+ chars with letter + digit', () => {
      expect(Password.parse('abc12345')).toBe('abc12345');
      expect(Password.parse('Password1')).toBe('Password1');
    });

    it('rejects < 8 chars', () => {
      const r = Password.safeParse('ab12');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.errors[0].message).toMatch(/tối thiểu 8/i);
      }
    });

    it('rejects no-letter password (digits only)', () => {
      const r = Password.safeParse('12345678');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.errors.some((e) => /chữ/i.test(e.message))).toBe(true);
      }
    });

    it('rejects no-digit password (letters only)', () => {
      const r = Password.safeParse('abcdefgh');
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.errors.some((e) => /số/i.test(e.message))).toBe(true);
      }
    });
  });

  describe('RegisterInput', () => {
    it('accepts valid shape', () => {
      expect(
        RegisterInput.parse({ email: 'a@b.co', password: 'password1' }),
      ).toEqual({ email: 'a@b.co', password: 'password1' });
    });

    it('rejects missing fields', () => {
      expect(() => RegisterInput.parse({ email: 'a@b.co' })).toThrow();
      expect(() => RegisterInput.parse({ password: 'password1' })).toThrow();
    });
  });

  describe('LoginInput', () => {
    it('accepts without rememberEmail (optional)', () => {
      const r = LoginInput.parse({ email: 'a@b.co', password: 'any' });
      expect(r.email).toBe('a@b.co');
      expect(r.rememberEmail).toBeUndefined();
    });

    it('accepts rememberEmail=true', () => {
      const r = LoginInput.parse({ email: 'a@b.co', password: 'any', rememberEmail: true });
      expect(r.rememberEmail).toBe(true);
    });

    it('login password min(1) only (not strict — allow legacy login)', () => {
      expect(() => LoginInput.parse({ email: 'a@b.co', password: '' })).toThrow();
      expect(LoginInput.parse({ email: 'a@b.co', password: 'x' }).password).toBe('x');
    });
  });

  describe('ChangePasswordInput', () => {
    it('requires oldPassword non-empty', () => {
      expect(() =>
        ChangePasswordInput.parse({ oldPassword: '', newPassword: 'password1' }),
      ).toThrow();
    });

    it('requires newPassword strict (Password rule)', () => {
      expect(() =>
        ChangePasswordInput.parse({ oldPassword: 'any', newPassword: 'weak' }),
      ).toThrow();
    });

    it('accepts valid pair', () => {
      const r = ChangePasswordInput.parse({
        oldPassword: 'anyOld',
        newPassword: 'newPass1',
      });
      expect(r.newPassword).toBe('newPass1');
    });
  });

  describe('ForgotPasswordInput', () => {
    it('accepts email', () => {
      expect(ForgotPasswordInput.parse({ email: 'a@b.co' })).toEqual({ email: 'a@b.co' });
    });

    it('rejects non-email', () => {
      expect(() => ForgotPasswordInput.parse({ email: 'not-email' })).toThrow();
    });
  });

  describe('ResetPasswordInput', () => {
    it('requires token >= 16 chars', () => {
      const r = ResetPasswordInput.safeParse({
        token: 'short',
        newPassword: 'password1',
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.errors[0].message).toMatch(/không hợp lệ/i);
      }
    });

    it('accepts token >= 16 chars + strict newPassword', () => {
      const r = ResetPasswordInput.parse({
        token: 'a'.repeat(32),
        newPassword: 'password1',
      });
      expect(r.token).toHaveLength(32);
    });
  });

  describe('PublicUser', () => {
    it('accepts valid user', () => {
      const u = PublicUser.parse({
        id: 'u_1',
        email: 'a@b.co',
        role: 'PLAYER',
        createdAt: '2026-04-30T00:00:00Z',
      });
      expect(u.role).toBe('PLAYER');
    });

    it('rejects invalid role enum', () => {
      expect(() =>
        PublicUser.parse({
          id: 'u_1',
          email: 'a@b.co',
          role: 'SUPERUSER',
          createdAt: '2026-04-30T00:00:00Z',
        }),
      ).toThrow();
    });

    it('allows MOD / ADMIN role', () => {
      expect(
        PublicUser.parse({
          id: 'u_1',
          email: 'a@b.co',
          role: 'MOD',
          createdAt: 'x',
        }).role,
      ).toBe('MOD');
      expect(
        PublicUser.parse({
          id: 'u_2',
          email: 'b@b.co',
          role: 'ADMIN',
          createdAt: 'x',
        }).role,
      ).toBe('ADMIN');
    });
  });

  describe('AuthErrorCode + AUTH_ERROR_VI', () => {
    it('AuthErrorCode covers 7 documented codes', () => {
      const codes = [
        'INVALID_CREDENTIALS',
        'EMAIL_TAKEN',
        'WEAK_PASSWORD',
        'OLD_PASSWORD_WRONG',
        'RATE_LIMITED',
        'UNAUTHENTICATED',
        'INVALID_RESET_TOKEN',
      ];
      for (const c of codes) {
        expect(AuthErrorCode.parse(c)).toBe(c);
      }
    });

    it('AuthErrorCode rejects unknown code', () => {
      expect(() => AuthErrorCode.parse('UNKNOWN_ERROR')).toThrow();
    });

    it('AUTH_ERROR_VI maps every code to non-empty VN string', () => {
      for (const code of AuthErrorCode.options) {
        const msg = AUTH_ERROR_VI[code];
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
      }
    });

    it('AUTH_ERROR_VI does not leak English fallback', () => {
      // Dễ catch typo khi copy-paste code → message EN không dịch.
      for (const code of AuthErrorCode.options) {
        const msg = AUTH_ERROR_VI[code];
        // ≥ 1 ký tự unicode VN (dấu).
        expect(msg).toMatch(/[À-ỹ]/);
      }
    });
  });
});
