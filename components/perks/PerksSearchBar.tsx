'use client'

import { useLang } from '@/lib/i18n/useLang'

// The search field in the /categories filter toolbar: filters as you type
// (the page debounces), no submit button. A 44px soft slate-50 pill at every
// width, the same height as Near Me and the Sort trigger beside it.
// 16px text on phones so iOS doesn't zoom on focus. Icon sits at the start
// edge and the clear button at the end, mirroring in RTL.
export default function PerksSearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLang()
  return (
    <div role="search" className="relative w-full">
      <i
        aria-hidden="true"
        className="fa-solid fa-magnifying-glass pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"
      ></i>
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('cats_search_placeholder')}
        aria-label={t('cats_search_placeholder')}
        className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 ps-10 pe-11 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('cats_clear_search')}
          className="absolute end-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-slate-400 [-webkit-tap-highlight-color:transparent] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand [@media(hover:hover)]:hover:text-slate-600"
        >
          <i aria-hidden="true" className="fa-solid fa-xmark text-sm"></i>
        </button>
      )}
    </div>
  )
}
