<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  type?: 'button' | 'submit' | 'reset';
  loading?: boolean;
  disabled?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
  <button
    :type="type ?? 'button'"
    :disabled="disabled || loading"
    class="px-5 py-2 rounded border border-ink-300 bg-ink-700/40 text-ink-50 hover:bg-ink-700/70 disabled:opacity-50 disabled:cursor-not-allowed transition"
  >
    <slot v-if="!loading" />
    <span v-else>{{ t('common.loading') }}</span>
  </button>
</template>
