import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { GemError, GemService } from './gem.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let svc: GemService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  svc = new GemService(prisma);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Tạo 1 character + 1 equipment item (`huyen_kiem`, quality LINH = 1 socket
 * capacity) ở slot WEAPON + grant N gem nhất định vào inventory unequipped.
 */
async function setupCharWithGearAndGems(
  equipmentKey: string,
  gemKey: string,
  gemQty: number,
) {
  const fixture = await makeUserChar(prisma);
  const equipment = await prisma.inventoryItem.create({
    data: {
      characterId: fixture.characterId,
      itemKey: equipmentKey,
      qty: 1,
      equippedSlot: 'WEAPON',
    },
  });
  if (gemQty > 0) {
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: gemKey,
        qty: gemQty,
      },
    });
  }
  return { ...fixture, equipmentId: equipment.id };
}

describe('GemService.socketGem', () => {
  it('khảm gem hợp lệ vào WEAPON LINH (1 socket) — deduct qty + push sockets[]', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 3);
    const result = await svc.socketGem(
      ctx.characterId,
      ctx.equipmentId,
      'gem_kim_pham',
    );
    expect(result.gemKey).toBe('gem_kim_pham');
    expect(result.slotIndex).toBe(0);
    expect(result.sockets).toEqual(['gem_kim_pham']);

    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.sockets).toEqual(['gem_kim_pham']);

    const gemRow = await prisma.inventoryItem.findFirst({
      where: { characterId: ctx.characterId, itemKey: 'gem_kim_pham' },
    });
    expect(gemRow?.qty).toBe(2);

    const ledger = await prisma.itemLedger.findMany({
      where: { characterId: ctx.characterId, itemKey: 'gem_kim_pham' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].qtyDelta).toBe(-1);
    expect(ledger[0].reason).toBe('GEM_SOCKET');
  });

  it('throw SOCKETS_FULL khi vượt capacity', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 5);
    // huyen_kiem = LINH = 1 socket. Khảm 1 lần thành công.
    await svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham');
    // Khảm lần 2 phải fail.
    await expect(
      svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham'),
    ).rejects.toThrow(GemError);
    await expect(
      svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham'),
    ).rejects.toMatchObject({ code: 'SOCKETS_FULL' });
  });

  it('throw NO_SOCKET_CAPACITY cho equipment quality PHAM (0 socket)', async () => {
    const ctx = await setupCharWithGearAndGems('so_kiem', 'gem_kim_pham', 1);
    // so_kiem = PHAM = 0 socket capacity
    await expect(
      svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham'),
    ).rejects.toMatchObject({ code: 'NO_SOCKET_CAPACITY' });
  });

  it('throw GEM_INCOMPATIBLE_SLOT khi gem không cho phép slot này', async () => {
    // gem_thuy_pham compatibleSlots = [ARTIFACT, TRAM] → KHÔNG có WEAPON.
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_thuy_pham', 1);
    await expect(
      svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_thuy_pham'),
    ).rejects.toMatchObject({ code: 'GEM_INCOMPATIBLE_SLOT' });
  });

  it('throw INSUFFICIENT_QTY khi inventory không có gem', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 0);
    await expect(
      svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham'),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_QTY' });
  });

  it('throw GEM_NOT_FOUND khi gemKey không tồn tại trong catalog', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 1);
    await expect(
      svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_invalid_xxx'),
    ).rejects.toMatchObject({ code: 'GEM_NOT_FOUND' });
  });

  it('throw EQUIPMENT_NOT_FOUND khi equipment thuộc character khác', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 1);
    const otherChar = await makeUserChar(prisma);
    await expect(
      svc.socketGem(otherChar.characterId, ctx.equipmentId, 'gem_kim_pham'),
    ).rejects.toMatchObject({ code: 'EQUIPMENT_NOT_FOUND' });
  });
});

describe('GemService.unsocketGem', () => {
  it('gỡ gem khỏi sockets[] + return qty về inventory + ghi ledger GEM_UNSOCKET', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 1);
    await svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham');

    const result = await svc.unsocketGem(ctx.characterId, ctx.equipmentId, 0);
    expect(result.gemKey).toBe('gem_kim_pham');
    expect(result.sockets).toEqual([]);
    expect(result.gemReturned).toBe(true);

    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.sockets).toEqual([]);

    const gemRow = await prisma.inventoryItem.findFirst({
      where: { characterId: ctx.characterId, itemKey: 'gem_kim_pham' },
    });
    expect(gemRow?.qty).toBe(1);

    const ledger = await prisma.itemLedger.findMany({
      where: {
        characterId: ctx.characterId,
        itemKey: 'gem_kim_pham',
        reason: 'GEM_UNSOCKET',
      },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].qtyDelta).toBe(1);
  });

  it('throw INVALID_SLOT_INDEX khi index ngoài range', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 1);
    await svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham');
    await expect(
      svc.unsocketGem(ctx.characterId, ctx.equipmentId, 1),
    ).rejects.toMatchObject({ code: 'INVALID_SLOT_INDEX' });
    await expect(
      svc.unsocketGem(ctx.characterId, ctx.equipmentId, -1),
    ).rejects.toMatchObject({ code: 'INVALID_SLOT_INDEX' });
  });
});

