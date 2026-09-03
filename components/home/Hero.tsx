'use client'

import Link from 'next/link'
import { useLang } from '@/lib/i18n/useLang'

export default function Hero({ onOpenRaffleTerms }: { onOpenRaffleTerms: () => void }) {
  const { t } = useLang()

  return (
    <section id="hero" className="hero-video-wrap">
      <video className="hero-vid" autoPlay muted loop playsInline poster="/hero-poster.jpg">
        <source src="/hero-video.mp4" type="video/mp4" />
      </video>
      <div className="hero-vid-overlay"></div>

      {/* Compact floating raffle pill — pops visually without taking hero real estate */}
      <button onClick={onOpenRaffleTerms} className="raffle-float">
        <span className="raffle-icon-wrap"><i className="fa-solid fa-gift"></i></span>
        <span>{t('raffle_pill_text')}</span>
      </button>

      <div className="hero-vid-content max-w-7xl mx-auto px-5 sm:px-6 py-20 sm:py-24 w-full">
        <div className="max-w-2xl">
          <h1 className="font-black text-white leading-[1.12] mb-5 sm:mb-6" style={{ fontSize: 'clamp(32px,7vw,58px)', letterSpacing: '-1.5px' }}>
            <span>{t('hero_line1')}</span><br />
            <span style={{ background: 'linear-gradient(90deg,#60c8ff,#a5f3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('hero_line2')}</span>
          </h1>

          <div className="hero-sub-glass mb-8 sm:mb-10 max-w-xl">
            <p className="text-white text-lg sm:text-2xl leading-relaxed font-bold">
              {t('hero_sub')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 mb-12 sm:mb-16">
            <a href="#deals" className="btn-primary">
              <i className="fa-solid fa-tags"></i> <span>{t('hero_cta1')}</span>
            </a>
            <Link href="/business" className="btn-secondary">
              <i className="fa-solid fa-store"></i> <span>{t('hero_cta2')}</span>
            </Link>
          </div>

          <div className="flex gap-6 sm:gap-10 flex-wrap">
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">183K+</div>
              <div className="text-white/65 text-xs sm:text-sm mt-0.5">{t('hero_stat1')}</div>
            </div>
            <div className="w-px bg-white/25"></div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">5</div>
              <div className="text-white/65 text-xs sm:text-sm mt-0.5">{t('hero_stat2')}</div>
            </div>
            <div className="w-px bg-white/25"></div>
            <div>
              <div className="text-2xl sm:text-3xl font-black text-white">30%</div>
              <div className="text-white/65 text-xs sm:text-sm mt-0.5">{t('hero_stat3')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
