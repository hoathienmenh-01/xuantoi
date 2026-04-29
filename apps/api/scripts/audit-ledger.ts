/**
 * Smart economy safety — audit ledger consistency.
 *
 * Quét toàn bộ DB so sánh:
 *   1. SUM(CurrencyLedger.delta WHERE currency=LINH_THACH) per character
 *      vs Character.linhThach.
 *   2. SUM(CurrencyLedger.delta WHERE currency=TIEN_NGOC) per character
 *      vs Character.tienNgoc.
 *   3. SUM(ItemLedger.qtyDelta) per (character, itemKey)
 *      vs SUM(InventoryItem.qty) per (character, itemKey).
 *
 * Phát hiện dupe/cheat/bug ledger. Exit code != 0 nếu có discrepancy.
 *
 * Chạy:
 *   pnpm --filter @xuantoi/api audit:ledger
 *
 * Hoặc trực tiếp:
 *   pnpm --filter @xuantoi/api exec ts-node scripts/audit-ledger.ts
 *
 * Read-only — không mutate DB, an toàn chạy production để monitor.
 */
import { PrismaClient } from '@prisma/client';

export type CharacterDiscrepancy = {
  characterId: string;
  field: 'linhThach' | 'tienNgoc';
  ledgerSum: bigint;
  characterValue: bigint;
  diff: bigint;
};

export type InventoryDiscrepancy = {
  characterId: string;
  itemKey: string;
  ledgerSum: number;
  inventorySum: number;
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
      const [characterId, itemKey] = key.split(':');
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

function formatResult(r: AuditResult): string {
  const lines: string[] = [];
  lines.push(`Scanned: ${r.charactersScanned} characters, ${r.itemKeysScanned} (char, item) pairs.`);
  if (r.currencyDiscrepancies.length === 0) {
    lines.push('Currency: OK (no discrepancies).');
  } else {
    lines.push(`Currency DISCREPANCIES: ${r.currencyDiscrepancies.length}`);
    for (const d of r.currencyDiscrepancies) {
      lines.push(
        `  char=${d.characterId} field=${d.field} ledger=${d.ledgerSum} character=${d.characterValue} diff=${d.diff}`,
      );
    }
  }
  if (r.inventoryDiscrepancies.length === 0) {
    lines.push('Inventory: OK (no discrepancies).');
  } else {
    lines.push(`Inventory DISCREPANCIES: ${r.inventoryDiscrepancies.length}`);
    for (const d of r.inventoryDiscrepancies) {
      lines.push(
        `  char=${d.characterId} item=${d.itemKey} ledgerSum=${d.ledgerSum} inventorySum=${d.inventorySum} diff=${d.diff}`,
      );
    }
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const result = await auditLedger(prisma);
    console.log(formatResult(result));
    const total = result.currencyDiscrepancies.length + result.inventoryDiscrepancies.length;
    if (total > 0) {
      console.error(`\n[FAIL] ${total} discrepancy/discrepancies found.`);
      process.exit(1);
    }
    console.log('\n[OK] Ledger audit clean.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(2);
  });
}
