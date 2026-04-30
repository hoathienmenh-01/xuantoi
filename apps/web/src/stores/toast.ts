import { defineStore } from 'pinia';
import { i18n } from '@/i18n';
import { resolveToastDuration } from '@/lib/toastDuration';

export type ToastType = 'info' | 'warning' | 'error' | 'success' | 'system';

export interface Toast {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  text: string;
  duration: number;
  createdAt: number;
}

export interface ToastInput {
  type?: ToastType | 'warn';
  text: string;
  title?: string;
  duration?: number;
}

/**
 * Resolve toast title qua i18n key `toast.title.<type>` (đã định nghĩa
 * sẵn ở `apps/web/src/i18n/{vi,en}.json`). Trước đây Pinia store hard-code
 * VN làm fail i18n parity khi user switch sang en — caller có thể truyền
 * `title` override, nhưng default title luôn theo locale hiện tại.
 *
 * Truy cập i18n qua `i18n.global.t(...)` (Vue plugin instance) thay vì
 * `useI18n()` vì Pinia action không phải Vue setup context. Legacy mode
 * = false → `t` là function trả `string`.
 */
const TITLE_KEY: Record<Toast['type'], string> = {
  info: 'toast.title.info',
  warning: 'toast.title.warning',
  error: 'toast.title.error',
  success: 'toast.title.success',
};
const TITLE_KEY_SYSTEM = 'toast.title.system';

const ANTI_SPAM_MS = 1200;
const MAX_TOASTS = 4;

function normalizeType(t: ToastType | 'warn' | undefined): Toast['type'] {
  if (t === 'warn' || t === 'warning') return 'warning';
  if (t === 'error') return 'error';
  if (t === 'success' || t === 'system') return 'success';
  return 'info';
}

export const useToastStore = defineStore('toast', {
  state: () => ({ toasts: [] as Toast[] }),
  actions: {
    push(input: string | ToastInput): void {
      const raw: ToastInput = typeof input === 'string' ? { text: input } : input;
      const type = normalizeType(raw.type);
      const isSystem = raw.type === 'system';
      const text = raw.text;
      const now = Date.now();

      // anti-spam: same (type+text) within 1200ms
      const recent = this.toasts.find(
        (t) => t.type === type && t.text === text && now - t.createdAt < ANTI_SPAM_MS,
      );
      if (recent) return;

      const duration = resolveToastDuration(type, raw.duration);
      const t = i18n.global.t.bind(i18n.global);
      const title = raw.title ?? (isSystem ? t(TITLE_KEY_SYSTEM) : t(TITLE_KEY[type]));

      const id = `t_${now}_${Math.random().toString(36).slice(2, 8)}`;
      this.toasts.push({ id, type, text, title, duration, createdAt: now });
      if (this.toasts.length > MAX_TOASTS) {
        this.toasts = this.toasts.slice(-MAX_TOASTS);
      }

      window.setTimeout(() => this.remove(id), duration);
    },
    remove(id: string): void {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
    clear(): void {
      this.toasts = [];
    },
  },
});
