'use client'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/home/Hero'
import ValueProps from '@/components/home/ValueProps'
import HowItWorks from '@/components/home/HowItWorks'
import LoggedInHome from '@/components/home/LoggedInHome'
import HomeFaqPrompt from '@/components/home/HomeFaqPrompt'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'

export default function Home() {
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
  // hero and navbar; the sections below inform rather than repeat it.
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ValueProps />
        <HowItWorks />
        <HomeFaqPrompt />
      </main>
      <Footer />
    </>
  )
}
