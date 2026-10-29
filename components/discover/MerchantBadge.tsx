'use client'

import { useState } from 'react'

interface MerchantBadgeProps {
  /** The business's logo (offer.businessLogoUrl); '' = none, so its initial shows. */
  logoUrl: string
  businessName: string
  /** 48px on a card, 64px on the offer page (the Expo app's sizes). */
  size?: 'card' | 'hero'
  className?: string
}

const SIZES = {
  card: { box: 'h-12 w-12 rounded-xl', pad: 'p-1.5', initial: 'text-xl' },
  hero: { box: 'h-16 w-16 rounded-2xl', pad: 'p-2', initial: 'text-[1.6rem]' },
} as const

// The business on a perk card, as the Expo app's MerchantBadge draws it: a
// white rounded tile (12–16px corners, a hairline edge, a soft shadow) with
// its logo fitted whole and room around it -- square, round or a wide
// wordmark -- or its initial on the brand tint when there's none or it fails
// to load. Plain <img> for the same reason as PerkImage: logos are uploaded
// (Firebase Storage) or pasted links on any host. Uploads are 1024px, so
// they stay sharp at 3x; nothing here scales or transforms the bitmap.
export default function MerchantBadge({ logoUrl, businessName, size = 'card', className = '' }: MerchantBadgeProps) {
  // Keyed on the URL, so a changed logo gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const logo = logoUrl && failedUrl !== logoUrl ? logoUrl : null
  const { box, pad, initial } = SIZES[size]

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-black/[0.06] shadow-[0_2px_6px_rgba(15,23,42,0.14)] ${box} ${
        logo ? `bg-white ${pad}` : 'bg-brandTint'
      } ${className}`}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logo)}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className={`font-extrabold leading-none text-brand ${initial}`}>{Array.from(businessName.trim())[0]?.toUpperCase() ?? ''}</span>
      )}
    </span>
  )
}
