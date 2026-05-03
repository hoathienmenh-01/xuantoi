<script setup lang="ts">
/**
 * Phase 11.6.D — Tribulation (Thiên Kiếp) view.
 *
 * Hiển thị kiếp sắp tới (nếu có) cho character đang ở peak realm + cho phép
 * trigger `POST /character/tribulation` (Phase 11.6.B server endpoint).
 * Server-authoritative: client chỉ gửi POST không body, server resolve
 * `c.realmKey → nextRealm()` + simulate kiếp deterministic + ghi
 * `TribulationAttemptLog` + atomic update character/currency/buff.
 *
 * Layout:
 *   - Header: title + character realm + stage.
 *   - Cooldown banner (nếu `tribulationCooldownAt` còn hiệu lực): live
 *     countdown đến lúc retry được. Phase 11.6.E.
 *   - Tâm Ma banner (nếu `taoMaUntil` còn hiệu lực): countdown debuff. Phase 11.6.E.
 *   - Upcoming tribulation card (nếu có def cho transition):
 *       - Tên + severity badge + type badge.
 *       - Description (lore).
 *       - Stat: số đợt (waves), reward preview (linhThach + expBonus +
 *         titleKey), failure penalty preview (expLossRatio + cooldownMinutes
 *         + taoMaDebuffChance).
 *       - Button "Vượt kiếp" — disable nếu inFlight, not at peak, no def,
 *         hoặc cooldown active. Phase 11.6.E pre-check tránh spam server reject.
 *   - Empty state (nếu không có def): hiển thị msg "low-tier transition,
 *     dùng Đột phá thông thường" hoặc "no next realm".
 *   - Last outcome banner (nếu vừa attempt phiên này):
 *       - Success: "Vượt kiếp thành công" + reward detail.
 *       - Fail: "Thất bại" + penalty detail (expLoss + cooldownAt +
 *         taoMa nếu có).
 *
 * KHÔNG đụng schema/seed/runtime — pure FE wire của 1 endpoint Phase 11.6.B
 * + 2 field expose Phase 11.6.E (`tribulationCooldownAt`/`taoMaUntil`).
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  getTribulationForBreakthrough,
  nextRealm,
  realmByKey,
  type TribulationDef,
} from '@xuantoi/shared';
import { useAuthStore } from '@/stores/auth';
import { useGameStore } from '@/stores/game';
import { useTribulationStore } from '@/stores/tribulation';
import { useToastStore } from '@/stores/toast';
import AppShell from '@/components/shell/AppShell.vue';

const auth = useAuthStore();
const game = useGameStore();
const tribulation = useTribulationStore();
const toast = useToastStore();
const router = useRouter();
const { t } = useI18n();

/**
 * Live ticker — re-evaluate computed `cooldownActive`/`cooldownRemainingText`/
 * `taoMaActive`/`taoMaRemainingText` mỗi giây để countdown chạy mượt mà
 * không cần fetchState lặp lại.
 */
const nowMs = ref<number>(Date.now());
let tickerHandle: ReturnType<typeof setInterval> | null = null;

/** Current peak detection: stage 9 + character exists. */
const atPeak = computed<boolean>(() => {
  const c = game.character;
  if (!c) return false;
  return c.realmStage >= 9;
});

/** Phase 11.6.E — cooldown active flag (server-side persisted timestamp). */
const cooldownActive = computed<boolean>(() => {
  const ts = game.character?.tribulationCooldownAt;
  if (!ts) return false;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return false;
  return ms > nowMs.value;
});

/** Phase 11.6.E — Tâm Ma debuff active flag. */
const taoMaActive = computed<boolean>(() => {
  const ts = game.character?.taoMaUntil;
  if (!ts) return false;
  const ms = Date.parse(ts);
  if (!Number.isFinite(ms)) return false;
  return ms > nowMs.value;
});

function fmtRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

const cooldownRemainingText = computed<string>(() => {
  const ts = game.character?.tribulationCooldownAt;
  if (!ts) return '';
  const ms = Date.parse(ts) - nowMs.value;
  return fmtRemaining(ms);
});

