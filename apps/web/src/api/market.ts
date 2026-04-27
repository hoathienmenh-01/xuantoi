import { apiClient } from './client';
import type { ItemDef, ItemKind } from '@xuantoi/shared';

export type ListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';

export interface ListingView {
  id: string;
  sellerId: string;
  sellerName: string;
  itemKey: string;
  qty: number;
  pricePerUnit: string;
  totalPrice: string;
  status: ListingStatus;
  createdAt: string;
  item: ItemDef;
  isMine: boolean;
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

export async function listMarket(
  kind?: ItemKind,
): Promise<{ listings: ListingView[]; feePct: number }> {
  const { data } = await apiClient.get<Envelope<{ listings: ListingView[]; feePct: number }>>(
    '/market/listings',
    { params: kind ? { kind } : undefined },
  );
  return unwrap(data);
}

export async function listMine(): Promise<ListingView[]> {
  const { data } = await apiClient.get<Envelope<{ listings: ListingView[] }>>('/market/mine');
  return unwrap(data).listings;
}

export async function postListing(
  inventoryItemId: string,
  qty: number,
  pricePerUnit: string,
): Promise<ListingView> {
  const { data } = await apiClient.post<Envelope<{ listing: ListingView }>>('/market/post', {
    inventoryItemId,
    qty,
    pricePerUnit,
  });
  return unwrap(data).listing;
}

export async function buyListing(id: string): Promise<ListingView> {
  const { data } = await apiClient.post<Envelope<{ listing: ListingView }>>(
    `/market/${id}/buy`,
    {},
  );
  return unwrap(data).listing;
}

export async function cancelListing(id: string): Promise<ListingView> {
  const { data } = await apiClient.post<Envelope<{ listing: ListingView }>>(
    `/market/${id}/cancel`,
    {},
  );
  return unwrap(data).listing;
}
