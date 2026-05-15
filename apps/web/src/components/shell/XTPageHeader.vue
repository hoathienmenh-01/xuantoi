<script setup lang="ts">
/**
 * UI-2.0 — Page header for individual function pages.
 *
 * Mobile: nút Back ở góc trái, page title ở giữa, optional action ở phải.
 * Desktop: cùng layout nhưng padding nhiều hơn, title to hơn.
 *
 * Mục đích: thay cho `<h1>` rời rạc trong từng view, đảm bảo mọi page riêng
 * (Inventory, Cultivation, Sect, …) đều có header gọn + back consistent.
 *
 * Phase 5: thêm `eyebrow` prop (Hán inscription kèm label) + `meta` slot
 * (chips / counters / breadcrumb) để hỗ trợ Bento layout. Khi không truyền
 * eyebrow / meta, component vẫn render layout cũ → backwards compatible.
 */
import { computed } from 'vue';
import XTBackButton from './XTBackButton.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    /** Optional Hán glyph (e.g. `奉道使命`) cho dòng eyebrow above title. */
    eyebrowHan?: string;
    /** Optional Romaji/Vietnamese label kèm eyebrow Hán. */
    eyebrowLabel?: string;
    hideBack?: boolean;
    backLabel?: string;
    backFallback?: string;
    /** Bento variant tô đậm bằng gradient gold subtle (mặc định false). */
    bento?: boolean;
    /** Minimal variant cho admin (loại bỏ border + bg). */
    minimal?: boolean;
  }>(),
  {
    subtitle: undefined,
    eyebrowHan: undefined,
    eyebrowLabel: undefined,
    hideBack: false,
    backLabel: undefined,
    backFallback: undefined,
    bento: false,
    minimal: false,
  },
);

const headerClass = computed(() => [
  'xt-page-header',
  props.bento ? 'xt-page-header--bento' : '',
  props.minimal ? 'xt-page-header--minimal' : '',
  // Legacy classes for backwards-compat with snapshot tests
  'flex flex-wrap items-center gap-3 border-b border-emerald-300/20 bg-white/40 px-4 py-3 backdrop-blur md:rounded-t-3xl md:border md:border-[var(--xt-border-jade)] md:bg-[var(--xt-bg-surface)]',
]);
</script>

<template>
  <header :class="headerClass" data-testid="xt-page-header">
    <XTBackButton
      v-if="!hideBack"
      :label="backLabel ?? 'Quay lại'"
      :fallback="backFallback ?? '/dashboard'"
    />
    <div class="min-w-0 flex-1">
      <div
        v-if="eyebrowHan || eyebrowLabel"
        class="xt-page-header__eyebrow"
        data-testid="xt-page-eyebrow"
      >
        <span v-if="eyebrowHan" class="xt-page-header__eyebrow-han">{{ eyebrowHan }}</span>
        <span v-if="eyebrowLabel" class="xt-page-header__eyebrow-label">{{ eyebrowLabel }}</span>
      </div>
      <h1
        class="truncate text-base font-semibold tracking-wide text-[var(--xt-text-primary)] md:text-2xl"
        data-testid="xt-page-title"
      >
        {{ title }}
      </h1>
      <p v-if="subtitle" class="truncate text-xs text-[var(--xt-text-muted)] md:text-sm">
        {{ subtitle }}
      </p>
      <div
        v-if="$slots.meta"
        class="xt-page-header__meta"
        data-testid="xt-page-meta"
      >
        <slot name="meta" />
      </div>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.xt-page-header__eyebrow {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--xt-text-eyebrow, 11px);
  letter-spacing: var(--xt-text-eyebrow-tracking, 0.18em);
  text-transform: uppercase;
  color: var(--xt-text-muted);
  margin-bottom: 2px;
}

.xt-page-header__eyebrow-han {
  font-family: var(--xt-font-display, 'Noto Serif SC', serif);
  font-size: 12px;
  letter-spacing: 0.12em;
  color: var(--xt-gold-soft, #c9a45a);
  text-transform: none;
}

.xt-page-header__eyebrow-label {
  color: var(--xt-text-muted);
}

.xt-page-header__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.xt-page-header--bento {
  background: linear-gradient(
    180deg,
    rgba(201, 164, 90, 0.06) 0%,
    rgba(8, 9, 11, 0) 100%
  );
}

.xt-page-header--minimal {
  background: transparent;
  border: none;
  backdrop-filter: none;
  border-bottom: 1px solid var(--xt-border-mist, rgba(111, 163, 198, 0.2));
  border-radius: 0;
}
</style>
