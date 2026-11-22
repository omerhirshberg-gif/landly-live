'use client'

import { useState, type ReactNode } from 'react'
import BrandMedia from '@/components/ui/BrandMedia'
import { RAAYONIT_LOGO_PATH } from '@/lib/payments/issuer'
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
  logo,
  priority = false,
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
  /** A logo-only perk (lib/offers/logoOnly.ts): the logo is the hero, large on white. */
  logo?: { src: string; alt: string; small?: boolean } | null
  /** Above the fold: the photo is fetched first and eagerly (fetchPriority high); every other card stays lazy. */
  priority?: boolean
  children?: ReactNode
}) {
  const { role, size, ambient, graphic, imgRef, onLoad, onError } = image
  const whole = role === 'photo' && dealPhotoFit(size, { ambient, graphic }) === 'contain'
  // The taller offer-page frame is for a portrait shot; a Raayonit graphic that is merely square or wide keeps the card's own frame.
  const tall = whole && !!containAspect && (!ambient || (size != null && size.width < size.height))

  // A logo that fails to load is replaced by the Raayonit mark, never a broken image icon.
  const [logoFailed, setLogoFailed] = useState(false)

  if (logo) {
    return (
      <div className={`relative z-[1] w-full ${aspect} ${className}`}>
        {logo.small || logoFailed ? (
          <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden rounded-[inherit] border-b border-slate-100 bg-gradient-to-br from-[#F1F5F9] to-[#E2E8F0] px-[30%] py-[14%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoFailed ? RAAYONIT_LOGO_PATH : logo.src} alt={logo.alt} onError={() => setLogoFailed(true)} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
          </div>
        ) : (
          // A logo-only perk fills the frame edge to edge (blurred copy, tint, crisp logo), never a logo on white.
          <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit] bg-[#EEF2F7]">
            <BrandMedia src={logo.src} alt={logo.alt} inset="p-5 sm:p-6" onError={() => setLogoFailed(true)} />
          </div>
        )}
        {children}
      </div>
    )
  }

  return (
    <div className={`relative z-[1] w-full ${tall ? containAspect : aspect} ${className}`}>
      <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
        <CategoryPanel category={category} size="hero" />
        {whole && (
          <>
            {/* An opaque studio base, so a transparent logo never shows the category panel's icon through it. */}
            <div aria-hidden="true" className="absolute inset-0 bg-[#F4F6F9]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {/* The blurred copy, drawn at an eighth of the frame (blur 3px) and scaled up 8.8x from the centre: the same look as a
                full-size blur-xl at scale-110, with the blur run over 1/64 of the pixels. Centred by flexbox, so no side is involved. */}
            <div aria-hidden="true" className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
              <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-[12.5%] w-[12.5%] flex-shrink-0 scale-[8.8] transform-gpu object-cover blur-[3px]" />
            </div>
            <div aria-hidden="true" className="absolute inset-0 z-[1] bg-[#F4F6F9]/45" />
          </>
        )}
        {(role === 'pending' || role === 'photo') && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            decoding="async"
            referrerPolicy="no-referrer"
            onError={onError}
            onLoad={(e) => onLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
            className={`absolute inset-0 z-[2] h-full w-full ${whole ? (ambient ? 'object-contain p-4' : 'object-contain') : 'object-cover'} transition-opacity duration-[180ms] ease-out-expo motion-reduce:transition-none ${role === 'photo' ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
      </div>
      {children}
    </div>
  )
}
