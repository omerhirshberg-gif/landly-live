'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { consentParts, CONSENT_PATHS } from '@/lib/legal/consentText'
import { PILLARS, PRELAUNCH_COPY, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { forgetJoinedLead, readJoinedLead, rememberJoinedLead, type JoinedLead } from '@/lib/prelaunch/share'
import { readArrival, type ArrivalTelemetry } from '@/lib/prelaunch/telemetry'
import { FaqSection, GalleryStrip, HeroSection, HowItWorks, JoinFooter, JoinHeader, PillarCards, SocialSection, StoryBento } from './LandingSections'
import LeadForm, { type CountryLabels } from './LeadForm'
import SuccessScreen from './SuccessScreen'

const storage = () => window.localStorage

// The /join launch page: nine sections with one action, saving a spot. The
// server sends each language's finished page, so nothing waits on LangProvider,
// whose first render is always English. `dir` and `lang` sit on this wrapper too,
// so the layout holds whatever language a visitor has saved for the rest of the
// site, and so does the font: the global Hebrew rule keys on <html lang>.
//
// Signing up replaces the form in place with the success screen, whose first
// action is the WhatsApp community.
export default function PrelaunchPage({ lang, countryLabels }: { lang: PrelaunchLang; countryLabels?: CountryLabels }) {
  const copy = PRELAUNCH_COPY[lang]
  const isRtl = lang === 'he'
  const [arrival, setArrival] = useState<ArrivalTelemetry | null>(null)
  const [joined, setJoined] = useState<JoinedLead | null>(null)

  // Once, on arrival: the page stays static, and first touch is what counts.
  useEffect(() => {
    setArrival(readArrival(window.location.search, document.referrer, new Date()))
    setJoined(readJoinedLead(storage))
  }, [])

  const finish = (lead: JoinedLead) => {
    rememberJoinedLead(storage, lead)
    setJoined(lead)
  }

  const startOver = () => {
    forgetJoinedLead(storage)
    setJoined(null)
  }

  const goToForm = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById('join-form')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    document.getElementById('join-first-name')?.focus({ preventScroll: true })
  }

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={lang}
      className={`relative isolate min-h-[var(--app-dvh)] overflow-x-clip bg-[#F8FAFC] px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] text-ink sm:px-6 lg:px-8 ${isRtl ? "[font-family:'Heebo',sans-serif]" : '[font-family:var(--font-sans),sans-serif]'}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[56rem] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(0,56,184,.13),transparent_72%)]" />

      <div className="mx-auto w-full max-w-6xl">
        <JoinHeader lang={lang} />
        <HeroSection lang={lang} onCta={goToForm} />
        <GalleryStrip lang={lang} />
        <SocialSection lang={lang} />
        <PillarCards lang={lang} />
        <HowItWorks lang={lang} />

        <section id="join-form" className="mt-14 scroll-mt-4 rounded-3xl border border-slate-200/80 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-8 lg:mt-20 lg:p-12">
          {joined ? (
            <div key="success" className="prelaunch-in">
              <SuccessScreen lang={lang} lead={joined} onStartOver={startOver} />
            </div>
          ) : (
            <div key="form" className="grid items-start gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="px-1 pt-2 text-center lg:self-center lg:px-0 lg:text-start">
                <h2 className="text-[1.75rem] font-black leading-tight tracking-tight sm:text-4xl">{copy.signupTitle}</h2>
                <p className="mt-2 text-lg leading-relaxed text-body [text-wrap:pretty]">{copy.signupSub}</p>
                <ul className="mt-6 hidden space-y-3 lg:block">
                  {PILLARS.map((key) => (
                    <li key={key} className="flex items-center gap-3 font-semibold">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white text-brand shadow-sm">
                        <Check aria-hidden="true" size={16} strokeWidth={1.75} />
                      </span>
                      {copy.pillars[key].title}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <LeadForm lang={lang} arrival={arrival} countryLabels={countryLabels} onJoined={finish} />
                <p className="mt-3 text-center text-xs leading-relaxed text-slate-500">
                  {consentParts(copy.legal).map((part, i) =>
                    'link' in part ? (
                      <a
                        key={i}
                        href={CONSENT_PATHS[part.link]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium underline underline-offset-2 transition-colors hover:text-brand"
                      >
                        {part.link === 'terms' ? copy.terms : copy.privacy}
                      </a>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
              </div>
            </div>
          )}
        </section>

        <StoryBento lang={lang} />
        <FaqSection lang={lang} />
        <JoinFooter lang={lang} />
      </div>
    </main>
  )
}
