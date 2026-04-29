<script setup lang="ts">
/**
 * Skeleton loader cơ bản — block xám hơi pulse, theme cổ phong (ink palette).
 *
 * Props:
 *  - height: chiều cao CSS (vd `h-4`, `h-12`, hoặc `36px`); default `h-4`.
 *  - width: chiều rộng tailwind class hoặc raw % (vd `w-full`, `w-1/3`); default `w-full`.
 *  - rounded: bo góc, default `rounded`.
 *  - testId: optional cho test query.
 */
withDefaults(
  defineProps<{
    height?: string;
    width?: string;
    rounded?: string;
    testId?: string;
  }>(),
  {
    height: 'h-4',
    width: 'w-full',
    rounded: 'rounded',
    testId: undefined,
  },
);
</script>

<template>
  <div
    class="bg-ink-700/40 animate-pulse"
    :class="[height, width, rounded]"
    :data-testid="testId ?? 'skeleton-block'"
    aria-hidden="true"
  />
</template>
