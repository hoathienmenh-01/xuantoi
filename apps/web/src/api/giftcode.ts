import { apiClient } from './client';

export interface GiftCodeRewardItem {
  itemKey: string;
  qty: number;
}

export interface GiftCodeRedeemResult {
  code: string;
  grantedLinhThach: string;
  grantedTienNgoc: number;
  grantedExp: string;
  grantedItems: GiftCodeRewardItem[];
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

export async function redeemGiftCode(code: string): Promise<GiftCodeRedeemResult> {
  const { data } = await apiClient.post<Envelope<{ reward: GiftCodeRedeemResult }>>(
    '/giftcodes/redeem',
    { code },
  );
  return unwrap(data).reward;
}
