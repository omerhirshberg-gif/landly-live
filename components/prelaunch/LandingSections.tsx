'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BadgePercent, ChevronDown, Gift, HeartHandshake, Mail, Sparkles } from 'lucide-react'
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from '@/components/ui/SocialIcon'
import { SUPPORT_EMAIL } from '@/lib/config'
import { PHOTO_HEIGHT, PHOTO_WIDTH, COLLAGE_PHOTOS, GALLERY_PHOTOS, photoSrc } from '@/lib/prelaunch/images'
import { PILLARS, PRELAUNCH_COPY, type Photo, type Pillar, type PrelaunchLang } from '@/lib/prelaunch/copy'
import { countdownTo, type Countdown as CountdownValue } from '@/lib/prelaunch/launch'
import { FACEBOOK_URL, INSTAGRAM_URL, WHATSAPP_COMMUNITY_URL } from '@/lib/prelaunch/links'
import { CONSENT_PATHS } from '@/lib/legal/consentText'
import LanguageSwitcher from './LanguageSwitcher'

// The sections of /join that hold no form state. Every one takes the page's
// language as a prop and renders on the server, so each language arrives finished.

const SECTION_TITLE = 'text-center text-[1.75rem] font-black leading-tight tracking-tight [text-wrap:balance] sm:text-4xl'
const SURFACE = 'rounded-3xl border border-slate-200/80 bg-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md'
const PILLAR_ICONS: Record<Pillar, typeof Gift> = { deals: BadgePercent, free: Gift, newcomers: HeartHandshake }

export function JoinHeader({ lang }: { lang: PrelaunchLang }) {
  return (
    <header className="flex items-center justify-between">
      <img src="/logo-mark.png" alt="Landly" width={117} height={112} className="h-9 w-auto" />
      <LanguageSwitcher lang={lang} />
    </header>
  )
}

