'use client'

import { useAdminT } from '@/lib/admin/translations'
import type { AdminLocale } from '@/lib/admin/adminLocale'

const OPTIONS: readonly { value: AdminLocale; label: string; lang: string; nameKey: 'header.langEnName' | 'header.langHeName' }[] = [
  { value: 'en', label: 'EN', lang: 'en', nameKey: 'header.langEnName' },
  { value: 'he', label: 'עב', lang: 'he', nameKey: 'header.langHeName' },
]

// The admin's language: a compact two-part segmented control, [ EN | עב ], with a
// globe. It is always laid out left to right so the order never flips with the
// page, and its size is the same in both languages, so nothing shifts on a switch.
// The short labels are visual only: each button's accessible name is the full language name.
export default function AdminLangSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useAdminT()
  return (
    <div role="group" aria-label={t('header.language')} dir="ltr" className={`inline-flex h-12 items-center gap-1 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 ps-2.5 ${className}`}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-[#64748B]">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
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
            className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold tracking-wide transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] ${
              selected ? 'bg-[#0038B8] text-white shadow-sm' : 'text-[#475569] hover:text-[#0B1B3D]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
