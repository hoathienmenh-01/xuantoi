<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useBadgesStore } from '@/stores/badges';
import { useRouter } from 'vue-router';
import ChatPanel from './ChatPanel.vue';
import LocaleSwitcher from './LocaleSwitcher.vue';

const { t } = useI18n();
const auth = useAuthStore();
const game = useGameStore();
const badges = useBadgesStore();
const router = useRouter();

onMounted(() => {
  badges.start();
});

onUnmounted(() => {
  badges.stop();
});

const expPct = computed(() => Math.round(game.expProgress * 100));
const realmText = computed(() => game.realmFullName || '—');
const cultivating = computed(() => game.character?.cultivating ?? false);
const isStaff = computed(() => {
  const r = game.character?.role;
  return r === 'ADMIN' || r === 'MOD';
});

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
            <span>{{ t('shell.stamina') }}</span>
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
          {{ game.wsConnected ? t('shell.wsOn') : t('shell.wsOff') }}
        </span>
        <LocaleSwitcher />
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
          道 {{ t('shell.nav.home') }}
        </RouterLink>
        <RouterLink
          to="/dungeon"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          劍 {{ t('shell.nav.dungeon') }}
        </RouterLink>
        <RouterLink
          to="/inventory"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          寶 {{ t('shell.nav.inventory') }}
        </RouterLink>
        <RouterLink
          to="/market"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          坊 {{ t('shell.nav.market') }}
        </RouterLink>
        <RouterLink
          to="/shop"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          肆 {{ t('shell.nav.shop') }}
        </RouterLink>
        <RouterLink
          to="/sect"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          門 {{ t('shell.nav.sect') }}
        </RouterLink>
        <RouterLink
          to="/boss"
          class="px-3 py-2 rounded hover:bg-ink-700/60 relative"
          active-class="bg-ink-700/60 text-ink-50"
        >
          鬼 {{ t('shell.nav.boss') }}
          <span
            v-if="badges.bossActive"
            class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-ink-700"
            :title="t('shell.badge.bossActive')"
          />
        </RouterLink>
        <RouterLink
          to="/missions"
          class="px-3 py-2 rounded hover:bg-ink-700/60 relative"
          active-class="bg-ink-700/60 text-ink-50"
        >
          任 {{ t('shell.nav.missions') }}
          <span
            v-if="badges.missionClaimable > 0"
            class="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-[10px] text-white"
          >
            {{ badges.missionClaimable > 99 ? '99+' : badges.missionClaimable }}
          </span>
        </RouterLink>
        <RouterLink
          to="/mail"
          class="px-3 py-2 rounded hover:bg-ink-700/60 relative"
          active-class="bg-ink-700/60 text-ink-50"
        >
          書 {{ t('shell.nav.mail') }}
          <span
            v-if="game.unreadMail > 0"
            class="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-600 text-[10px] text-white"
          >
            {{ game.unreadMail > 99 ? '99+' : game.unreadMail }}
          </span>
        </RouterLink>
        <RouterLink
          to="/giftcode"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          禮 {{ t('shell.nav.giftcode') }}
        </RouterLink>
        <RouterLink
          to="/leaderboard"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          榜 {{ t('shell.nav.leaderboard') }}
        </RouterLink>
        <RouterLink
          to="/topup"
          class="px-3 py-2 rounded hover:bg-ink-700/60 relative"
          active-class="bg-ink-700/60 text-ink-50"
        >
          ⛧ {{ t('shell.nav.topup') }}
          <span
            v-if="badges.topupPending"
            class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-ink-700"
            :title="t('shell.badge.topupPending')"
          />
        </RouterLink>
        <RouterLink
          to="/settings"
          class="px-3 py-2 rounded hover:bg-ink-700/60"
          active-class="bg-ink-700/60 text-ink-50"
        >
          設 {{ t('shell.nav.settings') }}
        </RouterLink>
        <RouterLink
          v-if="isStaff"
          to="/admin"
          class="px-3 py-2 rounded hover:bg-ink-700/60 text-amber-200"
          active-class="bg-ink-700/60 text-ink-50"
        >
          官 {{ t('shell.nav.admin') }}
        </RouterLink>
      </aside>

      <!-- Main content -->
      <main class="p-4 md:p-6 overflow-y-auto">
        <slot />
      </main>

      <!-- ChatDock -->
      <aside
        class="hidden md:flex flex-col border-l border-ink-300/30 bg-ink-700/30 p-3 text-sm"
      >
        <ChatPanel />
      </aside>
    </div>
  </div>
</template>
