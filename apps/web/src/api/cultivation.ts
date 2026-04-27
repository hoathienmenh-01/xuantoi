import type { PublicCharacter } from '@xuantoi/shared';
import { apiClient } from './client';

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

interface CultivationResp {
  character: PublicCharacter;
  flushedExp?: string;
}

function unwrap<T>(env: ApiEnvelope<T>, fallback: string): T {
  if (env.ok && env.data) return env.data;
  const err = env.error ?? { code: 'UNKNOWN', message: fallback };
  const e = new Error(err.message) as Error & { code?: string };
  e.code = err.code;
  throw e;
}

async function call(path: string, fallback: string): Promise<CultivationResp> {
  const { data } = await apiClient.post<ApiEnvelope<CultivationResp>>(path);
  return unwrap(data, fallback);
}

export const startCultivation = () => call('/cultivation/start', 'Bắt đầu tu luyện thất bại');
export const stopCultivation = () => call('/cultivation/stop', 'Dừng tu luyện thất bại');
export const tickCultivation = () => call('/cultivation/tick', 'Cập nhật tu luyện thất bại');
export const breakthrough = () => call('/cultivation/breakthrough', 'Đột phá thất bại');
