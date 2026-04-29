import { apiClient } from './client';

export type NextActionKey =
  | 'NO_CHARACTER'
  | 'BREAKTHROUGH_READY'
  | 'MISSION_CLAIMABLE'
  | 'DAILY_LOGIN_AVAILABLE'
  | 'MAIL_UNCLAIMED'
  | 'MAIL_UNREAD'
  | 'BOSS_ACTIVE'
  | 'TOPUP_PENDING'
  | 'CULTIVATE_IDLE';

export interface NextAction {
  key: NextActionKey;
  priority: number;
  params: Record<string, string | number>;
  route: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function getNextActions(): Promise<NextAction[]> {
  const { data } = await apiClient.get<Envelope<{ actions: NextAction[] }>>(
    '/me/next-actions',
  );
  if (!data.ok || !data.data) return [];
  return data.data.actions;
}
