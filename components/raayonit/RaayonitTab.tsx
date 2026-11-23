'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import { readFilters, writeFilters } from '@/lib/offers/raayonitFilterMemory'
import { Search } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { chainsByCategory, keepRaayonitFilter } from '@/lib/offers/discoverTab'
import { raayonitCategoryName, type RaayonitCategoryId } from '@/lib/offers/raayonitCategories'
import { normalizeQuery } from '@/lib/perks/perksFilter'
import { availableRegionFilters, chainMatchesSearch, matchesRegionFilter, nearMe, NEAR_ME_RADIUS_KM, RAAYONIT_REGION_LABEL_KEYS, type RaayonitRegionFilter } from '@/lib/offers/raayonitRegions'
import { MemberColumn } from '@/components/layout/MemberPageShell'
import { raayonitRows, RAAYONIT_MORE_ROW } from '@/lib/offers/raayonitRows'
import ChainTile from './ChainTile'
import RaayonitCategoryRail from './RaayonitCategoryRail'
import RaayonitCategoryDialog from './RaayonitCategoryDialog'
import RaayonitFilterMenu, { NO_RAAYONIT_FILTERS, raayonitFilterCount, type RaayonitFilterValues } from './RaayonitFilterMenu'

// "Where to redeem" (native: landly-mobile/src/components/RaayonitTab.tsx): a title, one search field with a Filter button beside it (Category and
// Region live in the button's popover / bottom sheet), a summary bar with "Clear filters" while any filter is on, the live result count and a grid
// of framed venue cards. Tapping a card opens its page (/offers/[offerId]). `initialCategory` (?category=) pre-selects a category.
export default memo(function RaayonitTab({ offers, initialCategory }: { offers: OfferDocument[]; initialCategory?: string }) {
  const { t, lang } = useLang()
  // A `?category=` link wins; otherwise the filters the member left with (opening a business and pressing back) come back.
  const [filters, setFilters] = useState<RaayonitFilterValues>(() => {
    if (initialCategory) return { ...NO_RAAYONIT_FILTERS, category: initialCategory as RaayonitCategoryId }
    const kept = readFilters()
    return kept ? { category: kept.category as RaayonitCategoryId, region: kept.region as RaayonitRegionFilter, near: kept.near } : NO_RAAYONIT_FILTERS
  })
  useEffect(() => { writeFilters(filters) }, [filters])
  const [query, setQuery] = useState('')
  const q = normalizeQuery(query)
  const allGroups = useMemo(() => chainsByCategory(offers, lang, { membership: true }), [offers, lang])
  const regions = useMemo(() => availableRegionFilters(offers), [offers])
  const category = keepRaayonitFilter(filters.category, allGroups)
  const region = regions.includes(filters.region) ? filters.region : 'all'
  const [openId, setOpenId] = useState<string | null>(null)
  const near = filters.near
  const { visible, groups } = useMemo(() => {
    const byRegion = near ? nearMe(offers, near) : region === 'all' ? offers : offers.filter((o) => matchesRegionFilter(o, region))
    const bySearch = q ? byRegion.filter((o) => chainMatchesSearch(o, q, t, lang)) : byRegion
    const grouped = chainsByCategory(bySearch, lang, { membership: true })
    const picked = category === 'all' ? grouped : grouped.filter((g) => g.id === category)
    // Near me lists the venues themselves, nearest first, not the category groups' alphabetical order.
    return { visible: near ? bySearch.filter((o) => picked.some((g) => g.offers.includes(o))) : [...new Map(picked.flatMap((g) => g.offers).map((o) => [o.id, o] as const)).values()], groups: picked }
  }, [offers, region, near, q, category, t, lang])
  // Browsing (no search, no category) is one row per category; a search or a picked category lists the matches as a grid.
  const rows = !q && category === 'all' && !near
  const rowList = useMemo(() => raayonitRows(groups), [groups])
  const rowTitle = (id: string) => (id === RAAYONIT_MORE_ROW ? t('raayonit_row_more') : raayonitCategoryName(id as RaayonitCategoryId, lang))
  const openRow = openId ? rowList.find((r) => r.id === openId) : undefined
  const active: RaayonitFilterValues = { category, region, near }
  const count = raayonitFilterCount(active)
  const summary = [category !== 'all' ? raayonitCategoryName(category, lang) : null, near ? `${t('geo_near_me_btn')} · ${NEAR_ME_RADIUS_KM} ${lang === 'he' ? 'ק״מ' : lang === 'ru' ? 'км' : 'km'}` : region !== 'all' ? t(RAAYONIT_REGION_LABEL_KEYS[region]) : null].filter(Boolean).join(' · ')
  const list = visible.length === 0 ? (
    <p className="py-10 text-center text-sm text-muted">{t('raayonit_no_results')}</p>
  ) : rows ? null : (
    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">{visible.map((o) => <li key={o.id}><ChainTile offer={o} /></li>)}</ul>
  )
  return (
    <div>
      <MemberColumn wide>
      <section aria-labelledby="businesses-title" className="mx-auto w-full max-w-6xl">
        <h2 id="businesses-title" className="text-[22px] font-extrabold tracking-tight text-ink sm:text-2xl">{t('raayonit_where_title')}</h2>
        <div className="mt-3.5 flex items-center gap-2">
          <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-slate-100 px-3.5 focus-within:ring-2 focus-within:ring-brand/40">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('raayonit_search_business')} aria-label={t('raayonit_search_business')} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400" />
          </label>
          <RaayonitFilterMenu values={active} onApply={setFilters} categories={allGroups.map((g) => ({ id: g.id, label: raayonitCategoryName(g.id, lang) }))} regions={regions} />
          {regions.length > 1 && <RaayonitFilterMenu mode="region" values={active} onApply={setFilters} categories={[]} regions={regions} />}
        </div>
        {count > 0 && (
          <div className="mt-3 flex min-h-10 items-center gap-3 rounded-xl bg-brandTint px-3">
            <bdi dir="auto" className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand">{summary}</bdi>
            <button type="button" onClick={() => setFilters(NO_RAAYONIT_FILTERS)} className="min-h-10 shrink-0 text-[13px] font-bold text-brand underline">{t('raayonit_filter_clear')}</button>
          </div>
        )}
        <p role="status" className="mt-4 text-sm font-bold text-ink">{t('raayonit_results').split('{count}').map((part, i, all) => <span key={i}>{part}{i < all.length - 1 && <bdi dir="ltr">{visible.length}</bdi>}</span>)}</p>
        {list}
      </section>
      </MemberColumn>
      {rows && visible.length > 0 && (
        <div className="mt-4">
          {rowList.map((row, i) => (
            <RaayonitCategoryRail divider={i > 0} key={row.id} id={`raayonit-row-${row.id}`} title={rowTitle(row.id)} offers={row.offers} hasMore={row.hasMore} onShowAll={() => setOpenId(row.id)} />
          ))}
        </div>
      )}
      {openRow && <RaayonitCategoryDialog title={rowTitle(openRow.id)} offers={openRow.all} onClose={() => setOpenId(null)} />}
    </div>
  )
})
