import { i18n } from '@/i18n';
import { apiClient } from './client';

/**
 * Phase 11.X.AT — talent learn API client.
 *
 * Wire `GET /character/talents/state` + `POST /character/talents/learn` (Phase
 * 11.X.AS server endpoints) cho Pinia `useTalentsStore` + UI Học button.
 */

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

export interface TalentLearnedRow {
  talentKey: string;
  /** ISO timestamp from server. */
  learnedAt: string;
}

export interface TalentsState {
  learned: TalentLearnedRow[];
  spent: number;
  remaining: number;
  budget: number;
}

export interface TalentLearnResult {
  learn: TalentLearnedRow;
  remaining: number;
}

export async function getTalentsState(): Promise<TalentsState> {
  const { data } = await apiClient.get<Envelope<{ talents: TalentsState }>>(
    '/character/talents/state',
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('talentsState');
  return data.data.talents;
}

export async function learnTalent(
  talentKey: string,
): Promise<TalentLearnResult> {
  const { data } = await apiClient.post<Envelope<TalentLearnResult>>(
    '/character/talents/learn',
    { talentKey },
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('talentsLearn');
  return data.data;
}
