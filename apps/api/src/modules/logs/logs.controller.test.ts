/**
 * Controller-level pure-unit tests cho `apps/api/src/modules/logs/logs.controller.ts`.
 *
 * 1 endpoint: `GET /logs/me?type=&limit=&cursor=`. Pattern:
 *   1. Auth → null → 401.
 *   2. Zod parse query (type enum, limit int [1..50] default 20, cursor optional).
 *   3. Delegate `logs.listForUser(userId, parsed)`.
 *   4. Map LogsError NO_CHARACTER → 404, INVALID_CURSOR → 400.
 *
 * Service-level test đã có; controller chưa lock zod boundaries + error mapping.
 */
import { describe, expect, it } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { LogsController } from './logs.controller';
import {
  LogsError,
  type LogsService,
  type LogsListResult,
} from './logs.service';
import type { AuthService } from '../auth/auth.service';

const STUB_LIST: LogsListResult = { entries: [], nextCursor: null };

function makeReq(cookie: string | undefined): Request {
  return { cookies: cookie ? { xt_access: cookie } : {} } as unknown as Request;
}

interface ListArgs {
  userId: string;
  parsed: { type: 'currency' | 'item'; limit: number; cursor?: string };
}

function makeController(opts: {
  authedUserId?: string | null;
  listImpl?: (uid: string, q: ListArgs['parsed']) => Promise<LogsListResult>;
} = {}) {
  const calls: ListArgs[] = [];
  const auth = {
    userIdFromAccess: async (t: string | undefined) =>
      t ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const logs = {
    listForUser: async (uid: string, q: ListArgs['parsed']) => {
      calls.push({ userId: uid, parsed: q });
      return opts.listImpl ? opts.listImpl(uid, q) : STUB_LIST;
    },
  } as unknown as LogsService;
  return { controller: new LogsController(logs, auth), calls };
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

describe('LogsController', () => {
  describe('auth', () => {
    it('401 khi không cookie', async () => {
      const { controller } = makeController();
      await expectHttpError(
        controller.me(makeReq(undefined), {}),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('401 khi auth resolve null', async () => {
      const { controller } = makeController({ authedUserId: null });
      await expectHttpError(
        controller.me(makeReq('bad'), {}),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });
  });

  describe('zod query', () => {
    it('default → type="currency", limit=20, cursor undefined', async () => {
      const { controller, calls } = makeController();
      await controller.me(makeReq('valid'), {});
      expect(calls[0].parsed).toEqual({ type: 'currency', limit: 20 });
    });

    it('type="item" được giữ', async () => {
      const { controller, calls } = makeController();
      await controller.me(makeReq('valid'), { type: 'item' });
      expect(calls[0].parsed.type).toBe('item');
    });

    it('type ngoài enum → 400 INVALID_INPUT', async () => {
      const { controller } = makeController();
      await expectHttpError(
        controller.me(makeReq('valid'), { type: 'gold' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('limit "5" string → coerce sang 5', async () => {
      const { controller, calls } = makeController();
      await controller.me(makeReq('valid'), { limit: '5' });
      expect(calls[0].parsed.limit).toBe(5);
    });

    it('limit 0 (dưới min) → 400', async () => {
      const { controller } = makeController();
      await expectHttpError(
        controller.me(makeReq('valid'), { limit: 0 }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('limit 51 (trên max) → 400', async () => {
      const { controller } = makeController();
      await expectHttpError(
        controller.me(makeReq('valid'), { limit: 51 }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('limit 1.5 (non-int) → 400', async () => {
      const { controller } = makeController();
      await expectHttpError(
        controller.me(makeReq('valid'), { limit: 1.5 }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('cursor string → passthrough', async () => {
      const { controller, calls } = makeController();
      await controller.me(makeReq('valid'), { cursor: 'eyJ0Ijoi' });
      expect(calls[0].parsed.cursor).toBe('eyJ0Ijoi');
    });

    it('cursor empty string → 400 (min 1)', async () => {
      const { controller } = makeController();
      await expectHttpError(
        controller.me(makeReq('valid'), { cursor: '' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
  });

  describe('delegation + envelope', () => {
    it('happy path → { ok: true, data: result }', async () => {
      const result: LogsListResult = {
        entries: [],
        nextCursor: 'next-cursor-abc',
      };
      const { controller } = makeController({ listImpl: async () => result });
      const r = await controller.me(makeReq('valid'), {});
      expect(r).toEqual({ ok: true, data: result });
    });
  });

  describe('error mapping', () => {
    it('LogsError NO_CHARACTER → 404', async () => {
      const { controller } = makeController({
        listImpl: async () => {
          throw new LogsError('NO_CHARACTER');
        },
      });
      await expectHttpError(
        controller.me(makeReq('valid'), {}),
        HttpStatus.NOT_FOUND,
        'NO_CHARACTER',
      );
    });

    it('LogsError INVALID_CURSOR → 400', async () => {
      const { controller } = makeController({
        listImpl: async () => {
          throw new LogsError('INVALID_CURSOR');
        },
      });
      await expectHttpError(
        controller.me(makeReq('valid'), {}),
        HttpStatus.BAD_REQUEST,
        'INVALID_CURSOR',
      );
    });

    it('unknown error rethrow nguyên', async () => {
      const boom = new Error('db down');
      const { controller } = makeController({
        listImpl: async () => {
          throw boom;
        },
      });
      await expect(controller.me(makeReq('valid'), {})).rejects.toBe(boom);
    });
  });
});
