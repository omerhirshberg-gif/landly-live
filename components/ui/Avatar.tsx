'use client'

import { useState } from 'react'
import { sizedAvatarUrl } from '@/lib/avatar/avatar'

// The member's photo, else a brand-blue gradient monogram (web counterpart of
// landly-mobile/src/components/Avatar.tsx). A photo that fails to load (an
// expired Google URL) falls back to the monogram. Decorative: the name is
// always written next to it, so it's hidden from screen readers. Google
// photos are asked for at 3× the drawn size, sharp on retina screens.
export default function Avatar({
  src,
  initials,
  size = 40,
  lgSize,
  className = '',
}: {
  src: string | null
  initials: string
  size?: number
  /** A larger size from 1024px up (the desktop profile card); phones and tablets keep `size`. */
  lgSize?: number
  className?: string
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showPhoto = !!src && failedSrc !== src
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full select-none ${showPhoto ? 'bg-slate-100' : 'ds-avatar-fallback text-white'} ${lgSize ? 'lg:!h-[var(--av-lg)] lg:!w-[var(--av-lg)]' : ''} ${className}`}
      style={{ width: size, height: size, ...(lgSize ? ({ '--av-lg': `${lgSize}px`, '--av-fs-lg': `${Math.round(lgSize * 0.36)}px` } as React.CSSProperties) : null) }}
    >
      {showPhoto ? (
        // Storage and Google photo URLs, not next/image remote patterns; no-referrer keeps Google's CDN from refusing it.
        <img src={sizedAvatarUrl(src, Math.max(size, lgSize ?? 0) * 3)} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setFailedSrc(src)} />
      ) : (
        <span className={`font-bold leading-none tracking-wide ${lgSize ? 'lg:!text-[length:var(--av-fs-lg)]' : ''}`} style={{ fontSize: Math.round(size * (initials.length > 1 ? 0.36 : 0.42)) }}>
          {initials || <PersonGlyph size={Math.round(size * 0.46)} />}
        </span>
      )}
    </span>
  )
}

// CSS-only head-and-shoulders shape for a member with no usable name, so the
// avatar never pulls in an icon font or SVG (the mobile drawer is text-only).
function PersonGlyph({ size }: { size: number }) {
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      <span className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-white/90" style={{ width: size * 0.46, height: size * 0.46 }} />
      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-full bg-white/90" style={{ width: size * 0.86, height: size * 0.4 }} />
    </span>
  )
}
