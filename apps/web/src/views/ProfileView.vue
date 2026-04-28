<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { getPublicProfile, type PublicProfile } from '@/api/character';
import AppShell from '@/components/shell/AppShell.vue';

const auth = useAuthStore();
const game = useGameStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const profile = ref<PublicProfile | null>(null);
const loading = ref(true);
const notFound = ref(false);

async function load(id: string): Promise<void> {
  loading.value = true;
  notFound.value = false;
  const p = await getPublicProfile(id);
  if (!p) {
    notFound.value = true;
    profile.value = null;
  } else {
    profile.value = p;
  }
  loading.value = false;
}

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  const id = String(route.params.id ?? '');
  if (!id) {
    notFound.value = true;
    loading.value = false;
    return;
  }
  await load(id);
});

watch(
  () => route.params.id,
  async (newId) => {
    if (typeof newId === 'string' && newId) await load(newId);
  },
);
</script>

<template>
  <AppShell>
    <div class="max-w-2xl mx-auto space-y-4">
      <header>
        <h1 class="text-2xl tracking-widest font-bold">{{ t('profile.title') }}</h1>
      </header>

      <div v-if="loading" class="text-ink-300 text-sm">{{ t('common.loading') }}</div>

      <div
        v-else-if="notFound"
        class="bg-ink-700/30 border border-ink-300/20 rounded p-6 text-center text-ink-300"
      >
        {{ t('profile.notFound') }}
      </div>

      <template v-else-if="profile">
        <section class="bg-ink-700/30 border border-ink-300/20 rounded p-4 space-y-2">
          <div class="flex items-baseline justify-between gap-2">
            <div>
              <h2 class="text-xl text-amber-200">{{ profile.name }}</h2>
              <p class="text-xs text-ink-300">
                {{ t('profile.realm', { realm: profile.realmKey, stage: profile.realmStage }) }}
                · Lv.{{ profile.level }}
              </p>
            </div>
            <span
              v-if="profile.role !== 'PLAYER'"
              class="px-2 py-0.5 rounded text-xs"
              :class="profile.role === 'ADMIN' ? 'bg-amber-700/40 text-amber-200' : 'bg-blue-700/40 text-blue-200'"
            >
              {{ profile.role }}
            </span>
          </div>
          <div v-if="profile.sectName" class="text-sm text-ink-200">
            {{ t('profile.sect') }}: <span class="text-amber-100">{{ profile.sectName }}</span>
          </div>
          <div class="text-xs text-ink-300">
            {{ t('profile.joinedAt') }}: {{ new Date(profile.createdAt).toLocaleDateString() }}
          </div>
        </section>

        <section class="bg-ink-700/30 border border-ink-300/20 rounded p-4">
          <h3 class="text-amber-200 mb-2">{{ t('profile.stats') }}</h3>
          <dl class="grid grid-cols-2 gap-2 text-sm">
            <dt class="text-ink-300">{{ t('profile.power') }}</dt>
            <dd>{{ profile.power }}</dd>
            <dt class="text-ink-300">{{ t('profile.spirit') }}</dt>
            <dd>{{ profile.spirit }}</dd>
            <dt class="text-ink-300">{{ t('profile.speed') }}</dt>
            <dd>{{ profile.speed }}</dd>
            <dt class="text-ink-300">{{ t('profile.luck') }}</dt>
            <dd>{{ profile.luck }}</dd>
          </dl>
        </section>
      </template>
    </div>
  </AppShell>
</template>
