import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'

// The Landly emblem as one flat silhouette in the current text colour, for a
// brand surface (the watermark on the members' pass card). Both tones of every
// part fill alike, so the mark reads as a single shape.
export default function LandlyMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} aria-hidden="true" focusable="false" className={className} style={{ shapeRendering: 'geometricPrecision' }}>
      {[STAR, ARCH, ARROW].flatMap((part) => [part.light, part.dark]).map((d) => (
        <path key={d.slice(0, 24)} d={d} fill="currentColor" fillRule="evenodd" />
      ))}
    </svg>
  )
}
