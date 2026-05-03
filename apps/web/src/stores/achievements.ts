import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/achievements';

/**
 * Phase 11.10.E — server-authoritative Achievement (Thành Tựu) store.
 *
 * State mirror server `GET /character/achievements`:
 *   - `rows`: full list (catalog merge với progress/completedAt/claimedAt).
 *   - `loaded`: đã hydrate ít nhất 1 lần.
 *   - `inFlight`: Set<achievementKey> đang claim — race-protect double-click.
 *   - `lastClaim`: result của claim mới nhất (cho UI hiển thị reward toast).
 *
 * Action `claim(achievementKey)`:
 *   - Server-authoritative — chờ response, refresh row trong rows[], không
 *     optimistic.
 *   - Trả về `null` (success) hoặc error code. Caller map code → toast i18n
 *     key `achievements.claim.errors.{code}`.
 *   - Pre-check `IN_FLIGHT` + `ALREADY_CLAIMED` (skip API call).
 *   - Pre-check `NOT_COMPLETED` (skip API call) khi row chưa complete.
 *
 * Computed `completedCount` / `claimableCount` cho UI badge.
 */
export const useAchievementsStore = defineStore('achievements', () => {
  const rows = ref<api.AchievementRow[]>([]);
  const loaded = ref(false);
  const inFlight = ref<Set<string>>(new Set());
  const lastClaim = ref<api.AchievementClaimResult | null>(null);

  function applyRows(next: api.AchievementRow[]): void {
    rows.value = next;
    loaded.value = true;
  }

  async function fetchState(): Promise<void> {
    const list = await api.getAchievementsState();
    applyRows(list);
  }

  function isClaiming(achievementKey: string): boolean {
    return inFlight.value.has(achievementKey);
  }

  function findRow(achievementKey: string): api.AchievementRow | undefined {
    return rows.value.find((r) => r.achievementKey === achievementKey);
  }

  const completedCount = computed(
    () => rows.value.filter((r) => r.completedAt !== null).length,
  );
  const claimableCount = computed(
    () =>
      rows.value.filter(
        (r) => r.completedAt !== null && r.claimedAt === null,
      ).length,
  );

  /**
   * Server-authoritative claim. Returns error code (string) on failure,
   * `null` on success. Callers map code → toast i18n key.
   */
  async function claim(achievementKey: string): Promise<string | null> {
    if (inFlight.value.has(achievementKey)) return 'IN_FLIGHT';
    const row = findRow(achievementKey);
    if (row && row.claimedAt !== null) return 'ALREADY_CLAIMED';
    if (row && row.completedAt === null) return 'NOT_COMPLETED';
    const next = new Set(inFlight.value);
    next.add(achievementKey);
    inFlight.value = next;
    try {
      const result = await api.claimAchievement(achievementKey);
      lastClaim.value = result;
      // Patch row in place: set claimedAt từ server response.
      const idx = rows.value.findIndex(
        (r) => r.achievementKey === achievementKey,
      );
      if (idx !== -1) {
        const patched = [...rows.value];
        patched[idx] = { ...patched[idx], claimedAt: result.claimedAt };
        rows.value = patched;
      }
      return null;
    } catch (e) {
      const code =
        (e as { code?: string }).code ??
        (e as { error?: { code?: string } }).error?.code ??
        'UNKNOWN';
      return code;
    } finally {
      const cleared = new Set(inFlight.value);
      cleared.delete(achievementKey);
      inFlight.value = cleared;
    }
  }

  function reset(): void {
    rows.value = [];
    loaded.value = false;
    inFlight.value = new Set();
    lastClaim.value = null;
  }

  return {
    rows,
    loaded,
    inFlight,
    lastClaim,
    completedCount,
    claimableCount,
    fetchState,
    isClaiming,
    findRow,
    claim,
    reset,
  };
});
