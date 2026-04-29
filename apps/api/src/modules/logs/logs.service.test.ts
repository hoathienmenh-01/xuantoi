/**
 * `LogsService` — integration test cho `GET /logs/me` business logic.
 *
 * Kiểm tra:
 * - Cursor encode/decode round-trip + invalid cursor.
 * - Listing CurrencyLedger + ItemLedger riêng theo type.
 * - Pagination keyset (nextCursor) ổn định cross-page, không trùng/sót.
 * - Limit clamp [1, 50] + default 20.
 * - User không có character → NO_CHARACTER.
 * - Character A không thấy log của character B.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CurrencyKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';
import {
  LOGS_LIMIT_DEFAULT,
  LOGS_LIMIT_MAX,
  LOGS_LIMIT_MIN,
  LogsError,
  LogsService,
  decodeCursor,
  encodeCursor,
} from './logs.service';

let prisma: PrismaService;
let svc: LogsService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  svc = new LogsService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedCurrencyLedgers(
  characterId: string,
  count: number,
  baseTime: Date = new Date('2026-04-29T00:00:00.000Z'),
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await prisma.currencyLedger.create({
      data: {
        characterId,
        currency: CurrencyKind.LINH_THACH,
        delta: BigInt(100 + i),
        reason: i % 2 === 0 ? 'MISSION_CLAIM' : 'BOSS_REWARD',
        refType: 'Mission',
        refId: `mission-${i}`,
        createdAt: new Date(baseTime.getTime() + i * 1000),
      },
    });
  }
}

async function seedItemLedgers(
  characterId: string,
  count: number,
  baseTime: Date = new Date('2026-04-29T00:00:00.000Z'),
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await prisma.itemLedger.create({
      data: {
        characterId,
        itemKey: i % 2 === 0 ? 'huyet_chi_dan' : 'thanh_lam_dan',
        qtyDelta: i % 3 === 0 ? -1 : 5,
        reason: 'MISSION_CLAIM',
        refType: 'Mission',
        refId: `mission-${i}`,
        createdAt: new Date(baseTime.getTime() + i * 1000),
      },
    });
  }
}

describe('LogsService — cursor encode/decode', () => {
  it('round-trip giữ nguyên createdAt + id', () => {
    const c = { createdAt: new Date('2026-04-29T12:34:56.789Z'), id: 'abc123' };
    const decoded = decodeCursor(encodeCursor(c));
    expect(decoded.createdAt.toISOString()).toBe(c.createdAt.toISOString());
    expect(decoded.id).toBe(c.id);
  });

  it('decode cursor hợp lệ với id chứa ký tự đặc biệt', () => {
    const c = { createdAt: new Date('2026-01-01T00:00:00.000Z'), id: 'cuid_with-dashes' };
    expect(decodeCursor(encodeCursor(c))).toEqual({
      createdAt: c.createdAt,
      id: c.id,
    });
  });

  it('decode cursor không phải base64 → INVALID_CURSOR', () => {
    expect(() => decodeCursor('!!!not-base64!!!')).toThrow(LogsError);
  });

  it('decode cursor base64 nhưng thiếu separator | → INVALID_CURSOR', () => {
    const bad = Buffer.from('no-separator-here', 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow(LogsError);
  });

  it('decode cursor có ISO sai → INVALID_CURSOR', () => {
    const bad = Buffer.from('not-an-iso-date|abc', 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow(LogsError);
  });

  it('decode cursor rỗng id → INVALID_CURSOR', () => {
    const bad = Buffer.from('2026-04-29T00:00:00.000Z|', 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow(LogsError);
  });
});

describe('LogsService — listForUser() currency', () => {
  it('character mới chưa có ledger → entries=[], nextCursor=null', async () => {
    const u = await makeUserChar(prisma);
    const r = await svc.listForUser(u.userId, { type: 'currency', limit: 20 });
    expect(r.entries).toEqual([]);
    expect(r.nextCursor).toBeNull();
  });

  it('user không có character → throw NO_CHARACTER', async () => {
    const fake = await prisma.user.create({
      data: { email: 'no-char-logs@xt.local', passwordHash: 'x' },
    });
    await expect(
      svc.listForUser(fake.id, { type: 'currency', limit: 20 }),
    ).rejects.toBeInstanceOf(LogsError);
  });

  it('list 5 currency ledger trả về đúng thứ tự DESC theo createdAt', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 5);
    const r = await svc.listForUser(u.userId, { type: 'currency', limit: 20 });
    expect(r.entries).toHaveLength(5);
    expect(r.entries[0]?.kind).toBe('CURRENCY');
    // entry mới nhất (i=4) phải đứng đầu
    expect(r.entries[0]?.refId).toBe('mission-4');
    expect(r.entries[4]?.refId).toBe('mission-0');
    expect(r.nextCursor).toBeNull();
  });

  it('serialize delta BigInt thành string (100..104)', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 5);
    const r = await svc.listForUser(u.userId, { type: 'currency', limit: 20 });
    const deltas = r.entries
      .filter((e) => e.kind === 'CURRENCY')
      .map((e) => (e as { delta: string }).delta);
    expect(deltas).toEqual(['104', '103', '102', '101', '100']);
  });

  it('limit clamp dưới min → 1', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 3);
    const r = await svc.listForUser(u.userId, { type: 'currency', limit: 0 });
    expect(r.entries).toHaveLength(LOGS_LIMIT_MIN);
  });

  it('limit clamp trên max → 50', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 60);
    const r = await svc.listForUser(u.userId, { type: 'currency', limit: 9999 });
    expect(r.entries).toHaveLength(LOGS_LIMIT_MAX);
    expect(r.nextCursor).not.toBeNull();
  });

  it('pagination 2 page bằng nextCursor — không trùng id, không sót', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 5);

    const page1 = await svc.listForUser(u.userId, { type: 'currency', limit: 2 });
    expect(page1.entries).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await svc.listForUser(u.userId, {
      type: 'currency',
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.entries).toHaveLength(2);
    expect(page2.nextCursor).not.toBeNull();

    const page3 = await svc.listForUser(u.userId, {
      type: 'currency',
      limit: 2,
      cursor: page2.nextCursor!,
    });
    expect(page3.entries).toHaveLength(1);
    expect(page3.nextCursor).toBeNull();

    // Tổng 5 entry, không trùng id, đúng thứ tự DESC.
    const allIds = [
      ...page1.entries.map((e) => e.id),
      ...page2.entries.map((e) => e.id),
      ...page3.entries.map((e) => e.id),
    ];
    expect(new Set(allIds).size).toBe(5);
    const refIds = [
      ...page1.entries.map((e) => e.refId),
      ...page2.entries.map((e) => e.refId),
      ...page3.entries.map((e) => e.refId),
    ];
    expect(refIds).toEqual([
      'mission-4',
      'mission-3',
      'mission-2',
      'mission-1',
      'mission-0',
    ]);
  });

  it('pagination ổn định khi 2 entry cùng createdAt (tie-break bằng id DESC)', async () => {
    const u = await makeUserChar(prisma);
    const sameTime = new Date('2026-04-29T00:00:00.000Z');
    // 4 entry cùng createdAt → tie phải break bằng id DESC, không trùng/sót.
    for (let i = 0; i < 4; i++) {
      await prisma.currencyLedger.create({
        data: {
          characterId: u.characterId,
          currency: CurrencyKind.LINH_THACH,
          delta: BigInt(10 + i),
          reason: 'TEST_TIE',
          refType: 'Test',
          refId: `tie-${i}`,
          createdAt: sameTime,
        },
      });
    }
    const page1 = await svc.listForUser(u.userId, { type: 'currency', limit: 2 });
    const page2 = await svc.listForUser(u.userId, {
      type: 'currency',
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page1.entries).toHaveLength(2);
    expect(page2.entries).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();
    const ids = [
      ...page1.entries.map((e) => e.id),
      ...page2.entries.map((e) => e.id),
    ];
    expect(new Set(ids).size).toBe(4);
  });

  it('character A không thấy ledger của character B (isolation)', async () => {
    const a = await makeUserChar(prisma);
    const b = await makeUserChar(prisma);
    await seedCurrencyLedgers(a.characterId, 3);
    await seedCurrencyLedgers(b.characterId, 5);

    const ra = await svc.listForUser(a.userId, { type: 'currency', limit: 20 });
    expect(ra.entries).toHaveLength(3);

    const rb = await svc.listForUser(b.userId, { type: 'currency', limit: 20 });
    expect(rb.entries).toHaveLength(5);
  });

  it('cursor không hợp lệ → throw INVALID_CURSOR', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 3);
    await expect(
      svc.listForUser(u.userId, {
        type: 'currency',
        limit: 20,
        cursor: '!!!bad-cursor!!!',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('default limit = 20 áp dụng khi gọi với limit=20 và có >20 entries', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 25);
    const r = await svc.listForUser(u.userId, {
      type: 'currency',
      limit: LOGS_LIMIT_DEFAULT,
    });
    expect(r.entries).toHaveLength(LOGS_LIMIT_DEFAULT);
    expect(r.nextCursor).not.toBeNull();
  });
});

describe('LogsService — listForUser() item', () => {
  it('list 4 item ledger trả về DESC theo createdAt + qtyDelta giữ dấu', async () => {
    const u = await makeUserChar(prisma);
    await seedItemLedgers(u.characterId, 4);
    const r = await svc.listForUser(u.userId, { type: 'item', limit: 20 });
    expect(r.entries).toHaveLength(4);
    expect(r.entries[0]?.kind).toBe('ITEM');
    expect(r.entries[0]?.refId).toBe('mission-3');
    // i=0 và i=3 đều % 3 === 0 → qtyDelta=-1; i=1, i=2 → qtyDelta=5
    const deltas = r.entries
      .filter((e) => e.kind === 'ITEM')
      .map((e) => (e as { qtyDelta: number }).qtyDelta);
    expect(deltas).toEqual([-1, 5, 5, -1]);
  });

  it('item ledger pagination cross-page không trùng/sót', async () => {
    const u = await makeUserChar(prisma);
    await seedItemLedgers(u.characterId, 5);

    const page1 = await svc.listForUser(u.userId, { type: 'item', limit: 3 });
    expect(page1.entries).toHaveLength(3);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await svc.listForUser(u.userId, {
      type: 'item',
      limit: 3,
      cursor: page1.nextCursor!,
    });
    expect(page2.entries).toHaveLength(2);
    expect(page2.nextCursor).toBeNull();

    const ids = [
      ...page1.entries.map((e) => e.id),
      ...page2.entries.map((e) => e.id),
    ];
    expect(new Set(ids).size).toBe(5);
  });

  it('mix 2 ledger: type=currency chỉ trả Currency, type=item chỉ trả Item', async () => {
    const u = await makeUserChar(prisma);
    await seedCurrencyLedgers(u.characterId, 3);
    await seedItemLedgers(u.characterId, 2);

    const rc = await svc.listForUser(u.userId, { type: 'currency', limit: 20 });
    expect(rc.entries).toHaveLength(3);
    expect(rc.entries.every((e) => e.kind === 'CURRENCY')).toBe(true);

    const ri = await svc.listForUser(u.userId, { type: 'item', limit: 20 });
    expect(ri.entries).toHaveLength(2);
    expect(ri.entries.every((e) => e.kind === 'ITEM')).toBe(true);
  });
});
