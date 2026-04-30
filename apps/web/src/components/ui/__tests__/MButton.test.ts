import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import MButton from '@/components/ui/MButton.vue';

/**
 * MButton smoke tests (session 9j task M): primary button primitive used
 * across the app. Regression here affects every submit/action button.
 * Covers: slot render, loading state swaps label, disabled flag, type prop,
 * disabled-when-loading.
 */

const i18n = createI18n({
  legacy: false,
  locale: 'vi',
  fallbackLocale: 'vi',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    vi: { common: { loading: 'Đang tải...' } },
  },
});

function mountBtn(props: Record<string, unknown> = {}, slot = 'Gửi') {
  return mount(MButton, {
    props,
    slots: { default: slot },
    global: { plugins: [i18n] },
  });
}

describe('MButton', () => {
  it('render slot content mặc định', () => {
    const w = mountBtn({}, 'Gửi');
    expect(w.text()).toBe('Gửi');
  });

  it('loading=true → swap label sang common.loading + ẩn slot', () => {
    const w = mountBtn({ loading: true }, 'Gửi');
    expect(w.text()).toBe('Đang tải...');
    expect(w.text()).not.toContain('Gửi');
  });

  it('loading=true → button disabled', () => {
    const w = mountBtn({ loading: true });
    expect(w.find('button').attributes('disabled')).toBeDefined();
  });

  it('disabled=true → button disabled', () => {
    const w = mountBtn({ disabled: true });
    expect(w.find('button').attributes('disabled')).toBeDefined();
  });

  it('type mặc định = button', () => {
    const w = mountBtn();
    expect(w.find('button').attributes('type')).toBe('button');
  });

  it('type="submit" → button type=submit', () => {
    const w = mountBtn({ type: 'submit' });
    expect(w.find('button').attributes('type')).toBe('submit');
  });

  it('không loading + không disabled → không disabled attr', () => {
    const w = mountBtn();
    expect(w.find('button').attributes('disabled')).toBeUndefined();
  });
});