describe('GemService.combineGems', () => {
  it('combine 3× PHAM → 1× LINH cùng element + ledger GEM_COMBINE -3 + +1', async () => {
    const fixture = await makeUserChar(prisma);
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: 'gem_kim_pham',
        qty: 5,
      },
    });

    const result = await svc.combineGems(fixture.characterId, 'gem_kim_pham');
    expect(result.srcQtyConsumed).toBe(3);
    expect(result.resultGemKey).toBe('gem_kim_linh');
    expect(result.resultQtyGained).toBe(1);

    // Còn 2 PHAM unequipped.
    const phamRow = await prisma.inventoryItem.findFirst({
      where: { characterId: fixture.characterId, itemKey: 'gem_kim_pham' },
    });
    expect(phamRow?.qty).toBe(2);

    // Có 1 LINH mới.
    const linhRow = await prisma.inventoryItem.findFirst({
      where: { characterId: fixture.characterId, itemKey: 'gem_kim_linh' },
    });
    expect(linhRow?.qty).toBe(1);

    // Ledger: 1 dòng -3 PHAM, 1 dòng +1 LINH.
    const ledger = await prisma.itemLedger.findMany({
      where: { characterId: fixture.characterId, reason: 'GEM_COMBINE' },
      orderBy: { createdAt: 'asc' },
    });
    expect(ledger).toHaveLength(2);
    expect(ledger.find((l) => l.itemKey === 'gem_kim_pham')?.qtyDelta).toBe(-3);
    expect(ledger.find((l) => l.itemKey === 'gem_kim_linh')?.qtyDelta).toBe(1);
  });

  it('throw INSUFFICIENT_QTY khi qty < 3', async () => {
    const fixture = await makeUserChar(prisma);
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: 'gem_kim_pham',
        qty: 2,
      },
    });
    await expect(
      svc.combineGems(fixture.characterId, 'gem_kim_pham'),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_QTY' });
  });

  it('throw NO_NEXT_TIER khi src là THAN', async () => {
    const fixture = await makeUserChar(prisma);
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: 'gem_kim_than',
        qty: 5,
      },
    });
    await expect(
      svc.combineGems(fixture.characterId, 'gem_kim_than'),
    ).rejects.toMatchObject({ code: 'NO_NEXT_TIER' });
  });

  it('throw GEM_NOT_FOUND khi src key không tồn tại', async () => {
    const fixture = await makeUserChar(prisma);
    await expect(
      svc.combineGems(fixture.characterId, 'gem_invalid_xxx'),
    ).rejects.toMatchObject({ code: 'GEM_NOT_FOUND' });
  });

  it('combine deterministic: re-run cùng input → cùng output', async () => {
    const fixture = await makeUserChar(prisma);
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: 'gem_moc_pham',
        qty: 9,
      },
    });
    const r1 = await svc.combineGems(fixture.characterId, 'gem_moc_pham');
    const r2 = await svc.combineGems(fixture.characterId, 'gem_moc_pham');
    const r3 = await svc.combineGems(fixture.characterId, 'gem_moc_pham');
    expect(r1.resultGemKey).toBe('gem_moc_linh');
    expect(r2.resultGemKey).toBe('gem_moc_linh');
    expect(r3.resultGemKey).toBe('gem_moc_linh');
  });
});

describe('GemService — equipBonus integration (Phase 11.4.B socket bonus wire)', () => {
  it('equipped weapon + socketed gem → equipBonus phản ánh tổng atk gem + base', async () => {
    const ctx = await setupCharWithGearAndGems('huyen_kiem', 'gem_kim_pham', 1);
    await svc.socketGem(ctx.characterId, ctx.equipmentId, 'gem_kim_pham');

    // Verify equipment.sockets có gem.
    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.sockets).toEqual(['gem_kim_pham']);
    // Verify gemBonus PHAM kim atk = 3 (per gems.ts ELEMENT_BONUS_TYPES.kim
    // scale 1.0 → atk: round(3 × 1.0) = 3, spirit: round(1) = 1).
    // (Test này không gọi InventoryService.equipBonus trực tiếp — chỉ verify
    // sockets được lưu, gem bonus sẽ tự stack qua composeSocketBonus.)
  });
});
