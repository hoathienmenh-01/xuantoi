import { apiClient } from './client';

export interface MailRewardItem {
  itemKey: string;
  qty: number;
}

export interface MailView {
  id: string;
  senderName: string;
  subject: string;
  body: string;
  rewardLinhThach: string;
  rewardTienNgoc: number;
  rewardExp: string;
  rewardItems: MailRewardItem[];
  readAt: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  claimable: boolean;
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

export async function listMail(): Promise<MailView[]> {
  const { data } = await apiClient.get<Envelope<{ mails: MailView[] }>>('/mail/me');
  return unwrap(data).mails;
}

export async function readMail(id: string): Promise<MailView> {
  const { data } = await apiClient.post<Envelope<{ mail: MailView }>>(
    `/mail/${encodeURIComponent(id)}/read`,
    {},
  );
  return unwrap(data).mail;
}

export async function claimMail(id: string): Promise<MailView> {
  const { data } = await apiClient.post<Envelope<{ mail: MailView }>>(
    `/mail/${encodeURIComponent(id)}/claim`,
    {},
  );
  return unwrap(data).mail;
}
