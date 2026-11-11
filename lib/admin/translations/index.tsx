'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { dirOf, persistLocale, type AdminLocale } from '@/lib/admin/adminLocale'
import { en, type AdminKey } from './en'
import { he } from './he'

export type { AdminKey }

const DICTIONARIES: Record<AdminLocale, Record<AdminKey, string>> = { en, he }

type Vars = Record<string, string | number>

/** `{name}` placeholders filled from vars; an unknown one is left visible rather than silently dropped. */
export function format(template: string, vars?: Vars) {
  return vars ? template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole)) : template
}

export function translate(locale: AdminLocale, key: AdminKey, vars?: Vars) {
  return format(DICTIONARIES[locale][key], vars)
}

/** Singular or plural by count: looks up `<key>.one` for exactly 1, else `<key>.other`. */
export function translatePlural(locale: AdminLocale, key: string, n: number, vars?: Vars) {
  return translate(locale, `${key}.${n === 1 ? 'one' : 'other'}` as AdminKey, { n, ...vars })
}

/** A route title (always English in lib/admin/routes.ts) or crumb in the admin's language; names pass through. */
export function routeLabel(locale: AdminLocale, label: string) {
  const key = `route.${label}`
  return key in en ? DICTIONARIES[locale][key as AdminKey] : label
}

interface LocaleState {
  locale: AdminLocale
  dir: 'ltr' | 'rtl'
  setLocale: (locale: AdminLocale) => void
  t: (key: AdminKey, vars?: Vars) => string
  tn: (key: string, n: number, vars?: Vars) => string
  route: (label: string) => string
}

const FALLBACK: LocaleState = {
  locale: 'en',
  dir: 'ltr',
  setLocale: () => {},
  t: (key, vars) => translate('en', key, vars),
  tn: (key, n, vars) => translatePlural('en', key, n, vars),
  route: (label) => routeLabel('en', label),
}

const LocaleContext = createContext<LocaleState>(FALLBACK)

/** Holds the admin's language. The server hands in the cookie's value so the first paint already has the right direction. */
export function AdminLocaleProvider({ initialLocale, children }: { initialLocale: AdminLocale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(initialLocale)

  const setLocale = useCallback((next: AdminLocale) => {
    setLocaleState(next)
    persistLocale(next)
  }, [])

  // Screen readers and spell-checkers follow the language inside the admin; the
  // direction itself is set on the shell's wrapper, so the site's own banners stay as they are.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.lang
    root.lang = locale
    return () => {
      root.lang = previous
    }
  }, [locale])

  const value = useMemo<LocaleState>(
    () => ({
      locale,
      dir: dirOf(locale),
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      tn: (key, n, vars) => translatePlural(locale, key, n, vars),
      route: (label) => routeLabel(locale, label),
    }),
    [locale, setLocale],
  )
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** The admin's language and its `t()`. Outside the provider (unit tests) it is English. */
export function useAdminT() {
  return useContext(LocaleContext)
}
