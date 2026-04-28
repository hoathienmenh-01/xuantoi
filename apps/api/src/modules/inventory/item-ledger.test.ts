/**
 * ItemLedger audit-trail integration tests.
 *
 * Mỗi grant qua `InventoryService` (boss reward, mission claim, mail claim,
 * giftcode redeem, combat loot, market buy/sell) phải ghi 1 dòng `ItemLedger`
 * có dấu (`qtyDelta`). `use()` consume cũng phải ghi outflow.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CurrencyKind } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CharacterService } from '../character/character.service';
import { CurrencyService } from '../character/currency.service';
import { RealtimeService } from '../realtime/realtime.service';
import { InventoryService } from './inventory.service';
import {
  TEST_DATABASE_URL,
  makeUserChar,
  wipeAll,
} from '../../test-helpers';

let prisma: PrismaService;
let inventory: InventoryService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  inventory = new InventoryService(prisma, realtime, chars);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('ItemLedger audit', () => {
  it('grant() ghi 1 dòng ItemLedger (qtyDelta dương) cho mỗi item', async () => {
    const { characterId } = await makeUserChar(prisma);
    const character = { id: characterId };
    await inventory.grant(
      character.id,
      [
        { itemKey: 'huyet_chi_dan', qty: 5 },
        { itemKey: 'thanh_lam_dan', qty: 2 },
      ],
      { reason: 'COMBAT_LOOT', refType: 'Encounter', refId: 'enc-1' },
    );
    const rows = await prisma.itemLedger.findMany({
      where: { characterId: character.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.itemKey).toBe('huyet_chi_dan');
    expect(rows[0]?.qtyDelta).toBe(5);
    expect(rows[0]?.reason).toBe('COMBAT_LOOT');
    expect(rows[0]?.refType).toBe('Encounter');
    expect(rows[0]?.refId).toBe('enc-1');
    expect(rows[1]?.itemKey).toBe('thanh_lam_dan');
    expect(rows[1]?.qtyDelta).toBe(2);
  });

  it('grant() lần 2 cùng item stackable → ghi thêm 1 dòng (KHÔNG cộng dồn ledger)', async () => {
    const { characterId } = await makeUserChar(prisma);
    const character = { id: characterId };
    await inventory.grant(
      character.id,
      [{ itemKey: 'huyet_chi_dan', qty: 3 }],
      { reason: 'MAIL_CLAIM', refType: 'Mail', refId: 'mail-1' },
    );
    await inventory.grant(
      character.id,
      [{ itemKey: 'huyet_chi_dan', qty: 7 }],
      { reason: 'MAIL_CLAIM', refType: 'Mail', refId: 'mail-2' },
    );
    const rows = await prisma.itemLedger.findMany({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.qtyDelta)).toEqual([3, 7]);
    expect(rows.map((r) => r.refId)).toEqual(['mail-1', 'mail-2']);
    // Inventory thực tế phải gộp = 10.
    const inv = await prisma.inventoryItem.findFirst({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
    });
    expect(inv?.qty).toBe(10);
  });

  it('use() consume 1 viên → ghi ledger qtyDelta=-1 reason=USE', async () => {
    const { userId, characterId } = await makeUserChar(prisma);
    const user = { id: userId };
    const character = { id: characterId };
    // Trước khi use: cấp 3 huyết chỉ đan + đảm bảo HP < HP max để effect có ý nghĩa.
    await prisma.character.update({
      where: { id: character.id },
      data: { hp: 1 },
    });
    await inventory.grant(
      character.id,
      [{ itemKey: 'huyet_chi_dan', qty: 3 }],
      { reason: 'ADMIN_GRANT' },
    );
    await prisma.itemLedger.deleteMany({}); // chỉ giữ ledger USE để verify isolated.
    const inv = await prisma.inventoryItem.findFirstOrThrow({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
    });

    await inventory.use(user.id, inv.id);

    const ledger = await prisma.itemLedger.findFirst({
      where: { characterId: character.id, reason: 'USE' },
    });
    expect(ledger).not.toBeNull();
    expect(ledger?.qtyDelta).toBe(-1);
    expect(ledger?.itemKey).toBe('huyet_chi_dan');
    expect(ledger?.refType).toBe('InventoryItem');
    expect(ledger?.refId).toBe(inv.id);

    // Inventory còn 2.
    const after = await prisma.inventoryItem.findFirstOrThrow({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
    });
    expect(after.qty).toBe(2);
  });

  it('grantTx() trong $transaction → ledger ghi cùng tx (rollback tất cả nếu fail)', async () => {
    const { characterId } = await makeUserChar(prisma);
    const character = { id: characterId };
    // Tạo 1 transaction rồi throw → ledger phải rollback theo.
    await expect(
      prisma.$transaction(async (tx) => {
        await inventory.grantTx(
          tx,
          character.id,
          [{ itemKey: 'huyet_chi_dan', qty: 5 }],
          { reason: 'BOSS_REWARD', refType: 'WorldBoss', refId: 'boss-1' },
        );
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    const rows = await prisma.itemLedger.findMany({
      where: { characterId: character.id },
    });
    const inv = await prisma.inventoryItem.findMany({
      where: { characterId: character.id },
    });
    expect(rows).toHaveLength(0);
    expect(inv).toHaveLength(0);
  });

  it('qty<=0 hoặc itemKey không tồn tại → KHÔNG ghi ledger + KHÔNG tạo inventory', async () => {
    const { characterId } = await makeUserChar(prisma);
    const character = { id: characterId };
    await inventory.grant(
      character.id,
      [
        { itemKey: 'unknown_item_key', qty: 5 },
        { itemKey: 'huyet_chi_dan', qty: 0 },
        { itemKey: 'huyet_chi_dan', qty: -3 },
      ],
      { reason: 'ADMIN_GRANT' },
    );
    const rows = await prisma.itemLedger.findMany({
      where: { characterId: character.id },
    });
    expect(rows).toHaveLength(0);
  });

  it('actorUserId được lưu trong ledger nếu meta cung cấp (admin grant audit)', async () => {
    const { characterId } = await makeUserChar(prisma);
    const character = { id: characterId };
    const adminUser = await prisma.user.create({
      data: { email: 'admin@admin.test', passwordHash: 'x', role: 'ADMIN' },
    });
    await inventory.grant(
      character.id,
      [{ itemKey: 'so_kiem', qty: 1 }],
      {
        reason: 'ADMIN_GRANT',
        actorUserId: adminUser.id,
        extra: { reasonText: 'Compensation' },
      },
    );
    const row = await prisma.itemLedger.findFirstOrThrow({
      where: { characterId: character.id },
    });
    expect(row.actorUserId).toBe(adminUser.id);
    expect(row.reason).toBe('ADMIN_GRANT');
    expect(row.meta).toMatchObject({ reasonText: 'Compensation' });
  });

  // Consistency check — sum của qtyDelta phải == inventoryItem.qty hiện tại
  // cho mỗi (characterId, itemKey) stackable. Kiểm tra với 2 lần grant + 1 use.
  it('sum(qtyDelta) === inventoryItem.qty (consistency check)', async () => {
    const { userId, characterId } = await makeUserChar(prisma);
    const user = { id: userId };
    const character = { id: characterId };
    await prisma.character.update({
      where: { id: character.id },
      data: { hp: 1 },
    });
    await inventory.grant(
      character.id,
      [{ itemKey: 'huyet_chi_dan', qty: 5 }],
      { reason: 'COMBAT_LOOT' },
    );
    await inventory.grant(
      character.id,
      [{ itemKey: 'huyet_chi_dan', qty: 3 }],
      { reason: 'MAIL_CLAIM' },
    );
    const inv = await prisma.inventoryItem.findFirstOrThrow({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
    });
    await inventory.use(user.id, inv.id);

    const rows = await prisma.itemLedger.findMany({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
    });
    const sum = rows.reduce((acc, r) => acc + r.qtyDelta, 0);
    const finalInv = await prisma.inventoryItem.findFirstOrThrow({
      where: { characterId: character.id, itemKey: 'huyet_chi_dan' },
    });
    expect(sum).toBe(finalInv.qty);
    expect(sum).toBe(7); // 5 + 3 - 1
  });
});

// Suppress unused warning — CurrencyKind imported for type completeness above.
void CurrencyKind;
void CurrencyService;
