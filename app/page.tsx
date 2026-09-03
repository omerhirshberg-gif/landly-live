'use client'

import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StickyCta from '@/components/layout/StickyCta'
import Hero from '@/components/home/Hero'
import ScrollHook from '@/components/home/ScrollHook'
import AppBanner from '@/components/home/AppBanner'
import DealsSection from '@/components/home/DealsSection'
import HowItWorks from '@/components/home/HowItWorks'
import Pricing from '@/components/home/Pricing'
import Faq from '@/components/home/Faq'
import Waitlist from '@/components/home/Waitlist'
import TermsModal from '@/components/modals/TermsModal'

export default function Home() {
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

  return (
    <>
      <Navbar />
      <Hero onOpenRaffleTerms={openRaffleTerms} />
      <ScrollHook />
      <AppBanner />
      <DealsSection onOpenRaffleTerms={openRaffleTerms} />
      <HowItWorks />
      <Pricing onOpenTerms={openTerms} />
      <Faq onOpenTerms={openTerms} onOpenRaffleTerms={openRaffleTerms} />
      <Waitlist />
      <Footer onOpenTerms={openTerms} onOpenRaffleTerms={openRaffleTerms} />
      <TermsModal isOpen={termsOpen} onClose={closeTerms} scrollToRaffle={scrollToRaffle} />
      <StickyCta />
    </>
  )
}
