import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/cultivationMethod';

/**
 * Phase 11.1.C — server-authoritative Cultivation Method (Công Pháp) store.
 *
 * State mirror server `GET /character/cultivation-method`:
 *   - `equippedMethodKey`: Key của method đang equip (hoặc null).
 *   - `learned`: Danh sách method đã học (key + source + learnedAt).
 *   - `loaded`: đã hydrate ít nhất 1 lần chưa.
 *   - `inFlight`: Set<methodKey> đang equip — race-protect double-click.
 *
 * Action `equip(methodKey)`:
 *   - Server-authoritative — chờ response, refresh cache, không optimistic.
 *   - Trả về `null` (success) hoặc error code (string). Caller dùng để hiển
 *     thị toast i18n `cultivationMethod.equip.errors.{code}`.
 *   - `inFlight` set/clear quanh request để UI disable button.
 *
 * KHÔNG có `learn` action — Phase 11.1.C scope chỉ expose `equip` (method
 * `learn` defer Phase 11.1.D khi có drop table mission/dungeon).
 */
export const useCultivationMethodStore = defineStore('cultivationMethod', () => {
  const equippedMethodKey = ref<string | null>(null);
  const learned = ref<api.CultivationMethodLearnedRow[]>([]);
  const loaded = ref(false);
  const inFlight = ref<Set<string>>(new Set());

  function applyState(state: api.CultivationMethodState): void {
    equippedMethodKey.value = state.equippedMethodKey;
    learned.value = state.learned;
    loaded.value = true;
  }

  async function fetchState(): Promise<void> {
    const state = await api.getCultivationMethodState();
    applyState(state);
  }

  function isEquipping(methodKey: string): boolean {
    return inFlight.value.has(methodKey);
  }

  function isEquipped(methodKey: string): boolean {
    return equippedMethodKey.value === methodKey;
  }

  /**
   * Server-authoritative equip. Returns error code (string) on failure,
   * `null` on success. Callers map code → toast i18n key.
   */
  async function equip(methodKey: string): Promise<string | null> {
    if (inFlight.value.has(methodKey)) return 'IN_FLIGHT';
    if (equippedMethodKey.value === methodKey) return 'ALREADY_EQUIPPED';
    const next = new Set(inFlight.value);
    next.add(methodKey);
    inFlight.value = next;
    try {
      const state = await api.equipCultivationMethod(methodKey);
      applyState(state);
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      return code;
    } finally {
      const cleared = new Set(inFlight.value);
      cleared.delete(methodKey);
      inFlight.value = cleared;
    }
  }

  function reset(): void {
    equippedMethodKey.value = null;
    learned.value = [];
    loaded.value = false;
    inFlight.value = new Set();
  }

  return {
    equippedMethodKey,
    learned,
    loaded,
    inFlight,
    fetchState,
    isEquipping,
    isEquipped,
    equip,
    reset,
  };
});
