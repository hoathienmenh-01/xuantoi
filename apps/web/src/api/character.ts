import { i18n } from '@/i18n';
import { apiClient } from './client';

function fallbackError(op: string): Error {
  return new Error(i18n.global.t(`common.apiFallback.${op}`));
}

export interface Character {
  id: string;
  name: string;
  realmKey: string;
  realmStage: number;
  level: number;
  exp: string;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  power: number;
  spirit: number;
  speed: number;
  luck: number;
  sectId: string | null;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function getCharacter(): Promise<Character | null> {
  const { data } = await apiClient.get<Envelope<{ character: Character | null }>>(
    '/character/me',
  );
  if (!data.ok) return null;
  return data.data?.character ?? null;
}

export interface OnboardInput {
  name: string;
  sectKey: 'thanh_van' | 'huyen_thuy' | 'tu_la';
}

export async function onboard(input: OnboardInput): Promise<Character> {
  const { data } = await apiClient.post<Envelope<{ character: Character }>>(
    '/character/onboard',
    input,
  );
  if (!data.ok || !data.data) throw data.error ?? fallbackError('onboard');
  return data.data.character;
}

export interface PublicProfile {
  id: string;
  name: string;
  realmKey: string;
  realmStage: number;
  level: number;
  power: number;
  spirit: number;
  speed: number;
  luck: number;
  sectId: string | null;
  sectKey: string | null;
  sectName: string | null;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  createdAt: string;
}

export async function getPublicProfile(id: string): Promise<PublicProfile | null> {
  try {
    const { data } = await apiClient.get<Envelope<{ profile: PublicProfile }>>(
      `/character/profile/${id}`,
    );
    if (!data.ok || !data.data) return null;
    return data.data.profile;
  } catch {
    return null;
  }
}
