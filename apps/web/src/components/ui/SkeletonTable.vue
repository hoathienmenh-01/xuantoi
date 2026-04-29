<script setup lang="ts">
/**
 * Skeleton cho bảng dữ liệu (LeaderboardView, ShopView, AdminView…).
 *
 * Props:
 *  - rows: số dòng giả; default 6.
 *  - cols: số cột giả (mỗi cột là 1 ô skeleton trên 1 dòng); default 5.
 *  - testId: query handle.
 */
withDefaults(
  defineProps<{
    rows?: number;
    cols?: number;
    testId?: string;
  }>(),
  {
    rows: 6,
    cols: 5,
    testId: 'skeleton-table',
  },
);
</script>

<template>
  <div :data-testid="testId" class="space-y-2" aria-hidden="true">
    <div
      v-for="r in rows"
      :key="r"
      class="grid gap-3"
      :style="{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }"
    >
      <div
        v-for="c in cols"
        :key="c"
        class="bg-ink-700/40 animate-pulse h-5 rounded"
      />
    </div>
  </div>
</template>
