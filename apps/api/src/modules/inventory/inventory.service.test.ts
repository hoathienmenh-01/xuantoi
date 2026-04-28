import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CharacterService } from '../character/character.service';
import { InventoryService, InventoryError } from './inventory.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../../test-helpers';

let prisma: PrismaService;
let inv: InventoryService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  const realtime = new RealtimeService();
  const chars = new CharacterService(prisma, realtime);
  inv = new InventoryService(prisma, realtime, chars);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('InventoryService', () => {
  describe('grant + list', () => {
    it('grant non-stackable: tạo row mới mỗi lần', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);

      const list = await inv.list(u.characterId);
      const swords = list.filter((x) => x.itemKey === 'so_kiem');
      expect(swords).toHaveLength(2);
      expect(swords.every((s) => s.qty === 1 && s.equippedSlot === null)).toBe(true);
    });

    it('grant stackable: gộp qty vào row hiện có (nếu chưa equip)', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'huyet_chi_dan', qty: 3 }]);
      await inv.grant(u.characterId, [{ itemKey: 'huyet_chi_dan', qty: 5 }]);

      const list = await inv.list(u.characterId);
      const pills = list.filter((x) => x.itemKey === 'huyet_chi_dan');
      expect(pills).toHaveLength(1);
      expect(pills[0].qty).toBe(8);
    });

    it('grant: itemKey không tồn tại trong catalog → bỏ qua, không tạo row', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'khong_ton_tai', qty: 1 }]);
      const rows = await prisma.inventoryItem.findMany({ where: { characterId: u.characterId } });
      expect(rows).toHaveLength(0);
    });

    it('list: filter ra item có itemKey không khớp catalog (orphan)', async () => {
      const u = await makeUserChar(prisma);
      await prisma.inventoryItem.create({
        data: { characterId: u.characterId, itemKey: 'orphan_key', qty: 1 },
      });
      const list = await inv.list(u.characterId);
      expect(list).toHaveLength(0);
    });
  });

  describe('equip / unequip', () => {
    it('equip: item có slot → set equippedSlot, list trả về đúng slot', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      const item = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'so_kiem' },
      });

      await inv.equip(u.userId, item.id);

      const list = await inv.list(u.characterId);
      const sword = list.find((x) => x.itemKey === 'so_kiem');
      expect(sword?.equippedSlot).toBe('WEAPON');
    });

    it('equip swap: trang bị mới ở cùng slot → tháo cái cũ tự động', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      await inv.grant(u.characterId, [{ itemKey: 'huyen_kiem', qty: 1 }]);
      const so = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'so_kiem' },
      });
      const huyen = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'huyen_kiem' },
      });

      await inv.equip(u.userId, so.id);
      await inv.equip(u.userId, huyen.id);

      const list = await inv.list(u.characterId);
      const equippedWeapons = list.filter((x) => x.equippedSlot === 'WEAPON');
      expect(equippedWeapons).toHaveLength(1);
      expect(equippedWeapons[0].itemKey).toBe('huyen_kiem');
      const oldSword = list.find((x) => x.itemKey === 'so_kiem');
      expect(oldSword?.equippedSlot).toBeNull();
    });

    it('equip item không có slot (đan dược) → NOT_EQUIPPABLE', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'huyet_chi_dan', qty: 1 }]);
      const pill = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'huyet_chi_dan' },
      });
      await expect(inv.equip(u.userId, pill.id)).rejects.toMatchObject({
        code: 'NOT_EQUIPPABLE',
      });
    });

    it('equip item của character khác → INVENTORY_ITEM_NOT_FOUND', async () => {
      const a = await makeUserChar(prisma);
      const b = await makeUserChar(prisma);
      await inv.grant(a.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      const sword = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: a.characterId },
      });
      await expect(inv.equip(b.userId, sword.id)).rejects.toMatchObject({
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    });

    it('unequip: gỡ item khỏi slot, item vẫn còn trong inventory', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      const sword = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'so_kiem' },
      });
      await inv.equip(u.userId, sword.id);

      await inv.unequip(u.userId, 'WEAPON');

      const fresh = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: sword.id } });
      expect(fresh.equippedSlot).toBeNull();
    });

    it('unequip slot trống → INVENTORY_ITEM_NOT_FOUND', async () => {
      const u = await makeUserChar(prisma);
      await expect(inv.unequip(u.userId, 'WEAPON')).rejects.toMatchObject({
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    });

    it('user không có character → equip/unequip throw NO_CHARACTER', async () => {
      const orphan = await prisma.user.create({
        data: { email: `orphan-${Date.now()}@xt.local`, passwordHash: 'x' },
      });
      await expect(inv.equip(orphan.id, 'fake-id')).rejects.toBeInstanceOf(InventoryError);
      await expect(inv.unequip(orphan.id, 'WEAPON')).rejects.toMatchObject({
        code: 'NO_CHARACTER',
      });
    });
  });

  describe('use', () => {
    it('use đan HP: hồi máu, capped at hpMax, qty giảm 1', async () => {
      const u = await makeUserChar(prisma, { hp: 50, hpMax: 100 });
      await inv.grant(u.characterId, [{ itemKey: 'huyet_chi_dan', qty: 3 }]); // hp +60
      const pill = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'huyet_chi_dan' },
      });

      await inv.use(u.userId, pill.id);

      const c = await prisma.character.findUniqueOrThrow({ where: { id: u.characterId } });
      expect(c.hp).toBe(100); // 50 + 60 = 110, capped to 100
      const fresh = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: pill.id } });
      expect(fresh.qty).toBe(2);
    });

    it('use đan có qty=1: xoá hẳn record', async () => {
      const u = await makeUserChar(prisma, { hp: 10, hpMax: 100 });
      await inv.grant(u.characterId, [{ itemKey: 'huyet_chi_dan', qty: 1 }]);
      const pill = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'huyet_chi_dan' },
      });

      await inv.use(u.userId, pill.id);

      const remaining = await prisma.inventoryItem.findUnique({ where: { id: pill.id } });
      expect(remaining).toBeNull();
    });

    it('use đan EXP: tăng exp', async () => {
      const u = await makeUserChar(prisma, { exp: 100n });
      await inv.grant(u.characterId, [{ itemKey: 'co_thien_dan', qty: 1 }]); // exp +500
      const pill = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'co_thien_dan' },
      });

      await inv.use(u.userId, pill.id);

      const c = await prisma.character.findUniqueOrThrow({ where: { id: u.characterId } });
      expect(c.exp).toBe(600n);
    });

    it('use item không có effect (vũ khí) → NOT_USABLE', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      const sword = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'so_kiem' },
      });
      await expect(inv.use(u.userId, sword.id)).rejects.toMatchObject({
        code: 'NOT_USABLE',
      });
    });

    it('use item của character khác → INVENTORY_ITEM_NOT_FOUND', async () => {
      const a = await makeUserChar(prisma);
      const b = await makeUserChar(prisma);
      await inv.grant(a.characterId, [{ itemKey: 'huyet_chi_dan', qty: 1 }]);
      const pill = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: a.characterId },
      });
      await expect(inv.use(b.userId, pill.id)).rejects.toMatchObject({
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    });
  });

  describe('equipBonus', () => {
    it('cộng dồn bonus từ tất cả slot đang đeo', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [
        { itemKey: 'so_kiem', qty: 1 }, // atk +5
        { itemKey: 'pham_giap', qty: 1 }, // def +4
      ]);
      const sword = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'so_kiem' },
      });
      const armor = await prisma.inventoryItem.findFirstOrThrow({
        where: { characterId: u.characterId, itemKey: 'pham_giap' },
      });
      await inv.equip(u.userId, sword.id);
      await inv.equip(u.userId, armor.id);

      const bonus = await inv.equipBonus(u.characterId);
      expect(bonus.atk).toBe(5);
      expect(bonus.def).toBe(4);
      expect(bonus.hpMaxBonus).toBe(0);
    });

    it('item không equip không cộng vào bonus', async () => {
      const u = await makeUserChar(prisma);
      await inv.grant(u.characterId, [{ itemKey: 'so_kiem', qty: 1 }]);
      const bonus = await inv.equipBonus(u.characterId);
      expect(bonus.atk).toBe(0);
    });
  });

  describe('grantTx', () => {
    it('grantTx trong $transaction: stackable gộp đúng', async () => {
      const u = await makeUserChar(prisma);
      await prisma.$transaction(async (tx) => {
        await inv.grantTx(tx, u.characterId, [
          { itemKey: 'huyet_chi_dan', qty: 2 },
          { itemKey: 'huyet_chi_dan', qty: 3 },
        ]);
      });
      const rows = await prisma.inventoryItem.findMany({
        where: { characterId: u.characterId, itemKey: 'huyet_chi_dan' },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].qty).toBe(5);
    });
  });
});
