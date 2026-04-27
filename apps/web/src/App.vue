<script setup lang="ts">
import { onMounted } from 'vue';
import MToast from '@/components/ui/MToast.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

onMounted(async () => {
  // Router guard cũng gọi hydrate, nhưng bảo đảm App boot trên các route public.
  if (!auth.hydrated) {
    await auth.hydrate();
  }
});
</script>

<template>
  <RouterView />
  <MToast />
</template>
