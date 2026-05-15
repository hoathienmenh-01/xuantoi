import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import XTScrollReveal from '@/components/xianxia/XTScrollReveal.vue';

describe('XTScrollReveal', () => {
  // Trong test env (jsdom + thiếu IntersectionObserver) → revealed=true ngay.
  // Đảm bảo content vẫn render đầy đủ, không bị che.

  it('default render: tag=div, mode=fade-up class', () => {
    const w = mount(XTScrollReveal, {
      slots: { default: '<span data-testid="content">Nội dung</span>' },
    });
    const root = w.find('[data-testid="xt-scroll-reveal"]');
    expect(root.exists()).toBe(true);
    expect(root.element.tagName).toBe('DIV');
    expect(root.classes()).toEqual(
      expect.arrayContaining(['xt-reveal', 'xt-reveal--fade-up']),
    );
    expect(w.find('[data-testid="content"]').exists()).toBe(true);
  });

  it('as="li" render thẻ li', () => {
    const w = mount(XTScrollReveal, {
      props: { as: 'li' },
      slots: { default: 'X' },
    });
    expect(w.find('[data-testid="xt-scroll-reveal"]').element.tagName).toBe('LI');
  });

  it('mode prop áp class xt-reveal--{mode}', () => {
    const w = mount(XTScrollReveal, {
      props: { mode: 'slide-left' },
      slots: { default: 'X' },
    });
    expect(w.find('[data-testid="xt-scroll-reveal"]').classes()).toContain(
      'xt-reveal--slide-left',
    );
  });

  it('delay > 0 → set transitionDelay style', () => {
    const w = mount(XTScrollReveal, {
      props: { delay: 200 },
      slots: { default: 'X' },
    });
    const root = w.find('[data-testid="xt-scroll-reveal"]');
    expect(root.attributes('style')).toContain('transition-delay: 200ms');
  });

  it('custom testId override', () => {
    const w = mount(XTScrollReveal, {
      props: { testId: 'reveal-row-1' },
      slots: { default: 'X' },
    });
    expect(w.find('[data-testid="reveal-row-1"]').exists()).toBe(true);
  });

  it('data-revealed bắt đầu false (chưa intersect) trong jsdom', () => {
    const w = mount(XTScrollReveal, {
      slots: { default: 'X' },
    });
    // jsdom có IntersectionObserver nhưng không tự dispatch → chưa reveal.
    expect(w.find('[data-testid="xt-scroll-reveal"]').attributes('data-revealed')).toBe(
      'false',
    );
    expect(w.find('[data-testid="xt-scroll-reveal"]').classes()).not.toContain(
      'xt-reveal--in',
    );
  });

  it('SSR fallback (xoá IntersectionObserver) → data-revealed="true"', () => {
    const originalIO = (globalThis as unknown as { IntersectionObserver: unknown })
      .IntersectionObserver;
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      undefined;
    try {
      const w = mount(XTScrollReveal, { slots: { default: 'X' } });
      expect(w.find('[data-testid="xt-scroll-reveal"]').attributes('data-revealed')).toBe(
        'true',
      );
    } finally {
      (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
        originalIO;
    }
  });
});
