/**
 * Controller-level pure-unit tests cho `apps/api/src/modules/chat/chat.controller.ts`.
 *
 * 3 endpoint:
 *  - `GET /chat/history?channel=WORLD|SECT`: auth + zod ChannelEnum →
 *    delegate `historyWorld()` (no userId) hoặc `historySect(userId)`.
 *  - `POST /chat/world`: auth + zod ({ text: 1..200 }) → sendWorld.
 *  - `POST /chat/sect`: auth + zod ({ text: 1..200 }) → sendSect.
 *
 * Error mapping (`ChatError`):
 *  - `NO_CHARACTER` / `NO_SECT` → 404
 *  - `EMPTY_TEXT` / `TEXT_TOO_LONG` → 400
 *  - `RATE_LIMITED` → 429
 *
 * Test này lock-in:
 *  1. Auth null → 401 cho cả 3 endpoint.
 *  2. Channel zod fail (`?channel=invalid` / undefined) → 400 INVALID_INPUT.
 *  3. WORLD → historyWorld() KHÔNG truyền userId; SECT → historySect(userId).
 *  4. Body text zod fail (rỗng / >200 / non-string / missing) → 400 INVALID_INPUT.
 *  5. Delegate đúng (userId, text).
 *  6. Envelope `{ ok, data: { messages } }` cho GET, `{ ok, data: { message } }` cho POST.
 *  7. ChatError 5-code mapping {404,404,400,400,429}.
 *  8. Unknown error rethrow nguyên.
 */
