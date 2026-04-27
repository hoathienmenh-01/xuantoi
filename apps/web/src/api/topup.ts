import type { TopupPackage } from '@xuantoi/shared';
import { apiClient } from './client';

export type { TopupPackage } from '@xuantoi/shared';

export interface TopupBank {
  bankName: string;
  accountName: string;
  accountNumber: string;
  noteHint: string;
}

export interface TopupOrderView {
  id: string;
  packageKey: string;
  packageName: string;
  tienNgocAmount: number;
  priceVND: number;
  transferCode: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
  createdAt: string;
  approvedAt: string | null;
  approvedByEmail: string | null;
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

export async function getTopupCatalog(): Promise<{ packages: TopupPackage[]; bank: TopupBank }> {
  const { data } = await apiClient.get<Envelope<{ packages: TopupPackage[]; bank: TopupBank }>>(
    '/topup/packages',
  );
  return unwrap(data);
}

export async function getMyTopups(): Promise<TopupOrderView[]> {
  const { data } = await apiClient.get<Envelope<{ orders: TopupOrderView[] }>>('/topup/me');
  return unwrap(data).orders;
}

export async function createTopupOrder(packageKey: string): Promise<TopupOrderView> {
  const { data } = await apiClient.post<Envelope<{ order: TopupOrderView }>>('/topup/create', {
    packageKey,
  });
  return unwrap(data).order;
}
