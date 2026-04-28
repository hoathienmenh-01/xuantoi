import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CurrencyKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { InventoryService } from '../inventory/inventory.service';
import { ShopError, ShopService } from './shop.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let shop: ShopService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  const currency = new CurrencyService(prisma);
  const inventory = new InventoryService(prisma, realtime, chars);
  shop = new ShopService(prisma, currency, inventory);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ShopService.list', () => {
  it('trả ra >=1 entry, tất cả có price > 0 và itemKey hợp lệ', () => {
    const entries = shop.list();
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.itemKey).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.price).toBeGreaterThan(0);
      expect(['LINH_THACH', 'TIEN_NGOC']).toContain(e.currency);
    }
  });

  it('chỉ chứa item phẩm Phàm/Linh (không bán Huyền/Tiên)', () => {
    const entries = shop.list();
    for (const e of entries) {
      expect(['PHAM', 'LINH']).toContain(e.quality);
    }
  });
});

describe('ShopService.buy', () => {
  it('mua item stackable thành công → trừ linh thạch + thêm vào túi + ledger SHOP_BUY', async () => {
    const f = await makeUserChar(prisma, { linhThach: 1_000n });
    // 'huyet_chi_dan' price=25, qty=3 → total=75.
    const r = await shop.buy(f.userId, 'huyet_chi_dan', 3);
    expect(r.itemKey).toBe('huyet_chi_dan');
    expect(r.qty).toBe(3);
    expect(r.totalPrice).toBe(75);
    expect(r.currency).toBe(CurrencyKind.LINH_THACH);

    const c = await prisma.character.findUniqueOrThrow({ where: { id: f.characterId } });
    expect(c.linhThach).toBe(925n);

    const inv = await prisma.inventoryItem.findFirstOrThrow({
      where: { characterId: f.characterId, itemKey: 'huyet_chi_dan' },
    });
    expect(inv.qty).toBe(3);

    const ledger = await prisma.currencyLedger.findFirstOrThrow({
      where: { characterId: f.characterId, reason: 'SHOP_BUY' },
    });
    expect(ledger.delta).toBe(-75n);
    const meta = ledger.meta as { itemKey: string; qty: number; unitPrice: number };
    expect(meta.itemKey).toBe('huyet_chi_dan');
    expect(meta.qty).toBe(3);
    expect(meta.unitPrice).toBe(25);
  });

  it('mua lần 2 cùng item stackable → gộp qty (không tạo row mới)', async () => {
    const f = await makeUserChar(prisma, { linhThach: 1_000n });
    await shop.buy(f.userId, 'huyet_chi_dan', 2);
    await shop.buy(f.userId, 'huyet_chi_dan', 4);
    const rows = await prisma.inventoryItem.findMany({
      where: { characterId: f.characterId, itemKey: 'huyet_chi_dan' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].qty).toBe(6);
  });

  it('không đủ linh thạch → INSUFFICIENT_FUNDS, KHÔNG trừ tiền + KHÔNG cấp item + KHÔNG ledger', async () => {
    const f = await makeUserChar(prisma, { linhThach: 50n });
    // huyet_chi_dan price=25, qty=10 → total=250 > 50.
    await expect(shop.buy(f.userId, 'huyet_chi_dan', 10)).rejects.toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
    });
    const c = await prisma.character.findUniqueOrThrow({ where: { id: f.characterId } });
    expect(c.linhThach).toBe(50n);
    const inv = await prisma.inventoryItem.findFirst({
      where: { characterId: f.characterId, itemKey: 'huyet_chi_dan' },
    });
    expect(inv).toBeNull();
    const ledger = await prisma.currencyLedger.findFirst({
      where: { characterId: f.characterId, reason: 'SHOP_BUY' },
    });
    expect(ledger).toBeNull();
  });

  it('itemKey không có trong NPC_SHOP → ITEM_NOT_IN_SHOP (anti-spoof boss item)', async () => {
    const f = await makeUserChar(prisma, { linhThach: 100_000n });
    // 'tien_huyen_kiem' tồn tại trong ITEMS nhưng không có trong NPC_SHOP.
    await expect(shop.buy(f.userId, 'tien_huyen_kiem', 1)).rejects.toMatchObject({
      code: 'ITEM_NOT_IN_SHOP',
    });
    // Item không tồn tại.
    await expect(shop.buy(f.userId, 'fake_key', 1)).rejects.toMatchObject({
      code: 'ITEM_NOT_IN_SHOP',
    });
  });

  it('qty không hợp lệ → INVALID_QTY (0, âm, >99, không phải integer)', async () => {
    const f = await makeUserChar(prisma, { linhThach: 100_000n });
    for (const bad of [0, -1, 100, 1.5]) {
      await expect(shop.buy(f.userId, 'huyet_chi_dan', bad)).rejects.toMatchObject({
        code: 'INVALID_QTY',
      });
    }
  });

  it('item non-stackable + qty>1 → NON_STACKABLE_QTY_GT_1', async () => {
    const f = await makeUserChar(prisma, { linhThach: 100_000n });
    // 'so_kiem' non-stackable.
    await expect(shop.buy(f.userId, 'so_kiem', 2)).rejects.toMatchObject({
      code: 'NON_STACKABLE_QTY_GT_1',
    });
  });

  it('user không có character → NO_CHARACTER', async () => {
    const u = await prisma.user.create({
      data: { email: `noc-${Date.now()}@xt.local`, passwordHash: 'x' },
    });
    await expect(shop.buy(u.id, 'huyet_chi_dan', 1)).rejects.toMatchObject({
      code: 'NO_CHARACTER',
    });
  });
});

describe('ShopService.buy — ShopError class', () => {
  it('là instance của ShopError với code đúng', async () => {
    const f = await makeUserChar(prisma, { linhThach: 1n });
    let caught: unknown;
    try {
      await shop.buy(f.userId, 'huyet_chi_dan', 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ShopError);
    expect((caught as ShopError).code).toBe('INSUFFICIENT_FUNDS');
  });
});
