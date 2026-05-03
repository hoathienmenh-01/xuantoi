import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as api from '@/api/skill';

/**
 * Phase 11.2.C — server-authoritative Skill Book store.
 *
 * State mirror `GET /character/skill`:
 *   - `maxEquipped`: cap server (`MAX_EQUIPPED_SKILLS`, hiện 4).
 *   - `learned`: list `SkillView` (skillKey + tier + masteryLevel + isEquipped
 *     + effective + nextLevelCost...).
 *   - `loaded`: đã hydrate ít nhất 1 lần chưa.
 *   - `inFlight`: Set<skillKey> đang gọi equip/unequip/upgrade — race-protect.
 *
 * Action `equip / unequip / upgradeMastery`:
 *   - Server-authoritative: chờ response, refresh cache, KHÔNG optimistic.
 *   - Trả về `null` (success) hoặc error code (string). Caller dùng cho
 *     toast i18n key `skillBook.errors.{code}`.
 *   - `inFlight` set/clear quanh request để UI disable button.
 *
 * KHÔNG có `learn` action — Phase 11.2.C scope chỉ expose equip/unequip/
 * upgradeMastery (skill drop/consume via ItemLedger defer Phase 11.2.D).
 */
export const useSkillStore = defineStore('skill', () => {
  const maxEquipped = ref<number>(4);
  const learned = ref<api.SkillView[]>([]);
  const loaded = ref(false);
  const inFlight = ref<Set<string>>(new Set());

  function applyState(state: api.SkillState): void {
    maxEquipped.value = state.maxEquipped;
    learned.value = state.learned;
    loaded.value = true;
  }

  async function fetchState(): Promise<void> {
    const state = await api.getSkillState();
    applyState(state);
  }

  function isInFlight(skillKey: string): boolean {
    return inFlight.value.has(skillKey);
  }

  const equippedCount = computed(() =>
    learned.value.filter((s) => s.isEquipped).length,
  );

  function extractCode(e: unknown): string {
    return (
      (e as { code?: string }).code ??
      (e as { error?: { code?: string } }).error?.code ??
      'UNKNOWN'
    );
  }

  function withInFlight<T>(
    skillKey: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const next = new Set(inFlight.value);
    next.add(skillKey);
    inFlight.value = next;
    return fn().finally(() => {
      const cleared = new Set(inFlight.value);
      cleared.delete(skillKey);
      inFlight.value = cleared;
    });
  }

  async function equip(skillKey: string): Promise<string | null> {
    if (inFlight.value.has(skillKey)) return 'IN_FLIGHT';
    return withInFlight(skillKey, async () => {
      try {
        const state = await api.equipSkill(skillKey);
        applyState(state);
        return null;
      } catch (e) {
        return extractCode(e);
      }
    });
  }

  async function unequip(skillKey: string): Promise<string | null> {
    if (inFlight.value.has(skillKey)) return 'IN_FLIGHT';
    return withInFlight(skillKey, async () => {
      try {
        const state = await api.unequipSkill(skillKey);
        applyState(state);
        return null;
      } catch (e) {
        return extractCode(e);
      }
    });
  }

  async function upgradeMastery(skillKey: string): Promise<string | null> {
    if (inFlight.value.has(skillKey)) return 'IN_FLIGHT';
    return withInFlight(skillKey, async () => {
      try {
        await api.upgradeSkillMastery(skillKey);
        // Refresh full state to pick up new mastery + effective + cost.
        await fetchState();
        return null;
      } catch (e) {
        return extractCode(e);
      }
    });
  }

  function reset(): void {
    maxEquipped.value = 4;
    learned.value = [];
    loaded.value = false;
    inFlight.value = new Set();
  }

  return {
    maxEquipped,
    learned,
    loaded,
    inFlight,
    equippedCount,
    fetchState,
    isInFlight,
    equip,
    unequip,
    upgradeMastery,
    reset,
  };
});
