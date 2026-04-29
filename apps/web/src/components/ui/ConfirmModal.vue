<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Khi true, nút confirm dùng style cảnh báo (đỏ) — dùng cho thao tác phá huỷ. */
  danger?: boolean;
  /** Disable nút confirm trong khi submit để tránh double-click. */
  loading?: boolean;
  /** Test id gốc; sub-element thêm `-confirm` / `-cancel`. Default `confirm-modal`. */
  testId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  danger: false,
  loading: false,
  testId: 'confirm-modal',
  message: '',
});

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();

const labelConfirm = computed(() => props.confirmText ?? t('common.confirm'));
const labelCancel = computed(() => props.cancelText ?? t('common.cancel'));

function onKeydown(ev: KeyboardEvent): void {
  if (!props.open) return;
  if (ev.key === 'Escape' && !props.loading) {
    ev.preventDefault();
    emit('cancel');
  }
}

watch(
  () => props.open,
  (val) => {
    if (typeof window === 'undefined') return;
    if (val) {
      window.addEventListener('keydown', onKeydown);
    } else {
      window.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKeydown);
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      :data-testid="testId"
      @click.self="!loading && emit('cancel')"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="bg-ink-700 border border-ink-300/30 rounded-lg shadow-2xl max-w-md w-[90vw] p-5 space-y-4"
      >
        <h3 class="text-lg tracking-wider text-ink-50 font-bold">
          {{ title }}
        </h3>
        <p
          v-if="message"
          class="text-sm text-ink-300 whitespace-pre-line"
          :data-testid="`${testId}-message`"
        >
          {{ message }}
        </p>
        <slot />
        <div class="flex gap-2 justify-end pt-2">
          <button
            type="button"
            class="px-4 py-2 rounded border border-ink-300/40 bg-ink-700/40 text-ink-50 hover:bg-ink-700/70 disabled:opacity-50 disabled:cursor-not-allowed transition"
            :disabled="loading"
            :data-testid="`${testId}-cancel`"
            @click="emit('cancel')"
          >
            {{ labelCancel }}
          </button>
          <button
            type="button"
            :class="
              danger
                ? 'px-4 py-2 rounded border border-red-400/50 bg-red-700/40 text-red-100 hover:bg-red-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition'
                : 'px-4 py-2 rounded border border-amber-400/50 bg-amber-700/40 text-amber-100 hover:bg-amber-700/60 disabled:opacity-50 disabled:cursor-not-allowed transition'
            "
            :disabled="loading"
            :data-testid="`${testId}-confirm`"
            @click="emit('confirm')"
          >
            {{ loading ? t('common.loading') : labelConfirm }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
