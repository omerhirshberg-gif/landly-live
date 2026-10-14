import { useId, type CSSProperties, type ReactNode } from 'react'
import { ARCH, ARROW, EMBLEM_COLORS, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import styles from './entrance.module.css'

// Web counterpart of landly-mobile/src/components/Emblem.tsx: the same vector
// parts, each a full-size SVG over the same viewBox, so stacked layers line
// up exactly and the static emblem is pixel-identical to the assembled intro.
const VIEWBOX = `0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`
type Part = typeof STAR

function PartPaths({ part }: { part: Part }) {
  return (
    <>
      <path d={part.light} fill={EMBLEM_COLORS.light} fillRule="evenodd" />
      <path d={part.dark} fill={EMBLEM_COLORS.dark} fillRule="evenodd" />
    </>
  )
}

function Layer({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={VIEWBOX} className={styles.svg} aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export function StaticEmblem() {
  return (
    <Layer>
      <PartPaths part={STAR} />
      <PartPaths part={ARCH} />
      <PartPaths part={ARROW} />
    </Layer>
  )
}

/** Part A: the Star of David and the arch it stands on. */
export function BaseLayer() {
  return (
    <Layer>
      <PartPaths part={STAR} />
      <PartPaths part={ARCH} />
    </Layer>
  )
}

/** Part A as a thin outline, drawn before the fill arrives. */
export function BaseOutlineLayer() {
  return (
    <Layer>
      {[STAR.light, ARCH.light].map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="none" stroke={EMBLEM_COLORS.light} strokeWidth={5} strokeLinejoin="round" />
      ))}
    </Layer>
  )
}

/** Part B: the arrow. */
export function ArrowLayer() {
  return (
    <Layer>
      <PartPaths part={ARROW} />
    </Layer>
  )
}

// The sheen band is a soft white gradient rect, rotated so it lies across the
// bottom-left -> top-right sweep and moved along it by a CSS translateX (SVG
// user units), clipped to the emblem's own shapes. Same geometry as mobile.
const CX = EMBLEM_VIEWBOX.width / 2
const CY = EMBLEM_VIEWBOX.height / 2
const BAND = 150
const REACH = 380 // half-diagonal of the viewBox, plus a margin
const X_FROM = CX - REACH - BAND
const X_TO = CX + REACH

export function ShineLayer() {
  // useId output isn't a valid bare url(#...) fragment in every React version.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const clipId = `landlyEmblemClip${id}`
  const gradientId = `landlyShine${id}`
  return (
    <Layer>
      <defs>
        <clipPath id={clipId}>
          {[STAR.light, ARCH.light, ARROW.light].map((d) => (
            <path key={d.slice(0, 24)} d={d} clipRule="evenodd" />
          ))}
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.6} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* rotate(-45): the band's x axis points up-right, its long side runs top-left -> bottom-right. */}
        <g transform={`rotate(-45 ${CX} ${CY})`}>
          <rect
            className={styles.shineBand}
            style={{ '--shine-distance': `${X_TO - X_FROM}px` } as CSSProperties}
            x={X_FROM}
            y={CY - 460}
            width={BAND}
            height={920}
            fill={`url(#${gradientId})`}
          />
        </g>
      </g>
    </Layer>
  )
}
