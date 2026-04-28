<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRouter } from 'vue-router';
import {
  SKILL_BASIC_ATTACK,
  skillsForSect,
  type SectKey,
  type SkillDef,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import {
  attackBoss,
  getCurrentBoss,
  type BossView,
  type DefeatedRewardSlice,
} from '@/api/boss';
import { on } from '@/ws/client';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';
import { itemName } from '@/lib/itemName';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();
const { t } = useI18n();

const boss = ref<BossView | null>(null);
const submitting = ref(false);
const cooldownLeft = ref(0); // ms còn lại
const lastDefeatedRewards = ref<DefeatedRewardSlice[] | null>(null);
let tickTimer: ReturnType<typeof setInterval> | null = null;
const offHandlers: Array<() => void> = [];

const sectKey = computed<SectKey | null>(() => game.character?.sectKey ?? null);
const usableSkills = computed<SkillDef[]>(() => skillsForSect(sectKey.value));
const selectedSkill = ref<string>(SKILL_BASIC_ATTACK.key);

const hpPct = computed(() => {
  if (!boss.value) return 0;
  const cur = Number(BigInt(boss.value.currentHp));
  const max = Number(BigInt(boss.value.maxHp));
  if (max === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)));
});

const myStash = computed(() => game.character?.linhThach ?? '0');

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  await refresh();

  // Realtime: cập nhật HP boss + leaderboard khi có ai đó đánh.
  offHandlers.push(
    on<{
      id: string;
      currentHp: string;
      maxHp: string;
      status: 'ACTIVE' | 'DEFEATED' | 'EXPIRED';
      leaderboardTop5: BossView['leaderboard'];
    }>('boss:update', (frame) => {
      const p = frame.payload;
      if (!boss.value || boss.value.id !== p.id) return;
      boss.value = {
        ...boss.value,
        currentHp: p.currentHp,
        status: p.status,
      };
      // Cập nhật top5 nhưng giữ phần dưới của bảng cũ.
      if (boss.value && p.leaderboardTop5.length > 0) {
        const existing = boss.value.leaderboard;
        const merged = [
          ...p.leaderboardTop5,
          ...existing.filter(
            (e) => !p.leaderboardTop5.some((t) => t.characterId === e.characterId),
          ),
        ];
        boss.value = { ...boss.value, leaderboard: merged.slice(0, 20) };
      }
    }),
  );
  offHandlers.push(
    on<{
      id: string;
      bossKey: string;
      name: string;
      level: number;
      maxHp: string;
      currentHp: string;
      spawnedAt: string;
      expiresAt: string;
    }>('boss:spawn', () => {
      // Có boss mới — refetch để lấy đầy đủ thông tin.
      void refresh();
      toast.push({ type: 'system', text: t('boss.spawnToast') });
    }),
  );
  offHandlers.push(
    on<{
      id: string;
      name: string;
      rewards: DefeatedRewardSlice[];
    }>('boss:defeated', (frame) => {
      const p = frame.payload;
      if (boss.value?.id === p.id) {
        boss.value = { ...boss.value, status: 'DEFEATED', currentHp: '0' };
      }
      lastDefeatedRewards.value = p.rewards;
      toast.push({ type: 'success', text: t('boss.defeatedToast', { name: p.name }) });
      void game.fetchState().catch(() => null);
      // Refresh boss sau ít giây để load boss mới (khi cron spawn).
      setTimeout(() => void refresh(), 3000);
    }),
  );
  offHandlers.push(
    on<{
      id: string;
      status: string;
      rewards: DefeatedRewardSlice[];
    }>('boss:end', (frame) => {
      const p = frame.payload;
      if (boss.value?.id === p.id) {
        boss.value = { ...boss.value, status: 'EXPIRED' };
      }
      lastDefeatedRewards.value = p.rewards;
      toast.push({ type: 'system', text: t('boss.endedToast') });
      void game.fetchState().catch(() => null);
      setTimeout(() => void refresh(), 3000);
    }),
  );

  // Tick local cho cooldown bar.
  tickTimer = setInterval(() => {
    if (boss.value?.cooldownUntil) {
      const ms = new Date(boss.value.cooldownUntil).getTime() - Date.now();
      cooldownLeft.value = Math.max(0, ms);
      if (cooldownLeft.value === 0 && boss.value) {
        boss.value = { ...boss.value, cooldownUntil: null };
      }
    } else {
      cooldownLeft.value = 0;
    }
  }, 250);
});

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
  for (const off of offHandlers) off();
  offHandlers.length = 0;
});

