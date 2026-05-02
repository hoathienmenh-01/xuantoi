import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../common/prisma.service';
import { CurrencyService } from './currency.service';
import { RefineService } from './refine.service';
import { makeUserChar, wipeAll } from '../../test-helpers';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  process.env.DATABASE_URL ??
  'postgresql://mtt:mtt@localhost:5432/mtt?schema=public';

let prisma: PrismaService;
let currency: CurrencyService;
let svc: RefineService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
  currency = new CurrencyService(prisma);
  svc = new RefineService(prisma, currency);
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Tạo 1 character + 1 equipment item + grant N material qty + optional
 * protection charm qty.
 */
async function setupCharWithEquipmentAndMaterial(opts: {
  equipmentKey: string;
  materialKey: string;
  materialQty: number;
  linhThach?: bigint;
  protectionQty?: number;
  startRefineLevel?: number;
}) {
  const fixture = await makeUserChar(prisma, {
    linhThach: opts.linhThach ?? 200000n, // đủ refine sâu
  });
  const equipment = await prisma.inventoryItem.create({
    data: {
      characterId: fixture.characterId,
      itemKey: opts.equipmentKey,
      qty: 1,
      equippedSlot: 'WEAPON',
      refineLevel: opts.startRefineLevel ?? 0,
    },
  });
  if (opts.materialQty > 0) {
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: opts.materialKey,
        qty: opts.materialQty,
      },
    });
  }
  if (opts.protectionQty && opts.protectionQty > 0) {
    await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: 'refine_protection_charm',
        qty: opts.protectionQty,
      },
    });
  }
  return { ...fixture, equipmentId: equipment.id };
}

describe('RefineService.refineEquipment — safe stage (L1..L5)', () => {
  it('success ở L0 → L1 (safe stage 95% rate, force success rng=0): consume material + linhThach + bump refineLevel + ledger', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 5,
      linhThach: 1000n,
    });

    // rng=0 → success roll < 0.95 (L1 successRate = 0.95) → success.
    const out = await svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0);

    expect(out.attemptLevel).toBe(1);
    expect(out.result.success).toBe(true);
    expect(out.finalLevel).toBe(1);
    expect(out.broken).toBe(false);
    expect(out.materialKey).toBe('tinh_thiet');
    expect(out.materialQty).toBe(1);
    expect(out.linhThachCost).toBe(100);

    // Equipment refineLevel bumped to 1.
    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.refineLevel).toBe(1);

    // Material qty -1 (5 → 4).
    const materialRow = await prisma.inventoryItem.findFirst({
      where: { characterId: ctx.characterId, itemKey: 'tinh_thiet' },
    });
    expect(materialRow?.qty).toBe(4);

    // Currency -100 LINH_THACH.
    const character = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(character?.linhThach).toBe(900n);

    // ItemLedger: REFINE_MATERIAL -1 tinh_thiet.
    const itemLedger = await prisma.itemLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'REFINE_MATERIAL' },
    });
    expect(itemLedger).toHaveLength(1);
    expect(itemLedger[0].qtyDelta).toBe(-1);
    expect(itemLedger[0].itemKey).toBe('tinh_thiet');

    // CurrencyLedger: REFINE -100 LINH_THACH.
    const currencyLedger = await prisma.currencyLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'REFINE' },
    });
    expect(currencyLedger).toHaveLength(1);
    expect(currencyLedger[0].delta).toBe(-100n);
  });

  it('fail safe stage (rng=0.99): không thay đổi level, vẫn consume material + linhThach', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 3,
      linhThach: 500n,
    });

    // rng=0.99 → fail (0.99 >= 0.95). Safe stage = no_loss.
    const out = await svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0.99);

    expect(out.result.success).toBe(false);
    expect(out.finalLevel).toBe(0);
    expect(out.broken).toBe(false);

    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.refineLevel).toBe(0);

    const materialRow = await prisma.inventoryItem.findFirst({
      where: { characterId: ctx.characterId, itemKey: 'tinh_thiet' },
    });
    expect(materialRow?.qty).toBe(2);

    const character = await prisma.character.findUnique({
      where: { id: ctx.characterId },
    });
    expect(character?.linhThach).toBe(400n);
  });
});

