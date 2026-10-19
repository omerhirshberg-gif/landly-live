'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function Hero() {
  const { t } = useLang()

  return (
    <section
      id="hero"
      // below-header clears the fixed navbar; the hero is only as tall as its
      // content, so the headline sits close under the navbar. No background
      // of its own: the site canvas (.home-ambient) runs behind every
      // section, so there's no cut line below it.
      className="relative overflow-hidden below-header"
    >
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 pt-8 pb-8 sm:pt-12 sm:pb-10 lg:pt-14 lg:pb-12 text-center">
        <h1
          className="font-black text-[#0B1B3D] leading-[1.12] mb-4 max-w-3xl mx-auto"
          style={{ fontSize: 'clamp(34px,5.6vw,60px)', letterSpacing: '-0.03em' }}
        >
          <span>{t('hero_line1')}</span><br />
          <span className="text-brand">{t('hero_line2')}</span>
        </h1>

        <p className="text-[#475569] text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto mb-7 sm:mb-8">
          {t('hero_sub')}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto mb-6 sm:mb-7">
          <Link
            href="/signup"
            className="tap-target group inline-flex items-center justify-center gap-2 bg-brand text-white border border-transparent font-extrabold tracking-tight text-[15px] px-8 py-3.5 rounded-xl min-h-[52px] shadow-[0_1px_2px_rgba(11,27,61,.08),0_8px_24px_rgba(0,56,184,.28)] transition hover:bg-brandDark [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:transform-none"
          >
            <span>{t('hero_cta1')}</span>
            <i className="fa-solid fa-arrow-right text-sm rtl:-scale-x-100" aria-hidden="true"></i>
          </Link>
          <Link
            href="/login"
            className="tap-target inline-flex items-center justify-center gap-2 bg-[#FFFFFF] border border-[#E2E8F0] text-[#0B1B3D] font-extrabold tracking-tight text-[15px] px-8 py-3.5 rounded-xl min-h-[52px] shadow-[0_1px_2px_rgba(11,27,61,.05)] transition hover:bg-slate-50 hover:border-slate-300 [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:transform-none"
          >
            <span>{t('nav_login')}</span>
          </Link>
        </div>

        {/* White pills, so they stand out on the canvas's blue-washed top. */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap text-[#475569] text-xs sm:text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 bg-white/80 rounded-full px-3 py-1.5 shadow-sm"><i className="fa-solid fa-bolt text-brand" aria-hidden="true"></i>{t('hero_trust1')}</span>
          <span className="inline-flex items-center gap-1.5 bg-white/80 rounded-full px-3 py-1.5 shadow-sm"><i className="fa-solid fa-sparkles text-brand" aria-hidden="true"></i>{t('hero_trust2')}</span>
        </div>
      </div>
    </section>
  )
}
