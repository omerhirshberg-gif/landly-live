'use client'

import { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StickyCta from '@/components/layout/StickyCta'
import Hero from '@/components/home/Hero'
import AppBanner from '@/components/home/AppBanner'
import DealsSection from '@/components/home/DealsSection'
import HowItWorks from '@/components/home/HowItWorks'
import BottomCta from '@/components/home/BottomCta'
import Waitlist from '@/components/home/Waitlist'
import LoggedInHome from '@/components/home/LoggedInHome'
import HomeFaqPrompt from '@/components/home/HomeFaqPrompt'
import TermsModal from '@/components/modals/TermsModal'
import { useAuth } from '@/lib/firebase/useAuth'

export default function Home() {
  const { user, loading } = useAuth()
  const [termsOpen, setTermsOpen] = useState(false)

  const openTerms = () => setTermsOpen(true)
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
        <HowItWorks variant="member" />
        <HomeFaqPrompt />
        <Footer onOpenTerms={openTerms} />
        <TermsModal isOpen={termsOpen} onClose={closeTerms} />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <Hero />
      <AppBanner />
      <DealsSection />
      <HowItWorks />
      <BottomCta />
      <HomeFaqPrompt />
      <Waitlist />
      <Footer onOpenTerms={openTerms} />
      <TermsModal isOpen={termsOpen} onClose={closeTerms} />
      <StickyCta />
    </>
  )
}