const taoMaRemainingText = computed<string>(() => {
  const ts = game.character?.taoMaUntil;
  if (!ts) return '';
  const ms = Date.parse(ts) - nowMs.value;
  return fmtRemaining(ms);
});

/** Realm name + stage display (e.g. "Kim Đan Cửu Trọng"). */
const currentRealmFull = computed<string>(() => game.realmFullName);

/** Next realm name nếu có (e.g. "Nguyên Anh"). */
const nextRealmName = computed<string | null>(() => {
  const c = game.character;
  if (!c) return null;
  const next = nextRealm(c.realmKey);
  return next ? next.name : null;
});

/** Tribulation def matches `(currentRealm, nextRealm)` transition. */
const upcomingDef = computed<TribulationDef | null>(() => {
  const c = game.character;
  if (!c) return null;
  const next = nextRealm(c.realmKey);
  if (!next) return null;
  return getTribulationForBreakthrough(c.realmKey, next.key) ?? null;
});

/**
 * Empty state reason:
 *   - 'no_character': chưa onboard.
 *   - 'no_next_realm': đã ở cảnh giới đỉnh (Hư Không Chí Tôn).
 *   - 'low_tier': transition không cần kiếp (e.g. phamnhan→luyenkhi) — caller
 *     dùng Đột phá thông thường.
 *   - null: có def, hiển thị tribulation card.
 */
const emptyReason = computed<'no_character' | 'no_next_realm' | 'low_tier' | null>(() => {
  const c = game.character;
  if (!c) return 'no_character';
  const next = nextRealm(c.realmKey);
  if (!next) return 'no_next_realm';
  if (!upcomingDef.value) return 'low_tier';
  return null;
});

const buttonDisabled = computed<boolean>(() => {
  if (tribulation.inFlight) return true;
  if (!upcomingDef.value) return true;
  if (!atPeak.value) return true;
  if (cooldownActive.value) return true;
  return false;
});

const buttonLabel = computed<string>(() => {
  if (tribulation.inFlight) return t('tribulation.button.attempting');
  if (!upcomingDef.value) return t('tribulation.button.unavailable');
  if (!atPeak.value) return t('tribulation.button.notAtPeak');
  if (cooldownActive.value) {
    return t('tribulation.button.cooldown', { remaining: cooldownRemainingText.value });
  }
  return t('tribulation.button.attempt');
});

function severityClass(s: TribulationDef['severity']): string {
  switch (s) {
    case 'minor':
      return 'bg-stone-700/40 text-stone-200 border-stone-500/40';
    case 'major':
      return 'bg-amber-700/40 text-amber-200 border-amber-500/40';
    case 'heavenly':
      return 'bg-rose-700/40 text-rose-200 border-rose-500/40';
    case 'saint':
      return 'bg-violet-700/40 text-violet-200 border-violet-500/40';
    default:
      return 'bg-ink-700/40 text-ink-200 border-ink-300/30';
  }
}

function typeClass(ty: TribulationDef['type']): string {
  switch (ty) {
    case 'lei':
      return 'bg-yellow-700/40 text-yellow-200 border-yellow-500/40';
    case 'hoa':
      return 'bg-rose-700/40 text-rose-200 border-rose-500/40';
    case 'bang':
      return 'bg-sky-700/40 text-sky-200 border-sky-500/40';
    case 'phong':
      return 'bg-emerald-700/40 text-emerald-200 border-emerald-500/40';
    case 'tam':
      return 'bg-violet-700/40 text-violet-200 border-violet-500/40';
    default:
      return 'bg-ink-700/40 text-ink-200 border-ink-300/30';
  }
}

function realmName(key: string): string {
  return realmByKey(key)?.name ?? key;
}

/** Formatted reward — int format Vietnamese-friendly. */
function fmtNum(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return String(n);
  return v.toLocaleString('vi-VN');
}

