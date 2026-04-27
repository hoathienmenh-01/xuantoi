<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-4xl tracking-widest">{{ t('notFound.title') }}</h1>
      <p class="mt-2 text-ink-300">{{ t('notFound.desc') }}</p>
      <RouterLink to="/" class="text-ink-50 underline mt-4 inline-block">
        {{ t('common.back') }}
      </RouterLink>
    </div>
  </div>
</template>
