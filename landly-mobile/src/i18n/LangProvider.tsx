import AsyncStorage from '@react-native-async-storage/async-storage'
import { useContext, useEffect, useState, type ReactNode } from 'react'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@shared/i18n/translations'
import { LangContext, type LangContextValue } from './LangContext'

// Native counterpart of lib/i18n/LangProvider.tsx: same dictionary, same
// context shape ({ lang, setLang, t, isRtl }), but AsyncStorage instead of
// localStorage, and layout direction is applied by the root layout instead
// of on <html>. English is the default until the user picks something else.
// The context itself lives in LangContext.ts, so it survives Fast Refresh.

const STORAGE_KEY = 'landly_lang' // same key name as the web app's localStorage
const DEFAULT_LANG: Lang = 'en'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && saved in translations) setLangState(saved as Lang)
      })
      .catch(() => {
        // Storage unavailable — stay on the default language
      })
  }, [])

  const setLang = (next: Lang) => {
    setLangState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Storage unavailable — the choice just won't persist
    })
  }

  const t = (key: TranslationKey): string => translations[lang][key] || translations.en[key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)

  return <LangContext.Provider value={{ lang, setLang, t, isRtl }}>{children}</LangContext.Provider>
}

// Outside a provider (only ever a dev-time hiccup), English, left to right,
// instead of a red screen.
const FALLBACK: LangContextValue = {
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key: TranslationKey) => translations.en[key] || key,
  isRtl: false,
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (ctx) return ctx
  if (__DEV__) console.warn('useLang was called outside a LangProvider; using English')
  return FALLBACK
}
