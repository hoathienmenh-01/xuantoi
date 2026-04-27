<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import { useToastStore } from '@/stores/toast';
import { useGameStore } from '@/stores/game';
import { getCharacter } from '@/api/character';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';

const auth = useAuthStore();
const router = useRouter();
const toast = useToastStore();
const game = useGameStore();
const { t } = useI18n();

const submitting = ref(false);

const expText = computed(() => {
  const c = game.character;
  if (!c) return '';
  return `${c.exp} / ${c.expNext}`;
});
const atPeak = computed(() => {
  const c = game.character;
  if (!c) return false;
  return c.realmStage === 9 && BigInt(c.exp) >= BigInt(c.expNext);
});

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  const char = await getCharacter().catch(() => null);
  if (!char) {
    router.replace('/onboarding');
    return;
  }
  await game.fetchState();
  game.bindSocket();
});

async function toggleCultivate(): Promise<void> {
  if (!game.character) return;
  submitting.value = true;
  try {
    await game.setCultivating(!game.character.cultivating);
    toast.push({
      type: 'success',
      text: game.character.cultivating ? 'Nhập định, linh khí xoay vần.' : 'Xuất định.',
    });
  } catch {
    toast.push({ type: 'error', text: t('auth.errors.UNKNOWN') });
  } finally {
    submitting.value = false;
  }
}

async function onBreakthrough(): Promise<void> {
  submitting.value = true;
  try {
    await game.breakthrough();
    toast.push({ type: 'system', text: 'Đột phá thành công, cảnh giới đã thăng.' });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'NOT_AT_PEAK') {
      toast.push({ type: 'warning', text: 'Chưa đủ duyên đột phá, mời tích thêm linh khí.' });
    } else {
      toast.push({ type: 'error', text: t('auth.errors.UNKNOWN') });
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <AppShell>
    <div v-if="game.character" class="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section class="rounded border border-ink-300/40 bg-ink-700/30 p-5">
        <header class="mb-3 flex items-center justify-between">
          <h2 class="text-xl tracking-widest">{{ game.character.name }}</h2>
          <span class="text-xs text-ink-300">{{ game.realmFullName }}</span>
        </header>

        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-xs text-ink-300">
              <span>Linh Khí (EXP)</span>
              <span>{{ expText }}</span>
            </div>
            <div class="h-2 mt-1 rounded bg-ink-900/60 overflow-hidden">
              <div
                class="h-full transition-all"
                :class="game.character.cultivating ? 'bg-emerald-400' : 'bg-ink-300'"
                :style="{ width: Math.round(game.expProgress * 100) + '%' }"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-xs text-ink-300 flex justify-between">
                <span>HP</span>
                <span>{{ game.character.hp }} / {{ game.character.hpMax }}</span>
              </div>
              <div class="h-1.5 mt-1 rounded bg-ink-900/60 overflow-hidden">
                <div
                  class="h-full bg-rose-400"
                  :style="{ width: (game.character.hp / game.character.hpMax) * 100 + '%' }"
                />
              </div>
            </div>
            <div>
              <div class="text-xs text-ink-300 flex justify-between">
                <span>MP</span>
                <span>{{ game.character.mp }} / {{ game.character.mpMax }}</span>
              </div>
              <div class="h-1.5 mt-1 rounded bg-ink-900/60 overflow-hidden">
                <div
                  class="h-full bg-sky-400"
                  :style="{ width: (game.character.mp / game.character.mpMax) * 100 + '%' }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap gap-2">
          <MButton :loading="submitting" @click="toggleCultivate">
            {{ game.character.cultivating ? 'Xuất Định' : 'Nhập Định' }}
          </MButton>
          <MButton :loading="submitting" :disabled="!atPeak" @click="onBreakthrough">
            Đột Phá
          </MButton>
        </div>

        <p v-if="game.lastTickAt" class="text-xs text-ink-300 mt-3">
          Tick gần nhất: +{{ game.lastTickGain }} EXP ·
          {{ new Date(game.lastTickAt).toLocaleTimeString('vi-VN') }}
        </p>
      </section>

      <section class="rounded border border-ink-300/40 bg-ink-700/30 p-5">
        <h3 class="text-sm tracking-widest text-ink-300 uppercase mb-3">Đạo Cơ</h3>
        <dl class="grid grid-cols-2 gap-y-2 text-sm">
          <dt class="text-ink-300">Lực</dt>
          <dd class="text-right">{{ game.character.power }}</dd>
          <dt class="text-ink-300">Linh</dt>
          <dd class="text-right">{{ game.character.spirit }}</dd>
          <dt class="text-ink-300">Tốc</dt>
          <dd class="text-right">{{ game.character.speed }}</dd>
          <dt class="text-ink-300">May</dt>
          <dd class="text-right">{{ game.character.luck }}</dd>
        </dl>
        <p class="text-xs text-ink-300 mt-4">
          {{ t('home.wip') }}
        </p>
      </section>
    </div>
    <div v-else class="text-center text-ink-300">Đang tải đạo cơ…</div>
  </AppShell>
</template>
