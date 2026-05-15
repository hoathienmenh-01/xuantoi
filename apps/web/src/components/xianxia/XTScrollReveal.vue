<script setup lang="ts">
/**
 * Cửu Thiên Mộng — `XTScrollReveal` (Phase 5 micro-interaction wrapper).
 *
 * Bọc nội dung trong 1 element animate-on-scroll. Khi enter viewport,
 * apply class `.xt-reveal--in` → transition vào opacity/translateY.
 *
 * Props:
 *   - `as`: HTML tag (default `div`).
 *   - `delay`: delay ms cho transition-delay (default 0).
 *   - `mode`: `fade-up` (default) | `fade` | `slide-left` | `slide-right`.
 *
 * Tôn trọng `prefers-reduced-motion` (via `useScrollReveal` → revealed=true
 * ngay → không có transition do CSS transition-duration: 0 fallback).
 */
import { computed } from 'vue';
import { useScrollReveal } from '@/composables/useScrollReveal';

type Mode = 'fade-up' | 'fade' | 'slide-left' | 'slide-right';

const props = withDefaults(
  defineProps<{
    as?: string;
    delay?: number;
    mode?: Mode;
    threshold?: number;
    rootMargin?: string;
    once?: boolean;
    testId?: string;
  }>(),
  {
    as: 'div',
    delay: 0,
    mode: 'fade-up',
    threshold: 0.15,
    rootMargin: '0px 0px -10% 0px',
    once: true,
    testId: 'xt-scroll-reveal',
  },
);

const { target, revealed } = useScrollReveal({
  threshold: props.threshold,
  rootMargin: props.rootMargin,
  once: props.once,
});

const rootClass = computed(() => [
  'xt-reveal',
  `xt-reveal--${props.mode}`,
  revealed.value ? 'xt-reveal--in' : '',
]);

const rootStyle = computed(() =>
  props.delay > 0 ? { transitionDelay: `${props.delay}ms` } : undefined,
);
</script>

<template>
  <component
    :is="as"
    ref="target"
    :class="rootClass"
    :style="rootStyle"
    :data-testid="testId"
    :data-revealed="revealed ? 'true' : 'false'"
  >
    <slot />
  </component>
</template>

<style scoped>
.xt-reveal {
  transition: opacity 480ms var(--xt-ease-out, ease-out),
    transform 480ms var(--xt-ease-out, ease-out);
  will-change: opacity, transform;
}

.xt-reveal--fade-up {
  opacity: 0;
  transform: translate3d(0, 12px, 0);
}

.xt-reveal--fade {
  opacity: 0;
}

.xt-reveal--slide-left {
  opacity: 0;
  transform: translate3d(-16px, 0, 0);
}

.xt-reveal--slide-right {
  opacity: 0;
  transform: translate3d(16px, 0, 0);
}

.xt-reveal--in {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}

@media (prefers-reduced-motion: reduce) {
  .xt-reveal {
    transition: none;
    opacity: 1;
    transform: none;
  }
}
</style>
