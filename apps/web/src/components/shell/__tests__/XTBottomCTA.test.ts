import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import XTBottomCTA from '@/components/shell/XTBottomCTA.vue';

describe('XTBottomCTA', () => {
  it('default render: role=region, sticky+safe-area class, default testId', () => {
    const w = mount(XTBottomCTA, {
      slots: { default: '<button data-testid="primary">Tu Luyện</button>' },
    });
    const root = w.find('[data-testid="xt-bottom-cta"]');
    expect(root.exists()).toBe(true);
    expect(root.attributes('role')).toBe('region');
    expect(root.classes()).toEqual(
      expect.arrayContaining([
        'xt-bottom-cta',
        'xt-bottom-cta--default',
        'xt-bottom-cta--sticky',
        'xt-bottom-cta--safe',
      ]),
    );
    expect(w.find('[data-testid="primary"]').exists()).toBe(true);
  });

  it('variant=cinematic + sticky=false + safeArea=false', () => {
    const w = mount(XTBottomCTA, {
      props: { variant: 'cinematic', sticky: false, safeArea: false },
      slots: { default: '<span/>' },
    });
    const root = w.find('[data-testid="xt-bottom-cta"]');
    expect(root.classes()).toContain('xt-bottom-cta--cinematic');
    expect(root.classes()).not.toContain('xt-bottom-cta--sticky');
    expect(root.classes()).not.toContain('xt-bottom-cta--safe');
  });

  it('variant=minimal', () => {
    const w = mount(XTBottomCTA, {
      props: { variant: 'minimal' },
      slots: { default: '<span/>' },
    });
    expect(w.find('[data-testid="xt-bottom-cta"]').classes()).toContain(
      'xt-bottom-cta--minimal',
    );
  });

  it('meta slot rendered with class xt-bottom-cta__meta', () => {
    const w = mount(XTBottomCTA, {
      slots: {
        meta: '<span data-testid="meta-content">9100 / 12000</span>',
        default: '<button>OK</button>',
      },
    });
    expect(w.find('[data-testid="meta-content"]').exists()).toBe(true);
    expect(w.find('.xt-bottom-cta__meta').exists()).toBe(true);
  });

  it('ariaLabel propagate vào root', () => {
    const w = mount(XTBottomCTA, {
      props: { ariaLabel: 'Hành động chính' },
      slots: { default: '<span/>' },
    });
    expect(w.find('[data-testid="xt-bottom-cta"]').attributes('aria-label')).toBe(
      'Hành động chính',
    );
  });

  it('custom testId override default', () => {
    const w = mount(XTBottomCTA, {
      props: { testId: 'custom-cta' },
      slots: { default: '<span/>' },
    });
    expect(w.find('[data-testid="custom-cta"]').exists()).toBe(true);
    expect(w.find('[data-testid="xt-bottom-cta"]').exists()).toBe(false);
  });
});
