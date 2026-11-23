'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useIsSheet } from '@/lib/useIsSheet'
import type { OfferDocument } from '@/lib/firebase/offers'
import { normalizeQuery } from '@/lib/perks/perksFilter'
import { raayonitCategoriesOf, raayonitCategoryName, raayonitCategoryOf, type RaayonitCategoryId } from '@/lib/offers/raayonitCategories'
import { chainMatchesSearch } from '@/lib/offers/raayonitRegions'
import RailArrows, { useRail } from '@/components/offers/RailArrows'
import ChainTile from './ChainTile'

// A category's full list (native: landly-mobile/src/components/RaayonitCategorySheet.tsx), opened by the row's "Show all": a bottom sheet on phones,
// a centred dialog from 768px, with the same scrim, rise and Escape / outside-tap close as the Filter panel.
export default function RaayonitCategoryDialog({ title, offers, onClose }: { title: string; offers: OfferDocument[]; onClose: () => void }) {
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<RaayonitCategoryId | 'all'>('all')
  // A list spanning several categories (the details page's every business) can be narrowed by category; one category's own list has nothing to narrow.
  const categories = useMemo(() => [...new Set(offers.map((o) => raayonitCategoryOf(o)))], [offers])
  const q = normalizeQuery(query)
  const pills = useRail<HTMLDivElement>(categories.length)
  const shown = useMemo(() => offers.filter((o) => (category === 'all' || raayonitCategoriesOf(o).includes(category)) && chainMatchesSearch(o, q, t, lang)), [offers, category, q, t, lang])
  const isSheet = useIsSheet()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useBodyScrollLock(true)
  useEffect(() => { panelRef.current?.focus() }, [])
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
  }
  const panel = (
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}
      className={isSheet
        ? 'perks-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white px-4 pt-2 outline-none'
        : 'perks-pop absolute start-1/2 top-1/2 flex max-h-[86dvh] w-[min(1040px,calc(100vw-48px))] -translate-y-1/2 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,.22)] outline-none ltr:-translate-x-1/2 rtl:translate-x-1/2'}>
      {isSheet && <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />}
      <div className="flex items-center justify-between gap-3 pb-3">
        <h2 id={titleId} className="min-w-0 text-lg font-extrabold tracking-tight text-ink sm:text-xl">
          <bdi dir="auto">{title}</bdi> <span className="font-semibold text-slate-500">(<bdi dir="ltr">{shown.length}</bdi>)</span>
        </h2>
        <button type="button" onClick={onClose} aria-label={t('avatar_cancel')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100">
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      <label className="mb-3 flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-slate-100 px-3.5 focus-within:ring-2 focus-within:ring-brand/40">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('raayonit_search_business')} aria-label={t('raayonit_search_business')} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400" />
      </label>
      {categories.length > 1 && (
        <div className="mb-3 flex shrink-0 items-center gap-2">
        <div ref={pills.ref} onScroll={pills.measure} role="radiogroup" aria-label={t('raayonit_filter_btn')} className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {(['all', ...categories] as const).map((id) => (
            <button key={id} type="button" role="radio" aria-checked={category === id} onClick={() => setCategory(id)}
              className={`min-h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${category === id ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-white text-slate-700 [@media(hover:hover)]:hover:border-slate-300'}`}>
              {id === 'all' ? t('cats_all_categories') : raayonitCategoryName(id, lang)}
            </button>
          ))}
        </div>
        <RailArrows edge={pills.edge} page={pills.page} />
        </div>
      )}
      {shown.length === 0 && <p role="status" className="py-8 text-center text-sm text-slate-600">{t('raayonit_no_results')}</p>}
      <ul className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))] sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((o) => <li key={o.id}><ChainTile offer={o} /></li>)}
      </ul>
    </div>
  )
  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div aria-hidden="true" onClick={onClose} className="perks-scrim absolute inset-0 bg-ink/30" />
      {panel}
    </div>,
    document.body
  )
}