// Dashes on the server, digits in the browser: a static page can't know the time
// it's read. Screen readers get the date once, not a number changing every
// second, and the block leaves the page when the moment comes.
function Countdown({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  const [left, setLeft] = useState<CountdownValue | null | undefined>(undefined)

  useEffect(() => {
    const tick = () => setLeft(countdownTo(Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  if (left === null) return null
  const blocks = (['days', 'hours', 'minutes', 'seconds'] as const).map((unit) => ({
    unit,
    label: copy.units[unit],
    value: left ? String(left[unit]).padStart(2, '0') : '--',
  }))

  return (
    <div className="mt-7">
      <p className="text-sm font-semibold text-body">{copy.countdownLabel}</p>
      <p className="sr-only">{copy.launchDate}</p>
      <div aria-hidden="true" className="mx-auto mt-2 grid max-w-md grid-cols-4 gap-2 lg:mx-0 sm:gap-3">
        {blocks.map(({ unit, label, value }) => (
          <div key={unit} className={`${SURFACE} !rounded-2xl px-1 py-3 text-center`}>
            <bdi dir="ltr" className="block text-2xl font-black tabular-nums tracking-tight text-brand sm:text-3xl">{value}</bdi>
            <span className="mt-0.5 block text-xs font-medium text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HeroCollage({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  const [main, top, bottom] = COLLAGE_PHOTOS
  const photo = (name: Photo, eager = false) => (
    <img
      src={photoSrc(name)}
      alt={copy.photoAlts[name]}
      width={PHOTO_WIDTH}
      height={PHOTO_HEIGHT}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      className="h-full w-full rounded-3xl object-cover shadow-[0_8px_30px_rgb(0,0,0,0.08)]"
    />
  )
  return (
    <div className="relative mx-auto w-full max-w-xl pb-6 lg:max-w-none lg:pb-0">
      <div className="grid aspect-[5/4] grid-cols-5 grid-rows-2 gap-3">
        <div className="col-span-3 row-span-2 min-h-0">{photo(main, true)}</div>
        <div className="col-span-2 min-h-0">{photo(top, true)}</div>
        <div className="col-span-2 min-h-0">{photo(bottom, true)}</div>
      </div>
      <p className={`${SURFACE} absolute bottom-0 start-4 inline-flex items-center gap-2 !rounded-full px-4 py-2.5 text-sm font-bold text-ink lg:-bottom-4`}>
        <Sparkles aria-hidden="true" size={18} strokeWidth={1.75} className="flex-shrink-0 text-brand" />
        {copy.dealsBadge}
      </p>
    </div>
  )
}

export function HeroSection({ lang, onCta }: { lang: PrelaunchLang; onCta: () => void }) {
  const copy = PRELAUNCH_COPY[lang]
  const Arrow = lang === 'he' ? ArrowLeft : ArrowRight
  return (
    <section className="mt-6 grid items-center gap-8 lg:mt-10 lg:grid-cols-2 lg:gap-14">
      <div className="text-center lg:text-start">
        <h1 className="bg-gradient-to-r from-brand to-indigo-600 bg-clip-text pb-1 text-[clamp(2rem,9vw,2.75rem)] font-black leading-[1.12] tracking-tight text-transparent [text-wrap:balance] lg:text-[3.25rem]">
          {copy.heroTitle}
        </h1>
        <p className="mt-3 text-lg font-semibold text-body [text-wrap:balance]">{copy.heroSub}</p>
        <a
          href="#join-form"
          onClick={(event) => {
            event.preventDefault()
            onCta()
          }}
          className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-brand px-8 text-center text-lg font-bold text-white shadow-[0_8px_24px_rgba(0,56,184,.25)] transition-all duration-300 hover:-translate-y-1 hover:bg-brandDark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:w-auto"
        >
          {copy.heroCta}
          <Arrow aria-hidden="true" size={20} strokeWidth={1.75} />
        </a>
        <Countdown lang={lang} />
      </div>
      <HeroCollage lang={lang} />
    </section>
  )
}

// A swipeable row on a phone, with the next photo peeking in; five across from 1024px.
export function GalleryStrip({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  return (
    <section className="-mx-4 mt-14 sm:-mx-6 lg:mx-0 lg:mt-20">
      <ul className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:scroll-px-6 sm:px-6 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
        {GALLERY_PHOTOS.map((name) => (
          <li key={name} className="w-[68%] flex-none snap-start sm:w-[42%] lg:w-auto">
            <img
              src={photoSrc(name)}
              alt={copy.photoAlts[name]}
              width={PHOTO_WIDTH}
              height={PHOTO_HEIGHT}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] h-auto w-full rounded-3xl object-cover shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PillarCards({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  return (
    <section className="mt-14 lg:mt-20">
      <h2 className={SECTION_TITLE}>{copy.pillarsTitle}</h2>
      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {PILLARS.map((key) => {
          const Icon = PILLAR_ICONS[key]
          return (
            <article key={key} className={`${SURFACE} bg-gradient-to-br from-blue-50/40 to-indigo-50/20 p-6 transition-all duration-300 hover:-translate-y-1`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brandTint text-brand">
                <Icon aria-hidden="true" size={20} strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 text-lg font-extrabold tracking-tight">{copy.pillars[key].title}</h3>
              <p className="mt-1.5 leading-relaxed text-body">{copy.pillars[key].body}</p>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function HowItWorks({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  return (
    <section className="mt-14 lg:mt-20">
      <h2 className={SECTION_TITLE}>{copy.stepsTitle}</h2>
      <ol className="mt-7 grid gap-4 lg:grid-cols-3">
        {copy.steps.map((step, index) => (
          <li key={step.title} className={`${SURFACE} flex items-start gap-4 p-6 lg:block`}>
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-base font-black text-white">
              <bdi dir="ltr">{index + 1}</bdi>
            </span>
            <div className="min-w-0 lg:mt-4">
              <h3 className="text-lg font-extrabold tracking-tight">{step.title}</h3>
              <p className="mt-1 leading-relaxed text-body">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

// The accounts in words as well as marks, large enough to find and to tap. The
// footer keeps its compact icons.
export function SocialSection({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  const cards = [
    { key: 'instagram', href: INSTAGRAM_URL, label: copy.followLabels.instagram, detail: '@golandly', icon: <InstagramIcon width={28} height={28} />, badge: 'bg-rose-50' },
    { key: 'facebook', href: FACEBOOK_URL, label: copy.followLabels.facebook, detail: '@golandly', icon: <FacebookIcon width={28} height={28} />, badge: 'bg-blue-50' },
    { key: 'whatsapp', href: WHATSAPP_COMMUNITY_URL, label: copy.followLabels.whatsapp, detail: 'Landly Community', icon: <WhatsAppIcon width={28} height={28} fill="currentColor" />, badge: 'bg-[#25D366] text-ink' },
  ]
  return (
    <section className="mt-14 lg:mt-20">
      <h2 className={SECTION_TITLE}>{copy.followTitle}</h2>
      <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-relaxed text-body [text-wrap:balance]">{copy.followSub}</p>
      <ul className="mt-7 grid gap-4 lg:grid-cols-3">
        {cards.map(({ key, href, label, detail, icon, badge }) => (
          <li key={key}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${SURFACE} flex min-h-[88px] items-center gap-4 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-brand/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/30 sm:p-5`}
            >
              <span className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${badge}`}>{icon}</span>
              <span className="min-w-0">
                <span className="block text-lg font-extrabold leading-snug tracking-tight text-ink">{label}</span>
                <span className="mt-0.5 block font-medium text-body"><bdi dir="ltr">{detail}</bdi></span>
                <span className="sr-only">({copy.newTab})</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function StoryBento({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  return (
    <section className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-5">
      <article className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1B3D] via-[#10295e] to-[#0038B8] p-7 text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:p-9 lg:col-span-3">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{copy.storyTitle}</h2>
        <p className="mt-3 text-lg leading-relaxed text-blue-50 [text-wrap:pretty]">{copy.storyBody}</p>
      </article>
      <article className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-100/60 p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-9 lg:col-span-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">{copy.foundingTitle}</h2>
        <p className="mt-1 text-6xl font-black tracking-tight text-amber-800 sm:text-7xl">
          <bdi dir="ltr">{copy.foundingNumber}</bdi>
        </p>
        <p className="mt-3 leading-relaxed text-amber-950 [text-wrap:pretty]">{copy.foundingBody}</p>
      </article>
    </section>
  )
}

export function FaqSection({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  return (
    <section className="mx-auto mt-14 w-full max-w-3xl lg:mt-20">
      <h2 className={SECTION_TITLE}>{copy.faqTitle}</h2>
      <div className="mt-7 space-y-3">
        {copy.faq.map(({ q, a }) => (
          <details key={q} className={`${SURFACE} group !rounded-2xl`}>
            <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 font-bold focus:outline-none focus-visible:ring-4 focus-visible:ring-brand/20 [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown aria-hidden="true" size={20} strokeWidth={1.75} className="flex-shrink-0 text-slate-500 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <p className="px-5 pb-5 leading-relaxed text-body [overflow-wrap:anywhere]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export function JoinFooter({ lang }: { lang: PrelaunchLang }) {
  const copy = PRELAUNCH_COPY[lang]
  const legalLink = 'inline-flex min-h-[44px] items-center whitespace-nowrap px-2 font-medium underline underline-offset-2 transition-colors hover:text-brand'
  const iconLink = 'flex h-11 w-11 items-center justify-center rounded-full text-slate-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/20'
  return (
    <footer className="mt-14 flex flex-col items-center gap-2 border-t border-slate-200/80 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-6 text-sm text-slate-500 lg:mt-20 lg:flex-row lg:justify-between lg:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
      <p>
        <bdi dir="ltr">© 2026 Landly.</bdi> {copy.rights}
      </p>
      <nav className="flex flex-wrap items-center justify-center">
        <a href={CONSENT_PATHS.terms} target="_blank" rel="noopener noreferrer" className={legalLink}>{copy.terms}</a>
        <a href={CONSENT_PATHS.privacy} target="_blank" rel="noopener noreferrer" className={legalLink}>{copy.privacy}</a>
      </nav>
      <div className="flex items-center gap-1">
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={iconLink}><InstagramIcon width={22} height={22} /></a>
        <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={iconLink}><FacebookIcon width={22} height={22} /></a>
        <a href={WHATSAPP_COMMUNITY_URL} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={iconLink}><WhatsAppIcon width={22} height={22} fill="currentColor" /></a>
        <a href={`mailto:${SUPPORT_EMAIL}`} aria-label={copy.contactLabel} className={iconLink}><Mail aria-hidden="true" size={22} strokeWidth={1.75} /></a>
      </div>
    </footer>
  )
}
