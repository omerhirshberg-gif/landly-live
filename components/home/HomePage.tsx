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
import SectionBoundary from '@/components/errors/SectionBoundary'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { EMPTY_SHOWCASE, pickHeroFeatures, pickTopSavings, type Showcase } from '@/lib/home/showcase'

// The home page's client side (app/page.tsx renders it with the page's
// metadata and structured data): the member dashboard, or the guest landing.
// `showcase` is the live offers app/page.tsx read on the server, for the
// guest sections that show real businesses and savings.
//
// Who is signed in is only known in the browser, after Firebase Auth answers,
// so the server render (and the client's first render, which must match it)
// carries both the member shell and the guest landing. Before the first
// paint the root layout's inline script marks <html> for a browser that had
// a member last time (lib/auth/memberHint.ts), and globals.css shows only
// the shell there; everyone else sees the landing straight from the HTML,
// with no JavaScript needed, so a script that's slow or never runs can't
// leave a guest looking at an empty page.
export default function HomePage({ showcase = EMPTY_SHOWCASE }: { showcase?: Showcase }) {
  const { user, loading } = useAuth()
  // A member who hasn't finished onboarding (say, reloading mid-wizard) is
  // sent back to it; the blank shell holds until that's known.
  const held = useOnboardingGuard()

  if (held) {
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

  // Loading or a guest: the same tree either way, so the landing a guest
  // already sees stays mounted (no restarted marquee or reveals) once Auth
  // answers; only the shell beside it and the wrapper's class go.
  return (
    <>
      <Navbar />
      {loading && <div className="member-shell below-header member-canvas" />}
      <div className={loading ? 'guest-while-loading' : undefined}>
        <GuestLanding showcase={showcase} />
      </div>
    </>
  )
}

function GuestLanding({ showcase }: { showcase: Showcase }) {
  // One CTA pair (Explore Perks → /signup, Sign In → /login) lives in the
  // hero and navbar; the sections below inform rather than repeat it. Right
  // under the hero, the partner marquee: real businesses on Landly drifting
  // by. Under What's inside, the biggest real savings (guests open any offer
  // freely, and its purchase bar is where they're asked to sign in), then
  // How it works (joining is step one), then the member pass the steps lead
  // to. Without three discounted offers the savings section and its
  // hairline are left out, so two hairlines never meet. The site's one canvas
  // (.home-ambient, the same as .member-canvas in globals.css) runs behind
  // all the sections (none sets its own background), under the translucent
  // navbar too. Soft hairlines (SectionDivider) mark where one section ends
  // and the next starts; sections below the fold rise in as they're reached (Reveal).
  // Everything under the hero sits in its own SectionBoundary: one that
  // throws drops out alone instead of taking the landing down.
  const topSavings = pickTopSavings(showcase.offers)
  return (
    <>
      <main className="home-ambient">
        <Hero features={pickHeroFeatures(showcase.offers)} />
        <SectionBoundary name="partner-marquee"><PartnerMarquee offers={showcase.offers} /></SectionBoundary>
        <SectionDivider />
        <SectionBoundary name="value-props"><Reveal><ValueProps /></Reveal></SectionBoundary>
        {topSavings.length > 0 && (
          <>
            <SectionDivider />
            <SectionBoundary name="savings-showcase"><SavingsShowcase offers={topSavings} /></SectionBoundary>
          </>
        )}
        <SectionDivider />
        <SectionBoundary name="how-it-works"><Reveal><HowItWorks /></Reveal></SectionBoundary>
        <SectionDivider />
        <SectionBoundary name="pass-showcase"><PassShowcase /></SectionBoundary>
        <SectionDivider />
        <SectionBoundary name="faq-prompt"><Reveal><HomeFaqPrompt /></Reveal></SectionBoundary>
      </main>
      <Footer />
    </>
  )
}