async function onAttempt(): Promise<void> {
  if (buttonDisabled.value) return;
  const errCode = await tribulation.attempt();
  if (errCode === null) {
    // attempt accepted — outcome populated in store
    const outcome = tribulation.lastOutcome;
    if (outcome?.success) {
      toast.push({
        type: 'success',
        text: t('tribulation.attempt.successToast', {
          to: realmName(outcome.toRealmKey),
        }),
      });
    } else {
      toast.push({
        type: 'warning',
        text: t('tribulation.attempt.failToast'),
      });
    }
    // refetch state để cập nhật realmKey/realmStage/exp/linhThach
    await game.fetchState().catch(() => null);
  } else {
    const key = `tribulation.errors.${errCode}`;
    const text = t(key);
    toast.push({
      type: 'error',
      text: text === key ? t('tribulation.errors.UNKNOWN') : text,
    });
  }
}

const showOutcome = ref<boolean>(false);
function dismissOutcome(): void {
  showOutcome.value = false;
  tribulation.clearLastOutcome();
}

onMounted(async () => {
  await auth.hydrate();
  if (!auth.isAuthenticated) {
    router.replace('/auth');
    return;
  }
  await game.fetchState().catch(() => null);
  game.bindSocket();
  // Phase 11.6.E — live countdown ticker (1 Hz), đủ smooth + đủ rẻ.
  tickerHandle = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (tickerHandle !== null) {
    clearInterval(tickerHandle);
    tickerHandle = null;
  }
});
</script>

