'use client'

import { useEffect, useState } from 'react'

// Standalone-page language reader used by the 4 auth pages (login/signup/
// forgot-password/reset-password). Separate from the main 5-language
// LangProvider/translations.ts on purpose: the legacy auth HTML files each
// had their own small, page-local `translations` object with only en/he.
// These pages have no switcher of their own — they silently follow the
// language the user already chose on the main site (same localStorage key,
// read-only here), falling back to English for new visitors and for any
// saved language other than Hebrew.

const STORAGE_KEY = 'landly_lang'
type SimpleLang = 'en' | 'he'

interface BaseDict {
  pageTitle: string
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

  const t = <K extends keyof T>(key: K): T[K] => dict[lang][key]

  return { lang, t }
}