import { describe, expect, it } from 'vitest';
import { HttpException, HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { ChatController } from './chat.controller';
import {
  ChatError,
  type ChatService,
  type ChatMessageView,
} from './chat.service';
import type { AuthService } from '../auth/auth.service';

const STUB_MSG: ChatMessageView = {
  id: 'msg-1',
  channel: 'WORLD' as ChatMessageView['channel'],
  scopeKey: 'WORLD',
  senderId: 'c1',
  senderName: 'tester',
  text: 'hi',
  createdAt: '2026-04-30T12:00:00.000Z',
};

const STUB_SECT_MSG: ChatMessageView = {
  ...STUB_MSG,
  id: 'msg-2',
  channel: 'SECT' as ChatMessageView['channel'],
  scopeKey: 'sect-1',
};

function makeReq(cookie: string | undefined): Request {
  return { cookies: cookie ? { xt_access: cookie } : {} } as unknown as Request;
}

function makeController(
  opts: {
    authedUserId?: string | null;
    historyWorldImpl?: () => Promise<ChatMessageView[]>;
    historySectImpl?: (uid: string) => Promise<ChatMessageView[]>;
    sendWorldImpl?: (uid: string, text: string) => Promise<ChatMessageView>;
    sendSectImpl?: (uid: string, text: string) => Promise<ChatMessageView>;
  } = {},
) {
  const auth = {
    userIdFromAccess: async (t: string | undefined) =>
      t ? (opts.authedUserId === undefined ? 'u1' : opts.authedUserId) : null,
  } as unknown as AuthService;
  const chat = {
    historyWorld: opts.historyWorldImpl ?? (async () => [STUB_MSG]),
    historySect: opts.historySectImpl ?? (async () => [STUB_SECT_MSG]),
    sendWorld: opts.sendWorldImpl ?? (async () => STUB_MSG),
    sendSect: opts.sendSectImpl ?? (async () => STUB_SECT_MSG),
  } as unknown as ChatService;
  return new ChatController(chat, auth);
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

describe('ChatController', () => {
  describe('auth — 401 cho cả 3 endpoint', () => {
    it('GET /chat/history 401 khi không cookie', async () => {
      const c = makeController();
      await expectHttpError(
        c.history(makeReq(undefined), 'WORLD'),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });
    it('POST /chat/world 401 khi auth null', async () => {
      const c = makeController({ authedUserId: null });
      await expectHttpError(
        c.world(makeReq('bad'), { text: 'hi' }),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });
    it('POST /chat/sect 401 khi không cookie', async () => {
      const c = makeController();
      await expectHttpError(
        c.sect(makeReq(undefined), { text: 'hi' }),
        HttpStatus.UNAUTHORIZED,
        'UNAUTHENTICATED',
      );
    });
  });

  describe('GET /chat/history — channel zod', () => {
    it('400 INVALID_INPUT khi channel=invalid', async () => {
      const c = makeController();
      await expectHttpError(
        c.history(makeReq('valid'), 'INVALID'),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('400 khi channel rỗng', async () => {
      const c = makeController();
      await expectHttpError(
        c.history(makeReq('valid'), ''),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('400 khi channel undefined (query thiếu)', async () => {
      const c = makeController();
      await expectHttpError(
        c.history(makeReq('valid'), undefined as unknown as string),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('case-sensitive — `world` lowercase fail', async () => {
      const c = makeController();
      await expectHttpError(
        c.history(makeReq('valid'), 'world'),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('WORLD → historyWorld() KHÔNG truyền userId', async () => {
      const calls: string[] = [];
      const c = makeController({
        historyWorldImpl: async () => {
          calls.push('world-no-uid');
          return [STUB_MSG];
        },
        historySectImpl: async () => {
          calls.push('sect-called!');
          return [];
        },
      });
      const r = await c.history(makeReq('valid'), 'WORLD');
      expect(r).toEqual({ ok: true, data: { messages: [STUB_MSG] } });
      expect(calls).toEqual(['world-no-uid']);
    });
    it('SECT → historySect(userId)', async () => {
      const calls: string[] = [];
      const c = makeController({
        historySectImpl: async (uid) => {
          calls.push(uid);
          return [STUB_SECT_MSG];
        },
      });
      const r = await c.history(makeReq('valid'), 'SECT');
      expect(r).toEqual({ ok: true, data: { messages: [STUB_SECT_MSG] } });
      expect(calls).toEqual(['u1']);
    });
    it('rethrow non-ChatError nguyên', async () => {
      const boom = new Error('db down');
      const c = makeController({
        historyWorldImpl: async () => {
          throw boom;
        },
      });
      await expect(c.history(makeReq('valid'), 'WORLD')).rejects.toBe(boom);
    });
  });

  describe('POST /chat/world — text zod', () => {
    it('400 khi body null', async () => {
      const c = makeController();
      await expectHttpError(
        c.world(makeReq('valid'), null),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('400 khi text rỗng (min 1)', async () => {
      const c = makeController();
      await expectHttpError(
        c.world(makeReq('valid'), { text: '' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('400 khi text > 200 ký tự', async () => {
      const c = makeController();
      await expectHttpError(
        c.world(makeReq('valid'), { text: 'x'.repeat(201) }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('400 khi text không phải string', async () => {
      const c = makeController();
      await expectHttpError(
        c.world(makeReq('valid'), { text: 42 }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('200 envelope; delegate (userId, text); text=200 boundary accept', async () => {
      const calls: Array<[string, string]> = [];
      const text = 'x'.repeat(200);
      const c = makeController({
        sendWorldImpl: async (uid, t) => {
          calls.push([uid, t]);
          return STUB_MSG;
        },
      });
      const r = await c.world(makeReq('valid'), { text });
      expect(r).toEqual({ ok: true, data: { message: STUB_MSG } });
      expect(calls).toEqual([['u1', text]]);
    });
  });

  describe('POST /chat/sect — text zod', () => {
    it('400 khi text rỗng', async () => {
      const c = makeController();
      await expectHttpError(
        c.sect(makeReq('valid'), { text: '' }),
        HttpStatus.BAD_REQUEST,
        'INVALID_INPUT',
      );
    });
    it('200 envelope; delegate (userId, text)', async () => {
      const calls: Array<[string, string]> = [];
      const c = makeController({
        sendSectImpl: async (uid, t) => {
          calls.push([uid, t]);
          return STUB_SECT_MSG;
        },
      });
      const r = await c.sect(makeReq('valid'), { text: 'sect msg' });
      expect(r).toEqual({ ok: true, data: { message: STUB_SECT_MSG } });
      expect(calls).toEqual([['u1', 'sect msg']]);
    });
  });

  describe('ChatError 5-code mapping', () => {
    const cases: Array<[
      'NO_CHARACTER' | 'NO_SECT' | 'EMPTY_TEXT' | 'TEXT_TOO_LONG' | 'RATE_LIMITED',
      number,
    ]> = [
      ['NO_CHARACTER', HttpStatus.NOT_FOUND],
      ['NO_SECT', HttpStatus.NOT_FOUND],
      ['EMPTY_TEXT', HttpStatus.BAD_REQUEST],
      ['TEXT_TOO_LONG', HttpStatus.BAD_REQUEST],
      ['RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS],
    ];
    for (const [code, status] of cases) {
      it(`world: ChatError(${code}) → ${status}`, async () => {
        const c = makeController({
          sendWorldImpl: async () => {
            throw new ChatError(code);
          },
        });
        await expectHttpError(
          c.world(makeReq('valid'), { text: 'hi' }),
          status,
          code,
        );
      });
    }

    it('sect: ChatError(NO_SECT) → 404 — đặc biệt sect-only error', async () => {
      const c = makeController({
        sendSectImpl: async () => {
          throw new ChatError('NO_SECT');
        },
      });
      await expectHttpError(
        c.sect(makeReq('valid'), { text: 'hi' }),
        HttpStatus.NOT_FOUND,
        'NO_SECT',
      );
    });

    it('history sect: ChatError(NO_CHARACTER) → 404', async () => {
      const c = makeController({
        historySectImpl: async () => {
          throw new ChatError('NO_CHARACTER');
        },
      });
      await expectHttpError(
        c.history(makeReq('valid'), 'SECT'),
        HttpStatus.NOT_FOUND,
        'NO_CHARACTER',
      );
    });

    it('rethrow non-ChatError nguyên', async () => {
      const boom = new Error('boom');
      const c = makeController({
        sendWorldImpl: async () => {
          throw boom;
        },
      });
      await expect(c.world(makeReq('valid'), { text: 'hi' })).rejects.toBe(boom);
    });
  });
});
