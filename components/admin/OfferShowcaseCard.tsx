'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import Card from './Card'
import BidiText from './BidiText'
import LogoTile from './LogoTile'
import OfferPrice from './OfferPrice'
import RowActionsMenu, { type RowAction } from './RowActionsMenu'
import { OfferStatusBadge } from './StatusBadge'

export interface ShowcaseOffer {
  id: string
  title: string
  imageUrl: string
  businessLogoUrl: string
  businessName: string
  originalPrice: number
  offerPrice: number
  expiryDate: string | null
  totalQuantity: number | null
  claimedCount: number
  active: boolean
}

// An offer the way members see it: its photo at 16:9 with the business's
// logo badge overlapping the bottom edge (as on the app's and the website's
// cards), then the title, price, status and how many were claimed. The
// photo and title open the editor; the rest of the actions sit in the ⋯ menu.
export default function OfferShowcaseCard({ offer, editHref, actions }: { offer: ShowcaseOffer; editHref: string; actions: readonly RowAction[] }) {
  return (
    <Card hover className="flex flex-col">
      <Link href={editHref} className="group relative block rounded-t-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8]">
        <OfferPhoto imageUrl={offer.imageUrl} />
        <LogoTile logoUrl={offer.businessLogoUrl} name={offer.businessName} className="absolute start-3 -bottom-6" />
        <span className="absolute top-4 end-4">
          <OfferStatusBadge offer={offer} />
        </span>
        <span className="sr-only">Edit {offer.title}</span>
      </Link>
      <div className="flex flex-1 flex-col px-4 pb-3 pt-8">
        <Link href={editHref} className="font-semibold leading-snug text-[#0B1B3D] hover:text-[#0038B8]">
          <BidiText lines={2}>{offer.title}</BidiText>
        </Link>
        <div className="mt-2">
          <OfferPrice offerPrice={offer.offerPrice} originalPrice={offer.originalPrice} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-[#94A3B8]">
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <i className="fa-solid fa-ticket text-[10px]" aria-hidden="true" />
              <bdi dir="ltr">
                {offer.claimedCount}/{offer.totalQuantity ?? '∞'}
              </bdi>{' '}
              claimed
            </span>
            {offer.expiryDate && (
              <span className="inline-flex items-center gap-1">
                <i className="fa-regular fa-clock text-[10px]" aria-hidden="true" />
                <bdi dir="ltr">{formatIsraeliDate(offer.expiryDate)}</bdi>
              </span>
            )}
          </span>
          <RowActionsMenu label={`More actions for ${offer.title}`} actions={actions} />
        </div>
      </div>
    </Card>
  )
}

function OfferPhoto({ imageUrl }: { imageUrl: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const photo = imageUrl && failedUrl !== imageUrl ? imageUrl : null
  return (
    <span className="m-2 mb-0 block aspect-video overflow-hidden rounded-[14px] border border-[#E2E8F0] bg-gradient-to-br from-[#F0F7FF] to-[#E2E8F0]">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.02]"
          onError={() => setFailedUrl(photo)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-2xl text-[#0038B8]/30" aria-hidden="true">
          <i className="fa-solid fa-image" />
        </span>
      )}
    </span>
  )
}
