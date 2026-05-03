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

// ====================================================================
// Phase 11.4.C — Gem socket / unsocket / combine API
// ====================================================================

/** Phase 11.4.C — `/character/gem/socket` response envelope. */
export interface GemSocketResult {
  equipmentInventoryItemId: string;
  gemKey: string;
  slotIndex: number;
  sockets: string[];
}

/** Phase 11.4.C — `/character/gem/unsocket` response envelope. */
export interface GemUnsocketResult {
  equipmentInventoryItemId: string;
  gemKey: string;
  sockets: string[];
  /**
   * `false` nếu gem catalog drift — gemKey trong DB không còn trong catalog
   * → service vẫn cho gỡ nhưng không grant lại để tránh restore item invalid.
   */
  gemReturned: boolean;
}

/**
 * Phase 11.4.C — `/character/gem/combine` response envelope.
 * Trùng pattern với `GemCombineResultOut` của `apps/api/.../gem.service.ts`,
 * KHÔNG nhầm với `GemCombineResult` của `@xuantoi/shared` (catalog type).
 */
export interface GemCombineApiResult {
  srcGemKey: string;
  srcQtyConsumed: 3;
  resultGemKey: string;
  resultQtyGained: 1;
}

/**
 * Phase 11.4.C — POST `/character/gem/socket`. Server-authoritative socket
 * 1× gem vào equipment slot kế tiếp. Caller phải re-fetch `listInventory()`
 * để cập nhật equipment.sockets[] + gem qty inventory.
 */
export async function socketGem(
  equipmentInventoryItemId: string,
  gemKey: string,
): Promise<GemSocketResult> {
  const { data } = await apiClient.post<Envelope<{ socket: GemSocketResult }>>(
    '/character/gem/socket',
    { equipmentInventoryItemId, gemKey },
  );
  return unwrap(data).socket;
}

/**
 * Phase 11.4.C — POST `/character/gem/unsocket`. Gỡ gem khỏi 1 slot, gem
 * qty về inventory unequipped row. Caller phải re-fetch `listInventory()`.
 */
export async function unsocketGem(
  equipmentInventoryItemId: string,
  slotIndex: number,
): Promise<GemUnsocketResult> {
  const { data } = await apiClient.post<Envelope<{ unsocket: GemUnsocketResult }>>(
    '/character/gem/unsocket',
    { equipmentInventoryItemId, slotIndex },
  );
  return unwrap(data).unsocket;
}

/**
 * Phase 11.4.C — POST `/character/gem/combine`. Combine 3× gem cùng key
 * thành 1× gem next-tier (deterministic). THAN tier không combine.
 */
export async function combineGemsApi(srcGemKey: string): Promise<GemCombineApiResult> {
  const { data } = await apiClient.post<Envelope<{ combine: GemCombineApiResult }>>(
    '/character/gem/combine',
    { srcGemKey },
  );
  return unwrap(data).combine;
}
