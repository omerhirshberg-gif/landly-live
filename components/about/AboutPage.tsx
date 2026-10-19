'use client'

import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import SectionDivider from '@/components/home/SectionDivider'
import { FOUNDERS } from '@/lib/about/founders'
import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from '@/lib/i18n/useLang'
import FounderCard from './FounderCard'

// /about: Landly's story, its co-founders, why it exists, and a way in. On
// the guest home's backdrop (.home-ambient) with the same hairlines between
// sections. The closing call to action invites guests to sign up or sign in;
// members, already in, get Explore Perks instead.
export default function AboutPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()

  return (
    <>
      <Navbar />
      <main className="home-ambient below-header">
        <section aria-labelledby="about-title" className="max-w-3xl mx-auto px-5 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-14 text-center">
          <h1 id="about-title" className="text-4xl sm:text-5xl font-black text-[#0B1B3D] mb-4" style={{ letterSpacing: '-0.03em' }}>
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
            {FOUNDERS.map((founder) => (
              <FounderCard key={founder.id} founder={founder} />
            ))}
          </div>
        </section>

        <SectionDivider />

        <section aria-labelledby="about-mission-title" className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-14">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-line shadow-sm">
            <h2 id="about-mission-title" className="text-2xl font-black text-[#0B1B3D] mb-3">{t('about_mission_title')}</h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-[#475569]">{t('about_mission_text')}</p>
          </div>
        </section>

        <SectionDivider />

        <section aria-labelledby="about-cta-title" className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-14 sm:pb-20">
          <div className="rounded-3xl bg-brand px-6 py-8 sm:px-10 sm:py-10 text-center text-white shadow-[0_12px_32px_rgba(0,56,184,.22)]">
            <h2 id="about-cta-title" className="text-2xl sm:text-3xl font-black mb-6">{t('about_cta_title')}</h2>
            {/* Held empty while auth loads, so neither set of buttons flashes. */}
            <div className="flex min-h-[52px] flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              {loading ? null : user ? (
                <Link href="/categories" className="tap-target inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 font-extrabold text-brand transition-colors hover:bg-brandLight">
                  {t('nav_cta')}
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="tap-target inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 font-extrabold text-brand transition-colors hover:bg-brandLight">
                    {t('signup_title')}
                  </Link>
                  <Link href="/login" className="tap-target inline-flex items-center justify-center rounded-full border border-white/40 px-8 py-3.5 font-extrabold text-white transition-colors hover:bg-white/10">
                    {t('nav_login')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
