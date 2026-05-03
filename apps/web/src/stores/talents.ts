import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/talents';

/**
 * Phase 11.X.AT — server-authoritative talent learn store.
 *
 * State mirror server `GET /character/talents/state`:
 *   - `learned`: Map<talentKey, ISO learnedAt> — set của talent đã học.
 *   - `spent`: Số ngộ-đạo điểm đã spent (sum talentPointCost từ rows learned).
 *   - `remaining`: budget - spent (cached, server-authoritative).
 *   - `budget`: spent + remaining (derived khi fetch state).
 *   - `loaded`: đã hydrate ít nhất 1 lần chưa (dùng để skeleton vs empty).
 *   - `inFlight`: Set<talentKey> đang gọi learn (race-protect double-click +
 *     UI disable).
 *
 * Action `learn(talentKey)`:
 *   - Optimistic? KHÔNG. Server-authoritative — chờ response, refresh cache.
 *     Tránh state divergence nếu server reject (ALREADY_LEARNED race).
 *   - Trả về error code (string) hoặc null (success). Caller dùng để hiển thị
 *     toast i18n `talents.learn.errors.{code}`.
 *   - inFlight set/clear quanh request để UI disable button.
 */
export const useTalentsStore = defineStore('talents', () => {
  const learned = ref<Map<string, string>>(new Map());
  const spent = ref(0);
  const remaining = ref(0);
  const budget = ref(0);
  const loaded = ref(false);
  const inFlight = ref<Set<string>>(new Set());

  const isLearned = computed(() => (talentKey: string) =>
    learned.value.has(talentKey),
  );

  const isLearning = computed(() => (talentKey: string) =>
    inFlight.value.has(talentKey),
  );

  function applyState(state: api.TalentsState): void {
    const next = new Map<string, string>();
    for (const row of state.learned) {
      next.set(row.talentKey, row.learnedAt);
    }
    learned.value = next;
    spent.value = state.spent;
    remaining.value = state.remaining;
    budget.value = state.budget;
    loaded.value = true;
  }

  async function fetchState(): Promise<void> {
    const state = await api.getTalentsState();
    applyState(state);
  }

  /**
   * Server-authoritative learn. Returns error code (string) on failure, null
   * on success. Callers map code → toast i18n key.
   */
  async function learn(talentKey: string): Promise<string | null> {
    if (inFlight.value.has(talentKey)) return 'IN_FLIGHT';
    const next = new Set(inFlight.value);
    next.add(talentKey);
    inFlight.value = next;
    try {
      const result = await api.learnTalent(talentKey);
      const newLearned = new Map(learned.value);
      newLearned.set(result.learn.talentKey, result.learn.learnedAt);
      learned.value = newLearned;
      remaining.value = result.remaining;
      // budget invariant: budget = spent + remaining → spent = budget - remaining.
      // Khi learn xong server đã trừ điểm, ta compute spent từ budget cố định.
      spent.value = Math.max(0, budget.value - result.remaining);
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      return code;
    } finally {
      const cleared = new Set(inFlight.value);
      cleared.delete(talentKey);
      inFlight.value = cleared;
    }
  }

  function reset(): void {
    learned.value = new Map();
    spent.value = 0;
    remaining.value = 0;
    budget.value = 0;
    loaded.value = false;
    inFlight.value = new Set();
  }

  return {
    learned,
    spent,
    remaining,
    budget,
    loaded,
    inFlight,
    isLearned,
    isLearning,
    fetchState,
    learn,
    reset,
  };
});
