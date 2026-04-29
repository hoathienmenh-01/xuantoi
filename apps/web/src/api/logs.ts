/**
 * M6 — self audit log (PR #88).
 * GET /logs/me?type=currency|item&limit=20&cursor=<opaque> → keyset paginated.
 */
import { apiClient } from './client';

export type LogType = 'currency' | 'item';

export interface LogEntryCurrency {
  kind: 'CURRENCY';
  id: string;
  createdAt: string;
  reason: string;
  refType: string | null;
  refId: string | null;
  actorUserId: string | null;
  currency: 'LINH_THACH' | 'TIEN_NGOC';
  /** BigInt as string. Có thể âm (chuỗi bắt đầu bằng "-"). */
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
  nextCursor: string | null;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function unwrap<T>(env: Envelope<T>): T {
  if (!env.ok || !env.data) {
    const err = env.error ?? { code: 'UNKNOWN', message: 'UNKNOWN' };
    throw Object.assign(new Error(err.message), { code: err.code });
  }
  return env.data;
}

export async function fetchLogsMe(params: {
  type: LogType;
  limit?: number;
  cursor?: string | null;
}): Promise<LogsListResult> {
  const query: Record<string, string | number> = {
    type: params.type,
    limit: params.limit ?? 20,
  };
  if (params.cursor) query.cursor = params.cursor;
  const { data } = await apiClient.get<Envelope<LogsListResult>>('/logs/me', {
    params: query,
  });
  return unwrap(data);
}
