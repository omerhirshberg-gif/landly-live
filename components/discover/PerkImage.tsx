'use client'

import { useState } from 'react'
import { CATEGORY_TILES } from '@/lib/categories'

interface PerkImageProps {
  src: string
  alt: string
  category: string
  businessName: string
  /** Emblem size: a list thumbnail's, the card's, or the larger detail-page hero's. */
  size?: 'thumb' | 'card' | 'hero'
  className?: string
}

// An offer's photo, or -- when there is none or it fails to load -- a branded
// panel: a soft brand gradient, the business's initial as a large watermark
// and the category's emoji on a white tile. Never the old broken-image icon.
// Plain <img>: offer photos are admin-pasted links on any host, outside
// next/image's remote patterns. no-referrer keeps hotlink-protected hosts
// (which refuse requests from other sites) serving the file.
export default function PerkImage({ src, alt, category, businessName, size = 'card', className = '' }: PerkImageProps) {
  // Keyed on the URL, so a changed image gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = !!src && failedSrc !== src

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(src)}
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }

  const emoji = CATEGORY_TILES.find((c) => c.category === category)?.emoji ?? '🎁'
  const initial = Array.from(businessName.trim())[0]?.toUpperCase() ?? ''
  const initialSize = { thumb: 'text-[4rem]', card: 'text-[7rem]', hero: 'text-[11rem]' }[size]
  const tileSize = { thumb: 'h-9 w-9 rounded-xl text-lg', card: 'h-14 w-14 rounded-2xl text-2xl', hero: 'h-20 w-20 rounded-2xl text-4xl' }[size]

  return (
    <div
      aria-hidden="true"
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#F0F7FF] via-[#EEF2F8] to-[#E2E8F0] ${className}`}
    >
      {initial && (
        <span
          className={`pointer-events-none absolute -bottom-[0.18em] end-[0.06em] select-none font-black leading-none text-[#0038B8]/[0.07] ${initialSize}`}
        >
          {initial}
        </span>
      )}
      <span
        className={`relative flex items-center justify-center bg-white/90 shadow-sm ring-1 ring-[#E2E8F0] ${tileSize}`}
      >
        {emoji}
      </span>
    </div>
  )
}
