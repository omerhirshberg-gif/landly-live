'use client'

import { useEffect, useRef, useState } from 'react'
import { dealImageRole } from '@/lib/offers/dealImage'

/** An image's state if it has already finished: its size, 'failed', or null while it's still loading. */
export function settledImage(img: Pick<HTMLImageElement, 'complete' | 'naturalWidth' | 'naturalHeight'> | null) {
  if (!img?.complete) return null
  return img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : 'failed'
}

// What the offer's image is (lib/offers/dealImage.ts), for the card that draws
// it: DealMedia reports its bitmap back here, and the logo box reads the role.
// Keyed on the URL, so a changed image is measured and tried afresh. A
// server-rendered image can finish before hydration attaches React's listeners,
// and React never replays that load, so it's read off the element on mount too;
// otherwise the photo stays hidden over the panel. Expo: src/lib/useDealImage.ts.
export function useDealImage(src: string) {
  const [loaded, setLoaded] = useState<{ src: string; width: number; height: number } | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const settled = settledImage(imgRef.current)
    if (settled === 'failed') setFailedSrc(src)
    else if (settled) setLoaded({ src, ...settled })
  }, [src])

  return {
    role: dealImageRole(src, loaded?.src === src ? loaded : null, failedSrc === src),
    imgRef,
    onLoad: (width: number, height: number) => setLoaded({ src, width, height }),
    onError: () => setFailedSrc(src),
  }
}

export type DealImage = ReturnType<typeof useDealImage>
