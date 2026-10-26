'use client'

import Link from 'next/link'
import { ArrowRight, PlaneTakeoff, QrCode, Sparkles, UserPlus } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import SnapDots from '@/components/ui/SnapDots'
import { useLang } from '@/lib/i18n/useLang'
import { useSnapIndex } from '@/lib/useSnapIndex'

// How Landly works, as three steps and a way into the /olim path. Phones
// (below md): one swipeable row of cards (about 82% of a phone's width, 320px
// on a small tablet; a swipe settles on a card's centre, momentum scrolling,
// the page never drags sideways), with pagination dots under it that follow the card in view and
// bring one in when tapped. From md: the three steps as a three-column grid,
// with the /olim card as a full-width banner beneath them. Each step is a
// white card on the section's slate wash (rounded-3xl, a hairline, a soft
// shadow, at least 230px tall, 250px from 640px). Behind its content, a giant
// editorial step number (01, 02, 03, the same in every language) at 10% ink,
// clearly there but quieter than the text, at the card's leading top corner,
// on the right in Hebrew; the card clips it and it's decorative (the titles
// carry the order). Facing it at the trailing top, the step's glyph in the
// shared 56px frame (IconFrame xl), then, held to the card's foot, a large
// title (24px, 26px from 640px) over a 16-18px description, aligned to the
// reading edge. No intro under the heading: the
// steps say it.
const STEPS = [
  { icon: UserPlus, titleKey: 'step1_title', descKey: 'step1_desc' },
  { icon: Sparkles, titleKey: 'step2_title', descKey: 'step2_desc' },
  { icon: QrCode, titleKey: 'step3_title', descKey: 'step3_desc' },
] as const

export default function HowItWorks() {
  const { t } = useLang()
  // The steps, then the /olim card.
  const slides = STEPS.length + 1
  const { ref: rowRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(slides)
  const slide = 'min-w-[82vw] max-w-[340px] sm:min-w-[320px] flex-shrink-0 snap-center md:min-w-0 md:max-w-none'

  return (
    <section id="how" className="bg-slate-50 py-12 sm:py-14 lg:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-12">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('how_label')}</div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{t('how_title')}</h2>
        </div>
        {/* The py keeps the cards' shadows and hover lift clear of the row's clipping. */}
        <div
          ref={rowRef}
          className="-mx-5 px-5 scroll-px-5 sm:-mx-6 sm:px-6 sm:scroll-px-6 flex gap-4 overflow-x-auto overscroll-x-contain py-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch] md:mx-0 md:px-0 md:py-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible"
        >
          {STEPS.map(({ icon: Icon, titleKey, descKey }, i) => (
            <div
              key={titleKey}
              className={`${slide} relative overflow-hidden p-7 sm:p-9 min-h-[230px] sm:min-h-[250px] flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white shadow-sm text-start transition-transform duration-300 ease-out-expo [@media(hover:hover)]:hover:-translate-y-1 motion-reduce:transform-none`}
            >
              <span aria-hidden="true" className="absolute start-5 sm:start-7 top-4 sm:top-5 select-none pointer-events-none font-black text-slate-900/[0.10] text-[88px] sm:text-[110px] leading-none tracking-tighter tabular-nums">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="relative flex justify-end">
                <IconFrame icon={Icon} size="xl" />
              </div>
              <div className="relative">
                <h3 className="mt-6 sm:mt-8 text-2xl sm:text-[26px] font-black leading-tight tracking-tight text-ink">{t(titleKey)}</h3>
                <p className="mt-3 max-w-sm text-base sm:text-lg font-medium leading-relaxed text-slate-600">{t(descKey)}</p>
              </div>
            </div>
          ))}
          <Link
            href="/olim"
            className={`${slide} block md:col-span-3 md:flex md:items-center md:gap-6 md:text-start text-center text-white rounded-2xl p-6 md:px-8 bg-[radial-gradient(120%_120%_at_0%_0%,#0038B8_0%,#002A8A_100%)] shadow-[0_2px_4px_rgba(0,42,138,.12),0_12px_32px_rgba(0,56,184,.22)] transition duration-200 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_4px_8px_rgba(0,42,138,.16),0_20px_44px_rgba(0,56,184,.32)] motion-reduce:transform-none`}
          >
            <span aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl md:mx-0 md:mb-0">
              <PlaneTakeoff aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100" strokeWidth={1.75} />
            </span>
            <span className="block md:flex-1">
              <span className="block text-micro font-bold tracking-widest uppercase mb-2 text-white/70">{t('step4_label')}</span>
              <span className="block font-black text-xl mb-2 leading-tight">{t('step4_title')}</span>
              <span className="block text-white/80 text-sm leading-relaxed mb-5 md:mb-0">{t('step4_desc')}</span>
            </span>
            <span className="inline-flex flex-shrink-0 items-center gap-2 text-sm font-bold text-white border border-white/30 rounded-xl px-4 py-2">
              {t('step4_link')} <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2.25} />
            </span>
          </Link>
        </div>
        <SnapDots count={slides} active={active} onSelect={scrollTo} className="md:hidden" />
      </div>
    </section>
  )
}
