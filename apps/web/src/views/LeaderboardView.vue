<script setup lang="ts">
/**
 * Smart beta feature §9 — basic leaderboard.
 * GET /leaderboard/power → top N (mặc định 50) sort theo cảnh giới + power.
 */
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { realmByKey, fullRealmName } from '@xuantoi/shared';
import AppShell from '@/components/shell/AppShell.vue';
import SkeletonTable from '@/components/ui/SkeletonTable.vue';
import { fetchLeaderboardPower, type LeaderboardRow } from '@/api/leaderboard';

const { t } = useI18n();
const rows = ref<LeaderboardRow[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await fetchLeaderboardPower(50);
  } catch (e) {
    const code = (e as { code?: string })?.code ?? 'UNKNOWN';
    error.value = code;
  } finally {
    loading.value = false;
  }
}

function realmDisplay(realmKey: string, stage: number): string {
  const def = realmByKey(realmKey);
  if (!def) return realmKey;
  return fullRealmName(def, stage);
}

function sectName(key: LeaderboardRow['sectKey']): string {
  if (!key) return '—';
  return t(`shell.sect.${key}`);
}

onMounted(load);
</script>

<template>
  <AppShell>
    <section class="rounded border border-ink-300/40 bg-ink-700/30 p-5">
      <header class="mb-4 flex items-baseline justify-between gap-3">
        <h2 class="text-2xl tracking-widest">{{ t('leaderboard.title') }}</h2>
        <span class="text-xs text-ink-300">{{ t('leaderboard.subtitle') }}</span>
      </header>

      <SkeletonTable
        v-if="loading"
        :rows="10"
        :cols="5"
        test-id="leaderboard-skeleton"
      />
      <div v-else-if="error" class="py-8 text-center text-sm text-red-400">
        {{ t('leaderboard.error') }}
        <button
          type="button"
          class="ml-2 rounded border border-ink-300/40 px-2 py-0.5 text-[11px] uppercase tracking-widest hover:bg-ink-700/60"
          @click="load"
        >
          {{ t('leaderboard.retry') }}
        </button>
      </div>
      <div v-else-if="rows.length === 0" class="py-8 text-center text-sm text-ink-300">
        {{ t('leaderboard.empty') }}
      </div>
      <table v-else class="w-full text-sm" data-testid="leaderboard-table">
        <thead class="text-xs uppercase tracking-widest text-ink-300">
          <tr>
            <th class="py-2 pr-2 text-left w-12">#</th>
            <th class="py-2 pr-2 text-left">{{ t('leaderboard.col.name') }}</th>
            <th class="py-2 pr-2 text-left">{{ t('leaderboard.col.realm') }}</th>
            <th class="py-2 pr-2 text-left">{{ t('leaderboard.col.sect') }}</th>
            <th class="py-2 pr-2 text-right">{{ t('leaderboard.col.power') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.characterId"
            class="border-t border-ink-300/10 hover:bg-ink-700/40"
          >
            <td class="py-1.5 pr-2 font-mono">
              <span
                v-if="r.rank <= 3"
                class="inline-block rounded bg-amber-500/20 px-1.5 text-amber-200"
              >{{ r.rank }}</span>
              <span v-else>{{ r.rank }}</span>
            </td>
            <td class="py-1.5 pr-2 text-ink-50">{{ r.name }}</td>
            <td class="py-1.5 pr-2 text-ink-200">
              {{ realmDisplay(r.realmKey, r.realmStage) }}
            </td>
            <td class="py-1.5 pr-2 text-ink-300">{{ sectName(r.sectKey) }}</td>
            <td class="py-1.5 pr-2 text-right font-mono text-ink-50">
              {{ r.power.toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </AppShell>
</template>
