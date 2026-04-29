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

export interface LeaderboardTopupRow {
  rank: number;
  characterId: string;
  name: string;
  realmKey: string;
  realmStage: number;
  totalTienNgoc: number;
  sectKey: 'thanh_van' | 'huyen_thuy' | 'tu_la' | null;
}

export interface LeaderboardSectRow {
  rank: number;
  sectId: string;
  sectKey: 'thanh_van' | 'huyen_thuy' | 'tu_la' | null;
  name: string;
  level: number;
  /** BigInt serialized as string từ BE để tránh JS number overflow. */
  treasuryLinhThach: string;
  memberCount: number;
  leaderName: string | null;
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

export async function fetchLeaderboardTopup(
  limit = 50,
): Promise<LeaderboardTopupRow[]> {
  const { data } = await apiClient.get<
    Envelope<{ rows: LeaderboardTopupRow[] }>
  >('/leaderboard/topup', { params: { limit } });
  return unwrap(data).rows;
}

export async function fetchLeaderboardSect(
  limit = 50,
): Promise<LeaderboardSectRow[]> {
  const { data } = await apiClient.get<
    Envelope<{ rows: LeaderboardSectRow[] }>
  >('/leaderboard/sect', { params: { limit } });
  return unwrap(data).rows;
}
