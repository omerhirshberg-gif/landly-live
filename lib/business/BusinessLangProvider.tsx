'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { translations, TranslationKey } from '@/lib/i18n/translations'

export type BusinessLang = 'he' | 'en'

interface BusinessLangContextValue {
  lang: BusinessLang
  setLang: (lang: BusinessLang) => void
  t: (key: TranslationKey) => string
  isRtl: boolean
}

const BusinessLangContext = createContext<BusinessLangContextValue | null>(null)

const STORAGE_KEY = 'landly_business_lang'

export function useBusinessLang() {
  const ctx = useContext(BusinessLangContext)
  if (!ctx) throw new Error('useBusinessLang must be used within BusinessLangProvider')
  return ctx
}

// Independent from the site-wide lib/i18n/LangProvider.tsx on purpose: its
// own storage key, its own default (Hebrew, not English), and -- unlike
// LangProvider -- it never touches document.documentElement, so switching
// language in here can never bleed into the rest of the site (or vice
// versa). It reuses the same `translations` table (bizdash_* keys included)
// as its only shared surface with the main i18n system, restricted to the
// two languages this toggle offers.
export function BusinessLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<BusinessLang>('he')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'he' || saved === 'en') setLangState(saved)
    } catch {
      // localStorage unavailable -- fall back to the default 'he'
    }
  }, [])

  const setLang = (next: BusinessLang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage unavailable -- selection just won't persist
    }
  }

  const t = (key: TranslationKey): string => translations[lang][key] || translations.en[key]
  const isRtl = lang === 'he'

  return (
    <BusinessLangContext.Provider value={{ lang, setLang, t, isRtl }}>{children}</BusinessLangContext.Provider>
  )
}
