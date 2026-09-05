'use client'

import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StickyCta from '@/components/layout/StickyCta'
import Hero from '@/components/home/Hero'
import AppBanner from '@/components/home/AppBanner'
import DealsSection from '@/components/home/DealsSection'
import HowItWorks from '@/components/home/HowItWorks'
import Pricing from '@/components/home/Pricing'
import BottomCta from '@/components/home/BottomCta'
import Faq from '@/components/home/Faq'
import Waitlist from '@/components/home/Waitlist'
import LoggedInHome from '@/components/home/LoggedInHome'
import TermsModal from '@/components/modals/TermsModal'
import { useAuth } from '@/lib/firebase/useAuth'

export default function Home() {
  const { user, loading } = useAuth()
  const [termsOpen, setTermsOpen] = useState(false)
  const [scrollToRaffle, setScrollToRaffle] = useState(false)

  const openTerms = () => {
    setScrollToRaffle(false)
    setTermsOpen(true)
  }
  const openRaffleTerms = () => {
    setScrollToRaffle(true)
    setTermsOpen(true)
  }
  const closeTerms = () => setTermsOpen(false)

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pt-16 min-h-screen bg-slate-50" />
      </>
    )
  }

  if (user) {
    return (
      <>
        <Navbar />
        <LoggedInHome user={user} />
        <HowItWorks />
        <Pricing onOpenTerms={openTerms} user={user} />
        <Faq onOpenTerms={openTerms} onOpenRaffleTerms={openRaffleTerms} />
        <Footer onOpenTerms={openTerms} onOpenRaffleTerms={openRaffleTerms} />
        <TermsModal isOpen={termsOpen} onClose={closeTerms} scrollToRaffle={scrollToRaffle} />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <Hero onOpenRaffleTerms={openRaffleTerms} />
      <AppBanner />
      <DealsSection onOpenRaffleTerms={openRaffleTerms} />
      <HowItWorks />
      <Pricing onOpenTerms={openTerms} />
      <BottomCta />
      <Faq onOpenTerms={openTerms} onOpenRaffleTerms={openRaffleTerms} />
      <Waitlist />
      <Footer onOpenTerms={openTerms} onOpenRaffleTerms={openRaffleTerms} />
      <TermsModal isOpen={termsOpen} onClose={closeTerms} scrollToRaffle={scrollToRaffle} />
      <StickyCta />
    </>
  )
}
