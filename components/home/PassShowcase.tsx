'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CircleCheck, PiggyBank, QrCode, Ticket, X } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import Reveal from '@/components/ui/Reveal'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/brand/wordmarkPath'
import { SITE_URL } from '@/lib/config'
import { useLang } from '@/lib/i18n/useLang'
import { useInView } from '@/lib/useInView'

// How long a voucher stays valid by default (an offer's validityDays).
const PASS_VALID_DAYS = 180
const QR_SIZE = 92
// The mockup's sample member number: an illustration, not a real account.
const DEMO_MEMBER_ID = 'LND-84920'

/** A validity date as a card prints it: MM/YYYY, the same in every language. */
export function formatValidThru(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

const POINTS = [
  { icon: Ticket, key: 'landing_pass_point1' },
  { icon: QrCode, key: 'landing_pass_point2' },
  { icon: PiggyBank, key: 'landing_pass_point3' },
] as const

// The guest home's look at the member pass: a phone drawn in CSS with the
// pass on its light Wallet-style screen, beside what using one is like. The
// pass is laid out like the real Wallet pass (lib/wallet/applePass.ts): a flat
// ink card the white Landly mark and wordmark
// with the validity opposite as a header field, a photo strip, the member's
// name, label-over-value fields (member number, status: active) and the QR on
// a white panel with the number under it; above it, the sheet's header (close,
// title, Add); under the card, a quiet "Show to redeem" line. The name and number are a sample (the
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
      {/* From lg the copy takes the room and the phone only its own width,
          the pair held to 64rem, so there's no empty half around the phone. */}
      <div className="max-w-5xl mx-auto px-5 sm:px-6 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
        <Reveal>
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('landing_pass_label')}</div>
          <h2 id="home-pass-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink mb-2">
            {t('landing_pass_title')}
          </h2>
          <p className="text-body text-copy sm:text-base leading-relaxed mb-6 max-w-xl">{t('landing_pass_sub')}</p>
          <ul className="space-y-3">
            {POINTS.map((p) => (
              <li key={p.key} className="flex items-center gap-3 text-copy font-semibold text-ink">
                <IconFrame icon={p.icon} size="sm" />
                <span>{t(p.key)}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <div ref={passRef} data-pass={!armed ? undefined : passInView ? 'play' : 'armed'} className="pass-anim relative mx-auto w-[248px] sm:w-[272px]">
          {/* Decorative: the phone repeats the points beside it. */}
          <div aria-hidden="true" className="relative rounded-[2.5rem] bg-[#0E1014] p-[7px] ring-1 ring-inset ring-white/15 shadow-[0_2px_4px_rgba(11,27,61,.12),0_24px_48px_-12px_rgba(11,27,61,.35),0_48px_96px_-24px_rgba(0,56,184,.35)]">
            <div className="relative flex aspect-[9/19] flex-col overflow-hidden rounded-[2.1rem] bg-gradient-to-b from-slate-100 to-white px-3.5 pt-11 pb-4">
              <div className="absolute top-2.5 left-1/2 h-[22px] w-[84px] -translate-x-1/2 rounded-full bg-[#0E1014]" />
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200/80"><X aria-hidden="true" className="h-3 w-3 text-ink" strokeWidth={2.5} /></span>
                <span className="min-w-0 truncate text-meta font-bold text-ink">{t('landing_pass_screen_title')}</span>
                <span className="shrink-0 rounded-full bg-[#0A84FF] px-2.5 py-0.5 text-nano font-bold text-white">{t('landing_pass_add')}</span>
              </div>

              {/* Laid out like the real Wallet pass (lib/wallet/applePass.ts): a flat ink card the mark and a header field,
                  a photo strip, the primary field, label-over-value fields, then the barcode on a white panel. Only the look changes here: the pass-*
                  hooks drive the entrance. */}
              <div className="pass-card relative shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-ink text-start text-white shadow-[0_10px_30px_-8px_rgba(11,27,61,.45)]">
                <div className="flex items-center justify-between gap-2 px-3.5 pb-2.5 pt-3.5">
                  <span className="flex items-center gap-1.5" dir="ltr">
                    <PassEmblem />
                    <svg viewBox={`${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`} className="h-3 w-auto" fill="currentColor">
                      <path d={WORDMARK_PATH} />
                    </svg>
                  </span>
                  <span className="text-end leading-tight">
                    <span className="block font-mono text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-[rgb(180,194,220)]">{t('landing_pass_card_valid')}</span>
                    <bdi dir="ltr" className="block min-h-[1.1rem] font-mono text-xs font-medium text-white">{validThru}</bdi>
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/raayonit-banner/shopping.webp" alt="" width={3000} height={1000} loading="lazy" decoding="async" className="block h-9 w-full object-cover" />
                <div className="px-3.5 pb-3 pt-2.5">
                  <div className="truncate font-display text-lg sm:text-xl font-normal tracking-tight text-white" dir="auto">{t('landing_pass_demo_name')}</div>
                  <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-[rgb(180,194,220)]">
                    <CircleCheck aria-hidden="true" className="h-2.5 w-2.5 text-emerald-400" strokeWidth={2.5} />
                    {t('landing_pass_free_member')}
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-[rgb(180,194,220)]">{t('landing_pass_card_member')}</div>
                      <bdi dir="ltr" className="block font-mono text-xs font-medium text-white">#{DEMO_MEMBER_ID}</bdi>
                    </div>
                    <div className="min-w-0 text-end">
                      <div className="font-mono text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-[rgb(180,194,220)]">{t('landing_pass_status')}</div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white">
                        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {t('landing_pass_status_active')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-center">
                    <div className="pass-qr relative w-full overflow-hidden rounded-lg bg-white px-3 pb-1.5 pt-2.5 text-center">
                      <span aria-hidden="true" className="pass-shine" />
                      {qr ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={qr} alt="" width={QR_SIZE} height={QR_SIZE} className="mx-auto block" />
                      ) : (
                        <div style={{ width: QR_SIZE, height: QR_SIZE }} className="mx-auto bg-slate-100" />
                      )}
                      <bdi dir="ltr" className="mt-1 block text-nano font-medium tracking-wide text-ink">{DEMO_MEMBER_ID}</bdi>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pass-pill mx-auto mt-auto inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600">
                <QrCode aria-hidden="true" className="h-3.5 w-3.5 text-slate-500" strokeWidth={2} />
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
