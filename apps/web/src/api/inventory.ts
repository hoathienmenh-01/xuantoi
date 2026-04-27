import { apiClient } from './client';
import type { EquipSlot, ItemDef } from '@xuantoi/shared';

export interface InventoryView {
  id: string;
  itemKey: string;
  qty: number;
  equippedSlot: EquipSlot | null;
  item: ItemDef;
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

export async function listInventory(): Promise<InventoryView[]> {
  const { data } = await apiClient.get<Envelope<{ items: InventoryView[] }>>('/inventory');
  return unwrap(data).items;
}

export async function equipItem(inventoryItemId: string): Promise<InventoryView[]> {
  const { data } = await apiClient.post<Envelope<{ items: InventoryView[] }>>(
    '/inventory/equip',
    { inventoryItemId },
  );
  return unwrap(data).items;
}

export async function unequipItem(slot: EquipSlot): Promise<InventoryView[]> {
  const { data } = await apiClient.post<Envelope<{ items: InventoryView[] }>>(
    '/inventory/unequip',
    { slot },
  );
  return unwrap(data).items;
}

export async function useItem(inventoryItemId: string): Promise<InventoryView[]> {
  const { data } = await apiClient.post<Envelope<{ items: InventoryView[] }>>(
    '/inventory/use',
    { inventoryItemId },
  );
  return unwrap(data).items;
}
