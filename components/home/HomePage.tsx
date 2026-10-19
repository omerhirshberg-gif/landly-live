'use client'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import Hero from '@/components/home/Hero'
import ValueProps from '@/components/home/ValueProps'
import HowItWorks from '@/components/home/HowItWorks'
import PartnerMarquee from '@/components/home/PartnerMarquee'
import SavingsShowcase from '@/components/home/SavingsShowcase'
import PassShowcase from '@/components/home/PassShowcase'
import Reveal from '@/components/ui/Reveal'
import SectionDivider from '@/components/ui/SectionDivider'
import LoggedInHome from '@/components/home/LoggedInHome'
import HomeFaqPrompt from '@/components/home/HomeFaqPrompt'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { EMPTY_SHOWCASE, pickTopSavings, type Showcase } from '@/lib/home/showcase'

// The home page's client side (app/page.tsx renders it with the page's
// metadata and structured data): the member dashboard, or the guest landing.
// `showcase` is the live offers app/page.tsx read on the server, for the
// guest sections that show real businesses and savings.
export default function HomePage({ showcase = EMPTY_SHOWCASE }: { showcase?: Showcase }) {
  const { user, loading } = useAuth()
  // A member who hasn't finished onboarding (say, reloading mid-wizard) is
  // sent back to it; the blank shell holds until that's known.
  const held = useOnboardingGuard()

  if (loading || held) {
    return (
      <>
        <Navbar />
        <div className="below-header member-canvas" />
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
  // hero and navbar; the sections below inform rather than repeat it. Right
  // under the hero, the partner marquee: real businesses on Landly drifting
  // by. Under What's inside, the biggest real savings (guests open any offer
  // freely, and its purchase bar is where they're asked to sign in), then the
  // member pass. Without three discounted offers the savings section and its
  // hairline are left out, so two hairlines never meet. The site's one canvas
  // (.home-ambient, the same as .member-canvas in globals.css) runs behind
  // all the sections (none sets its own background), under the translucent
  // navbar too. Soft hairlines (SectionDivider) mark where one section ends
  // and the next starts; sections below the fold rise in as they're reached (Reveal).
  const topSavings = pickTopSavings(showcase.offers)
  return (
    <>
      <Navbar />
      <main className="home-ambient">
        <Hero />
        <PartnerMarquee offers={showcase.offers} />
        <SectionDivider />
        <Reveal><ValueProps /></Reveal>
        {topSavings.length > 0 && (
          <>
            <SectionDivider />
            <SavingsShowcase offers={topSavings} />
          </>
        )}
        <SectionDivider />
        <PassShowcase />
        <SectionDivider />
        <Reveal><HowItWorks /></Reveal>
        <SectionDivider />
        <Reveal><HomeFaqPrompt /></Reveal>
      </main>
      <Footer />
    </>
  )
}
