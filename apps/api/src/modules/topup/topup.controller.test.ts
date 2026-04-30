/**
 * Controller-level pure-unit tests cho `apps/api/src/modules/topup/topup.controller.ts`.
 *
 * 3 endpoint:
 *  - `GET /topup/packages`: public (no auth!) → trả `TOPUP_PACKAGES` const + bankInfo().
 *  - `GET /topup/me`: auth → listForUser(userId) → `{ ok, data: { orders } }`.
 *  - `POST /topup/create`: auth → zod ({packageKey:string 1..64}) → createOrder.
 *
 * Error mapping (TopupError):
 *  - `INVALID_PACKAGE` → 400
 *  - `TOO_MANY_PENDING` → 429
 *  - default (`NO_USER`/`NOT_FOUND`/`ALREADY_PROCESSED`) → 409
 *
 * Quan trọng: zod parse fail → controller `fail('INVALID_PACKAGE')` (không `INVALID_INPUT`).
 */
import { describe, expect, it } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { TOPUP_PACKAGES } from '@xuantoi/shared';
import { TopupController } from './topup.controller';
import {
  TopupError,
  type TopupService,
  type TopupOrderView,
} from './topup.service';
import type { AuthService } from '../auth/auth.service';

const STUB_BANK = { bankName: 'Vietcombank', accountName: 'XT', accountNumber: '0123' };
const STUB_ORDER = {
  id: 'o1',
  packageKey: 'pkg-100',
  packageName: 'Gói 100K',
  tienNgocAmount: 1000,
  priceVND: 100000,
  transferCode: 'XT-AB12',
  status: 'PENDING',
  note: '',
} as unknown as TopupOrderView;

function makeReq(cookie: string | undefined): Request {
  return { cookies: cookie ? { xt_access: cookie } : {} } as unknown as Request;
}

function makeController(opts: {
  authedUserId?: string | null;
  listImpl?: (uid: string) => Promise<TopupOrderView[]>;
  createImpl?: (uid: string, key: string) => Promise<TopupOrderView>;
} = {}) {
  const auth = {
    userIdFromAccess: async (t: string | undefined) =>
      t ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const topup = {
    bankInfo: () => STUB_BANK,
    listForUser: opts.listImpl ?? (async () => []),
    createOrder: opts.createImpl ?? (async () => STUB_ORDER),
  } as unknown as TopupService;
  return new TopupController(topup, auth);
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

describe('TopupController', () => {
  describe('GET /topup/packages (public)', () => {
    it('không cần cookie cũng trả packages + bank', () => {
      const c = makeController();
      const r = c.packages();
      expect(r).toEqual({
        ok: true,
        data: { packages: TOPUP_PACKAGES, bank: STUB_BANK },
      });
    });
  });

  describe('GET /topup/me', () => {
    it('401 khi không cookie', async () => {
      const c = makeController();
      await expectHttpError(
        c.me(makeReq(undefined)),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('happy path → { ok: true, data: { orders } } với userId passthrough', async () => {
      let receivedUid: string | undefined;
      const c = makeController({
        listImpl: async (uid) => {
          receivedUid = uid;
          return [STUB_ORDER];
        },
      });
      const r = await c.me(makeReq('valid'));
      expect(r).toEqual({ ok: true, data: { orders: [STUB_ORDER] } });
      expect(receivedUid).toBe('u1');
    });
  });

  describe('POST /topup/create', () => {
    it('401 khi không cookie', async () => {
      const c = makeController();
      await expectHttpError(
        c.create(makeReq(undefined), { packageKey: 'pkg-100' }),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('zod fail (null body) → 400 INVALID_PACKAGE (không phải INVALID_INPUT)', async () => {
      const c = makeController();
      await expectHttpError(
        c.create(makeReq('valid'), null),
        HttpStatus.BAD_REQUEST,
        'INVALID_PACKAGE',
      );
    });

    it('zod fail (packageKey rỗng) → 400 INVALID_PACKAGE', async () => {
      const c = makeController();
      await expectHttpError(
        c.create(makeReq('valid'), { packageKey: '' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_PACKAGE',
      );
    });

    it('zod fail (packageKey >64) → 400 INVALID_PACKAGE', async () => {
      const c = makeController();
      await expectHttpError(
        c.create(makeReq('valid'), { packageKey: 'A'.repeat(65) }),
        HttpStatus.BAD_REQUEST,
        'INVALID_PACKAGE',
      );
    });

    it('happy path → { ok: true, data: { order } }', async () => {
      let receivedArgs: [string, string] | null = null;
      const c = makeController({
        createImpl: async (uid, key) => {
          receivedArgs = [uid, key];
          return STUB_ORDER;
        },
      });
      const r = await c.create(makeReq('valid'), { packageKey: 'pkg-100' });
      expect(r).toEqual({ ok: true, data: { order: STUB_ORDER } });
      expect(receivedArgs).toEqual(['u1', 'pkg-100']);
    });

    describe('error mapping', () => {
      it('TopupError INVALID_PACKAGE → 400', async () => {
        const c = makeController({
          createImpl: async () => {
            throw new TopupError('INVALID_PACKAGE');
          },
        });
        await expectHttpError(
          c.create(makeReq('valid'), { packageKey: 'pkg-x' }),
          HttpStatus.BAD_REQUEST,
          'INVALID_PACKAGE',
        );
      });

      it('TopupError TOO_MANY_PENDING → 429', async () => {
        const c = makeController({
          createImpl: async () => {
            throw new TopupError('TOO_MANY_PENDING');
          },
        });
        await expectHttpError(
          c.create(makeReq('valid'), { packageKey: 'pkg-x' }),
          HttpStatus.TOO_MANY_REQUESTS,
          'TOO_MANY_PENDING',
        );
      });

      const cases409: Array<ConstructorParameters<typeof TopupError>[0]> = [
        'NO_USER',
        'NOT_FOUND',
        'ALREADY_PROCESSED',
      ];
      for (const code of cases409) {
        it(`TopupError ${code} → 409`, async () => {
          const c = makeController({
            createImpl: async () => {
              throw new TopupError(code);
            },
          });
          await expectHttpError(
            c.create(makeReq('valid'), { packageKey: 'pkg-x' }),
            HttpStatus.CONFLICT,
            code,
          );
        });
      }

      it('unknown error rethrow', async () => {
        const boom = new Error('redis down');
        const c = makeController({
          createImpl: async () => {
            throw boom;
          },
        });
        await expect(
          c.create(makeReq('valid'), { packageKey: 'pkg-x' }),
        ).rejects.toBe(boom);
      });
    });
  });
});
