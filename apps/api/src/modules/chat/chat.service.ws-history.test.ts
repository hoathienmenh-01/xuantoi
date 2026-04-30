/**
 * Integration test bổ sung cho `chat.service.ts` — cover coverage gap:
 *
 *   1. WS broadcast: `sendWorld` → `realtime.broadcast('chat:msg', view)`.
 *   2. WS emit-to-room: `sendSect` → `realtime.emitToRoom('sect:<sectId>', 'chat:msg', view)`.
 *   3. History ordering: `historyWorld`/`historySect` trả oldest-first
 *      (service query desc + reverse).
 *   4. History isolation: chat WORLD không leak sang SECT; SECT A không
 *      leak sang SECT B (critical: sect chat là kín, leak = breach).
 *   5. History empty: chưa có message nào → `[]`.
 *   6. View shape strict: id, channel, scopeKey, senderId, senderName, text,
 *      createdAt (ISO string) — không có field thừa.
 *   7. sendSect error paths: NO_CHARACTER + NO_SECT (đã test ở file cũ nhưng
 *      historySect chưa test NO_CHARACTER/NO_SECT).
 *
 * Không cover ở file này (đã test ở `chat.service.test.ts`):
 *   - validation (EMPTY/TOO_LONG/NO_CHARACTER on send).
 *   - rate limit (8/30s, world+sect chung quota).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ChatError, ChatService } from './chat.service';
import { InMemorySlidingWindowRateLimiter } from '../../common/rate-limiter';
import { MissionService } from '../mission/mission.service';
import {
  TEST_DATABASE_URL,
  makeMissionService,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let realtime: RealtimeService;
let missions: MissionService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  realtime = new RealtimeService();
  missions = makeMissionService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

function freshSvc(): ChatService {
  const limiter = new InMemorySlidingWindowRateLimiter(30_000, 100);
  return new ChatService(prisma, realtime, missions, limiter);
}

async function makeSect(name: string, leaderCharacterId: string) {
  const sect = await prisma.sect.create({
    data: { name, leaderId: 'placeholder' },
  });
  await prisma.sect.update({
    where: { id: sect.id },
    data: { leaderId: leaderCharacterId },
  });
  return sect;
}

describe('ChatService WS emit', () => {
  it('sendWorld → realtime.broadcast("chat:msg", view)', async () => {
    const broadcastSpy = vi.spyOn(realtime, 'broadcast').mockImplementation(() => {});
    const emitRoomSpy = vi.spyOn(realtime, 'emitToRoom').mockImplementation(() => {});

    const u = await makeUserChar(prisma);
    const svc = freshSvc();
    const view = await svc.sendWorld(u.userId, 'hello world');

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(broadcastSpy).toHaveBeenCalledWith('chat:msg', view);
    expect(emitRoomSpy).not.toHaveBeenCalled();

    broadcastSpy.mockRestore();
    emitRoomSpy.mockRestore();
  });

  it('sendSect → realtime.emitToRoom("sect:<sectId>", "chat:msg", view)', async () => {
    const broadcastSpy = vi.spyOn(realtime, 'broadcast').mockImplementation(() => {});
    const emitRoomSpy = vi.spyOn(realtime, 'emitToRoom').mockImplementation(() => {});

    const u = await makeUserChar(prisma);
    const sect = await makeSect('WS-Sect', u.characterId);
    await prisma.character.update({
      where: { id: u.characterId },
      data: { sectId: sect.id },
    });

    const svc = freshSvc();
    const view = await svc.sendSect(u.userId, 'trong tông');

    expect(emitRoomSpy).toHaveBeenCalledTimes(1);
    expect(emitRoomSpy).toHaveBeenCalledWith(`sect:${sect.id}`, 'chat:msg', view);
    expect(broadcastSpy).not.toHaveBeenCalled();

    broadcastSpy.mockRestore();
    emitRoomSpy.mockRestore();
  });

  it('sendWorld KHÔNG gọi emitToRoom; sendSect KHÔNG gọi broadcast (isolation)', async () => {
    const broadcastSpy = vi.spyOn(realtime, 'broadcast').mockImplementation(() => {});
    const emitRoomSpy = vi.spyOn(realtime, 'emitToRoom').mockImplementation(() => {});

    const u = await makeUserChar(prisma);
    const sect = await makeSect('Iso-Sect', u.characterId);
    await prisma.character.update({
      where: { id: u.characterId },
      data: { sectId: sect.id },
    });

    const svc = freshSvc();
    await svc.sendWorld(u.userId, 'world msg');
    await svc.sendSect(u.userId, 'sect msg');

    expect(broadcastSpy).toHaveBeenCalledTimes(1);
    expect(emitRoomSpy).toHaveBeenCalledTimes(1);

    broadcastSpy.mockRestore();
    emitRoomSpy.mockRestore();
  });
});

describe('ChatService history ordering + isolation', () => {
  it('historyWorld trả oldest-first (service query desc + reverse)', async () => {
    const u = await makeUserChar(prisma);
    const svc = freshSvc();
    for (const t of ['m1', 'm2', 'm3']) {
      await svc.sendWorld(u.userId, t);
      // Ép mỗi createdAt cách ≥ 1ms để order ổn định.
      await new Promise((r) => setTimeout(r, 2));
    }
    const h = await svc.historyWorld();
    expect(h.map((m) => m.text)).toEqual(['m1', 'm2', 'm3']);
  });

  it('historyWorld rỗng khi chưa có message', async () => {
    const svc = freshSvc();
    const h = await svc.historyWorld();
    expect(h).toEqual([]);
  });

  it('historySect chỉ trả message của đúng sect (leak isolation)', async () => {
    const ua = await makeUserChar(prisma);
    const ub = await makeUserChar(prisma);
    const sectA = await makeSect('SectA', ua.characterId);
    const sectB = await makeSect('SectB', ub.characterId);
    await prisma.character.update({
      where: { id: ua.characterId },
      data: { sectId: sectA.id },
    });
    await prisma.character.update({
      where: { id: ub.characterId },
      data: { sectId: sectB.id },
    });

    const svc = freshSvc();
    await svc.sendSect(ua.userId, 'chat trong A');
    await svc.sendSect(ub.userId, 'chat trong B');

    const ha = await svc.historySect(ua.userId);
    const hb = await svc.historySect(ub.userId);

    expect(ha.map((m) => m.text)).toEqual(['chat trong A']);
    expect(hb.map((m) => m.text)).toEqual(['chat trong B']);
    // Critical: A không thấy text của B, B không thấy text của A.
    expect(ha.some((m) => m.text === 'chat trong B')).toBe(false);
    expect(hb.some((m) => m.text === 'chat trong A')).toBe(false);
  });

  it('historyWorld KHÔNG trả SECT message (channel isolation)', async () => {
    const u = await makeUserChar(prisma);
    const sect = await makeSect('HistIso', u.characterId);
    await prisma.character.update({
      where: { id: u.characterId },
      data: { sectId: sect.id },
    });

    const svc = freshSvc();
    await svc.sendWorld(u.userId, 'world-only');
    await svc.sendSect(u.userId, 'sect-only');

    const hw = await svc.historyWorld();
    const hs = await svc.historySect(u.userId);

    expect(hw.map((m) => m.text)).toEqual(['world-only']);
    expect(hs.map((m) => m.text)).toEqual(['sect-only']);
  });

  it('historySect NO_CHARACTER khi user chưa tạo character', async () => {
    const user = await prisma.user.create({
      data: { email: 'no-char-sect@xt.local', passwordHash: 'x' },
    });
    const svc = freshSvc();
    await expect(svc.historySect(user.id)).rejects.toMatchObject({
      code: 'NO_CHARACTER',
    });
  });

  it('historySect NO_SECT khi character chưa vào sect', async () => {
    const u = await makeUserChar(prisma);
    const svc = freshSvc();
    await expect(svc.historySect(u.userId)).rejects.toBeInstanceOf(ChatError);
    await expect(svc.historySect(u.userId)).rejects.toMatchObject({
      code: 'NO_SECT',
    });
  });
});

describe('ChatService view shape', () => {
  it('sendWorld view chứa đủ field + createdAt là ISO string', async () => {
    const u = await makeUserChar(prisma);
    const svc = freshSvc();
    const view = await svc.sendWorld(u.userId, 'shape-test');
    expect(view.id).toMatch(/[a-z0-9-]+/);
    expect(view.channel).toBe('WORLD');
    expect(view.scopeKey).toBe('world');
    expect(view.senderId).toBe(u.characterId);
    expect(view.senderName).toBe(u.name);
    expect(view.text).toBe('shape-test');
    // ISO 8601: "2026-04-30T16:50:12.345Z".
    expect(view.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // Không có field thừa (vd prismaRow meta).
    expect(Object.keys(view).sort()).toEqual(
      ['channel', 'createdAt', 'id', 'scopeKey', 'senderId', 'senderName', 'text'].sort(),
    );
  });

  it('text được trim trước khi lưu (bỏ whitespace hai đầu)', async () => {
    const u = await makeUserChar(prisma);
    const svc = freshSvc();
    const view = await svc.sendWorld(u.userId, '   trimmed   ');
    expect(view.text).toBe('trimmed');
  });
});
