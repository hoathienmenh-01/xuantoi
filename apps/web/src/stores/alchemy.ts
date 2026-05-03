import { ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/alchemy';

/**
 * Phase 11.11.D — server-authoritative alchemy (Luyện Đan) store.
 *
 * State mirror server `GET /character/alchemy/recipes`:
 *   - `furnaceLevel`: Cấp lò luyện hiện tại (default 1).
 *   - `recipes`: Danh sách AlchemyRecipeView snapshot (filtered theo
 *     furnaceLevel ≤ furnace của char) từ server.
 *   - `loaded`: đã hydrate ít nhất 1 lần chưa (skeleton vs empty state).
 *   - `inFlight`: Set<recipeKey> đang craft (race-protect double-click + UI
 *     disable).
 *   - `lastOutcome`: outcome gần nhất từ POST /craft, dùng cho toast/UI.
 *
 * Action `craft(recipeKey)`:
 *   - Optimistic? KHÔNG. Server-authoritative — chờ response, refresh cache.
 *     Tránh state divergence nếu craft fail/insufficient ingredient race.
 *   - Trả về `null` (success) hoặc error code (string). Caller dùng để hiển
 *     thị toast i18n `alchemy.craft.errors.{code}`.
 *   - inFlight set/clear quanh request để UI disable button.
 */
export const useAlchemyStore = defineStore('alchemy', () => {
  const furnaceLevel = ref(1);
  const recipes = ref<api.AlchemyRecipeView[]>([]);
  const loaded = ref(false);
  const inFlight = ref<Set<string>>(new Set());
  const lastOutcome = ref<api.AlchemyOutcomeView | null>(null);

  function applyState(state: api.AlchemyState): void {
    furnaceLevel.value = state.furnaceLevel;
    recipes.value = state.recipes;
    loaded.value = true;
  }

  async function fetchState(): Promise<void> {
    const state = await api.getAlchemyRecipes();
    applyState(state);
  }

  function isCrafting(recipeKey: string): boolean {
    return inFlight.value.has(recipeKey);
  }

  /**
   * Server-authoritative craft. Returns error code (string) on failure,
   * `null` on success (regardless of outcome.success — fail outcome vẫn được
   * coi là "thành công gọi API", chỉ là RNG roll thất bại). Callers map code
   * → toast i18n key.
   */
  async function craft(recipeKey: string): Promise<string | null> {
    if (inFlight.value.has(recipeKey)) return 'IN_FLIGHT';
    const next = new Set(inFlight.value);
    next.add(recipeKey);
    inFlight.value = next;
    try {
      const result = await api.craftAlchemyRecipe(recipeKey);
      furnaceLevel.value = result.furnaceLevel;
      lastOutcome.value = result.outcome;
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      return code;
    } finally {
      const cleared = new Set(inFlight.value);
      cleared.delete(recipeKey);
      inFlight.value = cleared;
    }
  }

  function reset(): void {
    furnaceLevel.value = 1;
    recipes.value = [];
    loaded.value = false;
    inFlight.value = new Set();
    lastOutcome.value = null;
  }

  return {
    furnaceLevel,
    recipes,
    loaded,
    inFlight,
    lastOutcome,
    fetchState,
    isCrafting,
    craft,
    reset,
  };
});
