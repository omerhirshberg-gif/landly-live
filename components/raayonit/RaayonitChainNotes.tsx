'use client'

import { CircleHelp } from 'lucide-react'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'
import { hasNoBranchTable, isChain } from '@/lib/offers/discoverTab'

// What a Raayonit chain's page says up front (native: RaayonitChainNotes.tsx): the hotel rule on a hotel, and a note that branches vary
// when the chain's tile carries no branch table of its own.
export default function RaayonitChainNotes({ offer, className = '' }: { offer: OfferDocument; className?: string }) {
  const { t } = useLang()
  if (!isChain(offer)) return null
  const notes = [offer.raayonitCategory === 'hotels' ? t('raayonit_hotel_notice') : '', hasNoBranchTable(offer) ? t('raayonit_branches_vary') : ''].filter(Boolean)
  if (notes.length === 0) return null
  return (
    <div className={`space-y-2.5 ${className}`}>
      {notes.map((text) => (
        <p key={text} className="flex gap-2.5 rounded-2xl border border-brand/20 bg-brandTint p-3.5 text-[13px] leading-5 text-ink">
          <CircleHelp aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-brand" strokeWidth={1.75} />
          <span>{text}</span>
        </p>
      ))}
    </div>
  )
}
