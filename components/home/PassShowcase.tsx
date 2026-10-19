'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Reveal from '@/components/ui/Reveal'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/brand/wordmarkPath'
import { SITE_URL } from '@/lib/config'
import { useLang } from '@/lib/i18n/useLang'
import { useInView } from '@/lib/useInView'

// How long a voucher stays valid by default (an offer's validityDays).
const PASS_VALID_DAYS = 180
const QR_SIZE = 112
// The mockup's sample member number: an illustration, not a real account.
const DEMO_MEMBER_ID = 'LND-84920'

/** A validity date as a card prints it: MM/YYYY, the same in every language. */
export function formatValidThru(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

const POINTS = [
  { icon: 'fa-ticket', key: 'landing_pass_point1' },
  { icon: 'fa-qrcode', key: 'landing_pass_point2' },
  { icon: 'fa-piggy-bank', key: 'landing_pass_point3' },
] as const

// The guest home's look at the member pass: a phone drawn in CSS with the
// pass on screen, beside what using one is like. The pass is a royal-blue
// card laid out like a membership card: the white Landly mark and wordmark
// with the member number opposite (its one appearance), the member's name,
// the QR in a white frame, and a footer row (valid until, status: active);
// under the card, a quiet "Show to redeem" pill. The name and number are a sample (the
// home page is for guests); the QR is real and opens /signup, so scanning it
// leads somewhere. Nothing floats outside the phone. The card's header and
// columns follow the page direction, so in Hebrew the logo sits on the right
// and the number on the left.
//
// The first time the phone scrolls into view the card arrives the way a
// Wallet card does, about 1.5s (.pass-anim in globals.css): tucked below the
// screen's bottom edge at 92%, it slides up on a decelerating spring, seats
// at full size as its depth shadow deepens, the QR wipes in and a shine
// crosses it, then the pill rises. Without JS, under reduced motion, or when
// the phone is already on screen at load, it simply shows the seated card;
// sizes are fixed, so nothing shifts either way.
export default function PassShowcase() {
  const { t } = useLang()
  const [qr, setQr] = useState<string | null>(null)
  // Set after mount: the date would differ between the hourly server render
  // and the visitor's clock.
  const [validThru, setValidThru] = useState('')
  const [passRef, passInView] = useInView<HTMLDivElement>({ once: true, rootMargin: '0px 0px -15% 0px' })
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const el = passRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setArmed(true)
  }, [passRef])

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(`${SITE_URL}/signup`, { margin: 1, width: QR_SIZE * 2, color: { dark: '#0B1B3D', light: '#FFFFFF' } })
      .then((url) => { if (!cancelled) setQr(url) })
      .catch(() => { if (!cancelled) setQr(null) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setValidThru(formatValidThru(new Date(Date.now() + PASS_VALID_DAYS * 86_400_000)))
  }, [])

  return (
    <section aria-labelledby="home-pass-title" className="pass-stage py-12 sm:py-14 lg:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('landing_pass_label')}</div>
          <h2 id="home-pass-title" className="text-3xl sm:text-4xl font-black text-ink mb-3" style={{ letterSpacing: '-0.025em' }}>
            {t('landing_pass_title')}
          </h2>
          <p className="text-body text-[15px] sm:text-base leading-relaxed mb-6 max-w-xl">{t('landing_pass_sub')}</p>
          <ul className="space-y-3">
            {POINTS.map((p) => (
              <li key={p.key} className="flex items-center gap-3 text-[15px] font-semibold text-ink">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/95 text-brand shadow-sm border border-line">
                  <i className={`fa-solid ${p.icon}`} aria-hidden="true"></i>
                </span>
                <span>{t(p.key)}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <div ref={passRef} data-pass={!armed ? undefined : passInView ? 'play' : 'armed'} className="pass-anim relative mx-auto w-[248px] sm:w-[272px]">
          {/* Decorative: the phone repeats the points beside it. */}
          <div aria-hidden="true" className="relative rounded-[2.75rem] bg-ink p-2.5 shadow-[0_2px_4px_rgba(11,27,61,.12),0_24px_48px_-12px_rgba(11,27,61,.35),0_48px_96px_-24px_rgba(0,56,184,.35)]">
            <div className="relative flex aspect-[9/19] flex-col overflow-hidden rounded-[2.25rem] bg-gradient-to-b from-brandTint to-white px-3.5 pt-11 pb-4">
              <div className="absolute top-2.5 left-1/2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-ink" />
              <div className="mb-3 px-1 text-[13px] font-extrabold text-ink">{t('landing_pass_screen_title')}</div>

              <div className="pass-card rounded-2xl sm:rounded-3xl border border-white/20 bg-gradient-to-br from-brand to-brandDark p-4 text-start text-white shadow-[0_25px_50px_-12px_rgba(0,56,184,.5)]">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5" dir="ltr">
                    <PassEmblem />
                    <svg viewBox={`${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`} className="h-3.5 w-auto" fill="currentColor">
                      <path d={WORDMARK_PATH} />
                    </svg>
                  </span>
                  <span className="text-end leading-tight">
                    <span className="block text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-blue-200/80">{t('landing_pass_card_member')}</span>
                    <bdi dir="ltr" className="block font-mono text-xs font-bold text-white/90">#{DEMO_MEMBER_ID}</bdi>
                  </span>
                </div>
                <div className="mt-1.5 truncate font-display text-xl sm:text-2xl font-bold tracking-tight text-white" dir="auto">{t('landing_pass_demo_name')}</div>
                <div className="mt-4 flex justify-center">
                  <div className="pass-qr relative overflow-hidden rounded-2xl bg-white p-2 shadow-[0_6px_16px_-6px_rgba(0,0,0,.35)]">
                    <span aria-hidden="true" className="pass-shine" />
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt="" width={QR_SIZE} height={QR_SIZE} className="block rounded-lg" />
                    ) : (
                      <div style={{ width: QR_SIZE, height: QR_SIZE }} className="rounded-lg bg-slate-100" />
                    )}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/15 pt-3">
                  <div className="min-w-0">
                    <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-blue-200/80">{t('landing_pass_card_valid')}</div>
                    <bdi dir="ltr" className="block min-h-[1.25rem] font-mono text-xs sm:text-sm font-bold text-white">{validThru}</bdi>
                  </div>
                  <div className="min-w-0 text-end">
                    <div className="text-[9px] sm:text-[10px] font-medium uppercase tracking-wider text-blue-200/80">{t('landing_pass_status')}</div>
                    <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {t('landing_pass_status_active')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pass-pill mx-auto mt-auto inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[12px] font-bold text-ink shadow-sm">
                <i className="fa-solid fa-qrcode text-brand"></i>
                {t('landing_pass_redeem')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// The Landly mark in white on the card: the emblem's dark faces at 75%, so
// the star, arch and arrow keep their depth in one colour.
function PassEmblem() {
  return (
    <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} className="h-6 w-auto" fill="currentColor">
      {[STAR, ARCH, ARROW].map((part, i) => (
        <g key={i}>
          <path d={part.light} />
          <path d={part.dark} opacity={0.75} />
        </g>
      ))}
    </svg>
  )
}
