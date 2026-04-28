import { apiClient } from './client';

export type MissionPeriod = 'DAILY' | 'WEEKLY' | 'ONCE';

export interface MissionRewardItem {
  itemKey: string;
  qty: number;
}

export interface MissionReward {
  linhThach?: number;
  tienNgoc?: number;
  exp?: number;
  congHien?: number;
  items?: MissionRewardItem[];
}

export interface MissionProgressView {
  key: string;
  name: string;
  description: string;
  period: MissionPeriod;
  goalKind: string;
  goalAmount: number;
  currentAmount: number;
  claimed: boolean;
  completable: boolean;
  windowEnd: string | null;
  rewards: MissionReward;
  quality: 'PHAM' | 'LINH' | 'HUYEN' | 'TIEN' | 'THANH';
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

export async function listMissions(): Promise<MissionProgressView[]> {
  const { data } = await apiClient.get<Envelope<{ missions: MissionProgressView[] }>>(
    '/missions/me',
  );
  return unwrap(data).missions;
}

export async function claimMission(
  missionKey: string,
): Promise<MissionProgressView[]> {
  const { data } = await apiClient.post<Envelope<{ missions: MissionProgressView[] }>>(
    '/missions/claim',
    { missionKey },
  );
  return unwrap(data).missions;
}
