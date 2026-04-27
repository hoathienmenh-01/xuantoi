<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useRouter } from 'vue-router';

const { t } = useI18n();
const auth = useAuthStore();
const game = useGameStore();
const router = useRouter();

const expPct = computed(() => Math.round(game.expProgress * 100));
const realmText = computed(() => game.realmFullName || '—');
const cultivating = computed(() => game.character?.cultivating ?? false);

async function logout(): Promise<void> {
  await auth.logout();
  router.push('/auth');
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-ink-900 text-ink-100">
    <!-- Topbar -->
    <header
      class="h-14 flex items-center gap-4 px-4 border-b border-ink-300/40 bg-ink-700/60 backdrop-blur"
    >
      <div class="text-lg tracking-widest font-bold">{{ t('app.brand') }}</div>
      <div class="text-sm text-ink-300 hidden md:block">{{ t('app.tagline') }}</div>

      <div class="ml-auto flex items-center gap-4 text-xs">
        <div v-if="game.character" class="hidden md:flex flex-col items-end">
          <span class="text-ink-50 font-bold">{{ game.character.name }}</span>
          <span class="text-ink-300">{{ realmText }}</span>
        </div>
        <div v-if="game.character" class="w-40 hidden md:block">
          <div class="flex justify-between text-[10px] text-ink-300">
            <span>EXP</span>
            <span>{{ expPct }}%</span>
          </div>
          <div class="h-1.5 mt-0.5 rounded bg-ink-900/60 overflow-hidden">
            <div
              class="h-full transition-all"
              :class="cultivating ? 'bg-emerald-400' : 'bg-ink-300'"
              :style="{ width: expPct + '%' }"
            />
          </div>
        </div>
        <div v-if="game.character" class="w-32 hidden md:block">
          <div class="flex justify-between text-[10px] text-ink-300">
            <span>Thể Lực</span>
            <span>{{ game.character.stamina }} / {{ game.character.staminaMax }}</span>
          </div>
          <div class="h-1.5 mt-0.5 rounded bg-ink-900/60 overflow-hidden">
            <div
              class="h-full bg-amber-400 transition-all"
              :style="{ width: (game.character.stamina / game.character.staminaMax) * 100 + '%' }"
            />
          </div>
        </div>
        <div v-if="game.character" class="hidden md:flex items-center gap-1 text-[11px]">
          <span class="text-amber-300">⛀</span>
          <span>{{ game.character.linhThach }}</span>
        </div>
        <span
          class="px-2 py-0.5 rounded text-[10px]"
          :class="game.wsConnected ? 'bg-emerald-700/40 text-emerald-200' : 'bg-red-700/40 text-red-200'"
        >
          {{ game.wsConnected ? 'WS ✓' : 'WS ×' }}
        </span>
        <button class="text-ink-300 hover:text-ink-50" @click="logout">
          {{ t('home.logout') }}
        </button>
      </div>
    </header>

    <div class="flex-1 grid grid-cols-1 md:grid-cols-[14rem_minmax(0,1fr)_18rem]">
      <!-- Sidebar trái -->
      <aside class="hidden md:flex flex-col border-r border-ink-300/30 bg-ink-700/30 p-3 gap-1 text-sm">
        <RouterLink
          to="/home"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          道 Đạo Tràng
        </RouterLink>
        <RouterLink
          to="/dungeon"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          劍 Luyện Khí Đường
        </RouterLink>
        <RouterLink
          to="/inventory"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          寶 Linh Bảo Các
        </RouterLink>
        <RouterLink
          to="/market"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          坊 Phường Thị
        </RouterLink>
        <a class="px-3 py-2 rounded text-ink-300/60 cursor-not-allowed" title="Phase 6">
          門 Tông Môn
        </a>
        <a class="px-3 py-2 rounded text-ink-300/60 cursor-not-allowed" title="Phase 7">
          鬼 Boss Đại Hội
        </a>
      </aside>

      <!-- Main content -->
      <main class="p-4 md:p-6 overflow-y-auto">
        <slot />
      </main>

      <!-- ChatDock placeholder -->
      <aside
        class="hidden md:flex flex-col border-l border-ink-300/30 bg-ink-700/30 p-3 gap-2 text-sm"
      >
        <h3 class="text-xs uppercase tracking-widest text-ink-300">Tâm Cảnh Đường</h3>
        <p class="text-xs text-ink-300/80">
          Phase 6 — Chat thế giới / tông môn / lân cận sẽ ở đây.
        </p>
      </aside>
    </div>
  </div>
</template>
