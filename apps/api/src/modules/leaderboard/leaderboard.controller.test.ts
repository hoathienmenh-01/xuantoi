/**
 * Controller-level tests cho `apps/api/src/modules/leaderboard/leaderboard.controller.ts`.
 *
 * 3 endpoint: `GET /leaderboard/{power,topup,sect}`. Mỗi endpoint cùng pattern:
 *   1. Resolve userId qua `auth.userIdFromAccess(cookie)`.
 *   2. Nếu không auth → throw 401 `UNAUTHENTICATED`.
 *   3. Parse `?limit=N` qua `Number()` và truyền cho service (service tự clamp).
 *   4. Wrap `{ ok: true, data: { rows } }`.
 *
 * Service đã có 27 test (`leaderboard.service.test.ts`) — controller tests này lock-in:
 *   - auth guard (3 endpoint × no-cookie + invalid)
 *   - delegation pattern (đúng method service được gọi với đúng arg)
 *   - response envelope shape
 *   - limit parsing edge cases (`undefined`, valid number, NaN passthrough → service clamps)
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { LeaderboardController } from './leaderboard.controller';
import type { AuthService } from '../auth/auth.service';
import type {
  LeaderboardService,
  LeaderboardRow,
  LeaderboardTopupRow,
  LeaderboardSectRow,
} from './leaderboard.service';

const STUB_POWER_ROW: LeaderboardRow = {
  rank: 1,
  characterId: 'c1',
  name: 'Đạo Hữu',
  realmKey: 'phamnhan',
  realmStage: 0,
  power: 14,
  level: 1,
  sectKey: null,
};

const STUB_TOPUP_ROW: LeaderboardTopupRow = {
  rank: 1,
  characterId: 'c1',
  name: 'Đạo Hữu',
  realmKey: 'phamnhan',
  realmStage: 0,
  totalTienNgoc: 1000,
  sectKey: null,
};

const STUB_SECT_ROW: LeaderboardSectRow = {
  rank: 1,
  sectId: 's1',
  sectKey: 'thanh_van',
  name: 'Thanh Vân Môn',
  level: 1,
  treasuryLinhThach: '0',
  memberCount: 5,
  leaderName: null,
};

function makeReq(cookie: string | undefined): Request {
  return {
    cookies: cookie ? { xt_access: cookie } : {},
  } as unknown as Request;
}

interface SvcCalls {
  power: (number | undefined)[];
  topup: (number | undefined)[];
  sect: (number | undefined)[];
}

function makeController(opts: { authedUserId?: string | null } = {}) {
  const calls: SvcCalls = { power: [], topup: [], sect: [] };
  const auth = {
    userIdFromAccess: async (token: string | undefined) =>
      token ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const svc = {
    topByPower: async (n?: number) => {
      calls.power.push(n);
      return [STUB_POWER_ROW];
    },
    topByTopup: async (n?: number) => {
      calls.topup.push(n);
      return [STUB_TOPUP_ROW];
    },
    topBySect: async (n?: number) => {
      calls.sect.push(n);
      return [STUB_SECT_ROW];
    },
  } as unknown as LeaderboardService;
  return { controller: new LeaderboardController(auth, svc), calls };
}

describe('LeaderboardController', () => {
  let ctx: ReturnType<typeof makeController>;

  beforeEach(() => {
    ctx = makeController();
  });

  describe('auth guard', () => {
    it('topByPower → 401 UNAUTHENTICATED khi không có cookie', async () => {
      try {
        await ctx.controller.topByPower(makeReq(undefined));
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

    it('topByTopup → 401 khi auth resolve null userId', async () => {
      const c = makeController({ authedUserId: null });
      await expect(c.controller.topByTopup(makeReq('bad-token'))).rejects.toThrow(
        HttpException,
      );
    });

    it('topBySect → 401 khi không có cookie', async () => {
      await expect(ctx.controller.topBySect(makeReq(undefined))).rejects.toThrow(
        HttpException,
      );
    });

    it('không endpoint nào gọi service khi auth fail', async () => {
      try {
        await ctx.controller.topByPower(makeReq(undefined));
      } catch {
        /* expected */
      }
      try {
        await ctx.controller.topByTopup(makeReq(undefined));
      } catch {
        /* expected */
      }
      try {
        await ctx.controller.topBySect(makeReq(undefined));
      } catch {
        /* expected */
      }
      expect(ctx.calls.power).toHaveLength(0);
      expect(ctx.calls.topup).toHaveLength(0);
      expect(ctx.calls.sect).toHaveLength(0);
    });
  });

  describe('delegation + envelope shape', () => {
    it('topByPower wraps { ok: true, data: { rows } } với rows từ service', async () => {
      const r = await ctx.controller.topByPower(makeReq('valid'));
      expect(r).toEqual({ ok: true, data: { rows: [STUB_POWER_ROW] } });
    });

    it('topByTopup wraps { ok: true, data: { rows } }', async () => {
      const r = await ctx.controller.topByTopup(makeReq('valid'));
      expect(r).toEqual({ ok: true, data: { rows: [STUB_TOPUP_ROW] } });
    });

    it('topBySect wraps { ok: true, data: { rows } }', async () => {
      const r = await ctx.controller.topBySect(makeReq('valid'));
      expect(r).toEqual({ ok: true, data: { rows: [STUB_SECT_ROW] } });
    });
  });

  describe('limit parsing', () => {
    it('không truyền `?limit=` → service nhận undefined (service tự clamp DEFAULT_LIMIT)', async () => {
      await ctx.controller.topByPower(makeReq('valid'));
      await ctx.controller.topByTopup(makeReq('valid'));
      await ctx.controller.topBySect(makeReq('valid'));
      expect(ctx.calls.power[0]).toBeUndefined();
      expect(ctx.calls.topup[0]).toBeUndefined();
      expect(ctx.calls.sect[0]).toBeUndefined();
    });

    it('`?limit=20` → service nhận number 20', async () => {
      await ctx.controller.topByPower(makeReq('valid'), '20');
      await ctx.controller.topByTopup(makeReq('valid'), '20');
      await ctx.controller.topBySect(makeReq('valid'), '20');
      expect(ctx.calls.power[0]).toBe(20);
      expect(ctx.calls.topup[0]).toBe(20);
      expect(ctx.calls.sect[0]).toBe(20);
    });

    it('`?limit=abc` → service nhận NaN (service clamps về DEFAULT_LIMIT=50)', async () => {
      await ctx.controller.topByPower(makeReq('valid'), 'abc');
      // Service tự handle NaN qua `Number.isFinite`. Controller chỉ pass-through.
      expect(Number.isNaN(ctx.calls.power[0])).toBe(true);
    });

    it('`?limit=0` → service nhận 0 (service clamps lên 1)', async () => {
      await ctx.controller.topByPower(makeReq('valid'), '0');
      expect(ctx.calls.power[0]).toBe(0);
    });

    it('`?limit=999` → service nhận 999 (service clamps xuống MAX_LIMIT=50)', async () => {
      await ctx.controller.topByPower(makeReq('valid'), '999');
      expect(ctx.calls.power[0]).toBe(999);
    });

    it('`?limit=` (empty string) → controller pass undefined cho service', async () => {
      await ctx.controller.topByPower(makeReq('valid'), '');
      // Empty string is falsy → ternary returns undefined.
      expect(ctx.calls.power[0]).toBeUndefined();
    });
  });

  describe('access cookie passthrough', () => {
    it('cookie value được truyền nguyên cho auth.userIdFromAccess', async () => {
      let received: string | undefined;
      const auth = {
        userIdFromAccess: async (token: string | undefined) => {
          received = token;
          return 'u1';
        },
      } as unknown as AuthService;
      const svc = {
        topByPower: async () => [STUB_POWER_ROW],
        topByTopup: async () => [],
        topBySect: async () => [],
      } as unknown as LeaderboardService;
      const ctrl = new LeaderboardController(auth, svc);
      await ctrl.topByPower(makeReq('cookie-abc-123'));
      expect(received).toBe('cookie-abc-123');
    });
  });
});
