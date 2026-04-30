import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
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
