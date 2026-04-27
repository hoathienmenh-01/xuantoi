<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { setLocale, type LocaleKey } from '@/i18n';

const { locale } = useI18n();

function toggle(): void {
  const next: LocaleKey = (locale.value as LocaleKey) === 'vi' ? 'en' : 'vi';
  setLocale(next);
}
</script>

<template>
  <button
    type="button"
    class="px-2 py-0.5 rounded text-[11px] border border-ink-300/40 hover:bg-ink-700/60 text-ink-200"
    :title="$t('locale.label')"
    @click="toggle"
  >
    {{ locale === 'vi' ? 'VI' : 'EN' }}
  </button>
</template>
