'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import HeroFeatureGrid from '@/components/home/HeroFeatureGrid'
import type { HeroFeature } from '@/lib/home/showcase'
import { useLang } from '@/lib/i18n/useLang'

export default function Hero({ features }: { features: readonly HeroFeature[] }) {
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
      {/* Phones and tablets stack: pill, headline, sub, the feature cards,
          then the buttons. From lg the copy and buttons share the start
          column and the cards stand beside them. */}
      <div className="w-full max-w-7xl mx-auto px-5 sm:px-6 pt-8 pb-8 sm:pt-12 sm:pb-10 lg:pt-14 lg:pb-12 grid text-center lg:text-start lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:grid-rows-[auto_auto] lg:gap-x-12 lg:items-center">
        <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
          {/* The free pass, said first: a frosted-glass chip over the headline,
              led by an emerald beacon whose ring pings outward (a still dot
              under reduced motion). Long copy wraps inside it on narrow phones. */}
          <p className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/70 bg-white/60 px-3.5 py-1.5 text-meta font-bold leading-snug tracking-tight rtl:tracking-normal text-ink ring-1 ring-brand/10 shadow-[0_2px_8px_rgba(0,56,184,0.06)] backdrop-blur-md">
            <span aria-hidden="true" className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>{t('hero_free_badge')}</span>
          </p>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink leading-[1.12] mb-4 max-w-3xl mx-auto lg:mx-0"
          >
            <span>{t('hero_line1')}</span><br />
            <span className="text-brand">{t('hero_line2')}</span>
          </h1>

          <p className="text-body text-base sm:text-lg lg:text-xl leading-relaxed max-w-xl mx-auto lg:mx-0 mb-7 sm:mb-8">
            {t('hero_sub')}
          </p>
        </div>

        <div className="w-full max-w-md mx-auto mb-7 sm:mb-8 lg:max-w-none lg:mb-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <HeroFeatureGrid features={features} />
        </div>

        <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
          {/* Side by side from 380px, stacked full width on the narrowest phones. */}
          <div className="flex items-center justify-center lg:justify-start gap-3 max-[379px]:flex-col max-[379px]:items-stretch">
            <Link href="/signup" className="ds-btn ds-btn-primary ds-btn-wrap">
              <span>{t('hero_cta1')}</span>
              <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2.25} />
            </Link>
            <Link href="/login" className="ds-btn ds-btn-secondary ds-btn-wrap">
              <span>{t('nav_login')}</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
