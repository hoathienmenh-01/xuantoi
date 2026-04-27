<script setup lang="ts">
import { useToastStore } from '@/stores/toast';
import { storeToRefs } from 'pinia';

const store = useToastStore();
const { toasts } = storeToRefs(store);
</script>

<template>
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
    <div
      v-for="t in toasts"
      :key="t.id"
      :class="[
        'rounded border-2 shadow-lg backdrop-blur px-4 py-2 text-sm cursor-pointer',
        'transition-opacity duration-300',
        t.type === 'error' && 'border-red-700 bg-red-900/70 text-red-50',
        t.type === 'warning' && 'border-yellow-600 bg-yellow-900/60 text-yellow-50',
        t.type === 'success' && 'border-emerald-700 bg-emerald-900/60 text-emerald-50',
        t.type === 'info' && 'border-ink-300 bg-ink-700/70 text-ink-50',
      ]"
      @click="store.remove(t.id)"
    >
      <div class="font-bold">{{ t.title }}</div>
      <div>{{ t.text }}</div>
    </div>
  </div>
</template>
