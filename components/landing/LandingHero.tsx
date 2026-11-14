'use client'

import StoreButtons from '@/components/landing/StoreButtons'
import { useLang } from '@/lib/i18n/useLang'

// The guest landing's full-bleed opening on a soft wash: one centred column of
// the headline, what GoLandly is, the way in and both stores. The deals have
// their own section right under it.
export default function LandingHero() {
  const { t } = useLang()

  return (
    <section id="hero" className="relative isolate overflow-x-clip below-header bg-gradient-to-b from-blue-50/60 via-white to-transparent">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_30%,rgba(59,130,246,.14),transparent_70%)]" />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-12 pb-10 text-center sm:px-6 lg:px-8 sm:pt-16 sm:pb-12 lg:pt-20 lg:pb-14">
        <h1 className="mb-4 text-4xl font-black leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-7xl">
          <span className="block">{t('landing_hero_title')}</span>
          <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text pb-1 text-transparent">{t('landing_hero_accent')}</span>
        </h1>
        <p className="mb-8 max-w-xl text-base leading-relaxed text-body sm:text-lg">{t('landing_hero_sub')}</p>
        <StoreButtons />
      </div>
    </section>
  )
}
