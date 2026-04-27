import type { Ref } from 'vue';
import { createI18n } from 'vue-i18n';
import vi from './vi.json';
import en from './en.json';

export type MessageSchema = typeof vi;
export type LocaleKey = 'vi' | 'en';

const STORAGE_KEY = 'xt.locale';

function readStoredLocale(): LocaleKey {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw === 'vi' || raw === 'en') return raw;
  } catch {
    /* ignore */
  }
  return 'vi';
}

export const i18n = createI18n({
  legacy: false,
  locale: readStoredLocale(),
  fallbackLocale: 'vi',
  messages: { vi, en },
});

function localeRef(): Ref<LocaleKey> {
  return i18n.global.locale as unknown as Ref<LocaleKey>;
}

export function setLocale(locale: LocaleKey): void {
  localeRef().value = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', locale);
  }
}

export function getLocale(): LocaleKey {
  return localeRef().value;
}

if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('lang', readStoredLocale());
}

export default i18n;
