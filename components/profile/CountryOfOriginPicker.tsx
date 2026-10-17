'use client'

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { filterCountries, listOriginCountries, type OriginCountry } from '@/lib/profile/countryOfOrigin'
import { useLang } from '@/lib/i18n/useLang'

// The country-of-origin chooser, on the page itself (never a popup): a
// search field over a scrolling list, the common origins first and then
// every country A–Z in the current language. Typing filters by the local
// name, the English name or the ISO code. The list is a listbox: ↑/↓ (and
// Home/End) move between countries, Enter or a click chooses one, ↓ from the
// search field enters the list. Only its vertical overscroll is contained, so
// a sideways edge swipe still goes back in the browser. Used by the onboarding card and by
// /settings/language-region/origin (app: src/components/CountryOfOriginList.tsx).
export default function CountryOfOriginPicker({
  value,
  onChange,
  labelledBy,
  listClassName = 'max-h-[min(46dvh,360px)]',
  invalid = false,
}: {
  value: string
  onChange: (code: string) => void
  labelledBy: string
  /** Height of the scrolling list. */
  listClassName?: string
  invalid?: boolean
}) {
  const { t, lang } = useLang()
  const searchId = useId()
  const [query, setQuery] = useState('')
  const countries = useMemo(() => listOriginCountries(lang), [lang])
  const matches = useMemo(() => (query.trim() ? filterCountries([...countries.pinned, ...countries.rest], query) : null), [countries, query])
  const visible = matches ?? [...countries.pinned, ...countries.rest]
  // The chosen country (or the first one) is the list's tab stop.
  const tabStop = visible.some((c) => c.code === value) ? value : visible[0]?.code

  const options = (list: HTMLElement | null) => Array.from(list?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])

  const onListKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const all = options(e.currentTarget)
    const index = all.indexOf(document.activeElement as HTMLElement)
    const target =
      e.key === 'ArrowDown' ? Math.min(index + 1, all.length - 1) :
      e.key === 'ArrowUp' ? index - 1 :
      e.key === 'Home' ? 0 :
      e.key === 'End' ? all.length - 1 : null
    if (target === null) return
    e.preventDefault()
    // Up from the first country goes back to the search field.
    if (target < 0) document.getElementById(searchId)?.focus()
    else all[target]?.focus()
  }

  const row = (c: OriginCountry) => {
    const selected = c.code === value
    return (
      <button
        key={c.code}
        type="button"
        role="option"
        aria-selected={selected}
        tabIndex={c.code === tabStop ? 0 : -1}
        onClick={() => onChange(c.code)}
        className={`tap-target flex w-full items-center gap-3 min-h-[48px] px-3.5 py-2 text-start transition-colors focus-visible:outline-none focus-visible:bg-slate-100 [@media(hover:hover)]:hover:bg-slate-50 ${
          selected ? 'bg-brandLight/70 text-brand font-semibold' : 'text-ink'
        }`}
      >
        <span aria-hidden="true" className="w-7 shrink-0 text-center text-xl leading-6">{c.flag}</span>
        <span className="min-w-0 flex-1 truncate text-[15px]">{c.name}</span>
        {selected && <i className="fa-solid fa-check flex-shrink-0 text-sm" aria-hidden="true"></i>}
      </button>
    )
  }

  const heading = (label: string) => (
    <div role="presentation" className="sticky top-0 z-[1] bg-white/95 backdrop-blur-sm px-3.5 pt-3 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </div>
  )

  return (
    <div>
      <div className="relative mb-3">
        <i className="fa-solid fa-magnifying-glass pointer-events-none absolute top-1/2 -translate-y-1/2 start-4 text-sm text-slate-400" aria-hidden="true"></i>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowDown') return
            e.preventDefault()
            options(e.currentTarget.parentElement?.nextElementSibling as HTMLElement | null)[0]?.focus()
          }}
          aria-label={t('origin_search_label')}
          placeholder={t('origin_search_placeholder')}
          autoComplete="off"
          enterKeyHint="search"
          // 16px so iOS Safari doesn't zoom the page on focus.
          className="w-full h-12 ps-11 pe-4 rounded-[14px] border border-slate-200 bg-slate-50 text-base text-ink placeholder:text-slate-400 focus:outline-none focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
        />
      </div>
      <div
        role="listbox"
        aria-labelledby={labelledBy}
        aria-invalid={invalid || undefined}
        onKeyDown={onListKeyDown}
        className={`${listClassName} overflow-y-auto overscroll-y-contain rounded-2xl border bg-white divide-y divide-slate-50 ${invalid ? 'border-red-600' : 'border-slate-200'}`}
      >
        {matches ? (
          matches.length ? matches.map(row) : <p role="status" className="px-4 py-6 text-center text-sm text-slate-500">{t('origin_no_results')}</p>
        ) : (
          <>
            {heading(t('origin_common'))}
            {countries.pinned.map(row)}
            {heading(t('origin_all'))}
            {countries.rest.map(row)}
          </>
        )}
      </div>
    </div>
  )
}
