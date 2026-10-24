'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { usePathname } from 'next/navigation';
import { englishMessages } from '@/lib/i18n/messages';

export type StudioLocale = 'zh' | 'en';
export type StudioTranslate = (source: string, values?: Record<string, string | number>) => string;
export const LANGUAGE_STORAGE_KEY = 'wenbing-interface-language-v1';
const LanguageContext = createContext<{ locale: StudioLocale; setLocale: (locale: StudioLocale) => void } | null>(null);

// For a newly opened example only; never re-run this over an existing form or draft.
export function initialInterfaceText(source: string) {
  try { return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? englishMessages[source] || source : source; }
  catch { return source; }
}

const pageTitles: Record<string, string> = {
  '/': '文炳建站 · 让你的故事成为网站',
  '/studio': '选择制作方式 · 文炳建站',
  '/studio/blocks': '模块制作 · 文炳建站',
  '/studio/api': 'API 制作 · 文炳建站',
  '/studio/manual': '模板制作 · 文炳建站',
  '/checkout': '订单与交付 · 文炳建站',
};

export function StudioLocaleProvider({ children }: { children: ReactNode }) {
  // One isolated instance per mounted tree also keeps SSR requests independent.
  const [engine] = useState(() => {
    const instance = createInstance();
    void instance.init({
      lng: 'zh', fallbackLng: 'zh', supportedLngs: ['zh', 'en'],
      initAsync: false, keySeparator: false, nsSeparator: false,
      resources: { zh: { translation: {} }, en: { translation: englishMessages } },
      interpolation: { escapeValue: false, skipOnVariables: true }, returnNull: false,
      react: { useSuspense: false },
    });
    return instance;
  });
  const [locale, updateLocale] = useState<StudioLocale>('zh');
  const path = usePathname();
  const applyLocale = useCallback((next: StudioLocale) => {
    void engine.changeLanguage(next);
    updateLocale(next);
  }, [engine]);
  const setLocale = useCallback((next: StudioLocale) => {
    applyLocale(next);
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, next); } catch { /* Switching still works when browser storage is unavailable. */ }
  }, [applyLocale]);

  useEffect(() => {
    try { applyLocale(localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'); } catch { /* Keep the default language. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) applyLocale(event.newValue === 'en' ? 'en' : 'zh');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [applyLocale]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    const title = pageTitles[path || '/'];
    if (title) document.title = String(engine.t(title, { defaultValue: title }));
  }, [engine, locale, path]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nextProvider i18n={engine}><LanguageContext.Provider value={value}>{children}</LanguageContext.Provider></I18nextProvider>;
}

export function useStudioI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('StudioLocaleProvider is required.');
  const { t: translate } = useTranslation();
  const t = useCallback<StudioTranslate>((source, values) => Object.hasOwn(englishMessages, source) ? String(translate(source, { ...values, defaultValue: source, nest: false })) : source, [translate]);
  return { ...context, t };
}

export function StudioLanguageSwitch() {
  const { locale, setLocale } = useStudioI18n();
  return <div className="site-language-switch" role="group" aria-label={locale === 'zh' ? '界面语言' : 'Interface language'}>
    <button type="button" lang="zh-CN" aria-label="切换为中文" aria-pressed={locale === 'zh'} onClick={() => setLocale('zh')}>中文</button>
    <button type="button" lang="en" aria-label="Switch to English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
  </div>;
}
