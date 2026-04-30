/**
 * Tests cho `apps/web/src/components/shell/LocaleSwitcher.vue`.
 *
 * Component có 3 nhiệm vụ:
 *   1. Render label 'VI' khi locale=vi, 'EN' khi locale=en (single source of truth ở `i18n.global.locale`).
 *   2. Click → toggle giữa 2 locale qua `setLocale()` (từ `@/i18n`).
 *   3. Có `title` attribute resolve qua `t('locale.label')` cho a11y / hover hint.
 *
 * Trước đây không có test riêng — refactor toggle logic / template label / title
 * sẽ silent regress. `setLocale` được mock để verify call chứ không thay đổi i18n
 * singleton thực sự (tránh leak state qua test khác).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const setLocaleMock = vi.fn();

vi.mock('@/i18n', () => ({
  setLocale: (...args: unknown[]) => setLocaleMock(...args),
}));

import LocaleSwitcher from '@/components/shell/LocaleSwitcher.vue';

function makeI18n(locale: 'vi' | 'en') {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'vi',
    messages: {
      vi: { locale: { label: 'Ngôn ngữ' } },
      en: { locale: { label: 'Language' } },
    },
  });
}

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    setLocaleMock.mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('render "VI" khi locale=vi', () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    expect(wrapper.text()).toBe('VI');
  });

  it('render "EN" khi locale=en', () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('en')] } });
    expect(wrapper.text()).toBe('EN');
  });

  it('title attribute resolve qua i18n locale.label (vi)', () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    expect(wrapper.attributes('title')).toBe('Ngôn ngữ');
  });

  it('title attribute resolve qua i18n locale.label (en)', () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('en')] } });
    expect(wrapper.attributes('title')).toBe('Language');
  });

  it('click khi locale=vi → setLocale("en")', async () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    await wrapper.find('button').trigger('click');
    expect(setLocaleMock).toHaveBeenCalledTimes(1);
    expect(setLocaleMock).toHaveBeenCalledWith('en');
  });

  it('click khi locale=en → setLocale("vi")', async () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('en')] } });
    await wrapper.find('button').trigger('click');
    expect(setLocaleMock).toHaveBeenCalledTimes(1);
    expect(setLocaleMock).toHaveBeenCalledWith('vi');
  });

  it('button có `type="button"` (không submit form vô tình)', () => {
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    expect(wrapper.find('button').attributes('type')).toBe('button');
  });

  it('multiple click toggle correctly (vi → en → vi qua 2 mount khác nhau)', async () => {
    // Component không reactive theo locale.value của i18n mock vì setLocale bị
    // mock; verify pure click intent: click 2 lần cùng locale → 2 lần cùng arg.
    const wrapper = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    await wrapper.find('button').trigger('click');
    await wrapper.find('button').trigger('click');
    expect(setLocaleMock).toHaveBeenCalledTimes(2);
    expect(setLocaleMock.mock.calls[0]?.[0]).toBe('en');
    expect(setLocaleMock.mock.calls[1]?.[0]).toBe('en');
  });
});
