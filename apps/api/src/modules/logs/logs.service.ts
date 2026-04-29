import { Injectable } from '@nestjs/common';
import { CurrencyKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

/**
 * `GET /logs/me` — self audit log cho người chơi.
 *
 * Trả về CurrencyLedger hoặc ItemLedger của character thuộc user hiện tại,
 * paginated keyset bằng `(createdAt DESC, id DESC)` để ổn định khi có nhiều
 * dòng cùng `createdAt` (race condition trong cùng transaction).
 *
 * Không expose `meta.adminReason` hay PII của admin actor — chỉ trả
 * `actorUserId` (cuid) để FE biết "hệ thống vs admin", chứ không tự lookup
 * email actor.
 */

export class LogsError extends Error {
  constructor(public code: 'NO_CHARACTER' | 'INVALID_CURSOR') {
    super(code);
  }
}

export type LogType = 'currency' | 'item';

/** Min / max / default cho query param `limit`. */
export const LOGS_LIMIT_MIN = 1;
export const LOGS_LIMIT_MAX = 50;
export const LOGS_LIMIT_DEFAULT = 20;

export interface LogCursor {
  createdAt: Date;
  id: string;
}

export interface LogEntryCurrency {
  kind: 'CURRENCY';
  id: string;
  createdAt: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  /** Cuid của user thực hiện thao tác (admin grant / topup approve). null nếu hệ thống. */
  actorUserId: string | null;
  currency: CurrencyKind;
  /** BigInt serialized as string để FE giữ nguyên độ chính xác. */
  delta: string;
}

export interface LogEntryItem {
  kind: 'ITEM';
  id: string;
  createdAt: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  actorUserId: string | null;
  itemKey: string;
  qtyDelta: number;
}

export type LogEntry = LogEntryCurrency | LogEntryItem;

export interface LogsListResult {
  entries: LogEntry[];
  /** Opaque cursor để gọi page tiếp theo. `null` nếu hết. */
  nextCursor: string | null;
}

/** Encode `(createdAt, id)` thành cursor opaque base64url. */
export function encodeCursor(c: LogCursor): string {
  const raw = `${c.createdAt.toISOString()}|${c.id}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/** Decode cursor opaque. Throw `LogsError('INVALID_CURSOR')` nếu sai format. */
export function decodeCursor(s: string): LogCursor {
  let raw: string;
  try {
    raw = Buffer.from(s, 'base64url').toString('utf8');
  } catch {
    throw new LogsError('INVALID_CURSOR');
  }
  const idx = raw.indexOf('|');
  if (idx <= 0 || idx === raw.length - 1) {
    throw new LogsError('INVALID_CURSOR');
  }
  const iso = raw.slice(0, idx);
  const id = raw.slice(idx + 1);
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) {
    throw new LogsError('INVALID_CURSOR');
  }
  return { createdAt, id };
}

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getCharacterIdByUser(userId: string): Promise<string> {
    const ch = await this.prisma.character.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!ch) throw new LogsError('NO_CHARACTER');
    return ch.id;
  }

  async listForUser(
    userId: string,
    opts: { type: LogType; limit: number; cursor?: string },
  ): Promise<LogsListResult> {
    const characterId = await this.getCharacterIdByUser(userId);
    const limit = Math.min(
      Math.max(opts.limit, LOGS_LIMIT_MIN),
      LOGS_LIMIT_MAX,
    );
    const cursor = opts.cursor ? decodeCursor(opts.cursor) : undefined;

    if (opts.type === 'currency') {
      return this.listCurrency(characterId, limit, cursor);
    }
    return this.listItem(characterId, limit, cursor);
  }

  private async listCurrency(
    characterId: string,
    limit: number,
    cursor?: LogCursor,
  ): Promise<LogsListResult> {
    const where: Prisma.CurrencyLedgerWhereInput = { characterId };
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        {
          AND: [
            { createdAt: cursor.createdAt },
            { id: { lt: cursor.id } },
          ],
        },
      ];
    }
    const rows = await this.prisma.currencyLedger.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const slice = rows.slice(0, limit);
    const entries: LogEntryCurrency[] = slice.map((r) => ({
      kind: 'CURRENCY',
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      reason: r.reason,
      refType: r.refType,
      refId: r.refId,
      actorUserId: r.actorUserId,
      currency: r.currency,
      delta: r.delta.toString(),
    }));
    const last = hasMore ? slice[slice.length - 1] : null;
    const nextCursor =
      last !== null ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return { entries, nextCursor };
  }

  private async listItem(
    characterId: string,
    limit: number,
    cursor?: LogCursor,
  ): Promise<LogsListResult> {
    const where: Prisma.ItemLedgerWhereInput = { characterId };
    if (cursor) {
      where.OR = [
        { createdAt: { lt: cursor.createdAt } },
        {
          AND: [
            { createdAt: cursor.createdAt },
            { id: { lt: cursor.id } },
          ],
        },
      ];
    }
    const rows = await this.prisma.itemLedger.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const slice = rows.slice(0, limit);
    const entries: LogEntryItem[] = slice.map((r) => ({
      kind: 'ITEM',
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      reason: r.reason,
      refType: r.refType,
      refId: r.refId,
      actorUserId: r.actorUserId,
      itemKey: r.itemKey,
      qtyDelta: r.qtyDelta,
    }));
    const last = hasMore ? slice[slice.length - 1] : null;
    const nextCursor =
      last !== null ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return { entries, nextCursor };
  }
}
