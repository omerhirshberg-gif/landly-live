'use client'

import { useLang } from '@/lib/i18n/useLang'

// The guest hero's visual: four sunlit photographs of everyday life in Israel
// on a warm cream frame, nothing laid over them (no cards, prices or badges):
// the beach, a Tel Aviv café window, a Jerusalem market stall and the Tel
// Aviv promenade. Each is a white-framed print, tilted a degree or two (the
// tilt mirrors in Hebrew) and drifting a few pixels up and down on its own slow
// cycle (.collage-drift in globals.css; still under Reduce Motion). Where there
// is a hover, a print straightens, lifts and its photo zooms. The drift sits on
// an outer wrapper and the tilt on the inner one, so the two transforms never
// fight. Photos are self-hosted WebP (public/images/hero, licences in
// docs/IMAGE_LICENSES.md), described in the reader's language (landing_collage_alt_*), and faceless by choice.

type PhotoName = 'beach' | 'cafe' | 'market' | 'life'

// Where object-cover keeps each subject when a tile crops the photo; the tilt;
// and the drift's length and phase, so the four never move in step.
const PHOTOS: { name: PhotoName; position: string; tilt: string; drift: string }[] = [
  { name: 'beach', position: '60% 70%', tilt: '-rotate-[1.5deg] rtl:rotate-[1.5deg]', drift: '5.5s, -1s' },
  { name: 'cafe', position: '50% 55%', tilt: 'rotate-[1.75deg] rtl:-rotate-[1.75deg]', drift: '6s, -3s' },
  { name: 'market', position: '55% 65%', tilt: 'rotate-[1.25deg] rtl:-rotate-[1.25deg]', drift: '5s, -2s' },
  { name: 'life', position: '50% 60%', tilt: '-rotate-[1.5deg] rtl:rotate-[1.5deg]', drift: '6s, -4.5s' },
]

export default function IsraelLifestyleCollage() {
  const { t } = useLang()
  return (
    <div className="mx-auto w-full max-w-[640px] rounded-[2rem] border border-[#EAE5DC] bg-[#FAF8F5] p-2.5 shadow-sm sm:p-3 lg:mx-0">
      <div className="grid grid-cols-2 gap-3">
        {PHOTOS.map(({ name, position, tilt, drift }, i) => {
          const [duration, delay] = drift.split(', ')
          return (
            <div key={name} className="collage-drift min-w-0" style={{ animationDuration: duration, animationDelay: delay }}>
              <div className={`group relative aspect-[4/3] w-full min-w-0 min-h-[210px] overflow-hidden rounded-3xl border-2 border-white bg-slate-100 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.16)] transition-transform duration-500 sm:min-h-[240px] [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:rotate-0 motion-reduce:transition-none ${tilt}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/images/hero/${name}.webp`}
                  srcSet={`/images/hero/${name}-sm.webp 640w, /images/hero/${name}.webp 1200w`}
                  sizes="(min-width:1024px) 20rem, 48vw"
                  width={1200}
                  height={name === 'life' ? 1200 : name === 'beach' ? 900 : 800}
                  alt={t(`landing_collage_alt_${name}`)}
                  decoding="async"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  draggable={false}
                  style={{ objectPosition: position }}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 [@media(hover:hover)]:group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
