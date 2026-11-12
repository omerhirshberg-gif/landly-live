'use client'

import type { ReactNode } from 'react'
import { dealPhotoFit } from '@/lib/offers/imageFit'
import { CategoryPanel } from './PerkImage'
import type { DealImage } from './useDealImage'

// A perk card's picture, as the Expo app's DealMedia.tsx draws it
// (lib/offers/dealImage.ts): a 16:9 photo of the deal fills the hero edge to
// edge. Without a photo the hero shows the category's panel. Until a bitmap
// has loaded (its kind may hang on its size) the hero shows the panel, then the
// photo fades in over it; no link, or one that fails, keeps the panel. Nothing
// tints the picture: the overlays (`children`) carry their own solid backgrounds.
// The card holds the image's state (useDealImage), as its logo box needs the
// role too. A landscape photo (ratio 1.2 or more) fills the frame (object-cover); a
// square or portrait one is shown whole (object-contain) in front of a soft blurred
// copy of itself, so its head and feet are never cut off, and the offer page lets
// the frame follow it (containAspect). Expo: landly-mobile/src/components/DealMedia.tsx.
// Plain <img> for the same reasons as PerkImage: admin-pasted links on
// any host, kept hotlink-safe.
export default function DealMedia({
  src,
  image,
  alt,
  category,
  className = '',
  aspect = 'aspect-video',
  containAspect,
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
  /** The frame's shape instead of `aspect` for a square or portrait photo shown whole (the offer page's taller hero). */
  containAspect?: string
  children?: ReactNode
}) {
  const { role, size, imgRef, onLoad, onError } = image
  const whole = role === 'photo' && dealPhotoFit(size) === 'contain'

  return (
    <div className={`relative z-[1] w-full ${whole && containAspect ? containAspect : aspect} ${className}`}>
      <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
        <CategoryPanel category={category} size="hero" />
        {whole && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="absolute inset-0 z-0 h-full w-full scale-110 object-cover blur-xl" />
            <div aria-hidden="true" className="absolute inset-0 z-[1] bg-[#F4F6F9]/50" />
          </>
        )}
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
            className={`absolute inset-0 z-[2] h-full w-full ${whole ? 'object-contain' : 'object-cover'} transition-opacity duration-[180ms] ease-out-expo motion-reduce:transition-none ${role === 'photo' ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
      {children}
    </div>
  )
}
