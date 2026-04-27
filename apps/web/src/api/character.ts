import { apiClient } from './client';

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
  if (!data.ok || !data.data) throw data.error ?? new Error('Onboard thất bại');
  return data.data.character;
}
