'use client'

import { useId, type CSSProperties } from 'react'
import { ARCH, ARROW, STAR } from '@/lib/brand/emblemPaths'
import { LOADER, LOADER_OFFSET, STAR_CENTRE, type LoaderSize } from '@/lib/brand/loaderSpec'
import { useLang } from '@/lib/i18n/useLang'

// The brand loader for full-area waits (Expo: landly-mobile/src/components/BrandLoader.tsx,
// both drawn from lib/brand/loaderSpec.ts): the real emblem in two pale tones with a
// soft blue band sweeping across it, clipped to the emblem's own silhouette. A
// skeleton in the shape of the mark. The loop has no intro or outro (the band is
// off the mark at both ends of a cycle), and the Star of David sits on the exact
// centre of the box, not the emblem's bounding box.
//
// Motion lives in CSS (.brand-loader in app/globals.css), fed by the numbers in
// the spec through custom properties. Direction comes from `[dir=rtl]` in CSS, so
// the sweep and its tilt mirror in Hebrew with no JS and no hydration flash; the
// mark never mirrors. Reduce Motion drops the band and only breathes in opacity.
const CSS_VARS = {
  '--bl-cycle': `${LOADER.cycleMs}ms`,
  '--bl-ease': `cubic-bezier(${LOADER.curve.join(',')})`,
  '--bl-travel': `${LOADER.travel}px`,
  '--bl-tilt': `${-LOADER.band.tiltDeg}deg`,
  '--bl-breathe': `${LOADER.breatheMs}ms`,
  '--bl-breathe-from': LOADER.breatheFrom,
  '--bl-delay': `${LOADER.showDelayMs}ms`,
  '--bl-fade-in': `${LOADER.fadeInMs}ms`,
} as CSSProperties

export default function BrandLoader({
  size = 'md',
  fill = false,
  label,
  className = '',
}: {
  /** sm 56, md 112, lg 212 (px), or any px. */
  size?: LoaderSize | number
  /** Centre in the parent, taking all the room it has (a full-area wait). */
  fill?: boolean
  /** The screen-reader label; defaults to "Loading…". */
  label?: string
  className?: string
}) {
  const { t } = useLang()
  const px = typeof size === 'number' ? size : LOADER.sizes[size]
  // ids are document-wide, so each loader gets its own.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const clipId = `landlyLoaderClip${uid}`
  const bandId = `landlyLoaderBand${uid}`
  const { width: bandW, height: bandH, peakOpacity } = LOADER.band

  return (
    <div role="status" style={CSS_VARS} className={`brand-loader-wrap ${fill ? 'flex min-h-[40vh] flex-1 items-center justify-center' : 'inline-flex'} ${className}`.trim()}>
      <svg
        className="brand-loader"
        width={px}
        height={px}
        viewBox={`0 0 ${LOADER.size} ${LOADER.size}`}
        shapeRendering="geometricPrecision"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            {[STAR.light, ARCH.light, ARROW.light].map((d) => (
              <path key={d.slice(0, 24)} d={d} clipRule="evenodd" />
            ))}
          </clipPath>
          <linearGradient id={bandId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={LOADER.bandColor} stopOpacity={0} />
            <stop offset="0.5" stopColor={LOADER.bandColor} stopOpacity={peakOpacity} />
            <stop offset="1" stopColor={LOADER.bandColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <g transform={`translate(${LOADER_OFFSET.x} ${LOADER_OFFSET.y})`}>
          {[STAR, ARCH, ARROW].map((part) => (
            <g key={part.light.slice(0, 24)}>
              <path d={part.light} fill={LOADER.pale.light} fillRule="evenodd" />
              <path d={part.dark} fill={LOADER.pale.dark} fillRule="evenodd" />
            </g>
          ))}
          <g clipPath={`url(#${clipId})`}>
            <g transform={`translate(${STAR_CENTRE.x} ${STAR_CENTRE.y})`}>
              <g className="brand-loader__tilt">
                <rect className="brand-loader__band" x={-bandW / 2} y={-bandH / 2} width={bandW} height={bandH} fill={`url(#${bandId})`} />
              </g>
            </g>
          </g>
        </g>
      </svg>
      <span className="sr-only">{label ?? t('bizdash_loading')}</span>
    </div>
  )
}
