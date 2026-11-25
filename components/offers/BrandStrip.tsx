'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import RailArrows, { useRail } from './RailArrows'
import { useLang } from '@/lib/i18n/useLang'
import { localizedBusinessName, parseBusinessTranslations } from '@/lib/business/businessText'
import type { BrandIndexEntry } from '@/lib/offers/branches'
import { webOfferPath } from '@/lib/offers/offerRoutes'
import { sortBrandsByReach } from '@/lib/offers/resolveChainBrand'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// The brands a multi-chain pass works at, as a row of logo tiles (a logo on a white stage, the name, how many branches honour
// the voucher), each tile opens that chain's own page. A search narrows the row and "View all" lists every brand in a sheet.
// Expo: landly-mobile/src/components/BrandStrip.tsx.
const countLabel = (t: (k: never) => string, n: number) => (n === 1 ? t('brands_one_branch' as never) : t('brands_branch_count' as never).replace('{count}', String(n)))

// Every brand image is shown whole, with an even margin inside its rounded box, so nothing touches or crosses the border.
// A photo, or any image in the sheet, sits in front of a soft blurred copy of itself (as the offer cards draw it);
// a logo in the row sits on the white stage. Expo: Logo in landly-mobile/src/components/BrandStrip.tsx.
function Logo({ entry, className, backdrop = false }: { entry: BrandIndexEntry; className: string; backdrop?: boolean }) {
  const [failed, setFailed] = useState(false)
  const own = !failed && !!entry.logoUrl
  const src = own ? entry.logoUrl : RAAYONIT_LOGO_PATH
  if (own && (backdrop || entry.photo)) {
    return (
      <span className="relative block h-full w-full overflow-hidden bg-[#F4F6F9]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
        <span className="absolute inset-0 bg-[#F4F6F9]/45" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-contain p-3" />
      </span>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`${className} object-contain ${own ? 'p-3' : 'p-6'}`} />
}

// `compact`: the voucher page's rail, whose search lives in the "Find your business" popup, so the search box and the second "show all" button are left out.
export default function BrandStrip({ entries, compact = false }: { entries: BrandIndexEntry[]; compact?: boolean }) {
  const { t, lang } = useLang()
  const [query, setQuery] = useState('')
  const [all, setAll] = useState(false)
  const named = useMemo(() => sortBrandsByReach(entries).map((e) => ({ ...e, label: localizedBusinessName({ businessName: e.name, businessTranslations: parseBusinessTranslations(e.nameTranslations) }, lang).text })), [entries, lang])
  const q = query.trim().toLowerCase()
  const match = (e: { label: string; name: string }) => !q || e.label.toLowerCase().includes(q) || e.name.includes(query.trim())
  const shown = named.filter(match)
  const count = String(named.length)
  const rail = useRail<HTMLUListElement>(shown.length)
  return (
    <div className="space-y-3">
      {/* One "show all" action: the full-width button under the rail. The compact strip has no such button, so it keeps this link. */}
      <div className={`flex items-center gap-3 ${compact ? 'justify-between' : 'justify-end'}`}>
        {compact && (
          <button type="button" onClick={() => setAll(true)} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand hover:underline">
            {t('brands_show_all').replace('{count}', '\u2066' + count + '\u2069')}
          </button>
        )}
        <RailArrows edge={rail.edge} page={rail.page} />
      </div>
      {!compact && <label className="flex h-11 items-center gap-2 rounded-[14px] bg-slate-100 px-3.5 focus-within:ring-2 focus-within:ring-brand/40">
        <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('brands_search')} aria-label={t('brands_search')} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400" />
      </label>}
      {shown.length === 0 ? (
        <p className="py-3 text-center text-sm text-muted">{t('brands_no_results')}</p>
      ) : (
        <ul ref={rail.ref} onScroll={rail.measure} className="-mx-1 flex snap-x scroll-px-1 gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {shown.map((e) => (
            <li key={e.offerId} className="w-[136px] shrink-0 snap-start sm:w-[144px]">
              <Link href={webOfferPath(e.offerId)} className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span className="flex h-[92px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:shadow-card-hover">
                  <Logo entry={e} className="h-full w-full" />
                </span>
                <bdi className="mt-1.5 block truncate text-sm font-semibold text-ink" dir="auto">{e.label}</bdi>
                {e.branchCount > 0 && <span className="block text-xs text-muted">{countLabel(t as never, e.branchCount)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!compact && <button type="button" onClick={() => setAll(true)} className="min-h-[44px] w-full rounded-xl border border-[#0038B8]/25 bg-[#F0F7FF] px-4 text-sm font-semibold text-[#0038B8] transition-colors hover:bg-[#E0EFFE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        {t('brands_show_all_cta').replace('{count}', '\u2066' + count + '\u2069')}
      </button>}
      {all && <AllBrands entries={named} onClose={() => setAll(false)} />}
    </div>
  )
}

function AllBrands({ entries, onClose }: { entries: (BrandIndexEntry & { label: string })[]; onClose: () => void }) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  useBodyScrollLock(true)
  const q = query.trim().toLowerCase()
  const rows = entries.filter((e) => !q || e.label.toLowerCase().includes(q) || e.name.includes(query.trim()))
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 md:items-center md:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t('perk_chains_title')} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()} className="flex max-h-[88vh] w-full max-w-[920px] flex-col rounded-t-[28px] bg-white pb-2 shadow-2xl md:rounded-3xl">
        <div className="flex items-center gap-2 p-4 pb-3">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-[14px] bg-slate-100 px-3.5 focus-within:ring-2 focus-within:ring-brand/40">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('brands_search')} aria-label={t('brands_search')} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400" />
          </label>
          <button type="button" onClick={onClose} aria-label={t('avatar_cancel')} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" strokeWidth={2} /></button>
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t('brands_no_results')}</p>
        ) : (
          <ul data-all-brands-grid className="grid grid-cols-2 gap-3 overflow-y-auto px-4 pb-4 sm:grid-cols-3 md:grid-cols-4">
            {rows.map((e) => (
              <li key={e.offerId}>
                <Link href={webOfferPath(e.offerId)} onClick={onClose} className="group block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  <span className="block h-[92px] overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:shadow-card-hover">
                    <Logo entry={e} backdrop className="h-full w-full" />
                  </span>
                  <bdi className="mt-1.5 block truncate text-sm font-semibold text-ink" dir="auto">{e.label}</bdi>
                  {e.branchCount > 0 && <span className="block text-xs text-muted">{countLabel(t as never, e.branchCount)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
