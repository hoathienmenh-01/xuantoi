<script setup lang="ts">
/**
 * Phase 11.X.AR — Talent Catalog read-only view.
 *
 * Hiển thị 45 talent từ shared catalog (`@xuantoi/shared` `TALENTS`) cho người
 * chơi xem, **không có học/learn flow** (server-authoritative learn flow chưa
 * wire frontend). Mục tiêu: cho user thấy roadmap ngộ-đạo + 5-element
 * symmetry coverage đã hoàn tất Phase 11.X.AN..AQ.
 *
 * Filters:
 * - Type: all | passive | active
 * - Element: all | kim | moc | thuy | hoa | tho | neutral
 *
 * Mỗi talent card hiển thị:
 * - Tên + element badge + type badge
 * - Realm requirement + talent point cost
 * - Description (lore)
 * - Effect summary format theo passiveEffect.kind / activeEffect.kind
 *
 * KHÔNG đụng runtime/schema/seed — pure read từ catalog static data.
 */
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  TALENTS,
  ELEMENTS,
  realmByKey,
  type ElementKey,
  type TalentDef,
  type TalentType,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import AppShell from '@/components/shell/AppShell.vue';

type ElementFilter = ElementKey | 'neutral' | 'all';
type TypeFilter = TalentType | 'all';

const auth = useAuthStore();
const game = useGameStore();
const router = useRouter();
const { t } = useI18n();

const typeFilter = ref<TypeFilter>('all');
const elementFilter = ref<ElementFilter>('all');

const filtered = computed<readonly TalentDef[]>(() => {
  return TALENTS.filter((talent) => {
    if (typeFilter.value !== 'all' && talent.type !== typeFilter.value) {
      return false;
    }
    if (elementFilter.value === 'all') return true;
    if (elementFilter.value === 'neutral') return talent.element === null;
    return talent.element === elementFilter.value;
  });
});

const counts = computed(() => ({
  total: TALENTS.length,
  filtered: filtered.value.length,
  passive: TALENTS.filter((t) => t.type === 'passive').length,
  active: TALENTS.filter((t) => t.type === 'active').length,
}));

function realmText(key: string): string {
  const r = realmByKey(key);
  return r ? r.name : key;
}

function elementClass(element: ElementKey | null): string {
  switch (element) {
    case 'kim':
      return 'bg-amber-700/40 text-amber-200 border-amber-500/40';
    case 'moc':
      return 'bg-emerald-700/40 text-emerald-200 border-emerald-500/40';
    case 'thuy':
      return 'bg-sky-700/40 text-sky-200 border-sky-500/40';
    case 'hoa':
      return 'bg-rose-700/40 text-rose-200 border-rose-500/40';
    case 'tho':
      return 'bg-stone-700/40 text-stone-200 border-stone-500/40';
    default:
      return 'bg-ink-700/40 text-ink-200 border-ink-300/30';
  }
}

function elementLabel(element: ElementKey | null): string {
  if (element === null) return t('talents.element.neutral');
  return t(`talents.element.${element}`);
}

function typeClass(type: TalentType): string {
  return type === 'passive'
    ? 'bg-violet-700/40 text-violet-200 border-violet-500/40'
    : 'bg-amber-700/40 text-amber-200 border-amber-500/40';
}

/**
 * Format effect summary cho 1 talent — multi-key i18n string built deterministic
 * từ `passiveEffect` / `activeEffect` định dạng catalog. Dùng tham số ICU để
 * vi/en khớp placeholders parity test.
 */
function effectSummary(talent: TalentDef): string {
  if (talent.passiveEffect) {
    const eff = talent.passiveEffect;
    switch (eff.kind) {
      case 'stat_mod': {
        const pct = Math.round((eff.value - 1) * 100);
        const stat = eff.statTarget ?? 'atk';
        return t('talents.effect.statMod', {
          pct,
          stat: t(`talents.stat.${stat}`),
        });
      }
      case 'regen': {
        const stat = eff.statTarget ?? 'hpMax';
        return t('talents.effect.regen', {
          flat: eff.value,
          stat: t(`talents.stat.${stat}`),
        });
      }
      case 'drop_bonus': {
        const pct = Math.round((eff.value - 1) * 100);
        return t('talents.effect.dropBonus', { pct });
      }
      case 'exp_bonus': {
        const pct = Math.round((eff.value - 1) * 100);
        return t('talents.effect.expBonus', { pct });
      }
      case 'damage_bonus': {
        const pct = Math.round((eff.value - 1) * 100);
        const target = eff.elementTarget ?? 'kim';
        return t('talents.effect.damageBonus', {
          pct,
          element: t(`talents.element.${target}`),
        });
      }
      default:
        return talent.description;
    }
  }
  if (talent.activeEffect) {
    const eff = talent.activeEffect;
    const aoe = eff.aoe
      ? t('talents.effect.aoe')
      : t('talents.effect.single');
    switch (eff.kind) {
      case 'damage':
        return t('talents.effect.activeDamage', {
          mul: eff.value,
          aoe,
          mp: eff.mpCost,
          cd: eff.cooldownTurns,
        });
      case 'cc':
        return t('talents.effect.activeCc', {
          turns: eff.value,
          aoe,
          mp: eff.mpCost,
          cd: eff.cooldownTurns,
        });
      case 'heal':
        return t('talents.effect.activeHeal', {
          mul: eff.value,
          mp: eff.mpCost,
          cd: eff.cooldownTurns,
        });
      case 'dot':
        return t('talents.effect.activeDot', {
          turns: eff.value,
          aoe,
          mp: eff.mpCost,
          cd: eff.cooldownTurns,
        });
      case 'utility':
        return t('talents.effect.activeUtility', {
          mp: eff.mpCost,
          cd: eff.cooldownTurns,
        });
      default:
        return talent.description;
    }
  }
  return talent.description;
}

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
});
</script>

