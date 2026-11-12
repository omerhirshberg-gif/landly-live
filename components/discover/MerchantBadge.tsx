'use client'

import { useState } from 'react'

interface MerchantBadgeProps {
  /** The business's logo (offer.businessLogoUrl); '' = none, so its initial shows. */
  logoUrl: string
  businessName: string
  /** 'sm': the feed cards' tile: one height for every logo (44px, 48px from 640px), as wide as the mark needs (64-124px, 72-140px from 640px). 'lg': an offer's own page, where the brand is a headline: a taller tile, and a wide wordmark may run to 160px. */
  size?: 'sm' | 'md' | 'lg'
}

// The business on a perk card and its offer's page, as the Expo app's
// MerchantBadge draws it: a white squircle tile (continuous-curvature corners where the
// browser has corner-shape, a plain arc elsewhere; a hairline edge, a soft shadow)
// of one height, as wide as its logo needs: a square or round mark sits in the
// 56px minimum, a wide wordmark grows up to 96px, or its initial shows when
// there's none or it fails to load. It floats over the picture, so a logo arriving
// moves nothing else. Every card takes its logo tile from here. Plain <img> for the
// same reason as PerkImage: logos are uploaded (Firebase Storage, trimmed tight by
// compressLogo) or pasted links on any host; nothing here scales or transforms the bitmap.
export default function MerchantBadge({ logoUrl, businessName, size = 'md' }: MerchantBadgeProps) {
  // Keyed on the URL, so a changed logo gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const logo = logoUrl && failedUrl !== logoUrl ? logoUrl : null

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center overflow-hidden ${
        size === 'sm'
          ? 'h-[44px] min-w-[64px] max-w-[124px] rounded-xl border border-slate-200/90 bg-white px-1.5 py-1 shadow-sm sm:h-[48px] sm:min-w-[72px] sm:max-w-[140px] sm:px-2'
          : `rounded-2xl [corner-shape:squircle] border border-slate-100 bg-white ${size === 'lg' ? 'h-14 min-w-[72px] max-w-[160px] px-3 shadow-md sm:h-16' : 'h-12 min-w-[56px] px-2.5 shadow-sm sm:h-14'}`
      }`}
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
          className={size === 'sm' ? 'h-full w-auto max-w-full object-contain' : `h-full w-auto object-contain ${size === 'lg' ? 'min-w-0 max-w-full' : 'max-w-[96px]'}`}
        />
      ) : (
        <span className={`font-extrabold leading-none text-brand ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>{Array.from(businessName.trim())[0]?.toUpperCase() ?? ''}</span>
      )}
    </span>
  )
}
