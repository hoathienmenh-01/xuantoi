import type { AchievementDef } from '@xuantoi/shared';
import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.10.E — Achievement (Thành Tựu) UI API client.
 *
 * Wire `GET /character/achievements` (Phase 11.10.E new endpoint) + `POST
 * /character/achievement/claim` (Phase 11.10.C-1 endpoint) cho Pinia
 * `useAchievementsStore` + UI `AchievementView.vue`.
 *
 * Server-authoritative — client chỉ gửi `achievementKey` (claim), server
 * validate completedAt!=null + claimedAt==null + grant linhThach/tienNgoc/exp
 * /title/items qua CurrencyLedger + ItemLedger reason ACHIEVEMENT_REWARD.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

export interface AchievementRow {
  achievementKey: string;
  progress: number;
  /** ISO timestamp from server, or `null` if not yet completed. */
  completedAt: string | null;
  /** ISO timestamp from server, or `null` if not yet claimed. */
  claimedAt: string | null;
  def: AchievementDef;
}

export interface AchievementClaimResult {
  achievementKey: string;
  /** ISO timestamp. */
  claimedAt: string;
  granted: {
    linhThach: number;
    tienNgoc: number;
    exp: number;
    titleKey: string | null;
    items: Array<{ itemKey: string; qty: number }>;
  };
}

export async function getAchievementsState(): Promise<AchievementRow[]> {
  const { data } = await apiClient.get<
    Envelope<{ achievements: AchievementRow[] }>
  >('/character/achievements');
  if (!data.ok || !data.data) throw data.error ?? fallbackError('achievementsState');
  return data.data.achievements;
}

export async function claimAchievement(
  achievementKey: string,
): Promise<AchievementClaimResult> {
  const { data } = await apiClient.post<
    Envelope<{ claim: AchievementClaimResult }>
  >('/character/achievement/claim', { achievementKey });
  if (!data.ok || !data.data) throw data.error ?? fallbackError('achievementClaim');
  return data.data.claim;
}
