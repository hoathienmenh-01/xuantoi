<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  SKILL_BASIC_ATTACK,
  realmByKey,
  skillsForSect,
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

const auth = useAuthStore();
const game = useGameStore();
const toast = useToastStore();
const router = useRouter();

const dungeons = ref<DungeonDef[]>([]);
const encounter = ref<EncounterView | null>(null);
const submitting = ref(false);

const sectKey = computed<SectKey | null>(() => game.character?.sectKey ?? null);

const usableSkills = computed<SkillDef[]>(() => {
  return skillsForSect(sectKey.value);
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
    toast.push({ type: 'success', text: `Mở quan vào ${d.name}.` });
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
        text: `Hoàn tất ải, +${encounter.value.reward?.exp ?? 0} EXP, +${encounter.value.reward?.linhThach ?? 0} linh thạch.`,
      });
    } else if (encounter.value.status === 'LOST') {
      toast.push({ type: 'warning', text: 'Đạo hữu đã bại trận, hãy hồi phục.' });
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
    toast.push({ type: 'warning', text: 'Đã rút khỏi ải.' });
  } catch (e) {
    handleErr(e);
  } finally {
    submitting.value = false;
  }
}

function handleErr(e: unknown): void {
  const code = (e as { code?: string })?.code ?? 'UNKNOWN';
  const map: Record<string, string> = {
    STAMINA_LOW: 'Thể lực không đủ, đợi tu luyện hồi phục.',
    MP_LOW: 'Linh khí cạn kiệt.',
    SKILL_NOT_USABLE: 'Đạo pháp này không thuộc tông môn của đạo hữu.',
    ALREADY_IN_FIGHT: 'Đạo hữu đã đang trong một trận chiến khác.',
    NO_CHARACTER: 'Chưa có nhân vật.',
    DUNGEON_NOT_FOUND: 'Không tìm thấy ải.',
    ENCOUNTER_NOT_FOUND: 'Trận chiến không còn nữa.',
    ENCOUNTER_ENDED: 'Trận chiến đã kết thúc.',
    UNKNOWN: 'Có lỗi xảy ra, mời thử lại.',
  };
  toast.push({ type: 'error', text: map[code] ?? map.UNKNOWN });
}
</script>

<template>
  <AppShell>
    <h2 class="text-xl tracking-widest mb-4">Luyện Khí Đường</h2>

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
            {{ d.monsters.length }} ải · {{ d.staminaEntry }} thể lực
          </p>
          <MButton
            :disabled="isFighting || (game.character?.stamina ?? 0) < d.staminaEntry"
            :loading="submitting"
            @click="onStart(d)"
          >
            {{ isFighting ? 'Đang trong ải' : 'Khai ải' }}
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
            Ải {{ encounter.monsterIndex + 1 }} / {{ encounter.dungeon.monsters.length }}
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
          <MButton :loading="submitting" @click="onAbandon">Rút Lui</MButton>
        </div>
        <div v-else class="text-sm text-ink-300 italic">
          Trận chiến đã kết thúc. Có thể khai ải mới.
        </div>
      </section>
      <section v-else class="text-ink-300 italic">
        Chưa có trận chiến — chọn một ải bên trái để bắt đầu.
      </section>
    </div>
  </AppShell>
</template>
