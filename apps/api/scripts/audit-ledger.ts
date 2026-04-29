/**
 * Smart economy safety — audit ledger consistency (CLI wrapper).
 *
 * Pure logic now lives in `apps/api/src/modules/admin/ledger-audit.ts` (also
 * dùng cho admin endpoint `GET /admin/economy/audit-ledger`). File này chỉ
 * là CLI thin wrapper để chạy ad-hoc trên prod DB qua pnpm script.
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
import { auditLedger, type AuditResult } from '../src/modules/admin/ledger-audit';

export {
  auditLedger,
  type AuditResult,
  type CharacterDiscrepancy,
  type InventoryDiscrepancy,
} from '../src/modules/admin/ledger-audit';

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
      process.exitCode = 1;
      return;
    }
    console.log('\n[OK] Ledger audit clean.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exitCode = 2;
  });
}
