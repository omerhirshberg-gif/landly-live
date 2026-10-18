'use client'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/home/Hero'
import ValueProps from '@/components/home/ValueProps'
import HowItWorks from '@/components/home/HowItWorks'
import PerkExamples from '@/components/home/PerkExamples'
import SectionDivider from '@/components/home/SectionDivider'
import LoggedInHome from '@/components/home/LoggedInHome'
import HomeFaqPrompt from '@/components/home/HomeFaqPrompt'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'

// The home page's client side (app/page.tsx renders it with the page's
// metadata and structured data): the member dashboard, or the guest landing.
export default function HomePage() {
  const { user, loading } = useAuth()
  // A member who hasn't finished onboarding (say, reloading mid-wizard) is
  // sent back to it; the blank shell holds until that's known.
  const held = useOnboardingGuard()

  if (loading || held) {
    return (
      <>
        <Navbar />
        <div className="pt-16 member-canvas" />
      </>
    )
  }

  if (user) {
    return (
      <>
        <Navbar />
        {/* Members get their dashboard only, like an app: no hero, value
            props, How it works, Aliyah card or marketing footer. Support
            sits at the end of the dashboard; Terms and Privacy are in the
            account menu and the mobile drawer. */}
        <LoggedInHome user={user} />
      </>
    )
  }

  // One CTA pair (Explore Perks → /signup, Sign In → /login) lives in the
  // hero and navbar; the sections below inform rather than repeat it. Under
  // What's inside, real perk examples: guests open any offer freely, and its
  // purchase bar is where they're asked to sign in. One multi-tone blue
  // backdrop (.home-ambient in globals.css) runs behind all the sections
  // (none sets its own background), under the translucent navbar too, so the
  // white cards stand out and no section ends in a hard colour edge. Soft
  // hairlines (SectionDivider) mark where one section ends and the next starts.
  return (
    <>
      <Navbar />
      <main className="home-ambient">
        <Hero />
        <SectionDivider />
        <ValueProps />
        <SectionDivider />
        <PerkExamples />
        <SectionDivider />
        <HowItWorks />
        <SectionDivider />
        <HomeFaqPrompt />
      </main>
      <Footer />
    </>
  )
}
