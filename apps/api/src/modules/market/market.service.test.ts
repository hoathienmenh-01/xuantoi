import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ListingStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { MarketService, MARKET_FEE_PCT } from './market.service';
import {
  TEST_DATABASE_URL,
  makeMissionService,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let market: MarketService;
let realtime: RealtimeService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const currency = new CurrencyService(prisma);
  const missions = makeMissionService(prisma);
  market = new MarketService(prisma, realtime, chars, currency, missions);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

const PILL = 'huyet_chi_dan'; // stackable PILL_HP

async function giveItem(characterId: string, qty: number) {
  return prisma.inventoryItem.create({
    data: { characterId, itemKey: PILL, qty },
  });
}

describe('MarketService', () => {
  it('post: trừ inventory + tạo listing ACTIVE', async () => {
    const seller = await makeUserChar(prisma);
    const inv = await giveItem(seller.characterId, 5);

    const view = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 3,
      pricePerUnit: 100n,
    });
    expect(view.qty).toBe(3);
    expect(view.status).toBe('ACTIVE');

    const remaining = await prisma.inventoryItem.findUnique({ where: { id: inv.id } });
    expect(remaining?.qty).toBe(2);
  });

  it('post: qty = inventory.qty → xoá row inventory', async () => {
    const seller = await makeUserChar(prisma);
    const inv = await giveItem(seller.characterId, 4);
    await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 4,
      pricePerUnit: 50n,
    });
    const remaining = await prisma.inventoryItem.findUnique({ where: { id: inv.id } });
    expect(remaining).toBeNull();
  });

  it('buy: trừ buyer + cộng seller (đã trừ phí 5%) + grant item + ghi 2 dòng ledger', async () => {
    const seller = await makeUserChar(prisma, { linhThach: 0n });
    const buyer = await makeUserChar(prisma, { linhThach: 5000n });
    const inv = await giveItem(seller.characterId, 2);

    const listing = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 2,
      pricePerUnit: 100n,
    });
    const total = 200n; // 2 * 100
    const fee = (total * BigInt(Math.round(MARKET_FEE_PCT * 1000))) / 1000n;
    const sellerGain = total - fee;

    await market.buy(buyer.userId, listing.id);

    const sChar = await prisma.character.findUniqueOrThrow({ where: { id: seller.characterId } });
    const bChar = await prisma.character.findUniqueOrThrow({ where: { id: buyer.characterId } });
    expect(sChar.linhThach).toBe(sellerGain);
    expect(bChar.linhThach).toBe(5000n - total);

    const buyerInv = await prisma.inventoryItem.findFirst({
      where: { characterId: buyer.characterId, itemKey: PILL },
    });
    expect(buyerInv?.qty).toBe(2);

    const ledger = await prisma.currencyLedger.findMany({
      where: { refType: 'Listing', refId: listing.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(ledger).toHaveLength(2);
    const buyRow = ledger.find((r) => r.reason === 'MARKET_BUY')!;
    const sellRow = ledger.find((r) => r.reason === 'MARKET_SELL')!;
    expect(buyRow.delta).toBe(-total);
    expect(buyRow.characterId).toBe(buyer.characterId);
    expect(sellRow.delta).toBe(sellerGain);
    expect(sellRow.characterId).toBe(seller.characterId);

    const finalListing = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(finalListing.status).toBe(ListingStatus.SOLD);
    expect(finalListing.buyerId).toBe(buyer.characterId);
  });

  it('buy: thiếu linh thạch → INSUFFICIENT_LINH_THACH, listing vẫn ACTIVE, không ghi ledger', async () => {
    const seller = await makeUserChar(prisma);
    const buyer = await makeUserChar(prisma, { linhThach: 50n });
    const inv = await giveItem(seller.characterId, 1);
    const listing = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 1,
      pricePerUnit: 100n,
    });

    await expect(market.buy(buyer.userId, listing.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_LINH_THACH',
    });
    const finalListing = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(finalListing.status).toBe(ListingStatus.ACTIVE);
    const ledger = await prisma.currencyLedger.findMany({
      where: { refId: listing.id },
    });
    expect(ledger).toHaveLength(0);
  });

  it('buy: tự mua listing của mình → CANNOT_BUY_OWN', async () => {
    const seller = await makeUserChar(prisma, { linhThach: 5000n });
    const inv = await giveItem(seller.characterId, 1);
    const listing = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 1,
      pricePerUnit: 100n,
    });
    await expect(market.buy(seller.userId, listing.id)).rejects.toMatchObject({
      code: 'CANNOT_BUY_OWN',
    });
  });

  it('buy 2 lần đồng thời → 1 thắng / 1 fail (LISTING_INACTIVE), không double-grant', async () => {
    const seller = await makeUserChar(prisma);
    const buyer1 = await makeUserChar(prisma, { linhThach: 5000n });
    const buyer2 = await makeUserChar(prisma, { linhThach: 5000n });
    const inv = await giveItem(seller.characterId, 1);
    const listing = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 1,
      pricePerUnit: 100n,
    });

    const results = await Promise.allSettled([
      market.buy(buyer1.userId, listing.id),
      market.buy(buyer2.userId, listing.id),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.code).toBe('LISTING_INACTIVE');

    // Chỉ 1 buyer được item
    const inv1 = await prisma.inventoryItem.findFirst({
      where: { characterId: buyer1.characterId, itemKey: PILL },
    });
    const inv2 = await prisma.inventoryItem.findFirst({
      where: { characterId: buyer2.characterId, itemKey: PILL },
    });
    const got1 = inv1?.qty ?? 0;
    const got2 = inv2?.qty ?? 0;
    expect(got1 + got2).toBe(1);
  });

  it('cancel: trả item về túi + flip status CANCELLED, double-cancel fail LISTING_INACTIVE', async () => {
    const seller = await makeUserChar(prisma);
    const inv = await giveItem(seller.characterId, 5);
    const listing = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 5,
      pricePerUnit: 50n,
    });
    await market.cancel(seller.userId, listing.id);
    const final = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    expect(final.status).toBe(ListingStatus.CANCELLED);
    const back = await prisma.inventoryItem.findFirst({
      where: { characterId: seller.characterId, itemKey: PILL },
    });
    expect(back?.qty).toBe(5);

    await expect(market.cancel(seller.userId, listing.id)).rejects.toMatchObject({
      code: 'LISTING_INACTIVE',
    });
  });

  it('cancel: không phải owner → NOT_OWNER', async () => {
    const seller = await makeUserChar(prisma);
    const stranger = await makeUserChar(prisma);
    const inv = await giveItem(seller.characterId, 1);
    const listing = await market.post(seller.userId, {
      inventoryItemId: inv.id,
      qty: 1,
      pricePerUnit: 50n,
    });
    await expect(market.cancel(stranger.userId, listing.id)).rejects.toMatchObject({
      code: 'NOT_OWNER',
    });
  });
});
