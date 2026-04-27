import type { PublicGameLog } from '@xuantoi/shared';
import { apiClient } from './client';

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function getMyLogs(): Promise<PublicGameLog[]> {
  try {
    const { data } = await apiClient.get<ApiEnvelope<{ logs: PublicGameLog[] }>>('/logs/me');
    return data.ok && data.data ? data.data.logs : [];
  } catch {
    return [];
  }
}
