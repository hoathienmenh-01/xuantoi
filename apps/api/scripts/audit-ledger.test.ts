import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma.service';
import { TEST_DATABASE_URL, makeUserChar, wipeAll } from '../src/test-helpers';
import { auditLedger } from './audit-ledger';

let prisma: PrismaService;

beforeAll(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  prisma = new PrismaService();
});

beforeEach(async () => {
  await wipeAll(prisma);
});

afterAll(async () => {
  await wipeAll(prisma);
  await prisma.$disconnect();
});

describe('audit-ledger script', () => {
  it('returns OK when no characters exist', async () => {
    const r = await auditLedger(prisma);
    expect(r.charactersScanned).toBe(0);
    expect(r.itemKeysScanned).toBe(0);
    expect(r.currencyDiscrepancies).toEqual([]);
    expect(r.inventoryDiscrepancies).toEqual([]);
  });

  it('returns OK when CurrencyLedger sum matches Character.linhThach + Character.tienNgoc', async () => {
    const { characterId } = await makeUserChar(prisma);
    await prisma.character.update({
      where: { id: characterId },
      data: { linhThach: 100n, tienNgoc: 50 },
    });
    await prisma.currencyLedger.create({
      data: { characterId: characterId, currency: 'LINH_THACH', delta: 100n, reason: 'TEST' },
    });
    await prisma.currencyLedger.create({
      data: { characterId: characterId, currency: 'TIEN_NGOC', delta: 50n, reason: 'TEST' },
    });

    const r = await auditLedger(prisma);
    expect(r.charactersScanned).toBe(1);
    expect(r.currencyDiscrepancies).toEqual([]);
  });

  it('detects linhThach discrepancy when Character.linhThach > sum(ledger)', async () => {
    const { characterId } = await makeUserChar(prisma);
    await prisma.character.update({
      where: { id: characterId },
      data: { linhThach: 1000n, tienNgoc: 0 },
    });
    await prisma.currencyLedger.create({
      data: { characterId: characterId, currency: 'LINH_THACH', delta: 200n, reason: 'TEST' },
    });

    const r = await auditLedger(prisma);
    expect(r.currencyDiscrepancies).toHaveLength(1);
    expect(r.currencyDiscrepancies[0]).toMatchObject({
      characterId: characterId,
      field: 'linhThach',
      ledgerSum: 200n,
      characterValue: 1000n,
      diff: 800n,
    });
  });

  it('detects tienNgoc discrepancy when ledger sum > Character.tienNgoc', async () => {
    const { characterId } = await makeUserChar(prisma);
    await prisma.character.update({
      where: { id: characterId },
      data: { linhThach: 0n, tienNgoc: 10 },
    });
    await prisma.currencyLedger.create({
      data: { characterId: characterId, currency: 'TIEN_NGOC', delta: 50n, reason: 'TEST' },
    });

    const r = await auditLedger(prisma);
    expect(r.currencyDiscrepancies).toHaveLength(1);
    expect(r.currencyDiscrepancies[0]).toMatchObject({
      characterId: characterId,
      field: 'tienNgoc',
      ledgerSum: 50n,
      characterValue: 10n,
      diff: -40n,
    });
  });

  it('returns OK when ItemLedger sum matches sum(InventoryItem.qty) per (char, itemKey)', async () => {
    const { characterId } = await makeUserChar(prisma);
    await prisma.inventoryItem.create({
      data: { characterId: characterId, itemKey: 'huyet_chi_dan', qty: 5 },
    });
    await prisma.itemLedger.create({
      data: {
        characterId: characterId,
        itemKey: 'huyet_chi_dan',
        qtyDelta: 5,
        reason: 'TEST_SEED',
      },
    });

    const r = await auditLedger(prisma);
    expect(r.itemKeysScanned).toBe(1);
    expect(r.inventoryDiscrepancies).toEqual([]);
  });

  it('detects inventory discrepancy when InventoryItem total > ItemLedger sum (potential dupe)', async () => {
    const { characterId } = await makeUserChar(prisma);
    // Inventory has 10 (suspicious dupe)
    await prisma.inventoryItem.create({
      data: { characterId: characterId, itemKey: 'huyet_chi_dan', qty: 10 },
    });
    // Ledger only records 5 grant
    await prisma.itemLedger.create({
      data: {
        characterId: characterId,
        itemKey: 'huyet_chi_dan',
        qtyDelta: 5,
        reason: 'TEST_SEED',
      },
    });

    const r = await auditLedger(prisma);
    expect(r.inventoryDiscrepancies).toHaveLength(1);
    expect(r.inventoryDiscrepancies[0]).toMatchObject({
      characterId: characterId,
      itemKey: 'huyet_chi_dan',
      ledgerSum: 5,
      inventorySum: 10,
      diff: 5,
    });
  });

  it('detects inventory discrepancy when ItemLedger has consume but InventoryItem still has qty', async () => {
    const { characterId } = await makeUserChar(prisma);
    await prisma.inventoryItem.create({
      data: { characterId: characterId, itemKey: 'huyet_chi_dan', qty: 3 },
    });
    // Ledger: granted 5, consumed 5 → expect inventory 0 (but actual 3)
    await prisma.itemLedger.create({
      data: { characterId: characterId, itemKey: 'huyet_chi_dan', qtyDelta: 5, reason: 'GRANT' },
    });
    await prisma.itemLedger.create({
      data: { characterId: characterId, itemKey: 'huyet_chi_dan', qtyDelta: -5, reason: 'CONSUME' },
    });

    const r = await auditLedger(prisma);
    expect(r.inventoryDiscrepancies).toHaveLength(1);
    expect(r.inventoryDiscrepancies[0]).toMatchObject({
      ledgerSum: 0,
      inventorySum: 3,
      diff: 3,
    });
  });

  it('aggregates multiple InventoryItem rows per (char, itemKey) including equipped slot', async () => {
    const { characterId } = await makeUserChar(prisma);
    // Pretend player has 2 stacks of same itemKey: 1 equipped + 1 in bag.
    await prisma.inventoryItem.create({
      data: {
        characterId: characterId,
        itemKey: 'kiem_thanh_van',
        qty: 1,
        equippedSlot: 'WEAPON',
      },
    });
    await prisma.inventoryItem.create({
      data: { characterId: characterId, itemKey: 'kiem_thanh_van', qty: 1 },
    });
    await prisma.itemLedger.create({
      data: { characterId: characterId, itemKey: 'kiem_thanh_van', qtyDelta: 2, reason: 'TEST' },
    });

    const r = await auditLedger(prisma);
    expect(r.inventoryDiscrepancies).toEqual([]);
  });
});
