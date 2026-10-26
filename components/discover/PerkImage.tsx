'use client'

import { useState } from 'react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { perkImageFit } from '@/lib/offers/imageFit'

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
// and the category's Lucide glyph in a white hairline frame (a price tag for
// an unknown category). Never the old broken-image icon.
// Plain <img>: offer photos are admin-pasted links on any host, outside
// next/image's remote patterns. no-referrer keeps hotlink-protected hosts
// (which refuse requests from other sites) serving the file. A photo covers
// the frame; a logo (lib/offers/imageFit.ts) sits whole inside it with room
// around it, on the frame's light background.
export default function PerkImage({ src, alt, category, businessName, size = 'card', className = '' }: PerkImageProps) {
  // Keyed on the URL, so a changed image gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [measured, setMeasured] = useState<{ src: string; width: number; height: number } | null>(null)
  const showImage = !!src && failedSrc !== src
  const fit = perkImageFit(src, measured?.src === src ? measured : null)
  // A logo's snug breathing room inside its frame (8-10px).
  const logoPadding = { thumb: 'p-1', card: 'p-2', hero: 'p-2.5' }[size]

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
        onLoad={(e) => setMeasured({ src, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        className={`h-full w-full ${fit === 'contain' ? `object-contain ${logoPadding}` : 'object-cover'} ${className}`}
      />
    )
  }

  const initial = Array.from(businessName.trim())[0]?.toUpperCase() ?? ''
  const initialSize = { thumb: 'text-monogram-sm', card: 'text-monogram-md', hero: 'text-monogram-lg' }[size]
  const tileSize = { thumb: 'h-9 w-9 rounded-xl', card: 'h-14 w-14 rounded-2xl', hero: 'h-20 w-20 rounded-2xl' }[size]
  const glyphSize = { thumb: 'h-[18px] w-[18px]', card: 'h-6 w-6', hero: 'h-9 w-9' }[size]

  return (
    <div
      aria-hidden="true"
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-brandTint via-[#EEF2F8] to-line ${className}`}
    >
      {initial && (
        <span
          className={`pointer-events-none absolute -bottom-[0.18em] end-[0.06em] select-none font-black leading-none text-brand/[0.07] ${initialSize}`}
        >
          {initial}
        </span>
      )}
      <span
        className={`relative flex items-center justify-center bg-white/90 text-brand shadow-sm ring-1 ring-slate-200/70 ${tileSize}`}
      >
        <CategoryIcon category={category} className={glyphSize} strokeWidth={1.5} />
      </span>
    </div>
  )
}
