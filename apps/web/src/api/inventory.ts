import { apiClient } from './client';
import type { EquipSlot, ItemDef } from '@xuantoi/shared';

export interface InventoryView {
  id: string;
  itemKey: string;
  qty: number;
  equippedSlot: EquipSlot | null;
  item: ItemDef;
  /** Phase 11.4.B Gem MVP — danh sách gemKey đã khảm theo thứ tự slot. */
  sockets: string[];
  /** Phase 11.5.B Refine MVP — cấp luyện khí 0..15. */
  refineLevel: number;
}

/**
 * Phase 11.5.C — Refine attempt result envelope (sub-set của
 * `RefineAttemptOutcome` của API). Dùng cho UI toast Luyện Khí.
 */
export interface RefineResult {
  equipmentInventoryItemId: string;
  attemptLevel: number;
  result: {
    success: boolean;
    nextLevel: number;
    broken: boolean;
    protectionConsumed: boolean;
  };
  finalLevel: number | null;
  broken: boolean;
  linhThachCost: number;
  materialKey: string;
  materialQty: number;
  protectionConsumed: boolean;
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

/**
 * Phase 11.5.C — POST `/character/refine`. Server-authoritative refine
 * attempt, deterministic RNG (seedrandom future). Trả `RefineResult` cho UI
 * toast (success +1 / fail risky -1 / fail extreme break / protection consumed).
 *
 * Caller phải re-fetch `listInventory()` sau khi success để cập nhật refineLevel
 * + bonus stat (UI không tự cộng, server-authoritative).
 */
export async function refineEquipment(
  equipmentInventoryItemId: string,
  useProtection: boolean,
): Promise<RefineResult> {
  const { data } = await apiClient.post<Envelope<{ refine: RefineResult }>>(
    '/character/refine',
    { equipmentInventoryItemId, useProtection },
  );
  return unwrap(data).refine;
}
