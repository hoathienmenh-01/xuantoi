import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.3.D — Spiritual Root (Linh Căn) UI API client.
 *
 * Wire 2 endpoint:
 *   - GET  /character/spiritual-root           (Phase 11.3.A read state, lazy onboard)
 *   - POST /character/spiritual-root/reroll    (Phase 11.3.D consume `linh_can_dan`)
 *
 * Server-authoritative: client KHÔNG gửi body cho reroll, server tự lookup
 * inventory `linh_can_dan` qty + atomic consume + roll RNG mới + insert
 * SpiritualRootRollLog source='reroll'.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

/**
 * State trả về từ server. Mirror `SpiritualRootStateOut` ở
 * `apps/api/src/modules/character/spiritual-root.service.ts`.
 *
 * Lưu ý: `secondaryElements` là `string[]` thuần — caller có thể narrow
 * sang `ElementKey[]` từ `@xuantoi/shared` nếu cần (shared catalog
 * validate ELEMENTS).
 */
export interface SpiritualRootState {
  /** 'pham' | 'linh' | 'huyen' | 'tien' | 'than' */
  grade: string;
  /** 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho' */
  primaryElement: string;
  /** Element phụ — `[]` nếu grade='pham', tối đa 4 (grade='than'). */
  secondaryElements: string[];
  /** Purity 80..100 inclusive. */
  purity: number;
  /** Số lần đã reroll qua `linh_can_dan` (Phase 11.3.D). */
  rerollCount: number;
}

export async function getSpiritualRootState(): Promise<SpiritualRootState> {
  const { data } = await apiClient.get<Envelope<{ spiritualRoot: SpiritualRootState }>>(
    '/character/spiritual-root',
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('spiritualRootState');
  return data.data.spiritualRoot;
}

export async function rerollSpiritualRoot(): Promise<SpiritualRootState> {
  const { data } = await apiClient.post<Envelope<{ spiritualRoot: SpiritualRootState }>>(
    '/character/spiritual-root/reroll',
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('spiritualRootReroll');
  return data.data.spiritualRoot;
}
