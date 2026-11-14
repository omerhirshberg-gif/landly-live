'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { CircleCheck } from 'lucide-react'
import OfferCard from '@/components/discover/OfferCard'
import { formatValidThru } from '@/components/home/PassShowcase'
import { ARCH, ARROW, EMBLEM_VIEWBOX, STAR } from '@/lib/brand/emblemPaths'
import { WORDMARK_PATH, WORDMARK_VIEWBOX } from '@/lib/brand/wordmarkPath'
import { SITE_URL } from '@/lib/config'
import type { OfferDocument } from '@/lib/firebase/offers'
import { useLang } from '@/lib/i18n/useLang'

const QR_SIZE = 72
const PASS_VALID_DAYS = 180
// A sample number, like the pass further down the page: an illustration, not an account.
const DEMO_MEMBER_ID = 'LND-84920'

// The guest hero's visual anchor: the free member pass, and a real live perk
// laid over its lower corner, so a visitor sees both what they get and what it
// buys (from sm; a phone keeps the hero compact with the pass alone). Static: the pass's own entrance plays further down (PassShowcase). With no live perk the pass stands alone.
// Everything is positioned with start/end, so Hebrew mirrors it.
export default function HeroPassStack({ deal }: { deal?: OfferDocument }) {
  const { t } = useLang()
  const [qr, setQr] = useState<string | null>(null)
  const [validThru, setValidThru] = useState('')

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
    <div className="relative mx-auto flex w-full max-w-[26rem] flex-col lg:max-w-[30rem] xl:max-w-[34rem]">
      <div aria-hidden="true" className={`${deal ? 'w-full sm:w-[94%] sm:pb-10' : 'w-full'} rounded-3xl border border-white/20 bg-gradient-to-br from-brand to-brandDark p-5 text-start text-white shadow-[0_24px_48px_-16px_rgba(0,56,184,.45)]`}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-1.5" dir="ltr">
            <svg viewBox={`0 0 ${EMBLEM_VIEWBOX.width} ${EMBLEM_VIEWBOX.height}`} className="h-6 w-auto" fill="currentColor">
              {[STAR, ARCH, ARROW].map((part, i) => (
                <g key={i}>
                  <path d={part.light} />
                  <path d={part.dark} opacity={0.75} />
                </g>
              ))}
            </svg>
            <svg viewBox={`${WORDMARK_VIEWBOX.x} ${WORDMARK_VIEWBOX.y} ${WORDMARK_VIEWBOX.width} ${WORDMARK_VIEWBOX.height}`} className="h-3.5 w-auto" fill="currentColor">
              <path d={WORDMARK_PATH} />
            </svg>
          </span>
          <span className="text-end leading-tight">
            <span className="block text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-blue-100/80">{t('landing_pass_card_member')}</span>
            <bdi dir="ltr" className="block font-mono text-xs font-bold tabular-nums text-white/90">#{DEMO_MEMBER_ID}</bdi>
          </span>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate font-display text-2xl font-bold leading-tight tracking-tight text-white" dir="auto">{t('landing_pass_demo_name')}</div>
            <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-nano font-semibold uppercase leading-tight tracking-wider rtl:tracking-normal text-white/90">
              <CircleCheck aria-hidden="true" className="h-2.5 w-2.5 text-emerald-300" strokeWidth={2.5} />
              {t('landing_pass_free_member')}
            </span>
            <div className="mt-5 flex gap-6">
              <div>
                <div className="text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-blue-100/80">{t('landing_pass_card_valid')}</div>
                <bdi dir="ltr" className="block min-h-[1.25rem] font-mono text-sm font-bold tabular-nums text-white">{validThru}</bdi>
              </div>
              <div>
                <div className="text-nano font-medium uppercase tracking-wider rtl:tracking-normal text-blue-100/80">{t('landing_pass_status')}</div>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {t('landing_pass_status_active')}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl bg-white p-2 shadow-[0_6px_16px_-6px_rgba(0,0,0,.35)]">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="" width={QR_SIZE} height={QR_SIZE} className="block rounded-lg" />
            ) : (
              <div style={{ width: QR_SIZE, height: QR_SIZE }} className="rounded-lg bg-slate-100" />
            )}
          </div>
        </div>
      </div>

      {deal && (
        <div className="relative -mt-7 ms-auto hidden w-[62%] sm:block">
          <OfferCard offer={deal} layout="grid" className="shadow-[0_16px_40px_-12px_rgba(11,27,61,.28)]" />
        </div>
      )}
    </div>
  )
}
