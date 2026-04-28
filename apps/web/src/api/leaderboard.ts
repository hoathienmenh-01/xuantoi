import { apiClient } from './client';

export interface LeaderboardRow {
  rank: number;
  characterId: string;
  name: string;
  realmKey: string;
  realmStage: number;
  power: number;
  level: number;
  sectKey: 'thanh_van' | 'huyen_thuy' | 'tu_la' | null;
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

export async function fetchLeaderboardPower(
  limit = 50,
): Promise<LeaderboardRow[]> {
  const { data } = await apiClient.get<Envelope<{ rows: LeaderboardRow[] }>>(
    '/leaderboard/power',
    { params: { limit } },
  );
  return unwrap(data).rows;
}
