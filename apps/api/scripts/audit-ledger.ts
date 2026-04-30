/**
 * Smart economy safety — audit ledger consistency (CLI wrapper).
 *
 * Pure logic now lives in `apps/api/src/modules/admin/ledger-audit.ts` (also
 * dùng cho admin endpoint `GET /admin/economy/audit-ledger`). File này chỉ
 * là CLI thin wrapper để chạy ad-hoc trên prod DB qua pnpm script.
 *
 * Chạy:
 *   pnpm --filter @xuantoi/api audit:ledger              # human-readable
 *   pnpm --filter @xuantoi/api audit:ledger -- --json    # machine-parseable
 *
 * Hoặc trực tiếp:
 *   pnpm --filter @xuantoi/api exec ts-node scripts/audit-ledger.ts [--json]
 *
 * Read-only — không mutate DB, an toàn chạy production để monitor.
 *
 * Exit codes:
 *   0 — clean (no discrepancy)
 *   1 — discrepancy found (non-zero summary)
 *   2 — runtime error (DB connect, query crash, ...)
 */
import { PrismaClient } from '@prisma/client';
import { auditLedger, type AuditResult } from '../src/modules/admin/ledger-audit';

export {
  auditLedger,
  type AuditResult,
  type CharacterDiscrepancy,
  type InventoryDiscrepancy,
} from '../src/modules/admin/ledger-audit';

/**
 * Parse CLI argv into a normalized options object.
 *
 * Pure helper, exported cho unit test. Không đọc `process.argv` trực tiếp —
 * caller truyền `argv` để test có thể inject.
 */
export interface CliOptions {
  json: boolean;
}

export function parseArgs(argv: readonly string[]): CliOptions {
  return {
    json: argv.includes('--json'),
  };
}

/**
 * Format an `AuditResult` as a human-readable plain-text report.
 *
 * Pure function (no I/O), exported cho unit test.
 */
export function formatResult(r: AuditResult): string {
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

/**
 * Format an `AuditResult` as a JSON string for machine consumption (cron, CI,
 * monitoring pipeline). Includes a pre-computed `summary` block so consumers
 * không phải tự đếm lại.
 *
 * BigInt-safe: `CharacterDiscrepancy` có `bigint` field (`ledgerSum`,
 * `characterValue`, `diff`) — `JSON.stringify` throw mặc định trên BigInt
 * → ta serialize tay sang `string` để giữ độ chính xác (không cast về
 * `number` vì có thể vượt `Number.MAX_SAFE_INTEGER`).
 *
 * Pure function (no I/O), exported cho unit test.
 */
export function formatResultJson(r: AuditResult): string {
  const payload = {
    summary: {
      charactersScanned: r.charactersScanned,
      itemKeysScanned: r.itemKeysScanned,
      currencyDiscrepancies: r.currencyDiscrepancies.length,
      inventoryDiscrepancies: r.inventoryDiscrepancies.length,
      totalDiscrepancies: r.currencyDiscrepancies.length + r.inventoryDiscrepancies.length,
      ok: r.currencyDiscrepancies.length === 0 && r.inventoryDiscrepancies.length === 0,
    },
    charactersScanned: r.charactersScanned,
    itemKeysScanned: r.itemKeysScanned,
    currencyDiscrepancies: r.currencyDiscrepancies.map((d) => ({
      characterId: d.characterId,
      field: d.field,
      ledgerSum: d.ledgerSum.toString(),
      characterValue: d.characterValue.toString(),
      diff: d.diff.toString(),
    })),
    inventoryDiscrepancies: r.inventoryDiscrepancies.map((d) => ({
      characterId: d.characterId,
      itemKey: d.itemKey,
      ledgerSum: d.ledgerSum,
      inventorySum: d.inventorySum,
      diff: d.diff,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

async function main(argv: readonly string[]): Promise<void> {
  const opts = parseArgs(argv);
  const prisma = new PrismaClient();
  try {
    const result = await auditLedger(prisma);
    const total = result.currencyDiscrepancies.length + result.inventoryDiscrepancies.length;

    if (opts.json) {
      console.log(formatResultJson(result));
    } else {
      console.log(formatResult(result));
    }

    if (total > 0) {
      if (!opts.json) {
        console.error(`\n[FAIL] ${total} discrepancy/discrepancies found.`);
      }
      process.exitCode = 1;
      return;
    }

    if (!opts.json) {
      console.log('\n[OK] Ledger audit clean.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    console.error(e);
    process.exitCode = 2;
  });
}
