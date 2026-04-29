/**
 * Smart economy safety — audit ledger consistency.
 *
 * Pure logic dùng chung cho:
 *   - script CLI `apps/api/scripts/audit-ledger.ts` (chạy ad-hoc trên prod DB).
 *   - admin endpoint `GET /admin/economy/audit-ledger` (admin chạy on-demand
 *     từ AdminView Stats tab).
 *
 * Quét toàn bộ DB so sánh:
 *   1. SUM(CurrencyLedger.delta WHERE currency=LINH_THACH) per character
 *      vs Character.linhThach.
 *   2. SUM(CurrencyLedger.delta WHERE currency=TIEN_NGOC) per character
 *      vs Character.tienNgoc.
 *   3. SUM(ItemLedger.qtyDelta) per (character, itemKey)
 *      vs SUM(InventoryItem.qty) per (character, itemKey).
 *
 * Read-only — không mutate DB, an toàn chạy production để monitor.
 */
import type { PrismaClient } from '@prisma/client';

export type CharacterDiscrepancy = {
  characterId: string;
  field: 'linhThach' | 'tienNgoc';
  /** Sum of CurrencyLedger.delta cho character này, currency tương ứng. */
  ledgerSum: bigint;
  /** Giá trị Character.linhThach hoặc Character.tienNgoc hiện tại. */
  characterValue: bigint;
  /** characterValue - ledgerSum. Dương = character có nhiều hơn ledger ghi nhận. */
  diff: bigint;
};

export type InventoryDiscrepancy = {
  characterId: string;
  itemKey: string;
  /** Sum of ItemLedger.qtyDelta cho (character, itemKey). */
  ledgerSum: number;
  /** Sum of InventoryItem.qty cho (character, itemKey). */
  inventorySum: number;
  /** inventorySum - ledgerSum. Dương = inventory có nhiều hơn ledger ghi nhận. */
  diff: number;
};

export type AuditResult = {
  charactersScanned: number;
  itemKeysScanned: number;
  currencyDiscrepancies: CharacterDiscrepancy[];
  inventoryDiscrepancies: InventoryDiscrepancy[];
};

export async function auditLedger(prisma: PrismaClient): Promise<AuditResult> {
  const characters = await prisma.character.findMany({
    select: { id: true, linhThach: true, tienNgoc: true },
  });

  const ledgerByChar = await prisma.currencyLedger.groupBy({
    by: ['characterId', 'currency'],
    _sum: { delta: true },
  });

  const ledgerLookup = new Map<string, bigint>();
  for (const row of ledgerByChar) {
    const key = `${row.characterId}:${row.currency}`;
    ledgerLookup.set(key, row._sum.delta ?? 0n);
  }

  const currencyDiscrepancies: CharacterDiscrepancy[] = [];
  for (const c of characters) {
    const ltSum = ledgerLookup.get(`${c.id}:LINH_THACH`) ?? 0n;
    if (ltSum !== c.linhThach) {
      currencyDiscrepancies.push({
        characterId: c.id,
        field: 'linhThach',
        ledgerSum: ltSum,
        characterValue: c.linhThach,
        diff: c.linhThach - ltSum,
      });
    }
    const tnSum = ledgerLookup.get(`${c.id}:TIEN_NGOC`) ?? 0n;
    const tnVal = BigInt(c.tienNgoc);
    if (tnSum !== tnVal) {
      currencyDiscrepancies.push({
        characterId: c.id,
        field: 'tienNgoc',
        ledgerSum: tnSum,
        characterValue: tnVal,
        diff: tnVal - tnSum,
      });
    }
  }

  const itemLedgerByKey = await prisma.itemLedger.groupBy({
    by: ['characterId', 'itemKey'],
    _sum: { qtyDelta: true },
  });
  const inventoryByKey = await prisma.inventoryItem.groupBy({
    by: ['characterId', 'itemKey'],
    _sum: { qty: true },
  });

  const ledgerSumLookup = new Map<string, number>();
  for (const row of itemLedgerByKey) {
    ledgerSumLookup.set(`${row.characterId}:${row.itemKey}`, row._sum.qtyDelta ?? 0);
  }
  const inventorySumLookup = new Map<string, number>();
  for (const row of inventoryByKey) {
    inventorySumLookup.set(`${row.characterId}:${row.itemKey}`, row._sum.qty ?? 0);
  }

  const allKeys = new Set<string>([...ledgerSumLookup.keys(), ...inventorySumLookup.keys()]);
  const inventoryDiscrepancies: InventoryDiscrepancy[] = [];
  for (const key of allKeys) {
    const ledgerSum = ledgerSumLookup.get(key) ?? 0;
    const inventorySum = inventorySumLookup.get(key) ?? 0;
    if (ledgerSum !== inventorySum) {
      const sepIdx = key.indexOf(':');
      const characterId = key.slice(0, sepIdx);
      const itemKey = key.slice(sepIdx + 1);
      inventoryDiscrepancies.push({
        characterId,
        itemKey,
        ledgerSum,
        inventorySum,
        diff: inventorySum - ledgerSum,
      });
    }
  }

  return {
    charactersScanned: characters.length,
    itemKeysScanned: allKeys.size,
    currencyDiscrepancies,
    inventoryDiscrepancies,
  };
}

/**
 * Serialize bigint trong AuditResult sang string để có thể trả qua HTTP JSON.
 * Dùng cho admin endpoint, FE nhận về parse lại nếu cần (ledgerSum/diff hiếm khi
 * vượt Number.MAX_SAFE_INTEGER trong closed-beta nhưng giữ string cho tương lai).
 */
export type AuditResultJson = {
  charactersScanned: number;
  itemKeysScanned: number;
  currencyDiscrepancies: Array<{
    characterId: string;
    field: 'linhThach' | 'tienNgoc';
    ledgerSum: string;
    characterValue: string;
    diff: string;
  }>;
  inventoryDiscrepancies: InventoryDiscrepancy[];
};

export function auditResultToJson(r: AuditResult): AuditResultJson {
  return {
    charactersScanned: r.charactersScanned,
    itemKeysScanned: r.itemKeysScanned,
    currencyDiscrepancies: r.currencyDiscrepancies.map((d) => ({
      characterId: d.characterId,
      field: d.field,
      ledgerSum: d.ledgerSum.toString(),
      characterValue: d.characterValue.toString(),
      diff: d.diff.toString(),
    })),
    inventoryDiscrepancies: r.inventoryDiscrepancies,
  };
}
