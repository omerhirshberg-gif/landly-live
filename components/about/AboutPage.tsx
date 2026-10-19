'use client'

import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SectionDivider from '@/components/ui/SectionDivider'
import Reveal from '@/components/ui/Reveal'
import { FOUNDERS } from '@/lib/about/founders'
import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from '@/lib/i18n/useLang'
import FounderCard from './FounderCard'

// /about: Landly's story, its co-founders, why it exists, and a way in. On
// the site canvas (.home-ambient) with the guest home's hairlines between
// sections, each rising in as it's reached. The closing call to action invites guests to sign up or sign in;
// members, already in, get Explore Perks instead.
export default function AboutPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()

  return (
    <>
      <Navbar />
      <main className="home-ambient below-header">
        <section aria-labelledby="about-title" className="max-w-3xl mx-auto px-5 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-14 text-center">
          <h1 id="about-title" className="text-4xl sm:text-5xl font-black text-ink mb-4" style={{ letterSpacing: '-0.03em' }}>
            {t('about_title')}
          </h1>
          <p className="text-[#475569] text-base sm:text-lg leading-relaxed">{t('about_sub')}</p>
        </section>

        <SectionDivider />

        <section aria-labelledby="about-founders-title" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
          <h2 id="about-founders-title" className="text-2xl sm:text-3xl font-black text-[#0B1B3D] text-center mb-6 sm:mb-8" style={{ letterSpacing: '-0.02em' }}>
            {t('about_founders_title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FOUNDERS.map((founder, i) => (
              <Reveal key={founder.id} delay={i * 80} className="h-full">
                <FounderCard founder={founder} />
              </Reveal>
            ))}
          </div>
        </section>

        <SectionDivider />

        <section aria-labelledby="about-mission-title" className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
          {/* Editorial: a brand bar down the start edge, the title as the lead. */}
          <Reveal className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 ps-8 sm:p-10 sm:ps-12">
            <span aria-hidden="true" className="absolute inset-y-0 start-0 w-1.5 bg-gradient-to-b from-brand to-brandGradientStart" />
            <i aria-hidden="true" className="fa-solid fa-quote-left text-2xl text-brand/20 rtl:-scale-x-100"></i>
            <h2 id="about-mission-title" className="mt-3 text-2xl sm:text-3xl font-black text-ink mb-4">{t('about_mission_title')}</h2>
            <p className="text-base sm:text-lg leading-relaxed text-body">{t('about_mission_text')}</p>
          </Reveal>
        </section>

        <SectionDivider />

        <section aria-labelledby="about-cta-title" className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-14 sm:pb-20">
          <Reveal className="rounded-3xl bg-brand px-6 py-8 sm:px-10 sm:py-10 text-center text-white shadow-[0_12px_32px_rgba(0,56,184,.22)]">
            <h2 id="about-cta-title" className="text-2xl sm:text-3xl font-black mb-6">{t('about_cta_title')}</h2>
            {/* Held empty while auth loads, so neither set of buttons flashes. */}
            <div className="flex min-h-[52px] flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              {loading ? null : user ? (
                <Link href="/categories" className="ds-btn ds-btn-inverse ds-btn-wrap">
                  {t('nav_cta')}
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="ds-btn ds-btn-inverse ds-btn-wrap">
                    {t('signup_title')}
                  </Link>
                  <Link href="/login" className="ds-btn ds-btn-outline-inverse ds-btn-wrap">
                    {t('nav_login')}
                  </Link>
                </>
              )}
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  )
}
