'use client'

import { useAdminT } from '@/lib/admin/translations'
import type { AdminLocale } from '@/lib/admin/adminLocale'

const OPTIONS: readonly { value: AdminLocale; label: string; lang: string; nameKey: 'header.langEnName' | 'header.langHeName' }[] = [
  { value: 'en', label: 'EN', lang: 'en', nameKey: 'header.langEnName' },
  { value: 'he', label: 'עב', lang: 'he', nameKey: 'header.langHeName' },
]

// The admin's language: a two-part segmented control, [ EN | עב ], text only (no
// icon). It is always laid out left to right so the order never flips with the
// page, and its size is the same in both languages, so nothing shifts on a switch.
// The short labels are visual only: each button's accessible name is the full language name.
export default function AdminLangSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useAdminT()
  return (
    <div role="group" aria-label={t('header.language')} dir="ltr" className={`inline-flex h-11 items-center gap-1 rounded-xl border border-adm-line bg-adm-sunken p-1 ${className}`}>
      {OPTIONS.map((option) => {
        const selected = option.value === locale
        return (
          <button
            key={option.value}
            type="button"
            lang={option.lang}
            aria-pressed={selected}
            aria-label={t(option.nameKey)}
            onClick={() => setLocale(option.value)}
            className={`inline-flex h-full min-h-11 min-w-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-semibold tracking-wide transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/50 ${
              selected ? 'bg-adm-nav-active text-adm-nav-active-text shadow-sm' : 'text-adm-text-2 hover:text-adm-text'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
