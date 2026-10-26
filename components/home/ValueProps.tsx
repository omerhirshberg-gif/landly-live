'use client'

import Link from 'next/link'
import { ArrowRight, Compass, HeartHandshake, Sparkles, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import IconFrame from '@/components/ui/IconFrame'
import { pillarHref, VALUE_PILLARS, type ValuePillar } from '@/lib/home/showcase'
import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'
import { useSnapIndex } from '@/lib/useSnapIndex'
import SnapDots from '@/components/ui/SnapDots'

// What Landly covers, grouped from the real business categories
// (lib/categories.ts) — no placeholder merchants, and no sign-up button: the
// hero and navbar carry the one sign-up path. Each pillar's glyph is a fine
// Lucide outline in the shared 40px frame (IconFrame).
// Each card is its glyph, its name and a short lifestyle line under it (no
// perk counts: a young catalogue reads as empty, not exclusive), with an
// arrow into its perks (lib/home/showcase.ts VALUE_PILLARS): the category,
// the catalogue, or /olim for Community.
const PILLAR_VIEW: Record<ValuePillar['key'], { icon: LucideIcon; titleKey: TranslationKey; tagKey: TranslationKey }> = {
  dining: { icon: UtensilsCrossed, titleKey: 'vp_dining_title', tagKey: 'vp_dining_desc' },
  lifestyle: { icon: Sparkles, titleKey: 'vp_lifestyle_title', tagKey: 'vp_lifestyle_desc' },
  experiences: { icon: Compass, titleKey: 'vp_experiences_title', tagKey: 'vp_experiences_desc' },
  community: { icon: HeartHandshake, titleKey: 'vp_community_title', tagKey: 'vp_community_desc' },
}
const PILLARS = VALUE_PILLARS.map((pillar) => ({ pillar, ...PILLAR_VIEW[pillar.key] }))

export default function ValueProps() {
  const { t } = useLang()
  const { ref: rowRef, index: active, scrollTo } = useSnapIndex<HTMLUListElement>(PILLARS.length)

  return (
    // id="deals" keeps old /#deals links and globals.css's scroll margin working.
    // Same padding as the other sections, so the hairlines between them sit
    // evenly. No background: the guest home's gradient (app/page.tsx) shows through.
    <section id="deals" className="py-12 sm:py-14 lg:py-16">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-5 sm:mb-12">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('vp_label')}</div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{t('vp_title')}</h2>
        </div>

        {/* Phones: one swipeable row of compact cards (the next one peeks in, a
            swipe settles on a card's centre, the page never drags sideways), so
            the perk examples below are a short scroll away instead of four
            stacked screens. From sm: the grid, two columns then four. The py
            keeps the cards' shadow and hover lift clear of the row's clipping.
            Under the row on phones, pagination dots follow the card in view
            (useSnapIndex) and bring a card in when tapped. */}
        <ul ref={rowRef} className="-mx-5 px-5 scroll-px-5 flex gap-3 overflow-x-auto overscroll-x-contain py-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0 sm:py-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-5 sm:overflow-visible">
          {PILLARS.map((p) => (
            <li key={p.titleKey} className="flex w-[200px] flex-shrink-0 snap-center sm:w-auto">
              <Link
                href={pillarHref(p.pillar)}
                // From sm, the same three shadow layers as the auth card (entrance.module.css .card);
                // a lighter one on phones, where the row would clip the deep layers.
                className="group flex w-full flex-col bg-white/95 backdrop-blur-sm border border-line rounded-2xl p-5 sm:p-6 shadow-card sm:shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_20px_-4px_rgba(15,23,42,.06),0_28px_56px_-16px_rgba(15,23,42,.14)] transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-brand/25 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgba(15,23,42,.05),0_10px_24px_-4px_rgba(15,23,42,.08),0_32px_64px_-16px_rgba(0,56,184,.18)] motion-reduce:transform-none"
              >
                <span className="flex items-start justify-between gap-2">
                  <IconFrame icon={p.icon} size="sm" />
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300 transition-[color,transform] duration-200 rtl:-scale-x-100 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5 [@media(hover:hover)]:group-hover:text-brand motion-reduce:transform-none"
                    strokeWidth={1.75}
                  />
                </span>
                <h3 className="mt-3 sm:mt-4 font-bold text-title text-ink text-balance">{t(p.titleKey)}</h3>
                <p className="mt-1 line-clamp-2 text-meta leading-snug text-slate-500">{t(p.tagKey)}</p>
              </Link>
            </li>
          ))}
        </ul>
        <SnapDots count={PILLARS.length} active={active} onSelect={scrollTo} className="sm:hidden" />
      </div>
    </section>
  )
}
