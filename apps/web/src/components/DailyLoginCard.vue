<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToastStore } from '@/stores/toast';
import {
  claimDailyLogin,
  getDailyLoginStatus,
  type DailyLoginStatus,
} from '@/api/dailyLogin';

const { t } = useI18n();
const toast = useToastStore();

const status = ref<DailyLoginStatus | null>(null);
const claiming = ref(false);

async function load(): Promise<void> {
  status.value = await getDailyLoginStatus().catch(() => null);
}

async function claim(): Promise<void> {
  if (!status.value || !status.value.canClaimToday) return;
  claiming.value = true;
  try {
    const r = await claimDailyLogin();
    if (!r) return;
    if (r.claimed) {
      toast.push({
        type: 'success',
        text: t('home.dailyLogin.successToast', {
          amount: r.linhThachDelta,
          streak: r.newStreak,
        }),
      });
    } else {
      toast.push({ type: 'system', text: t('home.dailyLogin.alreadyClaimedToast') });
    }
    await load();
  } finally {
    claiming.value = false;
  }
}

defineExpose({ refresh: load });

onMounted(load);
</script>

<template>
  <section
    v-if="status"
    class="rounded border border-amber-500/40 bg-amber-500/10 p-4"
    data-testid="daily-login-card"
  >
    <header class="mb-2 flex items-center justify-between">
      <h3 class="text-sm tracking-widest uppercase">
        {{ t('home.dailyLogin.title') }}
      </h3>
      <span v-if="status.currentStreak > 0" class="text-xs text-ink-300">
        × {{ status.currentStreak }}
      </span>
    </header>
    <p v-if="status.canClaimToday" class="text-sm">
      {{ t('home.dailyLogin.availableHint', { amount: status.nextRewardLinhThach }) }}
    </p>
    <p v-else class="text-sm text-ink-300">
      {{ t('home.dailyLogin.claimedHint', { streak: status.currentStreak }) }}
    </p>
    <button
      v-if="status.canClaimToday"
      type="button"
      :disabled="claiming"
      class="mt-3 rounded border border-amber-500/60 px-3 py-1 text-xs uppercase tracking-widest hover:bg-amber-500/20 disabled:opacity-50"
      data-testid="daily-login-claim-btn"
      @click="claim"
    >
      {{ claiming ? t('home.dailyLogin.claiming') : t('home.dailyLogin.claim') }}
    </button>
  </section>
</template>