async function refresh(): Promise<void> {
  try {
    boss.value = await getCurrentBoss();
  } catch {
    boss.value = null;
  }
}

async function onAttack(): Promise<void> {
  if (submitting.value || !boss.value) return;
  if (cooldownLeft.value > 0) return;
  submitting.value = true;
  try {
    const r = await attackBoss(selectedSkill.value);
    // Cập nhật ngay từ response để feedback tức thời (WS có thể chậm hơn).
    if (boss.value) {
      boss.value = {
        ...boss.value,
        currentHp: r.result.bossHp,
        myDamage: r.result.myDamageTotal,
        myRank: r.result.myRank,
        cooldownUntil: new Date(Date.now() + 1500).toISOString(),
      };
    }
    if (r.defeated) {
      lastDefeatedRewards.value = r.defeated;
    }
    toast.push({
      type: 'success',
      text: t('boss.damageToast', {
        dmg: r.result.damageDealt,
        rank: r.result.myRank,
      }),
    });
    await game.fetchState().catch(() => null);
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string })?.code ?? 'UNKNOWN';
  const text = t(`boss.errors.${code}`, '__missing__');
  toast.push({
    type: 'error',
    text: text === '__missing__' ? t('boss.errors.UNKNOWN') : text,
  });
}



function timeLeftText(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return t('boss.almostGone');
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}p${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <AppShell>
    <h2 class="text-xl tracking-widest mb-4">鬼 {{ t('boss.title') }}</h2>

    <div v-if="!boss" class="border border-ink-300/40 rounded p-6 bg-ink-700/30 text-center">
      <p class="text-ink-300">{{ t('boss.noneTitle') }}</p>
      <p class="text-xs text-ink-300/70 mt-2">
        {{ t('boss.noneHint') }}
      </p>
      <MButton class="mt-4" @click="refresh">{{ t('common.reload') }}</MButton>
    </div>

    <section v-else class="space-y-4">
      <!-- Boss header -->
      <div class="border border-ink-300/40 rounded p-4 bg-ink-700/30">
        <div class="flex items-start gap-4 flex-wrap">
          <div class="flex-1">
            <div class="text-2xl tracking-widest text-amber-200">
              {{ boss.name }}
              <span class="text-xs text-ink-300 ml-2">Lv.{{ boss.level }}</span>
            </div>
            <div class="text-xs text-ink-300 mt-1">{{ boss.description }}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-ink-300">{{ t('boss.timeLeft') }}</div>
            <div class="text-amber-300">{{ timeLeftText(boss.expiresAt) }}</div>
            <div class="text-xs text-ink-300 mt-1">
              {{ t('boss.participants', { n: boss.participants }) }}
            </div>
          </div>
        </div>

        <!-- HP bar -->
        <div class="mt-4">
          <div class="flex justify-between text-xs text-ink-300">
            <span>{{ t('boss.hp') }}</span>
            <span>{{ boss.currentHp }} / {{ boss.maxHp }} ({{ hpPct }}%)</span>
          </div>
          <div class="h-3 mt-1 rounded bg-ink-900/60 overflow-hidden">
            <div
              class="h-full bg-red-500 transition-all"
              :style="{ width: hpPct + '%' }"
            />
          </div>
        </div>
      </div>

      <!-- Attack panel -->
      <div
        v-if="boss.status === 'ACTIVE'"
        class="border border-ink-300/40 rounded p-4 bg-ink-700/30"
      >
        <div class="flex flex-wrap gap-2 items-center mb-3">
          <span class="text-xs text-ink-300">{{ t('boss.skill') }}</span>
          <select
            v-model="selectedSkill"
            class="bg-ink-900/70 border border-ink-300/30 rounded px-2 py-1 text-sm"
          >
            <option v-for="s in usableSkills" :key="s.key" :value="s.key">
              {{ s.name }}
              <span v-if="s.mpCost > 0">({{ s.mpCost }} MP)</span>
            </option>
          </select>
          <span class="text-xs text-ink-300 ml-2">
            ⛁ {{ game.character?.mp }}/{{ game.character?.mpMax }}
            · 力 {{ game.character?.stamina }}/{{ game.character?.staminaMax }}
            · 血 {{ game.character?.hp }}/{{ game.character?.hpMax }}
          </span>
          <span class="ml-auto text-xs text-ink-300">⛀ {{ myStash }}</span>
        </div>
        <div class="flex items-center gap-3">
          <MButton
            :loading="submitting"
            :disabled="cooldownLeft > 0"
            @click="onAttack"
          >
            {{ t('boss.attack') }}
            <span v-if="cooldownLeft > 0" class="text-xs ml-1">
              ({{ Math.ceil(cooldownLeft / 100) / 10 }}s)
            </span>
          </MButton>
          <span v-if="boss.myRank && boss.myDamage" class="text-xs text-ink-300">
            {{ t('boss.myDamage', { dmg: boss.myDamage, rank: boss.myRank }) }}
          </span>
        </div>
      </div>

      <!-- Reward pool hint -->
      <div class="border border-ink-300/40 rounded p-4 bg-ink-700/30">
        <div class="text-xs text-ink-300 mb-2">{{ t('boss.rewardsTitle') }}</div>
        <div class="text-xs space-y-1 text-ink-100">
          <div>{{ t('boss.rewardTop1') }}
            <span class="text-violet-300">
              {{ boss.topDropPool.map((k) => itemName(k, t)).join(' / ') }}
            </span>
          </div>
          <div>{{ t('boss.rewardTop23') }}
            <span class="text-emerald-300">
              {{ boss.midDropPool.map((k) => itemName(k, t)).join(' / ') }}
            </span>
          </div>
          <div>{{ t('boss.rewardTop410') }}</div>
          <div>{{ t('boss.rewardTop11') }}</div>
          <div class="text-ink-300">
            {{ t('boss.rewardExpire') }}
          </div>
        </div>
      </div>

      <!-- Leaderboard -->
      <div class="border border-ink-300/40 rounded p-4 bg-ink-700/30">
        <div class="text-sm tracking-widest mb-2">{{ t('boss.leaderboard') }}</div>
        <table class="w-full text-sm">
          <thead class="text-xs text-ink-300">
            <tr>
              <th class="text-left">{{ t('boss.col.rank') }}</th>
              <th class="text-left">{{ t('boss.col.name') }}</th>
              <th class="text-right">{{ t('boss.col.damage') }}</th>
              <th class="text-right">{{ t('boss.col.hits') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in boss.leaderboard"
              :key="row.characterId"
              :class="row.characterId === game.character?.id ? 'text-amber-300' : ''"
            >
              <td>#{{ row.rank }}</td>
              <td>
                <RouterLink
                  :to="`/profile/${row.characterId}`"
                  class="hover:text-amber-200 hover:underline"
                >
                  {{ row.characterName }}
                </RouterLink>
              </td>
              <td class="text-right">{{ row.damage }}</td>
              <td class="text-right">{{ row.hits }}</td>
            </tr>
            <tr v-if="boss.leaderboard.length === 0">
              <td colspan="4" class="text-center text-ink-300/70 py-3">
                {{ t('boss.noAttackers') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Defeated reward summary -->
      <div
        v-if="lastDefeatedRewards"
        class="border border-amber-400/40 rounded p-4 bg-amber-900/10"
      >
        <div class="text-sm tracking-widest mb-2 text-amber-300">
          {{ t('boss.lastRewards') }}
        </div>
        <ul class="text-xs space-y-1">
          <li v-for="r in lastDefeatedRewards.slice(0, 10)" :key="r.characterId">
            #{{ r.rank }} · {{ r.characterName }} ·
            <span class="text-amber-300">⛀ {{ r.linhThach }}</span>
            <span v-if="r.items.length > 0" class="text-violet-300 ml-2">
              + {{ r.items.map((i) => itemName(i.itemKey, t) + (i.qty > 1 ? ` x${i.qty}` : '')).join(', ') }}
            </span>
          </li>
        </ul>
      </div>
    </section>
  </AppShell>
</template>
