<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
  }
});
</script>

<template>
  <div class="min-h-screen p-6">
    <header class="border-b border-ink-300/40 pb-3 mb-6 flex items-center justify-between">
      <h1 class="text-2xl tracking-widest">Xuân Tôi · Đạo Môn</h1>
      <button
        class="text-sm text-ink-300 hover:text-ink-50"
        @click="auth.logout().then(() => router.push('/auth'))"
      >
        Xuất Quan
      </button>
    </header>
    <main class="text-ink-100">
      <p class="text-ink-300">
        Game shell sẽ được thi công ở Phase 2 — bao gồm Topbar, Sidebar, ChatDock và GameHome.
      </p>
      <pre class="mt-4 text-xs text-ink-300 bg-ink-900/60 p-3 rounded">{{
        auth.user
      }}</pre>
    </main>
  </div>
</template>
