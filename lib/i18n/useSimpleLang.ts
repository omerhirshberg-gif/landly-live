'use client'

import { useEffect, useState } from 'react'

// Standalone-page language toggle used by the 4 auth pages (login/signup/
// forgot-password/reset-password). Separate from the main 5-language
// LangProvider/translations.ts on purpose: the legacy auth HTML files each
// had their own small, page-local `translations` object with only en/he
// (a toggle button, not the 5-language dropdown), and read/write the same
// localStorage key with different fallback logic than the main site
// (anything that isn't exactly 'he' displays as English).

const STORAGE_KEY = 'landly_lang'
type SimpleLang = 'en' | 'he'

interface BaseDict {
  pageTitle: string
  toggleLabel: string
}

export function useSimpleLang<T extends BaseDict>(dict: Record<SimpleLang, T>) {
  const [lang, setLangState] = useState<SimpleLang>('en')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'he') setLangState('he')
    } catch {
      // localStorage unavailable — fall back to default 'en'
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    document.title = dict[lang].pageTitle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const toggleLang = () => {
    setLangState((prev) => {
      const next: SimpleLang = prev === 'en' ? 'he' : 'en'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // localStorage unavailable — language choice just won't persist
      }
      return next
    })
  }

  const t = <K extends keyof T>(key: K): T[K] => dict[lang][key]

  return { lang, t, toggleLang }
}
