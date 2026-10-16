'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function Hero() {
  const { t } = useLang()

  return (
    <section
      id="hero"
      // On phones the hero (its pt-16 clearing the fixed navbar) fills the
      // visible viewport; dvh tracks Safari/Chrome's collapsing toolbars, vh
      // is the fallback for browsers without it.
      className="relative overflow-hidden pt-16 flex items-center max-sm:min-h-screen max-sm:supports-[height:100dvh]:min-h-[100dvh]"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #FFFFFF 0%, #FFFFFF 30%, #EFF6FF 65%, #E0F2FE 100%)' }}
    >
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 pt-14 pb-10 sm:pt-20 sm:pb-12 lg:pt-24 lg:pb-14 text-center">
        <h1
          className="font-black text-[#0B1B3D] leading-[1.12] mb-5 max-w-3xl mx-auto"
          style={{ fontSize: 'clamp(34px,5.6vw,60px)', letterSpacing: '-0.03em' }}
        >
          <span>{t('hero_line1')}</span><br />
          <span className="text-brand">{t('hero_line2')}</span>
        </h1>

        <p className="text-[#475569] text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto mb-9">
          {t('hero_sub')}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto mb-7 sm:mb-8">
          <Link
            href="/signup"
            className="tap-target group inline-flex items-center justify-center gap-2 bg-brand text-white border border-transparent font-extrabold text-[15px] px-8 py-3.5 rounded-full min-h-[52px] shadow-[0_1px_2px_rgba(11,27,61,.08),0_8px_24px_rgba(0,56,184,.28)] transition hover:bg-brandDark [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:transform-none"
          >
            <span>{t('hero_cta1')}</span>
            <i className="fa-solid fa-arrow-right text-sm rtl:-scale-x-100" aria-hidden="true"></i>
          </Link>
          <Link
            href="/login"
            className="tap-target inline-flex items-center justify-center gap-2 bg-[#FFFFFF] border border-[#E2E8F0] text-[#0B1B3D] font-extrabold text-[15px] px-8 py-3.5 rounded-full min-h-[52px] shadow-[0_1px_2px_rgba(11,27,61,.05)] transition hover:bg-slate-50 hover:border-slate-300 [@media(hover:hover)]:hover:-translate-y-0.5 motion-reduce:transform-none"
          >
            <span>{t('nav_login')}</span>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap text-[#475569] text-xs sm:text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 bg-[#F0F7FF] rounded-full px-3 py-1.5"><i className="fa-solid fa-bolt text-brand" aria-hidden="true"></i>{t('hero_trust1')}</span>
          <span className="inline-flex items-center gap-1.5 bg-[#F0F7FF] rounded-full px-3 py-1.5"><i className="fa-solid fa-sparkles text-brand" aria-hidden="true"></i>{t('hero_trust2')}</span>
        </div>
      </div>
    </section>
  )
}