<template>
  <AppShell>
    <div class="max-w-3xl mx-auto space-y-4">
      <header class="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-2xl tracking-widest font-bold">{{ t('tribulation.title') }}</h1>
          <p class="text-xs text-ink-300 mt-1">
            {{ t('tribulation.subtitle') }}
          </p>
        </div>
        <div
          v-if="game.character"
          class="text-xs text-ink-300"
          data-testid="tribulation-current-realm"
        >
          {{ t('tribulation.currentRealm', { name: currentRealmFull }) }}
        </div>
      </header>

      <!-- Phase 11.6.E — cooldown banner (live countdown) -->
      <section
        v-if="cooldownActive"
        class="rounded p-3 border bg-amber-900/30 border-amber-500/40 text-amber-100 text-xs"
        data-testid="tribulation-cooldown-banner"
      >
        <div class="font-semibold mb-0.5">{{ t('tribulation.cooldown.title') }}</div>
        <div data-testid="tribulation-cooldown-remaining">
          {{ t('tribulation.cooldown.remaining', { remaining: cooldownRemainingText }) }}
        </div>
      </section>

      <!-- Phase 11.6.E — Tâm Ma debuff banner -->
      <section
        v-if="taoMaActive"
        class="rounded p-3 border bg-violet-900/30 border-violet-500/40 text-violet-100 text-xs"
        data-testid="tribulation-taoma-banner"
      >
        <div class="font-semibold mb-0.5">{{ t('tribulation.taoMa.title') }}</div>
        <div data-testid="tribulation-taoma-remaining">
          {{ t('tribulation.taoMa.remaining', { remaining: taoMaRemainingText }) }}
        </div>
      </section>

      <!-- Last outcome banner (success or fail) -->
      <section
        v-if="tribulation.lastOutcome"
        :class="[
          'rounded p-4 border',
          tribulation.lastOutcome.success
            ? 'bg-emerald-900/30 border-emerald-500/40 text-emerald-100'
            : 'bg-rose-900/30 border-rose-500/40 text-rose-100',
        ]"
        data-testid="tribulation-last-outcome"
      >
        <header class="flex items-center justify-between mb-2">
          <h2 class="text-base font-semibold">
            <template v-if="tribulation.lastOutcome.success">
              {{ t('tribulation.outcome.successTitle') }}
            </template>
            <template v-else>
              {{ t('tribulation.outcome.failTitle') }}
            </template>
          </h2>
          <button
            type="button"
            class="text-xs text-ink-300 hover:text-ink-50"
            data-testid="tribulation-outcome-dismiss"
            @click="dismissOutcome"
          >
            {{ t('tribulation.outcome.dismiss') }}
          </button>
        </header>

        <div class="text-xs space-y-1">
          <div data-testid="tribulation-outcome-transition">
            {{
              t('tribulation.outcome.transition', {
                from: realmName(tribulation.lastOutcome.fromRealmKey),
                to: realmName(tribulation.lastOutcome.toRealmKey),
              })
            }}
          </div>
          <div data-testid="tribulation-outcome-waves">
            {{
              t('tribulation.outcome.wavesCompleted', {
                count: tribulation.lastOutcome.wavesCompleted,
              })
            }}
            ·
            {{
              t('tribulation.outcome.totalDamage', {
                dmg: fmtNum(tribulation.lastOutcome.totalDamage),
              })
            }}
            · HP {{ fmtNum(tribulation.lastOutcome.finalHp) }}
          </div>

          <div
            v-if="tribulation.lastOutcome.success && tribulation.lastOutcome.reward"
            class="mt-2 space-y-0.5"
            data-testid="tribulation-outcome-reward"
          >
            <div>
              {{
                t('tribulation.outcome.rewardLinhThach', {
                  amount: fmtNum(tribulation.lastOutcome.reward.linhThach),
                })
              }}
            </div>
            <div>
              {{
                t('tribulation.outcome.rewardExpBonus', {
                  amount: fmtNum(tribulation.lastOutcome.reward.expBonus),
                })
              }}
            </div>
            <div v-if="tribulation.lastOutcome.reward.titleKey">
              {{
                t('tribulation.outcome.rewardTitle', {
                  key: tribulation.lastOutcome.reward.titleKey,
                })
              }}
            </div>
          </div>

          <div
            v-if="!tribulation.lastOutcome.success && tribulation.lastOutcome.penalty"
            class="mt-2 space-y-0.5"
            data-testid="tribulation-outcome-penalty"
          >
            <div>
              {{
                t('tribulation.outcome.penaltyExpLoss', {
                  amount: fmtNum(tribulation.lastOutcome.penalty.expLoss),
                })
              }}
            </div>
            <div>
              {{
                t('tribulation.outcome.penaltyCooldown', {
                  ts: tribulation.lastOutcome.penalty.cooldownAt,
                })
              }}
            </div>
            <div v-if="tribulation.lastOutcome.penalty.taoMaActive">
              {{
                t('tribulation.outcome.penaltyTaoMa', {
                  ts: tribulation.lastOutcome.penalty.taoMaExpiresAt ?? '',
                })
              }}
            </div>
          </div>
        </div>
      </section>

      <!-- Empty state -->
      <section
        v-if="emptyReason"
        class="bg-ink-700/30 border border-ink-300/20 rounded p-6 text-center text-ink-300"
        data-testid="tribulation-empty"
      >
        <template v-if="emptyReason === 'no_character'">
          {{ t('tribulation.empty.noCharacter') }}
        </template>
        <template v-else-if="emptyReason === 'no_next_realm'">
          {{ t('tribulation.empty.noNextRealm') }}
        </template>
        <template v-else-if="emptyReason === 'low_tier'">
          {{
            t('tribulation.empty.lowTier', {
              from: currentRealmFull,
              to: nextRealmName ?? '',
            })
          }}
        </template>
      </section>

      <!-- Upcoming tribulation card -->
      <section
        v-else-if="upcomingDef"
        class="bg-ink-700/30 border border-ink-300/20 rounded p-4 space-y-3"
        :data-testid="`tribulation-card-${upcomingDef.key}`"
      >
        <header class="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 class="text-amber-200 text-lg font-semibold">{{ upcomingDef.name }}</h2>
          <div class="flex items-center gap-1">
            <span
              :class="[
                'text-[10px] px-1.5 py-0.5 rounded border',
                severityClass(upcomingDef.severity),
              ]"
              data-testid="tribulation-severity-badge"
            >
              {{ t(`tribulation.severity.${upcomingDef.severity}`) }}
            </span>
            <span
              :class="[
                'text-[10px] px-1.5 py-0.5 rounded border',
                typeClass(upcomingDef.type),
              ]"
              data-testid="tribulation-type-badge"
            >
              {{ t(`tribulation.type.${upcomingDef.type}`) }}
            </span>
          </div>
        </header>

        <p class="text-sm text-ink-300" data-testid="tribulation-description">
          {{ upcomingDef.description }}
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div data-testid="tribulation-transition">
            <span class="text-ink-300">{{ t('tribulation.field.transition') }}:</span>
            <span class="text-ink-100 ml-1">
              {{ realmName(upcomingDef.fromRealmKey) }} → {{ realmName(upcomingDef.toRealmKey) }}
            </span>
          </div>
          <div data-testid="tribulation-waves">
            <span class="text-ink-300">{{ t('tribulation.field.waves') }}:</span>
            <span class="text-ink-100 ml-1">{{ upcomingDef.waves.length }}</span>
          </div>
        </div>

        <div class="border-t border-ink-300/20 pt-2 space-y-1 text-xs">
          <h3 class="text-ink-300 mb-1">{{ t('tribulation.field.rewardPreview') }}</h3>
          <div data-testid="tribulation-reward-linhThach">
            <span class="text-ink-300">{{ t('tribulation.field.rewardLinhThach') }}:</span>
            <span class="text-emerald-200 ml-1">
              {{ fmtNum(upcomingDef.reward.linhThach) }}
            </span>
          </div>
          <div data-testid="tribulation-reward-expBonus">
            <span class="text-ink-300">{{ t('tribulation.field.rewardExpBonus') }}:</span>
            <span class="text-emerald-200 ml-1">
              {{ fmtNum(upcomingDef.reward.expBonus.toString()) }}
            </span>
          </div>
          <div v-if="upcomingDef.reward.titleKey" data-testid="tribulation-reward-title">
            <span class="text-ink-300">{{ t('tribulation.field.rewardTitle') }}:</span>
            <span class="text-amber-200 ml-1">{{ upcomingDef.reward.titleKey }}</span>
          </div>
        </div>

        <div class="border-t border-ink-300/20 pt-2 space-y-1 text-xs">
          <h3 class="text-ink-300 mb-1">{{ t('tribulation.field.penaltyPreview') }}</h3>
          <div data-testid="tribulation-penalty-expLoss">
            <span class="text-ink-300">{{ t('tribulation.field.penaltyExpLoss') }}:</span>
            <span class="text-rose-200 ml-1">
              {{ Math.round(upcomingDef.failurePenalty.expLossRatio * 100) }}%
            </span>
          </div>
          <div data-testid="tribulation-penalty-cooldown">
            <span class="text-ink-300">{{ t('tribulation.field.penaltyCooldown') }}:</span>
            <span class="text-rose-200 ml-1">
              {{ upcomingDef.failurePenalty.cooldownMinutes }} {{ t('tribulation.unit.minutes') }}
            </span>
          </div>
          <div data-testid="tribulation-penalty-taoMa">
            <span class="text-ink-300">{{ t('tribulation.field.penaltyTaoMa') }}:</span>
            <span class="text-rose-200 ml-1">
              {{ Math.round(upcomingDef.failurePenalty.taoMaDebuffChance * 100) }}%
              ·
              {{ upcomingDef.failurePenalty.taoMaDebuffDurationMinutes }} {{ t('tribulation.unit.minutes') }}
            </span>
          </div>
        </div>

        <button
          type="button"
          :disabled="buttonDisabled"
          data-testid="tribulation-attempt-button"
          class="w-full mt-2 px-3 py-2 text-sm rounded bg-rose-700 text-rose-50 hover:bg-rose-600 disabled:bg-ink-700/40 disabled:text-ink-300 disabled:cursor-not-allowed"
          @click="onAttempt"
        >
          {{ buttonLabel }}
        </button>

        <p
          v-if="!atPeak && game.character"
          class="text-[10px] text-ink-300 text-center"
          data-testid="tribulation-not-at-peak-hint"
        >
          {{ t('tribulation.notAtPeakHint') }}
        </p>
      </section>
    </div>
  </AppShell>
</template>
