import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const setLocaleMock = vi.fn();
vi.mock('@/i18n', () => ({
  setLocale: (l: string) => setLocaleMock(l),
}));

import LocaleSwitcher from '@/components/shell/LocaleSwitcher.vue';

function makeI18n(initialLocale: 'vi' | 'en') {
  return createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'vi',
    missingWarn: false,
    fallbackWarn: false,
    messages: {
      vi: { locale: { label: 'Chuyển ngôn ngữ' } },
      en: { locale: { label: 'Switch language' } },
    },
  });
}

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    setLocaleMock.mockReset();
  });

  it('hiển thị VI khi locale=vi', () => {
    const w = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    expect(w.text()).toBe('VI');
  });

  it('hiển thị EN khi locale=en', () => {
    const w = mount(LocaleSwitcher, { global: { plugins: [makeI18n('en')] } });
    expect(w.text()).toBe('EN');
  });

  it('click khi vi → setLocale(en)', async () => {
    const w = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    await w.find('button').trigger('click');
    expect(setLocaleMock).toHaveBeenCalledWith('en');
  });

  it('click khi en → setLocale(vi)', async () => {
    const w = mount(LocaleSwitcher, { global: { plugins: [makeI18n('en')] } });
    await w.find('button').trigger('click');
    expect(setLocaleMock).toHaveBeenCalledWith('vi');
  });

  it('button có title từ i18n', () => {
    const w = mount(LocaleSwitcher, { global: { plugins: [makeI18n('vi')] } });
    expect(w.find('button').attributes('title')).toBe('Chuyển ngôn ngữ');
  });
});
