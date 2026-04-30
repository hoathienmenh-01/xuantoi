/**
 * Tests cho UI atom `apps/web/src/components/ui/MButton.vue`.
 *
 * Props:
 *  - `type`: defaults to 'button' (defensive: tránh form submit vô tình)
 *  - `loading`: hiện `t('common.loading')` thay slot và disabled = true
 *  - `disabled`: disabled = true (cho phép explicit disable không cần loading)
 *
 * Lock-in: slot render khi !loading, swap sang i18n loading text khi loading,
 * disabled khi loading || disabled, default `type=button`.
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

import MButton from '@/components/ui/MButton.vue';

function makeI18n(locale: 'vi' | 'en' = 'vi') {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'vi',
    messages: {
      vi: { common: { loading: 'Đang tải…' } },
      en: { common: { loading: 'Loading…' } },
    },
  });
}

const mountBtn = (
  props: Record<string, unknown> = {},
  slots: Record<string, string> = { default: 'Click me' },
  locale: 'vi' | 'en' = 'vi',
) =>
  mount(MButton, {
    props,
    slots,
    global: { plugins: [makeI18n(locale)] },
  });

describe('MButton', () => {
  it('default type="button" (defensive: không submit form vô tình)', () => {
    const w = mountBtn();
    expect(w.find('button').attributes('type')).toBe('button');
  });

  it('explicit type="submit" được tôn trọng', () => {
    const w = mountBtn({ type: 'submit' });
    expect(w.find('button').attributes('type')).toBe('submit');
  });

  it('explicit type="reset" được tôn trọng', () => {
    const w = mountBtn({ type: 'reset' });
    expect(w.find('button').attributes('type')).toBe('reset');
  });

  it('render slot content khi !loading', () => {
    const w = mountBtn({}, { default: 'Đăng nhập' });
    expect(w.text()).toBe('Đăng nhập');
  });

  it('loading=true → render i18n common.loading thay slot (vi)', () => {
    const w = mountBtn({ loading: true }, { default: 'Đăng nhập' }, 'vi');
    expect(w.text()).toBe('Đang tải…');
    expect(w.text()).not.toContain('Đăng nhập');
  });

  it('loading=true → render i18n common.loading (en parity)', () => {
    const w = mountBtn({ loading: true }, { default: 'Sign in' }, 'en');
    expect(w.text()).toBe('Loading…');
  });

  it('loading=true → button disabled', () => {
    const w = mountBtn({ loading: true });
    expect(w.find('button').attributes('disabled')).toBeDefined();
  });

  it('disabled=true (no loading) → button disabled, slot vẫn render', () => {
    const w = mountBtn({ disabled: true }, { default: 'Đóng' });
    expect(w.find('button').attributes('disabled')).toBeDefined();
    expect(w.text()).toBe('Đóng');
  });

  it('không loading + không disabled → button KHÔNG disabled', () => {
    const w = mountBtn();
    expect(w.find('button').attributes('disabled')).toBeUndefined();
  });

  it('click event emit khi không disabled (smoke)', async () => {
    const w = mountBtn();
    await w.find('button').trigger('click');
    // Component không emit custom event, chỉ check no-throw + DOM event capture.
    expect(w.find('button').exists()).toBe(true);
  });
});
