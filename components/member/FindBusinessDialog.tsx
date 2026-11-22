'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ChevronRight, Search, X } from 'lucide-react'
import BrandMedia from '@/components/ui/BrandMedia'
import HowToRedeem from '@/components/offers/HowToRedeem'
import type { OfferDocument } from '@/lib/firebase/offers'
import { localizedBusinessName } from '@/lib/business/businessText'
import { useLang } from '@/lib/i18n/useLang'
import { useLocalizedContent } from '@/lib/i18n/useLocalizedContent'
import { chainsByCategory, isChain } from '@/lib/offers/discoverTab'
import { offerTextSources } from '@/lib/offers/offerText'
import { webOfferPath } from '@/lib/offers/offerRoutes'
import { raayonitCategoryName, raayonitCategoryOf } from '@/lib/offers/raayonitCategories'
import { chainMatchesSearch } from '@/lib/offers/raayonitRegions'
import { normalizeQuery } from '@/lib/perks/perksFilter'
import { useBodyScrollLock } from '@/lib/useBodyScrollLock'
import { useIsSheet } from '@/lib/useIsSheet'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'

// "Find your business" on a pass: a popup with a search over the businesses that honour the pass; picking one shows that business's own
// redemption steps and conditions right there, so the buyer needn't leave the pass. A bottom sheet on phones, a centred dialog from 768px
// (the same shell as the Raayonit category list). `only` opens straight on one business (a single-business pass), with no list.
// Native: landly-mobile/src/components/FindBusinessSheet.tsx.
export default function FindBusinessDialog({ chains, only, onClose }: { chains: OfferDocument[]; only?: OfferDocument; onClose: () => void }) {
  const { t, lang } = useLang()
  const [picked, setPicked] = useState<OfferDocument | null>(only ?? null)
  const [query, setQuery] = useState('')
  const list = useMemo(() => chainsByCategory(chains, lang).flatMap((g) => g.offers), [chains, lang])
  const q = normalizeQuery(query)
  const shown = useMemo(() => list.filter((o) => chainMatchesSearch(o, q, t, lang)), [list, q, t, lang])
  const isSheet = useIsSheet()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useBodyScrollLock(true)
  useEffect(() => { panelRef.current?.focus() }, [])
  const canGoBack = !!picked && !only
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (canGoBack) setPicked(null)
    else onClose()
  }
  const panel = (
    <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown}
      className={isSheet
        ? 'perks-sheet absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white px-4 pt-2 outline-none'
        : 'perks-pop absolute start-1/2 top-1/2 flex max-h-[86dvh] w-[min(720px,calc(100vw-48px))] -translate-y-1/2 flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,.22)] outline-none ltr:-translate-x-1/2 rtl:translate-x-1/2'}>
      {isSheet && <div aria-hidden="true" className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-300" />}
      <div className="flex items-center justify-between gap-3 pb-3">
        {canGoBack ? (
          <button type="button" onClick={() => setPicked(null)} className="-ms-2 flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:hidden" strokeWidth={2} />
            <ArrowRight aria-hidden="true" className="hidden h-4 w-4 rtl:block" strokeWidth={2} />
            {t('voucher_biz_find_back')}
          </button>
        ) : (
          <h2 id={titleId} className="min-w-0 text-lg font-extrabold tracking-tight text-ink sm:text-xl">{t('voucher_biz_find_title')}</h2>
        )}
        <button type="button" onClick={onClose} aria-label={t('avatar_cancel')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 [@media(hover:hover)]:hover:bg-slate-100">
          <X aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
      {picked ? (
        <BusinessDetail offer={picked} titleId={canGoBack ? titleId : undefined} />
      ) : (
        <>
          <label className="mb-3 flex h-11 shrink-0 items-center gap-2 rounded-[14px] bg-slate-100 px-3.5 focus-within:ring-2 focus-within:ring-brand/40">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('voucher_biz_find_search')} aria-label={t('voucher_biz_find_search')} className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-slate-400" />
          </label>
          {shown.length === 0 && <p role="status" className="py-8 text-center text-sm text-slate-600">{t('raayonit_no_results')}</p>}
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
            {shown.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => setPicked(o)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-2.5 text-start transition-colors [@media(hover:hover)]:hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                  <span aria-hidden="true" className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-[#EEF2F7]">
                    <BrandMedia src={o.imageUrl || RAAYONIT_LOGO_PATH} cover={!!o.imageUrl && o.logoKind === 'photo'} inset="p-2" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <bdi dir="auto" className="block truncate text-[15px] font-bold text-ink">{localizedBusinessName(o, lang).text}</bdi>
                    <span className="block truncate text-[13px] text-slate-500">{raayonitCategoryName(raayonitCategoryOf(o), lang)}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400 rtl:-scale-x-100" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
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

// One business: its name, its own redemption steps and conditions, the hotel notice where it applies, and a link to its full page.
function BusinessDetail({ offer, titleId }: { offer: OfferDocument; titleId?: string }) {
  const { t, lang } = useLang()
  const content = useLocalizedContent(offerTextSources(offer), offer.translations, lang)
  const instructions = content.text('redemptionInstructions')
  const terms = content.text('redemptionTerms')
  const name = localizedBusinessName(offer, lang).text
  const hasOwn = instructions.text.trim() !== '' || terms.text.trim() !== ''
  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-[#EEF2F7]">
          <BrandMedia src={offer.imageUrl || RAAYONIT_LOGO_PATH} cover={!!offer.imageUrl && offer.logoKind === 'photo'} inset="p-2" />
        </span>
        <div className="min-w-0">
          <h3 id={titleId} className="truncate text-lg font-extrabold tracking-tight text-ink"><bdi dir="auto">{name}</bdi></h3>
          <p className="truncate text-[13px] text-slate-500">{raayonitCategoryName(raayonitCategoryOf(offer), lang)}</p>
        </div>
      </div>
      <div className="mt-4">
        <HowToRedeem method={offer.redemptionMethod} instructions={instructions.text} instructionsLang={instructions.lang} terms={terms.text} termsLang={terms.lang} codeOnly={isChain(offer)} variant="card" />
      </div>
      {!hasOwn && <p className="mt-3 text-[13px] leading-relaxed text-slate-600">{t('voucher_biz_find_generic')}</p>}
      {raayonitCategoryOf(offer) === 'hotels' && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900">{t('raayonit_hotel_notice')}</p>}
      <Link href={webOfferPath(offer.id)} className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">{t('voucher_biz_find_open')}</Link>
    </div>
  )
}
