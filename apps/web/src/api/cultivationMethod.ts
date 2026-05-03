import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.1.C — Cultivation Method (Công Pháp) UI API client.
 *
 * Wire `GET /character/cultivation-method` + `POST /character/cultivation-method/equip`
 * (Phase 11.1.B server endpoints) cho Pinia `useCultivationMethodStore` + UI
 * `CultivationMethodView.vue` (Công pháp tab).
 *
 * Server-authoritative: client chỉ gửi `methodKey`, server validate ownership
 * (đã `learn`) + realm + sect + forbiddenElement, rồi đổi
 * `Character.equippedCultivationMethodKey`.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

export interface CultivationMethodLearnedRow {
  methodKey: string;
  /** 'starter' | 'sect_shop' | 'dungeon_drop' | 'boss_drop' | 'event' | 'quest_milestone' */
  source: string;
  /** ISO timestamp from server. */
  learnedAt: string;
}

export interface CultivationMethodState {
  /** Method key currently equipped, or `null` if no method equipped (legacy fallback handled by server). */
  equippedMethodKey: string | null;
  learned: CultivationMethodLearnedRow[];
}

export async function getCultivationMethodState(): Promise<CultivationMethodState> {
  const { data } = await apiClient.get<Envelope<{ cultivationMethod: CultivationMethodState }>>(
    '/character/cultivation-method',
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('cultivationMethodState');
  return data.data.cultivationMethod;
}

export async function equipCultivationMethod(
  methodKey: string,
): Promise<CultivationMethodState> {
  const { data } = await apiClient.post<Envelope<{ cultivationMethod: CultivationMethodState }>>(
    '/character/cultivation-method/equip',
    { methodKey },
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('cultivationMethodEquip');
  return data.data.cultivationMethod;
}
