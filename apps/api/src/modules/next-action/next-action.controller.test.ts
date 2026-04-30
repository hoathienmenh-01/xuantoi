/**
 * Controller-level pure-unit tests cho `apps/api/src/modules/next-action/next-action.controller.ts`.
 *
 * 1 endpoint: `GET /me/next-actions`. Pattern:
 *   1. Auth → null userId → 401.
 *   2. Delegate `svc.forUser(userId)` → trả `{ ok: true, data: { actions } }`.
 *
 * Service đã có vitest cover business logic; controller chưa lock auth + envelope.
 */
import { describe, expect, it } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { NextActionController } from './next-action.controller';
import type { NextActionService } from './next-action.service';
import type { AuthService } from '../auth/auth.service';

const STUB_ACTIONS = [
  { key: 'BREAKTHROUGH_READY', priority: 1, params: {}, route: '/cultivate' },
  { key: 'MISSION_CLAIMABLE', priority: 2, params: { count: 3 }, route: '/missions' },
];

function makeReq(cookie: string | undefined): Request {
  return { cookies: cookie ? { xt_access: cookie } : {} } as unknown as Request;
}

function makeController(opts: {
  authedUserId?: string | null;
  forUserImpl?: (uid: string) => Promise<typeof STUB_ACTIONS>;
} = {}) {
  const auth = {
    userIdFromAccess: async (t: string | undefined) =>
      t ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const svc = {
    forUser: opts.forUserImpl ?? (async () => STUB_ACTIONS),
  } as unknown as NextActionService;
  return new NextActionController(auth, svc);
}

describe('NextActionController', () => {
  it('401 UNAUTHENTICATED khi không cookie', async () => {
    const c = makeController();
    try {
      await c.list(makeReq(undefined));
      expect.fail('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const err = e as HttpException;
      expect(err.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      expect(err.getResponse()).toMatchObject({
        ok: false,
        error: { code: 'UNAUTHENTICATED' },
      });
    }
  });

  it('401 khi auth resolve null', async () => {
    const c = makeController({ authedUserId: null });
    await expect(c.list(makeReq('bad'))).rejects.toThrow(HttpException);
  });

  it('happy path → { ok: true, data: { actions } } với userId passthrough', async () => {
    let receivedUid: string | undefined;
    const c = makeController({
      forUserImpl: async (uid) => {
        receivedUid = uid;
        return STUB_ACTIONS;
      },
    });
    const r = await c.list(makeReq('valid'));
    expect(r).toEqual({ ok: true, data: { actions: STUB_ACTIONS } });
    expect(receivedUid).toBe('u1');
  });

  it('empty actions → { ok: true, data: { actions: [] } }', async () => {
    const c = makeController({ forUserImpl: async () => [] });
    const r = await c.list(makeReq('valid'));
    expect(r).toEqual({ ok: true, data: { actions: [] } });
  });

  it('service không được gọi khi auth fail', async () => {
    let called = 0;
    const c = makeController({
      forUserImpl: async () => {
        called += 1;
        return STUB_ACTIONS;
      },
    });
    try {
      await c.list(makeReq(undefined));
    } catch {
      /* expected */
    }
    expect(called).toBe(0);
  });

  it('service throw → propagate (controller không nuốt error)', async () => {
    const boom = new Error('db down');
    const c = makeController({
      forUserImpl: async () => {
        throw boom;
      },
    });
    await expect(c.list(makeReq('valid'))).rejects.toBe(boom);
  });
});
