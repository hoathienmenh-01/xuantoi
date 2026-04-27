import { apiClient } from './client';

export interface BossLeaderboardRow {
  rank: number;
  characterId: string;
  characterName: string;
  damage: string;
  hits: number;
}

export interface BossView {
  id: string;
  bossKey: string;
  name: string;
  description: string;
  level: number;
  maxHp: string;
  currentHp: string;
  status: 'ACTIVE' | 'DEFEATED' | 'EXPIRED';
  spawnedAt: string;
  expiresAt: string;
  leaderboard: BossLeaderboardRow[];
  myDamage: string | null;
  myRank: number | null;
  participants: number;
  cooldownUntil: string | null;
  topDropPool: string[];
  midDropPool: string[];
}

export interface AttackResult {
  damageDealt: string;
  bossHp: string;
  bossMaxHp: string;
  defeated: boolean;
  myDamageTotal: string;
  myRank: number;
  charHp: number;
  charMp: number;
  charStamina: number;
}

export interface DefeatedRewardSlice {
  rank: number;
  characterId: string;
  characterName: string;
  damage: string;
  linhThach: string;
  items: { itemKey: string; qty: number }[];
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

export async function getCurrentBoss(): Promise<BossView | null> {
  const { data } = await apiClient.get<Envelope<{ boss: BossView | null }>>('/boss/current');
  return unwrap(data).boss;
}

export async function attackBoss(
  skillKey?: string,
): Promise<{ result: AttackResult; defeated: DefeatedRewardSlice[] | null }> {
  const { data } = await apiClient.post<
    Envelope<{ result: AttackResult; defeated: DefeatedRewardSlice[] | null }>
  >('/boss/attack', { skillKey });
  return unwrap(data);
}
