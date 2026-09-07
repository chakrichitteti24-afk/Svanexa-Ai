'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { SupportedLanguage, LanguageMeta, SUPPORTED_LANGUAGES } from './types';
import { normalizeLanguage, getLanguageMeta, getTranslation } from './index';
import { createClient } from '@/utils/supabase/client';

interface I18nContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: string) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
  meta: LanguageMeta;
  availableLanguages: typeof SUPPORTED_LANGUAGES;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'hersync_companion_language';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('English');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage or navigator
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const normalized = normalizeLanguage(stored);
        setLanguageState(normalized);
      }
    } catch {}
  }, []);

  // Sync dir and lang attributes on document
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = getLanguageMeta(language);
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
    document.body.dir = meta.dir;
  }, [language]);

  // Listen to cross-tab or BroadcastChannel changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setLanguageState(normalizeLanguage(e.newValue));
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('hersync_sync_channel');
      bc.onmessage = (event) => {
        if (event.data?.type === 'LANGUAGE_CHANGED' && event.data?.language) {
          setLanguageState(normalizeLanguage(event.data.language));
        }
      };
    } catch {}

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      try {
        bc?.close();
      } catch {}
    };
  }, []);

  const setLanguage = useCallback(async (newLang: string) => {
    const normalized = normalizeLanguage(newLang);
    setLanguageState(normalized);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, normalized);
      }

      // Broadcast to other tabs & components
      try {
        const bc = new BroadcastChannel('hersync_sync_channel');
        bc.postMessage({ type: 'LANGUAGE_CHANGED', language: normalized });
        bc.close();
      } catch {}

      // If user is authenticated, sync to Supabase user_preferences
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        await supabase.from('user_preferences').upsert(
          {
            user_id: session.user.id,
            language: normalized,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('Language sync notice:', err);
      }
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return getTranslation(language, key, params);
    },
    [language]
  );

  const meta = useMemo(() => getLanguageMeta(language), [language]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      isRTL: meta.dir === 'rtl',
      dir: meta.dir,
      meta,
      availableLanguages: SUPPORTED_LANGUAGES,
    }),
    [language, setLanguage, t, meta]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Graceful fallback if used without I18nProvider
    const fallbackMeta = SUPPORTED_LANGUAGES[0];
    return {
      language: 'English',
      setLanguage: async () => {},
      t: (key: string, params?: Record<string, string | number>) =>
        getTranslation('English', key, params),
      isRTL: false,
      dir: 'ltr',
      meta: fallbackMeta,
      availableLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return ctx;
}
