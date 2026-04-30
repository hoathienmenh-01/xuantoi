/**
 * Controller-level pure-unit tests cho `apps/api/src/modules/giftcode/giftcode.controller.ts`.
 *
 * 1 endpoint: `POST /giftcodes/redeem`. Pattern:
 *   1. Auth → null → 401 `UNAUTHENTICATED`.
 *   2. Validate body qua zod `RedeemInput` ({ code: string min 1 max 64 }).
 *      Fail → 400 `INVALID_INPUT`.
 *   3. Delegate `gift.redeem(userId, code)` → wrap `{ ok: true, data: { reward } }`.
 *   4. Map `GiftCodeError` → HTTP status:
 *      - `CODE_NOT_FOUND` / `NO_CHARACTER` → 404
 *      - `ALREADY_REDEEMED` / `CODE_EXPIRED` / `CODE_REVOKED` / `CODE_EXHAUSTED` → 409
 *      - default (`INVALID_INPUT`, `CODE_EXISTS`) → 400
 *   5. Unknown error rethrow.
 *
 * Service đã có vitest cover redeem logic; controller chưa lock zod + error mapping.
 */
import { describe, expect, it } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { GiftCodeController } from './giftcode.controller';
import {
  GiftCodeError,
  type GiftCodeService,
  type GiftCodeErrorCode,
} from './giftcode.service';
import type { AuthService } from '../auth/auth.service';

const STUB_REWARD = { linhThachDelta: '500', items: [] as Array<{ key: string; qty: number }> };

function makeReq(cookie: string | undefined): Request {
  return { cookies: cookie ? { xt_access: cookie } : {} } as unknown as Request;
}

function makeController(opts: {
  authedUserId?: string | null;
  redeemImpl?: (uid: string, code: string) => Promise<typeof STUB_REWARD>;
} = {}) {
  const auth = {
    userIdFromAccess: async (t: string | undefined) =>
      t ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const gift = {
    redeem: opts.redeemImpl ?? (async () => STUB_REWARD),
  } as unknown as GiftCodeService;
  return new GiftCodeController(gift, auth);
}

async function expectHttpError(p: Promise<unknown>, status: number, code: string) {
  try {
    await p;
    throw new Error('expected throw');
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    const err = e as HttpException;
    expect(err.getStatus()).toBe(status);
    expect(err.getResponse()).toMatchObject({ ok: false, error: { code } });
  }
}

describe('GiftCodeController', () => {
  describe('auth', () => {
    it('401 UNAUTHENTICATED khi không cookie', async () => {
      const c = makeController();
      await expectHttpError(
        c.redeem(makeReq(undefined), { code: 'WELCOME' }),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('401 khi auth resolve null', async () => {
      const c = makeController({ authedUserId: null });
      await expectHttpError(
        c.redeem(makeReq('bad'), { code: 'WELCOME' }),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });
  });

  describe('zod input validation', () => {
    it('body không phải object → 400 INVALID_INPUT', async () => {
      const c = makeController();
      await expectHttpError(
        c.redeem(makeReq('valid'), null),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('body thiếu `code` → 400', async () => {
      const c = makeController();
      await expectHttpError(
        c.redeem(makeReq('valid'), {}),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('code rỗng (min 1 fail) → 400', async () => {
      const c = makeController();
      await expectHttpError(
        c.redeem(makeReq('valid'), { code: '' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('code dài quá 64 ký tự → 400', async () => {
      const c = makeController();
      await expectHttpError(
        c.redeem(makeReq('valid'), { code: 'A'.repeat(65) }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('code đúng 64 ký tự → ok (boundary)', async () => {
      const c = makeController();
      const r = await c.redeem(makeReq('valid'), { code: 'A'.repeat(64) });
      expect(r).toEqual({ ok: true, data: { reward: STUB_REWARD } });
    });

    it('code 1 ký tự → ok (boundary)', async () => {
      const c = makeController();
      const r = await c.redeem(makeReq('valid'), { code: 'A' });
      expect(r).toEqual({ ok: true, data: { reward: STUB_REWARD } });
    });

    it('code không phải string → 400', async () => {
      const c = makeController();
      await expectHttpError(
        c.redeem(makeReq('valid'), { code: 123 }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
  });

  describe('delegation + envelope', () => {
    it('happy path → { ok: true, data: { reward } } + service nhận (userId, code)', async () => {
      let receivedArgs: [string, string] | null = null;
      const c = makeController({
        redeemImpl: async (uid, code) => {
          receivedArgs = [uid, code];
          return STUB_REWARD;
        },
      });
      const r = await c.redeem(makeReq('valid'), { code: 'WELCOME' });
      expect(r).toEqual({ ok: true, data: { reward: STUB_REWARD } });
      expect(receivedArgs).toEqual(['u1', 'WELCOME']);
    });
  });

  describe('error mapping (GiftCodeError)', () => {
    const cases404: GiftCodeErrorCode[] = ['CODE_NOT_FOUND', 'NO_CHARACTER'];
    const cases409: GiftCodeErrorCode[] = [
      'ALREADY_REDEEMED',
      'CODE_EXPIRED',
      'CODE_REVOKED',
      'CODE_EXHAUSTED',
    ];
    const cases400: GiftCodeErrorCode[] = ['INVALID_INPUT', 'CODE_EXISTS'];

    for (const code of cases404) {
      it(`${code} → 404`, async () => {
        const c = makeController({
          redeemImpl: async () => {
            throw new GiftCodeError(code);
          },
        });
        await expectHttpError(
          c.redeem(makeReq('valid'), { code: 'X' }),
          HttpStatus.NOT_FOUND,
          code,
        );
      });
    }

    for (const code of cases409) {
      it(`${code} → 409`, async () => {
        const c = makeController({
          redeemImpl: async () => {
            throw new GiftCodeError(code);
          },
        });
        await expectHttpError(
          c.redeem(makeReq('valid'), { code: 'X' }),
          HttpStatus.CONFLICT,
          code,
        );
      });
    }

    for (const code of cases400) {
      it(`${code} → 400`, async () => {
        const c = makeController({
          redeemImpl: async () => {
            throw new GiftCodeError(code);
          },
        });
        await expectHttpError(
          c.redeem(makeReq('valid'), { code: 'X' }),
          HttpStatus.BAD_REQUEST,
          code,
        );
      });
    }
  });

  describe('unknown error', () => {
    it('non-GiftCodeError → rethrow nguyên (không nuốt 500)', async () => {
      const boom = new Error('prisma exploded');
      const c = makeController({
        redeemImpl: async () => {
          throw boom;
        },
      });
      await expect(c.redeem(makeReq('valid'), { code: 'X' })).rejects.toBe(boom);
    });
  });
});
