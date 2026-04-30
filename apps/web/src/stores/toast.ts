import { defineStore } from 'pinia';
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

const TITLE_MAP: Record<Toast['type'], string> = {
  info: 'Tin tức',
  warning: 'Cảnh báo',
  error: 'Lỗi',
  success: 'Thành công',
};

const TITLE_SYSTEM = 'Thiên Đạo Sứ Giả';
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
      const title = raw.title ?? (isSystem ? TITLE_SYSTEM : TITLE_MAP[type]);

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
