import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CurrencyKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyError, CurrencyService } from './currency.service';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let currency: CurrencyService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  currency = new CurrencyService(prisma);
});

beforeEach(async () => {
  // Cascading: User -> Character -> CurrencyLedger.
  await prisma.currencyLedger.deleteMany({});
  await prisma.character.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: '@xt.curr' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

interface Fixture {
  characterId: string;
  userId: string;
}

let counter = 0;
async function makeChar(opts?: {
  linhThach?: bigint;
  tienNgoc?: number;
  sectId?: string | null;
}): Promise<Fixture> {
  counter += 1;
  const user = await prisma.user.create({
    data: {
      email: `c${counter}-${Date.now()}@xt.curr`,
      passwordHash: 'x',
    },
  });
  const char = await prisma.character.create({
    data: {
      userId: user.id,
      name: `CurrTest${counter}-${Date.now()}`,
      realmKey: 'pham_nhan',
      linhThach: opts?.linhThach ?? 1000n,
      tienNgoc: opts?.tienNgoc ?? 50,
      sectId: opts?.sectId ?? null,
    },
  });
  return { characterId: char.id, userId: user.id };
}

describe('CurrencyService', () => {
  it('apply: cộng linhThach → balance tăng + ghi 1 dòng ledger', async () => {
    const { characterId } = await makeChar({ linhThach: 100n });
    await currency.apply({
      characterId,
      currency: CurrencyKind.LINH_THACH,
      delta: 50n,
      reason: 'BOSS_REWARD',
      refType: 'WorldBoss',
      refId: 'boss-1',
      meta: { rank: 1 },
    });
    const c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.linhThach).toBe(150n);
    const rows = await prisma.currencyLedger.findMany({ where: { characterId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].delta).toBe(50n);
    expect(rows[0].reason).toBe('BOSS_REWARD');
    expect(rows[0].refId).toBe('boss-1');
  });

  it('apply: trừ linhThach đúng số → balance giảm + ledger có delta âm', async () => {
    const { characterId } = await makeChar({ linhThach: 200n });
    await currency.apply({
      characterId,
      currency: CurrencyKind.LINH_THACH,
      delta: -80n,
      reason: 'MARKET_BUY',
    });
    const c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.linhThach).toBe(120n);
    const rows = await prisma.currencyLedger.findMany({ where: { characterId } });
    expect(rows[0].delta).toBe(-80n);
  });

  it('apply: trừ thừa số dư → INSUFFICIENT_FUNDS, không ghi ledger, balance không đổi', async () => {
    const { characterId } = await makeChar({ linhThach: 30n });
    await expect(
      currency.apply({
        characterId,
        currency: CurrencyKind.LINH_THACH,
        delta: -100n,
        reason: 'MARKET_BUY',
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    const c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.linhThach).toBe(30n);
    const rows = await prisma.currencyLedger.findMany({ where: { characterId } });
    expect(rows).toHaveLength(0);
  });

  it('apply: characterId không tồn tại → NOT_FOUND', async () => {
    await expect(
      currency.apply({
        characterId: 'no-such-id',
        currency: CurrencyKind.LINH_THACH,
        delta: 10n,
        reason: 'BOSS_REWARD',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('apply: delta = 0 → INVALID_INPUT', async () => {
    const { characterId } = await makeChar();
    await expect(
      currency.apply({
        characterId,
        currency: CurrencyKind.LINH_THACH,
        delta: 0n,
        reason: 'ADMIN_GRANT',
      }),
    ).rejects.toBeInstanceOf(CurrencyError);
  });

  it('tienNgoc: cộng/trừ Int hoạt động', async () => {
    const { characterId } = await makeChar({ tienNgoc: 100 });
    await currency.apply({
      characterId,
      currency: CurrencyKind.TIEN_NGOC,
      delta: 200n,
      reason: 'ADMIN_TOPUP_APPROVE',
      actorUserId: 'admin-1',
    });
    let c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.tienNgoc).toBe(300);

    await currency.apply({
      characterId,
      currency: CurrencyKind.TIEN_NGOC,
      delta: -50n,
      reason: 'ADMIN_GRANT',
      actorUserId: 'admin-1',
    });
    c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.tienNgoc).toBe(250);

    const rows = await prisma.currencyLedger.findMany({
      where: { characterId },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].actorUserId).toBe('admin-1');
    expect(rows[1].delta).toBe(-50n);
  });

  it('extraWhere: guard sectId — sai sect → INSUFFICIENT_FUNDS (race với leave)', async () => {
    const sect = await prisma.sect.create({
      data: { name: `S-${Date.now()}-${counter}` },
    });
    const { characterId } = await makeChar({ linhThach: 500n, sectId: sect.id });
    // Race: user vừa rời sect ngay trước khi apply.
    await prisma.character.update({ where: { id: characterId }, data: { sectId: null } });
    await expect(
      currency.apply({
        characterId,
        currency: CurrencyKind.LINH_THACH,
        delta: -100n,
        reason: 'SECT_CONTRIBUTE',
        extraWhere: { sectId: sect.id },
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    const c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.linhThach).toBe(500n);
  });

  it('applyTx: rollback khi tx throw — balance + ledger đều không đổi', async () => {
    const { characterId } = await makeChar({ linhThach: 100n });
    await expect(
      prisma.$transaction(async (tx) => {
        await currency.applyTx(tx, {
          characterId,
          currency: CurrencyKind.LINH_THACH,
          delta: 50n,
          reason: 'BOSS_REWARD',
        });
        // Force rollback.
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const c = await prisma.character.findUniqueOrThrow({ where: { id: characterId } });
    expect(c.linhThach).toBe(100n);
    const rows = await prisma.currencyLedger.findMany({ where: { characterId } });
    expect(rows).toHaveLength(0);
  });

  it('refType/refId/meta được persist nguyên vẹn để query audit', async () => {
    const { characterId } = await makeChar();
    await currency.apply({
      characterId,
      currency: CurrencyKind.LINH_THACH,
      delta: 1n,
      reason: 'COMBAT_LOOT',
      refType: 'Encounter',
      refId: 'enc-xyz',
      meta: { dungeonKey: 'luyen_khi_1', monsters: ['slime'] },
    });
    const row = await prisma.currencyLedger.findFirstOrThrow({ where: { characterId } });
    expect(row.refType).toBe('Encounter');
    expect(row.refId).toBe('enc-xyz');
    const meta = row.meta as Prisma.JsonObject;
    expect(meta.dungeonKey).toBe('luyen_khi_1');
    expect(meta.monsters).toEqual(['slime']);
  });
});
