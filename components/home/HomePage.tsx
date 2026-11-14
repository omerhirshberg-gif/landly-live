'use client'

import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AudienceCards from '@/components/landing/AudienceCards'
import BottomCta from '@/components/landing/BottomCta'
import LandingHero from '@/components/landing/LandingHero'
import LiveDeals from '@/components/landing/LiveDeals'
import { LANDING_COLUMN } from '@/components/landing/landingColumn'
import CategoryPhotoRail, { CategoryPhotoTitle } from '@/components/home/CategoryPhotoRail'
import Faq from '@/components/home/Faq'
import HowItWorks from '@/components/home/HowItWorks'
import PassShowcase from '@/components/home/PassShowcase'
import Reveal from '@/components/ui/Reveal'
import SectionDivider from '@/components/ui/SectionDivider'
import LoggedInHome from '@/components/home/LoggedInHome'
import SectionBoundary from '@/components/errors/SectionBoundary'
import { useAuth } from '@/lib/firebase/useAuth'
import { useOnboardingGuard } from '@/components/auth/useOnboardingGuard'
import { EMPTY_LANDING, type LandingData } from '@/lib/home/landingData'

// The home page's client side (app/page.tsx renders it with the page's
// metadata and structured data): the member dashboard, or the guest landing.
// `landing` is the live offers app/page.tsx read on the server, cut into the
// guest sections (lib/home/landingData.ts).
//
// Who is signed in is only known in the browser, after Firebase Auth answers,
// so the server render (and the client's first render, which must match it)
// carries both the member shell and the guest landing. Before the first
// paint the root layout's inline script marks <html> for a browser that had
// a member last time (lib/auth/memberHint.ts), and globals.css shows only
// the shell there; everyone else sees the landing straight from the HTML,
// with no JavaScript needed, so a script that's slow or never runs can't
// leave a guest looking at an empty page.
export default function HomePage({ landing = EMPTY_LANDING }: { landing?: LandingData }) {
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
            props, How it works or marketing footer. Support
            sits at the end of the dashboard; Terms and Privacy are in the
            account menu and the mobile drawer. */}
        <LoggedInHome user={user} />
      </>
    )
  }

  // Loading or a guest: the same tree either way, so the landing a guest
  // already sees stays mounted (no restarted reveals) once Auth
  // answers; only the shell beside it and the wrapper's class go.
  return (
    <>
      <Navbar />
      {loading && <div className="member-shell below-header member-canvas" />}
      <div className={loading ? 'guest-while-loading' : undefined}>
        <GuestLanding landing={landing} />
      </div>
    </>
  )
}

function GuestLanding({ landing }: { landing: LandingData }) {
  // The hero, the category photos, then real deals and who GoLandly is for, which
  // their own card surfaces keep apart; hairlines only mark the longer sections
  // after them: How it works, the member pass those steps lead to, both stores
  // once more, and the questions everyone asks. A section with nothing live to show is left out. The site's one
  // canvas (.home-ambient, the same as .member-canvas in globals.css) runs
  // behind the sections, under the translucent navbar too. Everything under
  // the hero sits in its own SectionBoundary: one that throws drops out alone
  // instead of taking the landing down. PassShowcase is never wrapped in
  // Reveal: it plays its own entrance (tests/unit/passAnimationIntegrity.test.ts).
  return (
    <>
      <main className="home-ambient">
        <LandingHero />
        <SectionBoundary name="category-photos">
          <section aria-labelledby="landing-categories-title" className="py-6 sm:py-8">
            <div className={`mb-4 ${LANDING_COLUMN}`}>
              <CategoryPhotoTitle id="landing-categories-title" className="text-2xl font-black tracking-tight text-ink sm:text-3xl" />
            </div>
            <CategoryPhotoRail contained />
          </section>
        </SectionBoundary>
        {landing.deals.length > 0 && (
          <SectionBoundary name="live-deals"><LiveDeals deals={landing.deals} /></SectionBoundary>
        )}
        <SectionBoundary name="audience-cards"><Reveal><AudienceCards /></Reveal></SectionBoundary>
        <SectionDivider />
        <SectionBoundary name="how-it-works"><Reveal><HowItWorks /></Reveal></SectionBoundary>
        <SectionDivider />
        <SectionBoundary name="pass-showcase"><PassShowcase /></SectionBoundary>
        <SectionDivider />
        <SectionBoundary name="bottom-cta"><Reveal><BottomCta /></Reveal></SectionBoundary>
        <SectionBoundary name="faq"><Reveal><Faq /></Reveal></SectionBoundary>
      </main>
      <Footer />
    </>
  )
}
