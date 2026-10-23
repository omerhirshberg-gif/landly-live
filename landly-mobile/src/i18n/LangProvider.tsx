import AsyncStorage from '@react-native-async-storage/async-storage'
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@shared/i18n/translations'
import { LangContext, type LangContextValue } from './LangContext'

// Native counterpart of lib/i18n/LangProvider.tsx: same dictionary, same
// context shape ({ lang, setLang, t, isRtl }), but AsyncStorage instead of
// localStorage, and layout direction is applied by the root layout instead
// of on <html>. English is the default until the user picks something else.
// Every pick (Language & Region, the onboarding, a sign-in's saved language)
// goes through setLang and is saved; `ready` turns true once the saved one is
// read, and the root navigator and the lock screen wait for it, so a cold
// start never flashes English before the member's language.
// The context itself lives in LangContext.ts, so it survives Fast Refresh.

const STORAGE_KEY = 'landly_lang' // same key name as the web app's localStorage
const DEFAULT_LANG: Lang = 'en'

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG)
  const [ready, setReady] = useState(false)
  // A pick made while the read is in flight wins over what it returns.
  const picked = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (!picked.current && saved && saved in translations) setLangState(saved as Lang)
      })
      .catch(() => {
        // Storage unavailable — stay on the default language
      })
      .finally(() => setReady(true))
  }, [])

  const setLang = (next: Lang) => {
    picked.current = true
    setLangState(next)
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Storage unavailable — the choice just won't persist
    })
  }

  const t = (key: TranslationKey): string => translations[lang][key] || translations.en[key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)

  return <LangContext.Provider value={{ lang, setLang, t, isRtl, ready }}>{children}</LangContext.Provider>
}

// Outside a provider (only ever a dev-time hiccup), English, left to right,
// instead of a red screen.
const FALLBACK: LangContextValue = {
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key: TranslationKey) => translations.en[key] || key,
  isRtl: false,
  ready: true,
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (ctx) return ctx
  if (__DEV__) console.warn('useLang was called outside a LangProvider; using English')
  return FALLBACK
}
