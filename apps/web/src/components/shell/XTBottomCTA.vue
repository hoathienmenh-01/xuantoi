<script setup lang="ts">
/**
 * Cửu Thiên Mộng — `XTBottomCTA` (Phase 5 sticky bottom call-to-action).
 *
 * Bento + Cinematic principle: primary action luôn nhìn thấy ở đáy view, không
 * bao giờ phải scroll xuống để bắt được CTA. Mobile: position fixed bottom.
 * Desktop: card cuộn theo nội dung nhưng vẫn nổi bật.
 *
 * Slots:
 *   - `meta`: label / sub-label trái CTA (vd: "Cần tu vi 9100 / 12000").
 *   - default: nội dung CTA (thường gồm 1 primary `MButton` + optional secondary).
 *
 * Props:
 *   - `variant`: `default` (paper) | `cinematic` (gold gradient bar) | `minimal` (admin).
 *   - `sticky`: bật `position: sticky; bottom: 0` (mặc định true).
 *   - `safeArea`: cộng `env(safe-area-inset-bottom)` cho iOS PWA (mặc định true).
 */
import { computed } from 'vue';

type Variant = 'default' | 'cinematic' | 'minimal';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    sticky?: boolean;
    safeArea?: boolean;
    testId?: string;
    ariaLabel?: string;
  }>(),
  {
    variant: 'default',
    sticky: true,
    safeArea: true,
    testId: 'xt-bottom-cta',
    ariaLabel: undefined,
  },
);

const rootClass = computed(() => [
  'xt-bottom-cta',
  `xt-bottom-cta--${props.variant}`,
  props.sticky ? 'xt-bottom-cta--sticky' : '',
  props.safeArea ? 'xt-bottom-cta--safe' : '',
]);
</script>

<template>
  <div
    :class="rootClass"
    :data-testid="testId"
    :aria-label="ariaLabel"
    role="region"
  >
    <div v-if="$slots.meta" class="xt-bottom-cta__meta">
      <slot name="meta" />
    </div>
    <div class="xt-bottom-cta__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.xt-bottom-cta {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 16px;
  background: var(--xt-bg-surface);
  border: 1px solid var(--xt-border-jade);
  box-shadow: 0 -8px 24px -16px rgba(8, 9, 11, 0.6);
  z-index: 30;
  transition: transform 200ms var(--xt-ease-out, ease), box-shadow 200ms var(--xt-ease-out, ease);
}

.xt-bottom-cta--sticky {
  position: sticky;
  bottom: 0;
  margin-top: 16px;
}

.xt-bottom-cta--safe {
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
}

.xt-bottom-cta__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--xt-text-small, 14px);
  color: var(--xt-text-muted);
}

.xt-bottom-cta__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.xt-bottom-cta--cinematic {
  background: linear-gradient(
    180deg,
    rgba(201, 164, 90, 0.08) 0%,
    rgba(201, 164, 90, 0.18) 100%
  );
  border-color: rgba(201, 164, 90, 0.45);
  box-shadow: 0 -12px 32px -18px rgba(201, 164, 90, 0.5);
}

.xt-bottom-cta--minimal {
  background: var(--xt-bg-panel, rgba(8, 9, 11, 0.4));
  border-color: var(--xt-border-mist, rgba(111, 163, 198, 0.3));
  border-radius: 8px;
  box-shadow: none;
}

@media (max-width: 720px) {
  .xt-bottom-cta {
    padding: 10px 12px;
    border-radius: 14px;
    gap: 8px;
  }
  .xt-bottom-cta__actions {
    flex: 1;
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .xt-bottom-cta {
    transition: none;
  }
}
</style>