<template>
  <AppShell>
    <div class="max-w-5xl mx-auto space-y-4">
      <header class="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl tracking-widest font-bold">{{ t('talents.title') }}</h1>
          <p class="text-xs text-ink-300 mt-1">
            {{ t('talents.subtitle', { total: counts.total }) }}
          </p>
        </div>
        <div class="text-xs text-ink-300" data-testid="talents-counts">
          {{ t('talents.counts', { passive: counts.passive, active: counts.active }) }}
        </div>
      </header>

      <section class="bg-ink-700/30 border border-ink-300/20 rounded p-3 flex flex-wrap items-center gap-3 text-xs">
        <div class="flex items-center gap-2">
          <label class="text-ink-300">{{ t('talents.filter.type') }}</label>
          <select
            v-model="typeFilter"
            data-testid="talents-filter-type"
            class="bg-ink-900 border border-ink-300/30 rounded px-2 py-1 text-ink-100"
          >
            <option value="all">{{ t('talents.filter.all') }}</option>
            <option value="passive">{{ t('talents.filter.passive') }}</option>
            <option value="active">{{ t('talents.filter.active') }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-ink-300">{{ t('talents.filter.element') }}</label>
          <select
            v-model="elementFilter"
            data-testid="talents-filter-element"
            class="bg-ink-900 border border-ink-300/30 rounded px-2 py-1 text-ink-100"
          >
            <option value="all">{{ t('talents.filter.all') }}</option>
            <option v-for="el in ELEMENTS" :key="el" :value="el">
              {{ elementLabel(el) }}
            </option>
            <option value="neutral">{{ t('talents.element.neutral') }}</option>
          </select>
        </div>
        <span class="ml-auto text-ink-300" data-testid="talents-result-count">
          {{ t('talents.filter.shown', { shown: counts.filtered, total: counts.total }) }}
        </span>
      </section>

      <section
        v-if="counts.filtered === 0"
        class="bg-ink-700/30 border border-ink-300/20 rounded p-6 text-center text-ink-300"
        data-testid="talents-empty"
      >
        {{ t('talents.empty') }}
      </section>

      <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="talents-list">
        <article
          v-for="talent in filtered"
          :key="talent.key"
          class="bg-ink-700/30 border border-ink-300/20 rounded p-3 space-y-2"
          :data-testid="`talent-card-${talent.key}`"
        >
          <header class="flex items-baseline justify-between gap-2 flex-wrap">
            <h2 class="text-amber-200 text-base font-semibold">{{ talent.name }}</h2>
            <div class="flex items-center gap-1">
              <span
                class="px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider"
                :class="elementClass(talent.element)"
              >
                {{ elementLabel(talent.element) }}
              </span>
              <span
                class="px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider"
                :class="typeClass(talent.type)"
              >
                {{ t(`talents.type.${talent.type}`) }}
              </span>
            </div>
          </header>
          <p class="text-sm text-ink-200">{{ talent.description }}</p>
          <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-300">
            <dt>{{ t('talents.field.realm') }}</dt>
            <dd class="text-ink-100">{{ realmText(talent.realmRequirement) }}</dd>
            <dt>{{ t('talents.field.cost') }}</dt>
            <dd class="text-ink-100">{{ talent.talentPointCost }}</dd>
            <dt>{{ t('talents.field.effect') }}</dt>
            <dd class="text-ink-100 col-span-1">{{ effectSummary(talent) }}</dd>
          </dl>
        </article>
      </section>
    </div>
  </AppShell>
</template>
