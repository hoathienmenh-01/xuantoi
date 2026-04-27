<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { getCharacter } from '@/api/character';

const auth = useAuthStore();
const router = useRouter();
const { t } = useI18n();

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  // Nếu chưa có character thì đẩy sang onboarding A Linh.
  const char = await getCharacter().catch(() => null);
  if (!char) router.replace('/onboarding');
});
</script>

<template>
  <div class="min-h-screen p-6">
    <header class="border-b border-ink-300/40 pb-3 mb-6 flex items-center justify-between">
      <h1 class="text-2xl tracking-widest">{{ t('app.title') }}</h1>
      <button
        class="text-sm text-ink-300 hover:text-ink-50"
        @click="auth.logout().then(() => router.push('/auth'))"
      >
        {{ t('home.logout') }}
      </button>
    </header>
    <main class="text-ink-100">
      <p class="text-ink-300">{{ t('home.wip') }}</p>
      <pre class="mt-4 text-xs text-ink-300 bg-ink-900/60 p-3 rounded">{{ auth.user }}</pre>
    </main>
  </div>
</template>
