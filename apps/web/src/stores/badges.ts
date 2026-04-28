import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { getNextActions, type NextAction } from '@/api/nextAction';

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Aggregate badge counters derived from `/me/next-actions`. Used by sidebar
 * RouterLink badges. Read-only — refreshing is best-effort and silently fails
 * (badges simply hide). Single polling timer via start()/stop().
 */
export const useBadgesStore = defineStore('badges', () => {
  const actions = ref<NextAction[]>([]);
  const lastFetchAt = ref<number | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;

  const missionClaimable = computed<number>(() => {
    const a = actions.value.find((x) => x.key === 'MISSION_CLAIMABLE');
    if (!a) return 0;
    const c = Number(a.params.count ?? 0);
    return Number.isFinite(c) ? c : 0;
  });

  const mailUnclaimed = computed<number>(() => {
    const a = actions.value.find((x) => x.key === 'MAIL_UNCLAIMED');
    if (!a) return 0;
    const c = Number(a.params.count ?? 0);
    return Number.isFinite(c) ? c : 0;
  });

  const bossActive = computed<boolean>(() =>
    actions.value.some((x) => x.key === 'BOSS_ACTIVE'),
  );

  const topupPending = computed<boolean>(() =>
    actions.value.some((x) => x.key === 'TOPUP_PENDING'),
  );

  const breakthroughReady = computed<boolean>(() =>
    actions.value.some((x) => x.key === 'BREAKTHROUGH_READY'),
  );

  async function refresh(): Promise<void> {
    try {
      actions.value = await getNextActions();
      lastFetchAt.value = Date.now();
    } catch {
      // silent — badges are non-critical
    }
  }

  function start(): void {
    if (timer) return;
    void refresh();
    timer = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    actions,
    lastFetchAt,
    missionClaimable,
    mailUnclaimed,
    bossActive,
    topupPending,
    breakthroughReady,
    refresh,
    start,
    stop,
  };
});
