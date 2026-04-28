<script setup lang="ts">
/**
 * Smart onboarding checklist (§1 prompt user).
 *
 * 4 step derived từ `game.character` — KHÔNG cần backend tracking riêng:
 *   1. Đã tạo nhân vật.
 *   2. Đã chọn tông môn (`sectKey != null`).
 *   3. Đã nhập định (`cultivating === true`).
 *   4. Đã đột phá lần đầu (`realmKey !== 'phamnhan'` hoặc `realmStage > 0`).
 *
 * Tự ẩn khi tất cả 4 step done (declutter cho veteran). Mỗi step có route
 * dẫn tới chỗ thực hiện — click → `router.push`.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useGameStore } from '@/stores/game';

interface Step {
  key: 'character' | 'sect' | 'cultivate' | 'breakthrough';
  done: boolean;
  route: string;
}

const game = useGameStore();
const router = useRouter();
const { t } = useI18n();

const steps = computed<Step[]>(() => {
  const c = game.character;
  return [
    {
      key: 'character',
      done: c !== null,
      route: '/onboarding',
    },
    {
      key: 'sect',
      done: c?.sectKey != null,
      route: '/sect',
    },
    {
      key: 'cultivate',
      done: c?.cultivating === true,
      route: '/',
    },
    {
      key: 'breakthrough',
      done:
        c !== null &&
        (c.realmKey !== 'phamnhan' || c.realmStage > 0),
      route: '/',
    },
  ];
});

const allDone = computed(() => steps.value.every((s) => s.done));
const completedCount = computed(() => steps.value.filter((s) => s.done).length);
</script>

<template>
  <section
    v-if="!allDone"
    class="rounded border border-amber-500/40 bg-amber-500/5 p-4"
    data-testid="onboarding-checklist"
  >
    <div class="mb-3 flex items-baseline justify-between gap-2">
      <h3 class="text-sm tracking-widest text-amber-200 uppercase">
        {{ t('home.onboarding.title') }}
      </h3>
      <span class="text-xs text-ink-300 font-mono">
        {{ completedCount }}/{{ steps.length }}
      </span>
    </div>
    <ul class="space-y-1.5">
      <li
        v-for="s in steps"
        :key="s.key"
        class="flex items-center justify-between gap-3 text-sm"
        :class="s.done ? 'text-ink-300/70' : 'text-ink-50'"
      >
        <span class="flex items-center gap-2">
          <span
            class="inline-block w-4 text-center"
            :class="s.done ? 'text-emerald-400' : 'text-amber-400'"
          >{{ s.done ? '✓' : '○' }}</span>
          <span :class="{ 'line-through opacity-60': s.done }">
            {{ t(`home.onboarding.steps.${s.key}`) }}
          </span>
        </span>
        <button
          v-if="!s.done"
          type="button"
          class="shrink-0 rounded border border-amber-500/40 px-2 py-0.5 text-[11px] uppercase tracking-widest hover:bg-amber-500/10"
          @click="router.push(s.route)"
        >
          {{ t('home.onboarding.go') }}
        </button>
      </li>
    </ul>
  </section>
</template>
