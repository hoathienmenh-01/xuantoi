import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { GiftCodeService } from './giftcode.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

/**
 * Economy safety — concurrent race tests for GiftCode redeem.
 *
 * Verify CAS pattern in redeem() prevents double-grant under concurrent access.
 * Requires Postgres (integration test).
 */

let prisma: PrismaService;
let gift: GiftCodeService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const currency = new CurrencyService(prisma);
  const inventory = new InventoryService(prisma, realtime, chars);
  gift = new GiftCodeService(prisma, currency, inventory);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GiftCode redeem — concurrent race safety', () => {
  it('maxRedeems=1: 3 users concurrent → exactly 1 succeeds, no double-grant', async () => {
    const [a, b, c] = await Promise.all([
      makeUserChar(prisma, { linhThach: 0n }),
      makeUserChar(prisma, { linhThach: 0n }),
      makeUserChar(prisma, { linhThach: 0n }),
    ]);
    await gift.create({ code: 'RACE1', rewardLinhThach: 500n, maxRedeems: 1 });

    const results = await Promise.allSettled([
      gift.redeem(a.userId, 'RACE1'),
      gift.redeem(b.userId, 'RACE1'),
      gift.redeem(c.userId, 'RACE1'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(2);

    for (const rej of rejected) {
      const err = (rej as PromiseRejectedResult).reason;
      expect(['CODE_EXHAUSTED', 'ALREADY_REDEEMED']).toContain(err.code);
    }

    const chars = await prisma.character.findMany({
      where: { id: { in: [a.characterId, b.characterId, c.characterId] } },
      select: { linhThach: true },
    });
    const totalGranted = chars.reduce((sum, ch) => sum + ch.linhThach, 0n);
    expect(totalGranted).toBe(500n);

    const ledger = await prisma.currencyLedger.findMany({
      where: { reason: 'GIFTCODE_REDEEM' },
    });
    expect(ledger.length).toBe(1);

    const code = await prisma.giftCode.findUnique({ where: { code: 'RACE1' } });
    expect(code?.redeemCount).toBe(1);
  });

  it('maxRedeems=2: 5 users concurrent → exactly 2 succeed', async () => {
    const users = await Promise.all(
      Array.from({ length: 5 }, () => makeUserChar(prisma, { linhThach: 0n })),
    );
    await gift.create({ code: 'RACE2', rewardLinhThach: 100n, maxRedeems: 2 });

    const results = await Promise.allSettled(
      users.map((u) => gift.redeem(u.userId, 'RACE2')),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(2);

    const allChars = await prisma.character.findMany({
      where: { id: { in: users.map((u) => u.characterId) } },
      select: { linhThach: true },
    });
    const totalGranted = allChars.reduce((sum, ch) => sum + ch.linhThach, 0n);
    expect(totalGranted).toBe(200n);

    const code = await prisma.giftCode.findUnique({ where: { code: 'RACE2' } });
    expect(code?.redeemCount).toBe(2);
  });

  it('same user double-redeem concurrent → exactly 1 success (unique index)', async () => {
    const u = await makeUserChar(prisma, { linhThach: 0n });
    await gift.create({ code: 'DBLUSER', rewardLinhThach: 300n });

    const results = await Promise.allSettled([
      gift.redeem(u.userId, 'DBLUSER'),
      gift.redeem(u.userId, 'DBLUSER'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);

    const ch = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
      select: { linhThach: true },
    });
    expect(ch.linhThach).toBe(300n);

    const redemptions = await prisma.giftCodeRedemption.findMany({
      where: {
        giftCodeId: (await prisma.giftCode.findUnique({ where: { code: 'DBLUSER' } }))!.id,
      },
    });
    expect(redemptions.length).toBe(1);
  });

  it('concurrent redeem with items → exactly correct qty granted', async () => {
    const [a, b, c] = await Promise.all([
      makeUserChar(prisma),
      makeUserChar(prisma),
      makeUserChar(prisma),
    ]);
    await gift.create({
      code: 'RACEITEM',
      rewardItems: [{ itemKey: 'huyet_chi_dan', qty: 5 }],
      maxRedeems: 1,
    });

    const results = await Promise.allSettled([
      gift.redeem(a.userId, 'RACEITEM'),
      gift.redeem(b.userId, 'RACEITEM'),
      gift.redeem(c.userId, 'RACEITEM'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);

    const items = await prisma.inventoryItem.findMany({
      where: {
        characterId: { in: [a.characterId, b.characterId, c.characterId] },
        itemKey: 'huyet_chi_dan',
      },
    });
    const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
    expect(totalQty).toBe(5);
  });

  it('revoke during concurrent redeem → consistent state', async () => {
    const u = await makeUserChar(prisma, { linhThach: 0n });
    await gift.create({ code: 'REVOKERACE', rewardLinhThach: 999n, maxRedeems: 10 });

    await Promise.allSettled([
      gift.revoke('REVOKERACE'),
      gift.redeem(u.userId, 'REVOKERACE'),
    ]);

    const code = await prisma.giftCode.findUnique({ where: { code: 'REVOKERACE' } });
    expect(code).toBeDefined();
    expect(code!.redeemCount).toBeLessThanOrEqual(1);

    const ch = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
      select: { linhThach: true },
    });
    if (code!.redeemCount === 0) {
      expect(ch.linhThach).toBe(0n);
    } else {
      expect(ch.linhThach).toBe(999n);
    }
  });
});
