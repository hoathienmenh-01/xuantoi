import { apiClient } from './client';
import type { DungeonDef, MonsterDef } from '@xuantoi/shared';

export type EncounterStatus = 'ACTIVE' | 'WON' | 'LOST' | 'ABANDONED';

export interface EncounterLogLine {
  side: 'player' | 'monster' | 'system';
  text: string;
  ts: number;
}

export interface EncounterView {
  id: string;
  dungeon: DungeonDef;
  status: EncounterStatus;
  monster: MonsterDef | null;
  monsterHp: number;
  monsterIndex: number;
  log: EncounterLogLine[];
  reward: { exp: string; linhThach: string } | null;
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

export async function listDungeons(): Promise<DungeonDef[]> {
  const { data } = await apiClient.get<Envelope<{ dungeons: DungeonDef[] }>>(
    '/combat/dungeons',
  );
  return unwrap(data).dungeons;
}

export async function getActiveEncounter(): Promise<EncounterView | null> {
  const { data } = await apiClient.get<Envelope<{ encounter: EncounterView | null }>>(
    '/combat/encounter/active',
  );
  return unwrap(data).encounter;
}

export async function startEncounter(dungeonKey: string): Promise<EncounterView> {
  const { data } = await apiClient.post<Envelope<{ encounter: EncounterView }>>(
    '/combat/encounter/start',
    { dungeonKey },
  );
  return unwrap(data).encounter;
}

export async function performAction(
  encounterId: string,
  skillKey?: string,
): Promise<EncounterView> {
  const { data } = await apiClient.post<Envelope<{ encounter: EncounterView }>>(
    `/combat/encounter/${encounterId}/action`,
    { skillKey },
  );
  return unwrap(data).encounter;
}

export async function abandonEncounter(encounterId: string): Promise<EncounterView> {
  const { data } = await apiClient.post<Envelope<{ encounter: EncounterView }>>(
    `/combat/encounter/${encounterId}/abandon`,
    {},
  );
  return unwrap(data).encounter;
}
