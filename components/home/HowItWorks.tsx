'use client'

import Link from 'next/link'
import SnapDots from '@/components/ui/SnapDots'
import { useLang } from '@/lib/i18n/useLang'
import { useSnapIndex } from '@/lib/useSnapIndex'

// How Landly works, as three steps and a way into the /olim path. Phones
// (below md): one swipeable row of cards (about 82% of a phone's width, 320px
// on a small tablet; a swipe settles on a card's centre, momentum scrolling,
// the page never drags sideways), with pagination dots under it that follow the card in view and
// bring one in when tapped. From md: the three steps as a three-column grid,
// with the /olim card as a full-width banner beneath them. Each step's icon
// sits in a brand-tint box (no OS emoji).
export default function HowItWorks({ variant = 'guest' }: { variant?: 'guest' | 'member' }) {
  const { t } = useLang()

  const steps =
    variant === 'member'
      ? ([
          { icon: 'fa-ticket', titleKey: 'step2_title', descKey: 'step2_desc' },
          { icon: 'fa-bullseye', titleKey: 'step3_title', descKey: 'step3_desc' },
          { icon: 'fa-store', titleKey: 'step_redeem_title', descKey: 'step_redeem_desc' },
        ] as const)
      : ([
          { icon: 'fa-user-plus', titleKey: 'step1_title', descKey: 'step1_desc' },
          { icon: 'fa-ticket', titleKey: 'step2_title', descKey: 'step2_desc' },
          { icon: 'fa-bullseye', titleKey: 'step3_title', descKey: 'step3_desc' },
        ] as const)
  // The steps, then the /olim card.
  const slides = steps.length + 1
  const { ref: rowRef, index: active, scrollTo } = useSnapIndex<HTMLDivElement>(slides)
  const slide = 'min-w-[82vw] max-w-[340px] sm:min-w-[320px] flex-shrink-0 snap-center md:min-w-0 md:max-w-none'

  return (
    <section id="how" className="py-12 sm:py-14 lg:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 sm:mb-12">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('how_label')}</div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1B3D] mb-3" style={{ letterSpacing: '-0.025em' }}>{t('how_title')}</h2>
          <p className="text-[#475569] text-[15px] sm:text-base leading-relaxed">{t('how_sub')}</p>
        </div>
        {/* The py keeps the cards' shadows and hover lift clear of the row's clipping. */}
        <div
          ref={rowRef}
          className="-mx-5 px-5 scroll-px-5 sm:-mx-6 sm:px-6 sm:scroll-px-6 flex gap-4 overflow-x-auto overscroll-x-contain py-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch] md:mx-0 md:px-0 md:py-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible"
        >
          {steps.map((step, i) => (
            <div className={`${slide} bg-white/95 backdrop-blur-sm border border-[#E2E8F0] rounded-2xl p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,.04),0_4px_16px_rgba(15,23,42,.05)]`} key={step.titleKey}>
              <div className="step-num">{i + 1}</div>
              <span aria-hidden="true" className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-brand/10 bg-brandTint text-lg text-brand">
                <i className={`fa-solid ${step.icon}`}></i>
              </span>
              <h3 className="font-bold text-[17px] text-[#0B1B3D] mb-2">{t(step.titleKey)}</h3>
              <p className="text-[#475569] text-sm leading-relaxed">{t(step.descKey)}</p>
            </div>
          ))}
          <Link
            href="/olim"
            className={`${slide} block md:col-span-3 md:flex md:items-center md:gap-6 md:text-start text-center text-white rounded-2xl p-6 md:px-8 bg-[radial-gradient(120%_120%_at_0%_0%,#0038B8_0%,#002A8A_100%)] shadow-[0_2px_4px_rgba(0,42,138,.12),0_12px_32px_rgba(0,56,184,.22)] transition duration-200 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_4px_8px_rgba(0,42,138,.16),0_20px_44px_rgba(0,56,184,.32)] motion-reduce:transform-none`}
          >
            <span aria-hidden="true" className="mx-auto mb-3 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl md:mx-0 md:mb-0">
              <i className="fa-solid fa-plane-departure rtl:-scale-x-100"></i>
            </span>
            <span className="block md:flex-1">
              <span className="block text-[11px] font-bold tracking-widest uppercase mb-2 text-white/70">{t('step4_label')}</span>
              <span className="block font-black text-[19px] mb-2 leading-tight">{t('step4_title')}</span>
              <span className="block text-white/80 text-sm leading-relaxed mb-5 md:mb-0">{t('step4_desc')}</span>
            </span>
            <span className="inline-flex flex-shrink-0 items-center gap-2 text-sm font-bold text-white border border-white/30 rounded-xl px-4 py-2">
              {t('step4_link')} <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
            </span>
          </Link>
        </div>
        <SnapDots count={slides} active={active} onSelect={scrollTo} className="md:hidden" />
      </div>
    </section>
  )
}
