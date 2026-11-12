'use client'

import { Search, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// The search field in the /categories filter toolbar: filters as you type
// (the page debounces), no submit button. A 48px soft slate-100 pill at every
// width, the same height as the Near Me pill beside it.
// 16px text on phones so iOS doesn't zoom on focus. Icon sits at the start
// edge and the clear button at the end, mirroring in RTL.
export default function PerksSearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLang()
  return (
    <div role="search" className="relative w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute start-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400"
        strokeWidth={2}
      />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('cats_search_placeholder')}
        aria-label={t('cats_search_placeholder')}
        className="h-12 w-full rounded-full border border-slate-200/80 bg-slate-100/90 ps-12 pe-12 text-base text-slate-900 shadow-sm placeholder:text-slate-500 transition-all hover:bg-slate-100 focus:border-brand focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand/10"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('cats_clear_search')}
          className="absolute end-0 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full text-slate-400 [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand [@media(hover:hover)]:hover:text-slate-600"
        >
          <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
