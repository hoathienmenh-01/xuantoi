/**
 * Pure query layer cho `getEconomyAlerts` — extract khỏi `admin.service.ts`
 * để tái sử dụng cho:
 *   - Admin endpoint `GET /admin/economy/alerts` (qua AdminService).
 *   - CLI `pnpm --filter @xuantoi/api alerts:economy` (qua
 *     `scripts/economy-alerts.ts`) cho cron / monitoring pipeline.
 *
 * Pure ở mức "không phụ thuộc Nest DI / RealtimeService / business
 * service khác" — chỉ cần `PrismaClient` (hoặc bất kỳ object có shape
 * tương tự). Không mutate DB. Không gửi WS event.
 *
 * Pattern này song song với `ledger-audit.ts` / `audit-ledger.ts`.
 */
import { TopupStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Subset Prisma cần thiết — typed loose để dễ test với mock.
 * Production luôn truyền `PrismaClient` thật.
 */
export type PrismaForEconomyAlerts = Pick<
  PrismaClient,
  'character' | 'inventoryItem' | 'topupOrder'
>;

export interface EconomyAlertsResult {
  negativeCurrency: {
    characterId: string;
    name: string;
    userEmail: string;
    linhThach: string;
    tienNgoc: number;
    tienNgocKhoa: number;
  }[];
  negativeInventory: {
    inventoryItemId: string;
    characterId: string;
    characterName: string;
    itemKey: string;
    qty: number;
  }[];
  stalePendingTopups: {
    id: string;
    userEmail: string;
    packageKey: string;
    tienNgocAmount: number;
    createdAt: string;
    ageHours: number;
  }[];
  staleHours: number;
  generatedAt: string;
}

/**
 * Đọc alerts từ DB. Read-only. Dùng `Promise.all` để 3 query song song
 * (giảm latency cho dashboard).
 *
 * Thuyết minh shape:
 *   - `negativeCurrency`: characters có `linhThach`/`tienNgoc`/`tienNgocKhoa`
 *     < 0. Invariant violation — currency không bao giờ được âm.
 *   - `negativeInventory`: items có `qty < 1`. Invariant violation — qty=0
 *     phải xoá row, qty<0 là bug.
 *   - `stalePendingTopups`: topup `PENDING` quá `staleHours` — admin
 *     chưa duyệt, có thể là dấu hiệu của payment deadlock.
 */
export async function queryEconomyAlerts(
  prisma: PrismaForEconomyAlerts,
  staleHours: number,
): Promise<EconomyAlertsResult> {
  const since = new Date(Date.now() - staleHours * 3600 * 1000);

  const [negChars, negItems, staleTopups] = await Promise.all([
    prisma.character.findMany({
      where: {
        OR: [
          { linhThach: { lt: 0n } },
          { tienNgoc: { lt: 0 } },
          { tienNgocKhoa: { lt: 0 } },
        ],
      },
      select: {
        id: true,
        name: true,
        linhThach: true,
        tienNgoc: true,
        tienNgocKhoa: true,
        user: { select: { email: true } },
      },
      orderBy: { name: 'asc' },
      take: 100,
    }),
    prisma.inventoryItem.findMany({
      where: { qty: { lt: 1 } },
      select: {
        id: true,
        characterId: true,
        itemKey: true,
        qty: true,
        character: { select: { name: true } },
      },
      orderBy: { id: 'asc' },
      take: 100,
    }),
    prisma.topupOrder.findMany({
      where: {
        status: TopupStatus.PENDING,
        createdAt: { lt: since },
      },
      select: {
        id: true,
        packageKey: true,
        tienNgocAmount: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
  ]);

  const now = Date.now();
  return {
    negativeCurrency: negChars.map((c) => ({
      characterId: c.id,
      name: c.name,
      userEmail: c.user.email,
      linhThach: c.linhThach.toString(),
      tienNgoc: c.tienNgoc,
      tienNgocKhoa: c.tienNgocKhoa,
    })),
    negativeInventory: negItems.map((i) => ({
      inventoryItemId: i.id,
      characterId: i.characterId,
      characterName: i.character.name,
      itemKey: i.itemKey,
      qty: i.qty,
    })),
    stalePendingTopups: staleTopups.map((t) => ({
      id: t.id,
      userEmail: t.user.email,
      packageKey: t.packageKey,
      tienNgocAmount: t.tienNgocAmount,
      createdAt: t.createdAt.toISOString(),
      ageHours: Math.floor((now - t.createdAt.getTime()) / (3600 * 1000)),
    })),
    staleHours,
    generatedAt: new Date(now).toISOString(),
  };
}

/**
 * Tổng số alert items — tiện cho cron exit code / FE badge counter.
 */
export function countAlerts(r: EconomyAlertsResult): number {
  return (
    r.negativeCurrency.length +
    r.negativeInventory.length +
    r.stalePendingTopups.length
  );
}