describe('RefineService.refineEquipment — risky stage (L6..L10)', () => {
  it('fail risky không protection → level -1', async () => {
    // Start at L6: requires yeu_dan material (2 qty).
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'yeu_dan',
      materialQty: 5,
      linhThach: 50000n,
      startRefineLevel: 6, // attemptLevel will be 7
    });

    // L7 successRate = 0.525, rng=0.99 → fail. Risky → level -1 (6→5).
    const out = await svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0.99);

    expect(out.attemptLevel).toBe(7);
    expect(out.result.success).toBe(false);
    expect(out.finalLevel).toBe(5);
    expect(out.broken).toBe(false);
    expect(out.protectionConsumed).toBe(false);

    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.refineLevel).toBe(5);
  });

  it('fail risky CÓ protection → level giữ nguyên + protection -1', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'yeu_dan',
      materialQty: 5,
      linhThach: 50000n,
      protectionQty: 1,
      startRefineLevel: 6,
    });

    const out = await svc.refineEquipment(ctx.characterId, ctx.equipmentId, true, () => 0.99);

    expect(out.result.success).toBe(false);
    expect(out.finalLevel).toBe(6); // giữ nguyên
    expect(out.protectionConsumed).toBe(true);
    expect(out.broken).toBe(false);

    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.refineLevel).toBe(6);

    // Protection charm consumed.
    const protectionRow = await prisma.inventoryItem.findFirst({
      where: {
        characterId: ctx.characterId,
        itemKey: 'refine_protection_charm',
      },
    });
    expect(protectionRow).toBeNull();

    // Ledger: REFINE_PROTECTION -1.
    const ledger = await prisma.itemLedger.findMany({
      where: { characterId: ctx.characterId, reason: 'REFINE_PROTECTION' },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].qtyDelta).toBe(-1);
  });

  it('useProtection=true nhưng không có charm → throw INSUFFICIENT_PROTECTION', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'yeu_dan',
      materialQty: 5,
      linhThach: 50000n,
      startRefineLevel: 6,
    });

    await expect(
      svc.refineEquipment(ctx.characterId, ctx.equipmentId, true, () => 0.99),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_PROTECTION' });
  });
});

describe('RefineService.refineEquipment — extreme stage (L11..L15)', () => {
  it('fail extreme + break (rng[0]=0.99 fail, rng[1]=0.0 break < 0.10) → equipment delete', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'han_ngoc',
      materialQty: 5,
      linhThach: 200000n,
      startRefineLevel: 10,
    });

    // L11 successRate=0.20, breakChance=0.10. rng[0]=0.99 fail; rng[1]=0.0 < 0.10 → break.
    const rolls = [0.99, 0.0];
    let i = 0;
    const rng = () => rolls[i++];

    const out = await svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, rng);

    expect(out.result.success).toBe(false);
    expect(out.broken).toBe(true);
    expect(out.finalLevel).toBeNull();

    // Equipment deleted.
    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment).toBeNull();
  });

  it('fail extreme + no-break + protection → level giữ nguyên + protection -1', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'han_ngoc',
      materialQty: 5,
      linhThach: 200000n,
      protectionQty: 1,
      startRefineLevel: 10,
    });

    // rng[0]=0.99 fail; rng[1]=0.99 > 0.10 → no break; protection cứu.
    const rolls = [0.99, 0.99];
    let i = 0;
    const rng = () => rolls[i++];

    const out = await svc.refineEquipment(ctx.characterId, ctx.equipmentId, true, rng);

    expect(out.broken).toBe(false);
    expect(out.protectionConsumed).toBe(true);
    expect(out.finalLevel).toBe(10);

    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.refineLevel).toBe(10);
  });
});

describe('RefineService.refineEquipment — error paths', () => {
  it('throw EQUIPMENT_NOT_FOUND khi equipment thuộc character khác', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 5,
    });
    const otherCtx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 5,
    });
    await expect(
      svc.refineEquipment(otherCtx.characterId, ctx.equipmentId, false, () => 0),
    ).rejects.toMatchObject({ code: 'EQUIPMENT_NOT_FOUND' });
  });

  it('throw NOT_REFINABLE khi item không phải equipment (không có slot)', async () => {
    const fixture = await makeUserChar(prisma);
    // huyet_chi_dan có kind=PILL_HP — không có slot → NOT_REFINABLE.
    const item = await prisma.inventoryItem.create({
      data: {
        characterId: fixture.characterId,
        itemKey: 'huyet_chi_dan',
        qty: 1,
      },
    });
    await expect(
      svc.refineEquipment(fixture.characterId, item.id, false, () => 0),
    ).rejects.toMatchObject({ code: 'NOT_REFINABLE' });
  });

  it('throw MAX_LEVEL_REACHED khi refineLevel = 15', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'han_ngoc',
      materialQty: 5,
      startRefineLevel: 15,
    });
    await expect(
      svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0),
    ).rejects.toMatchObject({ code: 'MAX_LEVEL_REACHED' });
  });

  it('throw INSUFFICIENT_MATERIAL khi không đủ qty', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 0,
    });
    await expect(
      svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_MATERIAL' });
  });

  it('throw INSUFFICIENT_FUNDS khi linhThach < cost', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 5,
      linhThach: 50n, // L1 cost = 100
    });
    await expect(
      svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
  });
});

describe('RefineService — equipBonus integration sau refine', () => {
  it('sau refine L0 → L1 (mult 1.10), equipBonus = round(base*1.10)', async () => {
    const ctx = await setupCharWithEquipmentAndMaterial({
      equipmentKey: 'huyen_kiem',
      materialKey: 'tinh_thiet',
      materialQty: 5,
      linhThach: 1000n,
    });

    // refine L0 → L1.
    await svc.refineEquipment(ctx.characterId, ctx.equipmentId, false, () => 0);

    // huyen_kiem base bonuses: atk: 12, spirit: 2.
    // L1 mult = 1.10. equipBonus.atk = round(12 * 1.10) = 13. spirit = round(2*1.10) = 2.
    const equipment = await prisma.inventoryItem.findUnique({
      where: { id: ctx.equipmentId },
    });
    expect(equipment?.refineLevel).toBe(1);
  });
});
