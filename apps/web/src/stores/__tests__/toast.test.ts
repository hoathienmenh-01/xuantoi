import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { i18n } from '@/i18n';
import { useToastStore } from '@/stores/toast';

describe('useToastStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });

  it('push string adds an info toast with default title and duration', () => {
    const toast = useToastStore();
    toast.push('Hello');
    expect(toast.toasts).toHaveLength(1);
    const [t] = toast.toasts;
    expect(t.type).toBe('info');
    expect(t.title).toBe('Tin tức');
    expect(t.text).toBe('Hello');
    expect(t.duration).toBe(3000);
  });

  it('push warning uses longer duration and warning title', () => {
    const toast = useToastStore();
    toast.push({ type: 'warning', text: 'careful' });
    expect(toast.toasts[0].title).toBe('Cảnh báo');
    expect(toast.toasts[0].duration).toBe(5000);
  });

  it('push error uses longest default duration', () => {
    const toast = useToastStore();
    toast.push({ type: 'error', text: 'boom' });
    expect(toast.toasts[0].type).toBe('error');
    expect(toast.toasts[0].duration).toBe(6000);
  });

  it('push success uses success default duration', () => {
    const toast = useToastStore();
    toast.push({ type: 'success', text: 'done' });
    expect(toast.toasts[0].duration).toBe(3500);
  });

  it('caller override duration takes precedence over default policy', () => {
    const toast = useToastStore();
    toast.push({ type: 'error', text: 'flash', duration: 100 });
    expect(toast.toasts[0].duration).toBe(100);
  });

  it('"warn" alias maps to warning type', () => {
    const toast = useToastStore();
    toast.push({ type: 'warn', text: 'x' });
    expect(toast.toasts[0].type).toBe('warning');
  });

  it('system input uses system title and success type', () => {
    const toast = useToastStore();
    toast.push({ type: 'system', text: 'thiên đạo' });
    const [t] = toast.toasts;
    expect(t.type).toBe('success');
    expect(t.title).toBe('Thiên Đạo Sứ Giả');
  });

  it('anti-spam dedups identical toast within 1200ms', () => {
    const toast = useToastStore();
    toast.push('dup');
    toast.push('dup');
    expect(toast.toasts).toHaveLength(1);
  });

  it('caps to last 4 toasts', () => {
    const toast = useToastStore();
    for (let i = 0; i < 6; i++) toast.push({ text: `m${i}` });
    expect(toast.toasts).toHaveLength(4);
    expect(toast.toasts.map((t) => t.text)).toEqual(['m2', 'm3', 'm4', 'm5']);
  });

  it('auto-removes toast after its duration', () => {
    const toast = useToastStore();
    toast.push({ text: 'x', duration: 500 });
    expect(toast.toasts).toHaveLength(1);
    vi.advanceTimersByTime(600);
    expect(toast.toasts).toHaveLength(0);
  });

  it('remove() drops a toast by id', () => {
    const toast = useToastStore();
    toast.push('a');
    const id = toast.toasts[0].id;
    toast.remove(id);
    expect(toast.toasts).toHaveLength(0);
  });

  it('clear() empties all toasts', () => {
    const toast = useToastStore();
    toast.push('a');
    toast.push({ text: 'b' });
    toast.clear();
    expect(toast.toasts).toHaveLength(0);
  });
});

describe('useToastStore — i18n title resolution', () => {
  let originalLocale: string;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    originalLocale = (i18n.global.locale as unknown as { value: string }).value;
  });

  afterEach(() => {
    (i18n.global.locale as unknown as { value: string }).value = originalLocale;
  });

  it('locale=vi → default title dùng key `toast.title.info` ("Tin tức")', () => {
    (i18n.global.locale as unknown as { value: string }).value = 'vi';
    const toast = useToastStore();
    toast.push('hello');
    expect(toast.toasts[0].title).toBe('Tin tức');
  });

  it('locale=en → default title dùng key `toast.title.info` ("Info")', () => {
    (i18n.global.locale as unknown as { value: string }).value = 'en';
    const toast = useToastStore();
    toast.push('hello');
    expect(toast.toasts[0].title).toBe('Info');
  });

  it('locale=en → warning/error/success/system titles đều dịch sang en', () => {
    (i18n.global.locale as unknown as { value: string }).value = 'en';
    const toast = useToastStore();
    toast.push({ type: 'warning', text: 'w' });
    toast.push({ type: 'error', text: 'e' });
    toast.push({ type: 'success', text: 's' });
    toast.push({ type: 'system', text: 'y' });
    expect(toast.toasts.map((t) => t.title)).toEqual([
      'Warning',
      'Error',
      'Success',
      'Heavenly Herald',
    ]);
  });

  it('caller-supplied `title` override luôn thắng default i18n key', () => {
    (i18n.global.locale as unknown as { value: string }).value = 'en';
    const toast = useToastStore();
    toast.push({ type: 'info', text: 'x', title: 'Custom Title' });
    expect(toast.toasts[0].title).toBe('Custom Title');
  });
});
