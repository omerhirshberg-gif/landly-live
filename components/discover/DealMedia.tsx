'use client'

import type { ReactNode } from 'react'
import { CategoryPanel } from './PerkImage'
import type { DealImage } from './useDealImage'

// A perk card's picture, as the Expo app's DealMedia.tsx draws it
// (lib/offers/dealImage.ts): a 16:9 photo of the deal fills the hero edge to
// edge. Without a photo the hero shows the category's panel. Until a bitmap
// has loaded (its kind may hang on its size) the hero shows the panel, then the
// photo fades in over it; no link, or one that fails, keeps the panel. Nothing
// tints the picture: the overlays (`children`) carry their own solid backgrounds.
// The card holds the image's state (useDealImage), as its logo box needs the
// role too. Plain <img> for the same reasons as PerkImage: admin-pasted links on
// any host, kept hotlink-safe.
export default function DealMedia({
  src,
  image,
  alt,
  category,
  className = '',
  aspect = 'aspect-video',
  children,
}: {
  src: string
  image: DealImage
  alt: string
  category: string
  /** The frame's corners or margins, for a page that doesn't sit it in a card; the picture follows its corners. */
  className?: string
  /** The frame's shape: 16:9 on the offer page, 2:1 capped at 172px on the feed cards. */
  aspect?: string
  children?: ReactNode
}) {
  const { role, imgRef, onLoad, onError } = image

  return (
    <div className={`relative z-[1] w-full ${aspect} ${className}`}>
      <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <CategoryPanel category={category} size="hero" />
        {(role === 'pending' || role === 'photo') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={onError}
            onLoad={(e) => onLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[180ms] ease-out-expo motion-reduce:transition-none ${role === 'photo' ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
      {children}
    </div>
  )
}
