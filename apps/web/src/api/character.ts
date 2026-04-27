import type { CreateCharacterInput, PublicCharacter } from '@xuantoi/shared';
import { apiClient } from './client';

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function unwrap<T>(env: ApiEnvelope<T>, fallback: string): T {
  if (env.ok && env.data) return env.data;
  const err = env.error ?? { code: 'UNKNOWN', message: fallback };
  const e = new Error(err.message) as Error & { code?: string };
  e.code = err.code;
  throw e;
}

export async function getMyCharacter(): Promise<PublicCharacter | null> {
  try {
    const { data } = await apiClient.get<ApiEnvelope<{ character: PublicCharacter }>>(
      '/character/me',
    );
    if (data.ok && data.data) return data.data.character;
    if (data.error?.code === 'CHAR_NOT_FOUND') return null;
    return null;
  } catch (err) {
    const code = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data
      ?.error?.code;
    if (code === 'CHAR_NOT_FOUND') return null;
    throw err;
  }
}

export async function createCharacter(input: CreateCharacterInput): Promise<PublicCharacter> {
  const { data } = await apiClient.post<ApiEnvelope<{ character: PublicCharacter }>>(
    '/character/create',
    input,
  );
  return unwrap(data, 'Khai mở đạo đồ thất bại').character;
}
