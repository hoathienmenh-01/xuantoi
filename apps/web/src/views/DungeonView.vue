<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  SKILL_BASIC_ATTACK,
  realmByKey,
  activeSkillsForSect,
  type DungeonDef,
  type SectKey,
  type SkillDef,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useToastStore } from '@/stores/toast';
import {
  abandonEncounter,
  getActiveEncounter,
  listDungeons,
  performAction,
  startEncounter,
  type EncounterView,
} from '@/api/combat';
import AppShell from '@/components/shell/AppShell.vue';
import MButton from '@/components/ui/MButton.vue';
import { extractApiErrorCodeOrDefault } from '@/lib/apiError';

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();
const { t } = useI18n();

const dungeons = ref<DungeonDef[]>([]);
const encounter = ref<EncounterView | null>(null);
const submitting = ref(false);

const sectKey = computed<SectKey | null>(() => game.character?.sectKey ?? null);

const usableSkills = computed<SkillDef[]>(() => {
  return activeSkillsForSect(sectKey.value);
});

function realmDisplay(key: string): string {
  return realmByKey(key)?.name ?? key;
}

const monsterHpPct = computed(() => {
  const m = encounter.value?.monster;
  if (!m || !encounter.value) return 0;
  return Math.max(0, Math.min(100, Math.round((encounter.value.monsterHp / m.hp) * 100)));
});

const isFighting = computed(() => encounter.value?.status === 'ACTIVE');

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();

  try {
    dungeons.value = (await listDungeons()) as DungeonDef[];
    encounter.value = await getActiveEncounter();
  } catch (e) {
    console.error(e);
  }
});

async function onStart(d: DungeonDef): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    encounter.value = await startEncounter(d.key);
    toast.push({ type: 'success', text: t('dungeon.startToast', { name: d.name }) });
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onAction(skill: SkillDef): Promise<void> {
  if (!encounter.value || submitting.value) return;
  submitting.value = true;
  try {
    const skillKey = skill.key === SKILL_BASIC_ATTACK.key ? undefined : skill.key;
    encounter.value = await performAction(encounter.value.id, skillKey);
    if (encounter.value.status === 'WON') {
      toast.push({
        type: 'system',
        text: t('dungeon.rewardToast', {
          exp: encounter.value.reward?.exp ?? 0,
          linh: encounter.value.reward?.linhThach ?? 0,
        }),
      });
    } else if (encounter.value.status === 'LOST') {
      toast.push({ type: 'warning', text: t('dungeon.lostToast') });
    }
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

async function onAbandon(): Promise<void> {
  if (!encounter.value || submitting.value) return;
  submitting.value = true;
  try {
    encounter.value = await abandonEncounter(encounter.value.id);
    toast.push({ type: 'warning', text: t('dungeon.abandonToast') });
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

function handleErr(e: unknown): void {
  const code = extractApiErrorCodeOrDefault(e, 'UNKNOWN');
  const text = t(`dungeon.errors.${code}`, '__missing__');
  toast.push({
    type: 'error',
    text: text === '__missing__' ? t('dungeon.errors.UNKNOWN') : text,
  });
}
</script>

<template>
  <AppShell>
    <h2 class="text-xl tracking-widest mb-4">{{ t('dungeon.title') }}</h2>

    <div class="grid gap-6 lg:grid-cols-[1fr_2fr]">
      <!-- Dungeon list -->
      <section class="space-y-3">
        <div
          v-for="d in dungeons"
          :key="d.key"
          class="rounded border border-ink-300/40 bg-ink-700/30 p-4 space-y-2"
        >
          <header class="flex items-center justify-between">
            <h3 class="text-base font-bold">{{ d.name }}</h3>
            <span class="text-xs text-ink-300">{{ realmDisplay(d.recommendedRealm) }}</span>
          </header>
          <p class="text-xs text-ink-300">{{ d.description }}</p>
          <p class="text-xs text-ink-300">
            {{ t('dungeon.monsterCount', { n: d.monsters.length }) }} ·
            {{ t('dungeon.staminaEntry', { stam: d.staminaEntry }) }}
          </p>
          <MButton
            :disabled="isFighting || (game.character?.stamina ?? 0) < d.staminaEntry"
            :loading="submitting"
            @click="onStart(d)"
          >
            {{ isFighting ? t('dungeon.inFight') : t('dungeon.enter') }}
          </MButton>
        </div>
      </section>

      <!-- Encounter panel -->
      <section
        v-if="encounter"
        class="rounded border border-ink-300/40 bg-ink-700/30 p-5 space-y-4"
      >
        <header class="flex items-center justify-between">
          <h3 class="text-lg font-bold">{{ encounter.dungeon.name }}</h3>
          <span class="text-xs text-ink-300">
            {{ t('dungeon.counter', {
              cur: encounter.monsterIndex + 1,
              total: encounter.dungeon.monsters.length,
            }) }}
          </span>
        </header>

        <div v-if="encounter.monster" class="space-y-2">
          <div class="flex justify-between text-sm">
            <span>{{ encounter.monster.name }} · Lv.{{ encounter.monster.level }}</span>
            <span>{{ encounter.monsterHp }} / {{ encounter.monster.hp }}</span>
          </div>
          <div class="h-2 rounded bg-ink-900/60 overflow-hidden">
            <div class="h-full bg-rose-500" :style="{ width: monsterHpPct + '%' }" />
          </div>
        </div>

        <div
          class="bg-ink-900/40 rounded p-3 text-xs space-y-1 max-h-48 overflow-y-auto font-mono"
        >
          <div
            v-for="(line, i) in encounter.log"
            :key="i"
            :class="{
              'text-emerald-300': line.side === 'player',
              'text-rose-300': line.side === 'monster',
              'text-amber-200': line.side === 'system',
            }"
          >
            · {{ line.text }}
          </div>
        </div>

        <div v-if="isFighting" class="flex flex-wrap gap-2">
          <MButton
            v-for="s in usableSkills"
            :key="s.key"
            :loading="submitting"
            :title="s.description"
            @click="onAction(s)"
          >
            {{ s.name }}
            <span class="text-[10px] text-ink-300 ml-1">
              {{ s.mpCost > 0 ? '-' + s.mpCost + ' MP' : '' }}
            </span>
          </MButton>
          <MButton :loading="submitting" @click="onAbandon">{{ t('dungeon.retreat') }}</MButton>
        </div>
        <div v-else class="text-sm text-ink-300 italic">
          {{ t('dungeon.ended') }}
        </div>
      </section>
      <section v-else class="text-ink-300 italic">
        {{ t('dungeon.noFight') }}
      </section>
    </div>
  </AppShell>
</template>
