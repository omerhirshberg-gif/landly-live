'use client'

import type { ChangeEvent } from 'react'
import { ChevronDown, Globe } from 'lucide-react'
import { LANGUAGES } from '@/lib/i18n/languages'
import { isPrelaunchLang, PRELAUNCH_COPY, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { JOIN_LANG_STORAGE_KEY, LANG_STORAGE_KEY } from '@/lib/prelaunch/langScript'
import { languageHref } from '@/lib/prelaunch/share'

// A native <select>: the picker in-app browsers handle best, at 16px so iOS
// doesn't zoom. Language names, not flags: a flag isn't a language, and emoji
// flags don't draw on Windows. Choosing one is remembered for the next visit to
// /join (lib/prelaunch/langScript.ts) and keeps the campaign's query string.
export default function LanguageSwitcher({ lang }: { lang: PrelaunchLang }) {
  const change = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value
    if (!isPrelaunchLang(next)) return
    try {
      localStorage.setItem(JOIN_LANG_STORAGE_KEY, next)
      localStorage.setItem(LANG_STORAGE_KEY, next)
    } catch {
      // Storage blocked: the switch still happens, it just isn't remembered.
    }
    window.location.assign(languageHref(next, window.location.search))
  }

  return (
    <div className="relative inline-flex min-h-[44px] items-center text-slate-600 transition-colors focus-within:text-brand hover:text-brand">
      <Globe aria-hidden="true" size={16} strokeWidth={1.75} className="pointer-events-none absolute start-2" />
      <select
        value={lang}
        onChange={change}
        aria-label={PRELAUNCH_COPY[lang].languageLabel}
        className="min-h-[44px] cursor-pointer appearance-none rounded-full bg-transparent pe-7 ps-8 text-base font-semibold text-inherit focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/20"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} className="pointer-events-none absolute end-2" />
    </div>
  )
}
