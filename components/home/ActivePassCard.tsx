'use client'

import Link from 'next/link'
import { ArrowRight, Ticket } from 'lucide-react'
import { passCountMessage } from '@/lib/home/categoryRails'
import { useLang } from '@/lib/i18n/useLang'
import LandlyMark from './LandlyMark'

// The member pass: the home page's focal point, and always there, as the way
// into My Pass. Deep brand blue with the Expo card's two background layers
// (landly-mobile/src/components/ActivePassCard.tsx, passGlow and passMark),
// copied 1:1; the live count, then the button. The whole card is one link.
// Hebrew mirrors it through the page's dir: `end` puts both layers on the left.
// `count` is null until the first snapshot (or if the read is refused): a "–"
// and an unseen message holding the card's height, never a fake 0.
//
// Below 768px it's a ticket, as in the app: full width, with notches cut into
// both edges and a dashed tear line above a full-width button. From 768px it
// lies down (Home centres it, up to 680px wide): the label and count at the start and the
// button at the end, the emblem moved clear of it.
export default function ActivePassCard({ count, className = '' }: { count: number | null; className?: string }) {
  const { t } = useLang()
  return (
    <Link
      href="/member"
      aria-labelledby="home-pass-count home-pass-cta"
      className={`group relative isolate mt-5 grid w-full grid-cols-1 overflow-hidden rounded-2xl bg-brand p-5 text-white shadow-[0_12px_32px_-12px_rgba(0,42,138,0.55)] [-webkit-tap-highlight-color:transparent] transition-transform duration-150 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none sm:mt-6 sm:p-6 md:min-h-[168px] md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-8 md:px-8 md:py-6 ${className}`}
    >
      {/* passGlow: a 200px disc of 8% white, bleeding off the top end corner
          (top -70, end -50) and clipped by the card's overflow-hidden. */}
      <span aria-hidden="true" className="pointer-events-none absolute -top-[70px] -end-[50px] z-0 h-[200px] w-[200px] rounded-full bg-white/[0.08]" />
      {/* passMark: the emblem, 88x86 at top 12, end 14, every path white at 15%. */}
      <LandlyMark className="pointer-events-none absolute top-3 end-3.5 z-0 h-[86px] w-[88px] text-white/15 md:end-6 md:top-4 md:h-14 md:w-14" />
      <span className="relative z-10 flex items-center gap-2.5 md:col-start-1 md:row-start-1">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/15" aria-hidden="true">
          <Ticket aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="text-meta font-bold uppercase tracking-wide text-white/85">{t('home_pass_label')}</span>
      </span>
      <span id="home-pass-count" className="relative z-10 mt-4 flex items-center gap-3 pe-[72px] sm:gap-4 md:col-start-1 md:row-start-2 md:pe-0">
        <span className="text-stat sm:text-5xl leading-none font-extrabold tabular-nums" dir="ltr" aria-live="polite">{count ?? '–'}</span>
        <span className={`min-w-0 text-copy sm:text-base font-semibold leading-snug ${count === null ? 'invisible' : ''}`}>
          {passCountMessage(count ?? 0, t)}
        </span>
      </span>
      {/* A ticket's perforation, as in the app. The notches take the canvas's tone
          where this card sits, partway down its 420px wash. */}
      <span aria-hidden="true" className="relative z-10 -mx-5 my-4 flex items-center sm:-mx-6 md:hidden">
        <span className="-ms-[9px] h-[18px] w-[18px] flex-shrink-0 rounded-full bg-[#F4F7FB]" />
        <span className="mx-1.5 flex-1 border-t-[1.5px] border-dashed border-white/35" />
        <span className="-me-[9px] h-[18px] w-[18px] flex-shrink-0 rounded-full bg-[#F4F7FB]" />
      </span>
      <span id="home-pass-cta" className="relative z-10 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-copy font-bold text-brand transition-colors [@media(hover:hover)]:group-hover:bg-brandLight md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:self-end">
        <span>{t('home_pass_cta')}</span>
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2} />
      </span>
    </Link>
  )
}
