import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/spiritualRoot';

/**
 * Phase 11.3.D — server-authoritative Spiritual Root (Linh Căn) store.
 *
 * State mirror server `GET /character/spiritual-root`:
 *   - `state`: `SpiritualRootState | null` — null trước hydrate.
 *   - `loaded`: đã hydrate ít nhất 1 lần chưa.
 *   - `rerolling`: ref<boolean> — race-protect double-click reroll button.
 *
 * Action `reroll()`:
 *   - Server-authoritative — chờ response, refresh cache, không optimistic
 *     (server consume linh_can_dan + atomic transaction quyết định kết quả).
 *   - Trả về `null` (success) hoặc error code (string). Caller dùng để hiển
 *     thị toast i18n `spiritualRoot.reroll.errors.{code}`.
 */
export const useSpiritualRootStore = defineStore('spiritualRoot', () => {
  const state = ref<api.SpiritualRootState | null>(null);
  const loaded = ref(false);
  const rerolling = ref(false);

  async function fetchState(): Promise<void> {
    const next = await api.getSpiritualRootState();
    state.value = next;
    loaded.value = true;
  }

  /**
   * Server-authoritative reroll — consume 1× `linh_can_dan` qua server.
   * Returns error code (string) on failure, `null` on success. Callers
   * map code → toast i18n key `spiritualRoot.reroll.errors.{code}`.
   */
  async function reroll(): Promise<string | null> {
    if (rerolling.value) return 'IN_FLIGHT';
    rerolling.value = true;
    try {
      const next = await api.rerollSpiritualRoot();
      state.value = next;
      loaded.value = true;
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      return code;
    } finally {
      rerolling.value = false;
    }
  }

  function reset(): void {
    state.value = null;
    loaded.value = false;
    rerolling.value = false;
  }

  return {
    state,
    loaded,
    rerolling,
    fetchState,
    reroll,
    reset,
  };
});
