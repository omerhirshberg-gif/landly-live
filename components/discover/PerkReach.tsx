'use client'

import { useRef, useState } from 'react'
import { Globe, Network } from 'lucide-react'
import BranchNavigationModal, { type BranchTarget } from '@/components/offers/BranchNavigationModal'
import { useLang } from '@/lib/i18n/useLang'
import type { OfferDocument } from '@/lib/firebase/offers'
import { locationNotice, withCount } from '@/lib/offers/locationVisibility'
import { participatingBranches } from '@/lib/offers/participatingBranches'

type ReachOffer = Pick<OfferDocument, 'fulfillmentType' | 'perkScope' | 'isNationwide' | 'participatingChains' | 'participatingPlaces' | 'chainsCount' | 'universalRedemptionGuide' | 'translations'> & { businessName?: string; brandName?: string }

export const isMultiChain = (offer: Pick<ReachOffer, 'perkScope'>) => offer.perkScope === 'multi_chain'

/** Where a multi-branch perk can be used, in place of a single store's address: the store or chain count, or the validity notice. Null for a single-location perk. Wraps instead of cutting mid-sentence. */
export function PerkReachLine({ offer, className = '' }: { offer: ReachOffer; className?: string }) {
  const { t } = useLang()
  const notice = locationNotice(offer)
  if (!notice) return null
  const Icon = notice.key === 'perk_honoured_at_chains' ? Network : Globe
  return (
    <span className={`flex min-w-0 items-start gap-1 ${className}`}>
      <Icon aria-hidden="true" className="mt-[3px] h-3 w-3 shrink-0 text-brand" strokeWidth={1.75} />
      <span className="line-clamp-2 min-w-0 font-medium">{withCount(t(notice.key), notice.count)}</span>
    </span>
  )
}

/** The stores or chains that honour a perk, as a row of plain cards the reader scrolls sideways, in their own language. */
export function ParticipatingChains({ offer, guide = true }: { offer: ReachOffer; guide?: boolean }) {
  const { t, lang } = useLang()
  const branches = participatingBranches(offer, lang)
  const [picked, setPicked] = useState<BranchTarget | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  // One brand's stores are searched with its name in front; a multi-chain pass spans brands, so its names stand alone.
  const brand = offer.perkScope === 'multi_chain' ? null : offer.brandName || offer.businessName || null
  return (
    <div className="space-y-4">
      <ul
        aria-label={t(offer.perkScope === 'multi_chain' ? 'perk_chains_title' : 'perk_stores_title')}
        className="-mx-1 flex snap-x snap-mandatory flex-nowrap gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
      >
        {branches.map((branch) => (
          <li key={branch.key} className="flex shrink-0 snap-start">
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`${branch.label}. ${t('perk_stores_hint')}`}
              onClick={(event) => {
                opener.current = event.currentTarget
                setPicked({ label: branch.label, name: branch.name, brand, point: branch.point })
              }}
              className="flex min-h-11 min-w-[6rem] max-w-[15rem] items-center rounded-xl border border-[#E2E8F0] bg-white px-4 py-2.5 text-start transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              <bdi dir="auto" className="line-clamp-2 text-sm font-semibold leading-snug text-ink">{branch.label}</bdi>
            </button>
          </li>
        ))}
      </ul>
      {branches.length > 0 && <p className="-mt-2 text-xs text-slate-500">{t('perk_stores_hint')}</p>}
      <BranchNavigationModal branch={picked} onClose={() => setPicked(null)} returnFocusTo={opener.current} />
      {guide && <RedemptionGuide offer={offer} />}
    </div>
  )
}

/** How to redeem a multi-chain pass at any of its chains, in the reader's language; nothing when the admin wrote none. */
export function RedemptionGuide({ offer }: { offer: ReachOffer }) {
  const { t, lang } = useLang()
  const guide = offer.universalRedemptionGuide
  const text = guide ? (lang === 'he' ? guide.he || guide.en : guide.en || guide.he) : ''
  if (!text) return null
  return (
    <div>
      <p className="mb-1 text-sm font-bold text-ink">{t('perk_chains_redeem_title')}</p>
      <p className="whitespace-pre-line text-copy leading-relaxed text-body" dir="auto">{text}</p>
    </div>
  )
}
