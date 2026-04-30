/**
 * Smart economy safety — economy alerts (CLI wrapper).
 *
 * Pure logic ở `apps/api/src/modules/admin/economy-alerts-query.ts`
 * (cũng dùng cho admin endpoint `GET /admin/economy/alerts`). File này
 * chỉ là CLI thin wrapper để chạy ad-hoc / cron / monitoring pipeline.
 *
 * Chạy:
 *   pnpm --filter @xuantoi/api alerts:economy
 *   pnpm --filter @xuantoi/api alerts:economy -- --json
 *   pnpm --filter @xuantoi/api alerts:economy -- --stale-hours=48
 *   pnpm --filter @xuantoi/api alerts:economy -- --json --stale-hours=48
 *
 * Read-only — không mutate DB, an toàn chạy production.
 *
 * Exit codes:
 *   0 — clean (no alerts)
 *   1 — alerts found (negative currency / negative inventory / stale topup)
 *   2 — runtime error (DB connect, query crash, parse arg, ...)
 */
import { PrismaClient } from '@prisma/client';
import {
  countAlerts,
  queryEconomyAlerts,
  type EconomyAlertsResult,
} from '../src/modules/admin/economy-alerts-query';

export {
  queryEconomyAlerts,
  countAlerts,
  type EconomyAlertsResult,
} from '../src/modules/admin/economy-alerts-query';

export interface CliOptions {
  json: boolean;
  staleHours: number;
}

export const DEFAULT_STALE_HOURS = 24;

export class CliArgError extends Error {}

/**
 * Parse argv. Pure helper, exported cho unit test.
 *
 * Hỗ trợ:
 *   --json                  emit JSON thay vì human-readable
 *   --stale-hours=N         override default 24h (positive integer, > 0)
 *   --stale-hours N         (variant với space)
 *
 * Throw `CliArgError` nếu `--stale-hours` invalid (NaN / <= 0). Caller
 * bắt và exit code 2.
 */
export function parseArgs(argv: readonly string[]): CliOptions {
  let json = false;
  let staleHours = DEFAULT_STALE_HOURS;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') {
      json = true;
    } else if (a === '--stale-hours') {
      const next = argv[i + 1];
      staleHours = parseStaleHoursValue(next);
      i++;
    } else if (a.startsWith('--stale-hours=')) {
      staleHours = parseStaleHoursValue(a.slice('--stale-hours='.length));
    }
  }
  return { json, staleHours };
}

function parseStaleHoursValue(raw: string | undefined): number {
  if (raw == null || raw.trim() === '') {
    throw new CliArgError('--stale-hours requires a positive integer value');
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    throw new CliArgError(
      `--stale-hours invalid (got ${JSON.stringify(raw)}); must be positive integer`,
    );
  }
  return n;
}

/**
 * Format `EconomyAlertsResult` sang human-readable plain text.
 * Pure function, exported cho unit test.
 */
export function formatResult(r: EconomyAlertsResult): string {
  const lines: string[] = [];
  lines.push(`Economy alerts (staleHours=${r.staleHours}, generatedAt=${r.generatedAt}):`);

  if (r.negativeCurrency.length === 0) {
    lines.push('  Negative currency: OK (none).');
  } else {
    lines.push(`  Negative currency: ${r.negativeCurrency.length}`);
    for (const c of r.negativeCurrency) {
      lines.push(
        `    char=${c.characterId} name=${c.name} email=${c.userEmail} linhThach=${c.linhThach} tienNgoc=${c.tienNgoc} tienNgocKhoa=${c.tienNgocKhoa}`,
      );
    }
  }

  if (r.negativeInventory.length === 0) {
    lines.push('  Negative inventory: OK (none).');
  } else {
    lines.push(`  Negative inventory: ${r.negativeInventory.length}`);
    for (const i of r.negativeInventory) {
      lines.push(
        `    invItem=${i.inventoryItemId} char=${i.characterId} (${i.characterName}) item=${i.itemKey} qty=${i.qty}`,
      );
    }
  }

  if (r.stalePendingTopups.length === 0) {
    lines.push('  Stale pending topups: OK (none).');
  } else {
    lines.push(`  Stale pending topups: ${r.stalePendingTopups.length}`);
    for (const t of r.stalePendingTopups) {
      lines.push(
        `    topup=${t.id} email=${t.userEmail} pkg=${t.packageKey} amount=${t.tienNgocAmount} ageHours=${t.ageHours}`,
      );
    }
  }

  return lines.join('\n');
}

/**
 * Format `EconomyAlertsResult` sang JSON. Pre-compute `summary` block để
 * cron consumer không phải tự đếm lại. Pure function, exported cho test.
 */
export function formatResultJson(r: EconomyAlertsResult): string {
  const total = countAlerts(r);
  const payload = {
    summary: {
      negativeCurrency: r.negativeCurrency.length,
      negativeInventory: r.negativeInventory.length,
      stalePendingTopups: r.stalePendingTopups.length,
      total,
      ok: total === 0,
    },
    ...r,
  };
  return JSON.stringify(payload, null, 2);
}

async function main(argv: readonly string[]): Promise<void> {
  let opts: CliOptions;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 2;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const result = await queryEconomyAlerts(prisma, opts.staleHours);
    const total = countAlerts(result);

    if (opts.json) {
      console.log(formatResultJson(result));
    } else {
      console.log(formatResult(result));
    }

    if (total > 0) {
      if (!opts.json) {
        console.error(`\n[FAIL] ${total} alert(s) found.`);
      }
      process.exitCode = 1;
      return;
    }

    if (!opts.json) {
      console.log('\n[OK] No economy alerts.');
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
