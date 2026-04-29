import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { GiftCodeError, GiftCodeService } from './giftcode.service';
import {
  TEST_DATABASE_URL,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

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

describe('GiftCodeService.create', () => {
  it('tạo code hợp lệ và normalize thành UPPER', async () => {
    const c = await gift.create({
      code: 'welcome01',
      rewardLinhThach: 500n,
      maxRedeems: 100,
    });
    expect(c.code).toBe('WELCOME01');
    expect(c.rewardLinhThach).toBe('500');
    expect(c.maxRedeems).toBe(100);
    expect(c.redeemCount).toBe(0);
  });

  it('từ chối code trùng → CODE_EXISTS (case-insensitive)', async () => {
    await gift.create({ code: 'SALE', rewardLinhThach: 100n });
    await expect(
      gift.create({ code: 'sale', rewardLinhThach: 100n }),
    ).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'CODE_EXISTS',
    );
  });

  it('từ chối code sai format (<4, ký tự lạ)', async () => {
    await expect(gift.create({ code: 'ab' })).rejects.toBeInstanceOf(GiftCodeError);
    await expect(gift.create({ code: 'bad code!' })).rejects.toBeInstanceOf(
      GiftCodeError,
    );
  });

  it('từ chối reward âm hoặc >10 items', async () => {
    await expect(
      gift.create({ code: 'BADCODE', rewardTienNgoc: -1 }),
    ).rejects.toBeInstanceOf(GiftCodeError);
    const many = Array.from({ length: 11 }, () => ({
      itemKey: 'huyet_chi_dan',
      qty: 1,
    }));
    await expect(
      gift.create({ code: 'MANYITEM', rewardItems: many }),
    ).rejects.toBeInstanceOf(GiftCodeError);
  });
});

describe('GiftCodeService.redeem', () => {
  it('trao linhThach + tienNgoc + exp + item + ghi ledger', async () => {
    const u = await makeUserChar(prisma, { linhThach: 0n, tienNgoc: 0 });
    await gift.create({
      code: 'BIGGIFT',
      rewardLinhThach: 1000n,
      rewardTienNgoc: 50,
      rewardExp: 200n,
      rewardItems: [{ itemKey: 'huyet_chi_dan', qty: 3 }],
    });
    const res = await gift.redeem(u.userId, 'biggift');
    expect(res.code).toBe('BIGGIFT');
    expect(res.grantedLinhThach).toBe('1000');
    expect(res.grantedTienNgoc).toBe(50);

    const char = await prisma.character.findUniqueOrThrow({
      where: { id: u.characterId },
    });
    expect(char.linhThach).toBe(1000n);
    expect(char.tienNgoc).toBe(50);
    expect(char.exp).toBe(200n);

    const inv = await prisma.inventoryItem.findMany({
      where: { characterId: u.characterId },
    });
    expect(inv).toHaveLength(1);
    expect(inv[0].qty).toBe(3);

    const ledger = await prisma.currencyLedger.findMany({
      where: { characterId: u.characterId, reason: 'GIFTCODE_REDEEM' },
    });
    expect(ledger.length).toBe(2);
  });

  it('ALREADY_REDEEMED khi cùng user redeem lần 2', async () => {
    const u = await makeUserChar(prisma);
    await gift.create({ code: 'TWICE', rewardLinhThach: 50n });
    await gift.redeem(u.userId, 'TWICE');
    await expect(gift.redeem(u.userId, 'TWICE')).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'ALREADY_REDEEMED',
    );
  });

  it('CODE_NOT_FOUND / CODE_EXPIRED / CODE_REVOKED', async () => {
    const u = await makeUserChar(prisma);
    await expect(gift.redeem(u.userId, 'GHOST99')).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'CODE_NOT_FOUND',
    );

    await gift.create({
      code: 'EXPIRED',
      rewardLinhThach: 10n,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(gift.redeem(u.userId, 'EXPIRED')).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'CODE_EXPIRED',
    );

    await gift.create({ code: 'REVOKED', rewardLinhThach: 10n });
    await gift.revoke('REVOKED');
    await expect(gift.redeem(u.userId, 'REVOKED')).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'CODE_REVOKED',
    );
  });

  it('CODE_EXHAUSTED khi vượt maxRedeems', async () => {
    const a = await makeUserChar(prisma);
    const b = await makeUserChar(prisma);
    const c = await makeUserChar(prisma);
    await gift.create({
      code: 'LIMITED',
      rewardLinhThach: 10n,
      maxRedeems: 2,
    });
    await gift.redeem(a.userId, 'LIMITED');
    await gift.redeem(b.userId, 'LIMITED');
    await expect(gift.redeem(c.userId, 'LIMITED')).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'CODE_EXHAUSTED',
    );
  });

  it('NO_CHARACTER khi user chưa tạo nhân vật', async () => {
    const user = await prisma.user.create({
      data: { email: 'nochar@xt.local', passwordHash: 'x' },
    });
    await gift.create({ code: 'NOCHAR', rewardLinhThach: 10n });
    await expect(gift.redeem(user.id, 'NOCHAR')).rejects.toSatisfy(
      (e) => e instanceof GiftCodeError && e.code === 'NO_CHARACTER',
    );
  });

  it('INVALID_INPUT khi code rỗng / quá dài', async () => {
    const u = await makeUserChar(prisma);
    await expect(gift.redeem(u.userId, '')).rejects.toBeInstanceOf(GiftCodeError);
    await expect(
      gift.redeem(u.userId, 'A'.repeat(64)),
    ).rejects.toBeInstanceOf(GiftCodeError);
  });
});

describe('GiftCodeService.list & revoke', () => {
  it('list desc createdAt', async () => {
    await gift.create({ code: 'FIRST', rewardLinhThach: 1n });
    await gift.create({ code: 'SECOND', rewardLinhThach: 1n });
    const l = await gift.list();
    expect(l).toHaveLength(2);
    expect(l[0].code).toBe('SECOND');
  });

  it('revoke idempotent', async () => {
    await gift.create({ code: 'REVOKE01', rewardLinhThach: 1n });
    const r1 = await gift.revoke('REVOKE01');
    expect(r1.revokedAt).not.toBeNull();
    const r2 = await gift.revoke('REVOKE01');
    expect(r2.revokedAt).toBe(r1.revokedAt);
  });
});
