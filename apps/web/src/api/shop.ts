import { apiClient } from './client';

export interface ShopEntry {
  itemKey: string;
  name: string;
  description: string;
  kind: string;
  quality: string;
  price: number;
  currency: 'LINH_THACH' | 'TIEN_NGOC';
  stackable: boolean;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function listNpcShop(): Promise<ShopEntry[]> {
  const { data } = await apiClient.get<Envelope<{ entries: ShopEntry[] }>>('/shop/npc');
  if (!data.ok || !data.data) throw data.error ?? new Error('Lấy shop thất bại');
  return data.data.entries;
}

export interface ShopBuyResult {
  itemKey: string;
  qty: number;
  totalPrice: number;
  currency: 'LINH_THACH' | 'TIEN_NGOC';
}

export async function buyFromShop(
  itemKey: string,
  qty: number,
): Promise<ShopBuyResult> {
  const { data } = await apiClient.post<Envelope<ShopBuyResult>>('/shop/buy', {
    itemKey,
    qty,
  });
  if (!data.ok || !data.data) throw data.error ?? new Error('Mua thất bại');
  return data.data;
}
