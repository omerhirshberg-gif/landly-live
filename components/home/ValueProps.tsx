'use client'

import { useLang } from '@/lib/i18n/useLang'
import { TranslationKey } from '@/lib/i18n/translations'

// What Landly covers, grouped from the real business categories
// (lib/categories.ts) — no placeholder merchants, and deliberately no CTA:
// the hero and navbar already carry the one sign-up path.
const PILLARS: { icon: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: 'fa-utensils', titleKey: 'vp_dining_title', descKey: 'vp_dining_desc' },
  { icon: 'fa-bag-shopping', titleKey: 'vp_lifestyle_title', descKey: 'vp_lifestyle_desc' },
  { icon: 'fa-map-location-dot', titleKey: 'vp_experiences_title', descKey: 'vp_experiences_desc' },
  { icon: 'fa-people-group', titleKey: 'vp_community_title', descKey: 'vp_community_desc' },
]

export default function ValueProps() {
  const { t } = useLang()

  return (
    // id="deals" keeps the navbar's /#deals link and scroll-spy pointing here.
    // Tighter top than bottom so the section sits close under the hero.
    <section id="deals" className="pt-12 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-10 sm:mb-12">
          <div className="text-xs font-bold tracking-widest text-brand uppercase mb-3">{t('vp_label')}</div>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0B1B3D] mb-3" style={{ letterSpacing: '-0.025em' }}>{t('vp_title')}</h2>
          <p className="text-[#475569] text-[15px] sm:text-base leading-relaxed">{t('vp_sub')}</p>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {PILLARS.map((p) => (
            <li
              key={p.titleKey}
              // Same three shadow layers as the auth card (entrance.module.css .card).
              className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-6 sm:p-7 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_20px_-4px_rgba(15,23,42,.06),0_28px_56px_-16px_rgba(15,23,42,.14)] transition duration-200 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgba(15,23,42,.05),0_10px_24px_-4px_rgba(15,23,42,.08),0_32px_64px_-16px_rgba(0,56,184,.18)] motion-reduce:transform-none"
            >
              <div className="w-12 h-12 rounded-xl bg-[#F0F7FF] text-brand flex items-center justify-center mb-4">
                <i className={`fa-solid ${p.icon} text-lg`} aria-hidden="true"></i>
              </div>
              <h3 className="font-bold text-[17px] text-[#0B1B3D] mb-1.5">{t(p.titleKey)}</h3>
              <p className="text-[#475569] text-sm leading-relaxed">{t(p.descKey)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
