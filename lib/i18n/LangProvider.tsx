'use client'

import { createContext, useEffect, useState, ReactNode } from 'react'
import { translations, RTL_LANGS, Lang, TranslationKey } from './translations'

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

  const setLang = (next: Lang) => {
    setLangState(next)
    applyDirection(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable — language choice just won't persist
    }
  }

  const t = (key: TranslationKey): string => {
    return translations[lang][key] || translations.en[key]
  }

  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)

  return <LangContext.Provider value={{ lang, setLang, t, isRtl }}>{children}</LangContext.Provider>
}
