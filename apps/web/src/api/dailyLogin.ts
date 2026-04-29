import { apiClient } from './client';

export interface DailyLoginStatus {
  todayDateLocal: string;
  canClaimToday: boolean;
  currentStreak: number;
  /** BigInt-as-string. */
  nextRewardLinhThach: string;
}

export interface DailyLoginClaimResult {
  claimed: boolean;
  /** BigInt-as-string. 0 nếu idempotent. */
  linhThachDelta: string;
  newStreak: number;
  claimDateLocal: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function getDailyLoginStatus(): Promise<DailyLoginStatus | null> {
  const { data } = await apiClient.get<Envelope<DailyLoginStatus>>(
    '/daily-login/me',
  );
  return data.ok && data.data ? data.data : null;
}

export async function claimDailyLogin(): Promise<DailyLoginClaimResult | null> {
  const { data } = await apiClient.post<Envelope<DailyLoginClaimResult>>(
    '/daily-login/claim',
  );
  return data.ok && data.data ? data.data : null;
}
