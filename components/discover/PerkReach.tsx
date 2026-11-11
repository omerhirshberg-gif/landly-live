'use client'

import { Globe, Network } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import type { OfferDocument } from '@/lib/firebase/offers'

type ReachOffer = Pick<OfferDocument, 'fulfillmentType' | 'perkScope' | 'participatingChains' | 'chainsCount' | 'universalRedemptionGuide'>

export const isMultiChain = (offer: Pick<ReachOffer, 'perkScope'>) => offer.perkScope === 'multi_chain'

/** Where a Multipass perk can be used, in place of a single store's address: the chain count, or "nationwide" for one brand. Null for a local-business perk. */
export function PerkReachLine({ offer, hasPlace = false, className = '' }: { offer: ReachOffer; hasPlace?: boolean; className?: string }) {
  const { t } = useLang()
  if (isMultiChain(offer)) {
    return (
      <span className={`flex min-w-0 items-center gap-1 ${className}`}>
        <Network aria-hidden="true" className="h-3 w-3 shrink-0 text-brand" strokeWidth={1.75} />
        <span className="truncate font-medium">{t('perk_honoured_at_chains').replace('{n}', '⁦' + String(offer.chainsCount ?? 0) + '⁩')}</span>
      </span>
    )
  }
  if (offer.fulfillmentType === 'multipass_pool' && !hasPlace) {
    return (
      <span className={`flex min-w-0 items-center gap-1 ${className}`}>
        <Globe aria-hidden="true" className="h-3 w-3 shrink-0 text-brand" strokeWidth={1.75} />
        <span className="truncate font-medium">{t('perk_nationwide')}</span>
      </span>
    )
  }
  return null
}

/** The chains that honour a multi-chain voucher, as tags, with the guide that applies at all of them. */
export function ParticipatingChains({ offer }: { offer: ReachOffer }) {
  const { t, lang } = useLang()
  const chains = offer.participatingChains ?? []
  const guide = offer.universalRedemptionGuide
  const text = guide ? (lang === 'he' ? guide.he || guide.en : guide.en || guide.he) : ''
  return (
    <div className="space-y-4">
      <ul className="flex flex-wrap gap-2" aria-label={t('perk_chains_title')}>
        {chains.map((name) => (
          <li key={name} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-ink">
            <bdi dir="auto">{name}</bdi>
          </li>
        ))}
      </ul>
      {text && (
        <div>
          <p className="mb-1 text-sm font-bold text-ink">{t('perk_chains_redeem_title')}</p>
          <p className="whitespace-pre-line text-copy leading-relaxed text-body" dir="auto">{text}</p>
        </div>
      )}
    </div>
  )
}
