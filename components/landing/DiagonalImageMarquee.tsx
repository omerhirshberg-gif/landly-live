'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'

// The guest hero's visual. From lg: three columns of photo cards on a diagonal
// (tilted -11deg, +11deg in Hebrew), up / down / up, filling a full-bleed canvas
// the hero anchors to the viewport's end edge: no frame, the photos run off the
// top and bottom (crisp, full-opacity, no fade); the 44px pause button sits on the open canvas at the
// bottom-end corner, never on a photo.
// Below lg: two horizontal photo
// ribbons drifting in opposite directions, with a slim left and right fade, in the
// document flow with the pause button under them (clear of the floating
// Accessibility and WhatsApp buttons). Every track holds its photos twice and
// slides exactly one copy (-50%), so the loop has no seam. Motion is
// transform-only. It pauses on hover (hover devices), with the 44px button
// (WCAG 2.2.2), and not at all under Reduce Motion (the first copy stands
// still, the button is hidden). No :focus-within pause: the button is the
// keyboard's way in, and it would stop Play from working. Rules: globals.css
// (.marquee-*). Photos: public/images/hero-marquee, licences in
// docs/IMAGE_LICENSES.md. The cards are decorative (alt=""); each variant
// carries one localized label. Only one variant is displayed at a time, and
// the hidden one's lazy images are not fetched.

// Forty-two curated photos, every one shown in exactly one track: each diagonal
// column owns 14 (a doubled track is 28 cards tall, so the tilted stage never runs
// out of photos mid-loop) and each mobile ribbon owns 21. The three columns share
// no photo, nor do the two ribbons. Landmarks, nature, nightlife and lifestyle are
// interleaved so no two neighbours look alike. tests/unit/landing.test.ts enforces
// the partition and that every file exists.
export const COL_PHOTOS = {
  up: ['masada-a', 'beach', 'deadsea-a', 'cafe', 'western-wall-a', 'party-a', 'banias-a', 'wellness-studio', 'jordan-a', 'rooftop-bar', 'ramon-a', 'tlv-a', 'galilee-a', 'bar-a'],
  down: ['deadsea-b', 'life', 'masada-b', 'mezze-plate', 'banias-b', 'party-b', 'jerusalem-b', 'wellness-corner', 'ramon-b', 'cocktail-bar', 'jordan-b', 'tlv-b', 'hermon-a', 'eilat-a'],
  up2: ['jerusalem-c', 'market', 'banias-c', 'dinner-wine', 'masada-c', 'boutique-interior', 'deadsea-c', 'fashion-rack', 'negev-a', 'bar-b', 'galilee-b', 'eilat-b', 'deadsea-d', 'mahane-yehuda-a'],
} as const
export const ROW_PHOTOS = {
  a: ['masada-a', 'beach', 'western-wall-a', 'party-a', 'jordan-a', 'rooftop-bar', 'galilee-a', 'deadsea-b', 'life', 'banias-b', 'party-b', 'ramon-b', 'cocktail-bar', 'hermon-a', 'jerusalem-c', 'market', 'masada-c', 'boutique-interior', 'negev-a', 'bar-b', 'deadsea-d'],
  b: ['deadsea-a', 'cafe', 'banias-a', 'wellness-studio', 'ramon-a', 'tlv-a', 'bar-a', 'masada-b', 'mezze-plate', 'jerusalem-b', 'wellness-corner', 'jordan-b', 'tlv-b', 'eilat-a', 'banias-c', 'dinner-wine', 'deadsea-c', 'fashion-rack', 'galilee-b', 'eilat-b', 'mahane-yehuda-a'],
} as const

const COLUMNS = (Object.keys(COL_PHOTOS) as (keyof typeof COL_PHOTOS)[]).map((direction) => ({ direction, photos: COL_PHOTOS[direction] }))
const ROWS = (Object.keys(ROW_PHOTOS) as (keyof typeof ROW_PHOTOS)[]).map((id) => ({ id, photos: ROW_PHOTOS[id] }))

function Copy({ className, photos, duplicate, sizes }: { className: string; photos: readonly string[]; duplicate?: boolean; sizes: string }) {
  return (
    <ul className={className} aria-hidden={duplicate ? 'true' : undefined}>
      {photos.map((name) => (
        <li key={name} className="marquee-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/images/hero-marquee/${name}.webp`}
            srcSet={`/images/hero-marquee/${name}-sm.webp 480w, /images/hero-marquee/${name}.webp 720w`}
            sizes={sizes}
            width={720}
            height={960}
            alt=""
            decoding="async"
            loading="lazy"
            draggable={false}
          />
        </li>
      ))}
    </ul>
  )
}

export default function DiagonalImageMarquee() {
  const { t } = useLang()
  const [paused, setPaused] = useState(false)
  // Off screen (scrolled past, or a hidden tab) the tracks stand still, so an idle page stops compositing.
  // Separate from `paused`: scrolling back never overrides the visitor's own pause.
  const [onScreen, setOnScreen] = useState(true)
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const frame = frameRef.current
    if (!frame || typeof IntersectionObserver === 'undefined') return
    let intersecting = true
    const sync = () => setOnScreen(intersecting && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting
      sync()
    }, { rootMargin: '100px' })
    observer.observe(frame)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  const label = t('landing_marquee_alt')
  return (
    <div ref={frameRef} className={`marquee-frame mx-auto w-full lg:mx-0${paused ? ' is-paused' : ''}${onScreen ? '' : ' is-offscreen'}`}>
      <div className="marquee-stage hidden lg:block">
        <div role="img" aria-label={label} className="marquee-tilt">
          {COLUMNS.map(({ direction, photos }) => (
            <div key={direction} className={`marquee-col marquee-col--${direction}`}>
              <div className="marquee-track">
                <Copy className="marquee-copy" photos={photos} sizes="11rem" />
                <Copy className="marquee-copy" photos={photos} sizes="11rem" duplicate />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div role="img" aria-label={label} className="marquee-ribbon -mx-4 sm:-mx-6 lg:hidden">
        {ROWS.map(({ id, photos }) => (
          <div key={id} className={`marquee-row marquee-row--${id}`}>
            <Copy className="marquee-rcopy" photos={photos} sizes="8rem" />
            <Copy className="marquee-rcopy" photos={photos} sizes="8rem" duplicate />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="marquee-toggle"
        aria-pressed={paused}
        aria-label={t(paused ? 'landing_marquee_play' : 'landing_marquee_pause')}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? <Play aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Pause aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.75} />}
      </button>
    </div>
  )
}
