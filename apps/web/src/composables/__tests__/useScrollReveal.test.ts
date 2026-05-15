/* eslint-disable vue/one-component-per-file -- multiple inline test components are intentional for isolation */
import { describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { useScrollReveal } from '@/composables/useScrollReveal';

describe('useScrollReveal', () => {
  it('SSR/missing IntersectionObserver fallback → revealed=true ngay', () => {
    const originalIO = (globalThis as unknown as { IntersectionObserver: unknown })
      .IntersectionObserver;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      undefined;
    try {
      const Cmp = defineComponent({
        setup() {
          const { target, revealed } = useScrollReveal();
          return { target, revealed };
        },
        template: '<div ref="target" :data-revealed="revealed"/>',
      });
      const w = mount(Cmp);
      expect(w.find('div').attributes('data-revealed')).toBe('true');
    } finally {
      (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
        originalIO;
    }
  });

  it('prefers-reduced-motion → revealed=true ngay', () => {
    const originalMM = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const Cmp = defineComponent({
        setup() {
          const { target, revealed } = useScrollReveal();
          return { target, revealed };
        },
        template: '<div ref="target" :data-revealed="revealed"/>',
      });
      const w = mount(Cmp);
      expect(w.find('div').attributes('data-revealed')).toBe('true');
    } finally {
      window.matchMedia = originalMM;
    }
  });

  it('observe element và set revealed=true khi entry.isIntersecting', async () => {
    // Stub matchMedia → no reduced motion.
    const originalMM = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    // Stub IntersectionObserver capture callback.
    type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
    let cb: IOCallback | null = null;
    const observedEls: Element[] = [];
    class IOStub {
      constructor(handler: IOCallback) {
        cb = handler;
      }
      observe(el: Element) {
        observedEls.push(el);
      }
      disconnect() {
        cb = null;
      }
      unobserve() {}
    }
    const originalIO = (globalThis as unknown as { IntersectionObserver: unknown })
      .IntersectionObserver;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      IOStub;
    try {
      const Cmp = defineComponent({
        setup() {
          const { target, revealed } = useScrollReveal();
          return () =>
            h('div', { ref: target, 'data-revealed': revealed.value ? 'true' : 'false' });
        },
      });
      const w = mount(Cmp);
      await nextTick();
      expect(observedEls.length).toBe(1);
      expect(w.find('div').attributes('data-revealed')).toBe('false');
      // Trigger intersection.
      (cb as IOCallback | null)?.([{ isIntersecting: true }]);
      await nextTick();
      expect(w.find('div').attributes('data-revealed')).toBe('true');
    } finally {
      (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
        originalIO;
      window.matchMedia = originalMM;
    }
  });
});
