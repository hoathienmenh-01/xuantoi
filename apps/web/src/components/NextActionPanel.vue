<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getNextActions, type NextAction } from '@/api/nextAction';

const { t } = useI18n();
const router = useRouter();

const actions = ref<NextAction[]>([]);
const loading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  try {
    actions.value = await getNextActions();
  } catch {
    actions.value = [];
  } finally {
    loading.value = false;
  }
}

defineExpose({ refresh: load });

onMounted(load);

function priorityClass(p: number): string {
  // 1 → đỏ rực (cấp thiết). 2-3 → vàng/cam (nên làm). 4-5 → xám (gợi ý mềm).
  if (p <= 1) return 'border-rose-500/60 bg-rose-500/10';
  if (p <= 3) return 'border-amber-500/50 bg-amber-500/10';
  return 'border-ink-300/40 bg-ink-700/30';
}

function actionLabel(a: NextAction): string {
  return t(`home.nextAction.items.${a.key}`, a.params);
}
</script>

<template>
  <section
    v-if="actions.length > 0 || loading"
    class="rounded border border-ink-300/40 bg-ink-700/30 p-4"
  >
    <h3 class="text-sm tracking-widest text-ink-300 uppercase mb-3">
      {{ t('home.nextAction.title') }}
    </h3>
    <p v-if="loading && actions.length === 0" class="text-xs text-ink-300">
      {{ t('home.nextAction.loading') }}
    </p>
    <ul v-else class="space-y-2">
      <li
        v-for="a in actions"
        :key="a.key"
        class="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
        :class="priorityClass(a.priority)"
      >
        <span class="flex-1">{{ actionLabel(a) }}</span>
        <button
          type="button"
          class="shrink-0 rounded border border-ink-300/40 px-3 py-1 text-xs uppercase tracking-widest hover:bg-ink-300/10"
          @click="router.push(a.route)"
        >
          {{ t('home.nextAction.go') }}
        </button>
      </li>
    </ul>
  </section>
</template>
