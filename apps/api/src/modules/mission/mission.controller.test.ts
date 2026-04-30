/**
 * Controller-level pure-unit tests cho `apps/api/src/modules/mission/mission.controller.ts`.
 *
 * 2 endpoint:
 *  - `GET /missions/me`: auth → list `MissionProgressView[]`.
 *  - `POST /missions/claim`: auth → zod ({ missionKey: string min 1 max 80 })
 *    → claim → list lại missions.
 *
 * Error mapping (`MissionError`):
 *  - `NO_CHARACTER` / `MISSION_UNKNOWN` → 404
 *  - `NOT_READY` / `ALREADY_CLAIMED` → 409
 *
 * Service đã có vitest cover progress logic; controller chưa lock auth + zod
 * + error mapping + envelope. Test này lock-in:
 *  1. Auth null → 401 `UNAUTHENTICATED` (không cần check zod).
 *  2. Body zod invalid (missing/empty/too long missionKey/wrong type) → 400
 *     `INVALID_INPUT`.
 *  3. Delegate đúng args (userId, missionKey).
 *  4. `MissionError` map đúng status. Unknown error rethrow nguyên.
 *  5. Envelope `{ ok: true, data: { missions } }` strict cho cả 2 endpoint.
 */
import { describe, expect, it } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { MissionController } from './mission.controller';
import {
  MissionError,
  type MissionService,
  type MissionProgressView,
} from './mission.service';
import type { AuthService } from '../auth/auth.service';

const STUB_MISSIONS: MissionProgressView[] = [];

function makeReq(cookie: string | undefined): Request {
  return { cookies: cookie ? { xt_access: cookie } : {} } as unknown as Request;
}

function makeController(
  opts: {
    authedUserId?: string | null;
    listImpl?: (uid: string) => Promise<MissionProgressView[]>;
    claimImpl?: (uid: string, key: string) => Promise<void>;
  } = {},
) {
  const auth = {
    userIdFromAccess: async (t: string | undefined) =>
      t ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const missions = {
    listForUser: opts.listImpl ?? (async () => STUB_MISSIONS),
    claim: opts.claimImpl ?? (async () => undefined),
  } as unknown as MissionService;
  return new MissionController(missions, auth);
}

async function expectHttpError(
  p: Promise<unknown>,
  status: number,
  code: string,
) {
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

describe('MissionController', () => {
  describe('GET /missions/me — auth', () => {
    it('401 UNAUTHENTICATED khi không có cookie', async () => {
      const c = makeController();
      await expectHttpError(
        c.me(makeReq(undefined)),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('401 khi auth resolve null', async () => {
      const c = makeController({ authedUserId: null });
      await expectHttpError(
        c.me(makeReq('bad')),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('200 envelope { ok, data: { missions } } khi auth ok', async () => {
      const sample: MissionProgressView[] = [
        {
          key: 'daily.cultivate',
          name: 'Tu luyện 30 phút',
          description: '',
          period: 'DAILY' as MissionProgressView['period'],
          goalKind: 'CULTIVATE_SECONDS' as MissionProgressView['goalKind'],
          goalAmount: 1800,
          currentAmount: 600,
          claimed: false,
          completable: false,
          windowEnd: '2026-04-30T17:00:00.000Z',
          rewards: { linhThach: 0, exp: 0, items: [] },
          quality: 'COMMON' as MissionProgressView['quality'],
        },
      ];
      const c = makeController({ listImpl: async () => sample });
      const r = await c.me(makeReq('valid'));
      expect(r).toEqual({ ok: true, data: { missions: sample } });
    });

    it('rethrow non-MissionError nguyên (không nuốt 500)', async () => {
      const boom = new Error('db down');
      const c = makeController({
        listImpl: async () => {
          throw boom;
        },
      });
      await expect(c.me(makeReq('valid'))).rejects.toBe(boom);
    });
  });

  describe('POST /missions/claim — auth + zod', () => {
    it('401 khi không cookie (không kiểm zod)', async () => {
      const c = makeController();
      await expectHttpError(
        c.claim(makeReq(undefined), { missionKey: 'k' }),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });

    it('400 INVALID_INPUT khi body null', async () => {
      const c = makeController();
      await expectHttpError(
        c.claim(makeReq('valid'), null),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('400 khi thiếu missionKey', async () => {
      const c = makeController();
      await expectHttpError(
        c.claim(makeReq('valid'), {}),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('400 khi missionKey rỗng (min 1)', async () => {
      const c = makeController();
      await expectHttpError(
        c.claim(makeReq('valid'), { missionKey: '' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('400 khi missionKey > 80 ký tự', async () => {
      const c = makeController();
      await expectHttpError(
        c.claim(makeReq('valid'), { missionKey: 'x'.repeat(81) }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('400 khi missionKey không phải string', async () => {
      const c = makeController();
      await expectHttpError(
        c.claim(makeReq('valid'), { missionKey: 123 }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });

    it('200 + envelope khi claim ok; delegate (userId, missionKey)', async () => {
      const calls: Array<[string, string]> = [];
      const c = makeController({
        claimImpl: async (uid, k) => {
          calls.push([uid, k]);
        },
        listImpl: async () => STUB_MISSIONS,
      });
      const r = await c.claim(makeReq('valid'), { missionKey: 'daily.cultivate' });
      expect(r).toEqual({ ok: true, data: { missions: STUB_MISSIONS } });
      expect(calls).toEqual([['u1', 'daily.cultivate']]);
    });

    it('missionKey đúng max 80 ký tự được accept', async () => {
      const c = makeController();
      const r = await c.claim(makeReq('valid'), { missionKey: 'x'.repeat(80) });
      expect(r).toEqual({ ok: true, data: { missions: STUB_MISSIONS } });
    });
  });

  describe('POST /missions/claim — MissionError mapping', () => {
    const cases: Array<[
      'NO_CHARACTER' | 'MISSION_UNKNOWN' | 'NOT_READY' | 'ALREADY_CLAIMED',
      number,
    ]> = [
      ['NO_CHARACTER', HttpStatus.NOT_FOUND],
      ['MISSION_UNKNOWN', HttpStatus.NOT_FOUND],
      ['NOT_READY', HttpStatus.CONFLICT],
      ['ALREADY_CLAIMED', HttpStatus.CONFLICT],
    ];
    for (const [code, status] of cases) {
      it(`MissionError(${code}) → ${status}`, async () => {
        const c = makeController({
          claimImpl: async () => {
            throw new MissionError(code);
          },
        });
        await expectHttpError(
          c.claim(makeReq('valid'), { missionKey: 'k' }),
          status,
          code,
        );
      });
    }

    it('rethrow non-MissionError (giữ stack 500 nguyên)', async () => {
      const boom = new Error('boom');
      const c = makeController({
        claimImpl: async () => {
          throw boom;
        },
      });
      await expect(
        c.claim(makeReq('valid'), { missionKey: 'k' }),
      ).rejects.toBe(boom);
    });
  });
});
