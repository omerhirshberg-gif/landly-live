'use client'

import { createContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react'
import { translations, RTL_LANGS, Lang, TranslationKey } from './translations'
import { keyFor } from './neutralAliases'
import { useRaayonitDisplay } from '../flags/raayonitDisplayStore'

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: TranslationKey) => string
  isRtl: boolean
}

export const LangContext = createContext<LangContextValue | null>(null)

const STORAGE_KEY = 'landly_lang'

function applyDirection(lang: Lang) {
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  document.documentElement.classList.toggle('is-rtl', isRtl)
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  // Raayonit's name is read from its neutral twin until the display flag says otherwise (lib/i18n/neutralAliases.ts).
  const raayonitDisplay = useRaayonitDisplay()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null
      if (saved && translations[saved]) {
        setLangState(saved)
        applyDirection(saved)
      }
    } catch {
      // localStorage unavailable — fall back to default 'en'
    }
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    applyDirection(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable — language choice just won't persist
    }
  }, [])

  // Stable per language, so memoized cards and hooks that depend on `t` only re-run when the language changes.
  const t = useCallback((requested: TranslationKey): string => {
    const key = keyFor(requested, raayonitDisplay)
    return translations[lang][key] || translations.en[key]
  }, [lang, raayonitDisplay])

  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  const value = useMemo(() => ({ lang, setLang, t, isRtl }), [lang, setLang, t, isRtl])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}
