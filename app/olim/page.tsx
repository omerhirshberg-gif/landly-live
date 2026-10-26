'use client'

import Link from 'next/link'
import { ArrowRight, Baby, BookOpen, CarFront, Check, CircleCheck, Clock, Gift, HandHeart, IdCard, Languages, Layers, Scale, ShieldCheck, Sofa, Stethoscope, Ticket, UserPlus, type LucideIcon } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import MentorRequestCard from '@/components/olim/MentorRequestCard'
import SegmentCards from '@/components/olim/SegmentCards'
import CountUp from '@/components/ui/CountUp'
import IconFrame from '@/components/ui/IconFrame'
import Reveal from '@/components/ui/Reveal'
import SectionDivider from '@/components/ui/SectionDivider'
import SnapDots from '@/components/ui/SnapDots'
import { MENTOR_SECTION_ID } from '@/components/olim/mentorSection'
import { CATEGORY_TILES } from '@/lib/categories'
import { useAuth } from '@/lib/firebase/useAuth'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useLang } from '@/lib/i18n/useLang'
import { LANGUAGES } from '@/lib/i18n/languages'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useSnapIndex } from '@/lib/useSnapIndex'

type Step = { icon: LucideIcon; titleKey: TranslationKey; descKey: TranslationKey; link?: { href: string; labelKey: TranslationKey }; done?: boolean }

// Guests: how joining works.
const GUEST_STEPS: Step[] = [
  { icon: UserPlus, titleKey: 'olim_step1_title', descKey: 'olim_step1_desc' },
  { icon: IdCard, titleKey: 'olim_step2_title', descKey: 'olim_step2_desc' },
  { icon: Gift, titleKey: 'olim_step3_title', descKey: 'olim_step3_desc' },
]

// Members: already in, so the first step is done and the other two are actions.
const MEMBER_STEPS: Step[] = [
  { icon: CircleCheck, titleKey: 'olim_mstep1_title', descKey: 'olim_mstep1_desc', link: { href: '/profile', labelKey: 'olim_mstep1_link' }, done: true },
  { icon: Gift, titleKey: 'olim_mstep2_title', descKey: 'olim_mstep2_desc', link: { href: '/categories', labelKey: 'olim_mstep2_link' } },
  { icon: HandHeart, titleKey: 'olim_mstep3_title', descKey: 'olim_mstep3_desc', link: { href: `#${MENTOR_SECTION_ID}`, labelKey: 'olim_mstep3_link' } },
]

// The four benefits. Lone Soldiers keeps its own anchor (/olim#lone-soldiers)
// on its card.
const BENEFITS: { icon: LucideIcon; titleKey: TranslationKey; descKey: TranslationKey; id?: string }[] = [
  { icon: Ticket, titleKey: 'olim_card_title', descKey: 'olim_card_desc' },
  { icon: Scale, titleKey: 'olim_rights_title', descKey: 'olim_rights_desc' },
  { icon: HandHeart, titleKey: 'olim_mentor_title', descKey: 'olim_mentor_desc' },
  { icon: ShieldCheck, titleKey: 'olim_lone_title', descKey: 'olim_lone_desc', id: 'lone-soldiers' },
]

// The categories new arrivals ask about first, each with its vector icon
// (the same as the category's tile, components/ui/CategoryIcon.tsx, where there is one).
const OLIM_CATEGORIES: { icon: LucideIcon; labelKey: TranslationKey }[] = [
  { icon: Baby, labelKey: 'cats_kids' },
  { icon: Sofa, labelKey: 'cats_home' },
  { icon: ShieldCheck, labelKey: 'cats_insurance' },
  { icon: Stethoscope, labelKey: 'olim_cat_health' },
  { icon: BookOpen, labelKey: 'olim_cat_ulpan' },
  { icon: CarFront, labelKey: 'cats_cars' },
]

// The design-system buttons: on the canvas in the hero, in their on-dark
// variants (globals.css .ds-btn-inverse) on the closing brand card.
const CTA_PRIMARY = 'ds-btn ds-btn-primary ds-btn-wrap shadow-[0_8px_24px_-8px_rgba(0,56,184,.45)]'
const CTA_SECONDARY = 'ds-btn ds-btn-secondary ds-btn-wrap'

// /olim: a showcase page for everyone making their life in Israel (new
// immigrants, lone soldiers, students, travellers), not only olim. An
// editorial hero on the site canvas (the headline first, no pill above it),
// How It Works, the four benefits (Lone Soldiers the fourth) as one swipe row
// on phones and tablets and a four-column grid from 1024px, the categories
// newcomers need first, who Landly is for (SegmentCards), a row of key
// numbers that count up as they're reached, and the mentor request, the
// page's one closing call to action (its sign-up gate for guests).
// Soft hairlines (SectionDivider) mark where each section ends and the next
// starts, as on the home page. Every number is a fact about the product (free, its five languages, the
// 48-hour mentor promise, the category count), never a made-up audience size.
//
// It follows auth. Guests get the join pitch, the free promise and the
// sign-up steps; members get a welcome back, their active-membership status,
// steps that lead to perks and a mentor, and the mentor form. The guest copy
// is what's prerendered (and indexed) and what shows while auth loads; the
// member copy fades in once the session is known. Hebrew mirrors it through
// the page's dir.
export default function OlimPage() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const member = !loading && !!user
  const { loaded: profileLoaded, firstName, profile } = useMemberProfile(member ? user : null)
  const steps = member ? MEMBER_STEPS : GUEST_STEPS
  // Member-only text fades in, so the switch from the prerendered guest copy reads as intended.
  const memberFade = member ? 'greet-in' : ''

  // ₪0 stays put (counting up to nothing says nothing); the rest count up.
  const STATS: { icon: LucideIcon; value: number | null; text?: string; labelKey: TranslationKey }[] = [
    { icon: HandHeart, value: null, text: '₪0', labelKey: 'olim_stat_free' },
    { icon: Languages, value: LANGUAGES.length, labelKey: 'olim_stat_languages' },
    { icon: Clock, value: 48, labelKey: 'olim_stat_mentor' },
    { icon: Layers, value: CATEGORY_TILES.length, labelKey: 'olim_stat_categories' },
  ]

  const { ref: benefitsRef, index: activeBenefit, scrollTo: showBenefit } = useSnapIndex<HTMLUListElement>(BENEFITS.length)

  // Held empty while auth loads, so neither set of buttons flashes.
  const ctas = (
    <div className="flex min-h-[52px] flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
      {loading ? null : user ? (
        <>
          <Link href="/categories" className={CTA_PRIMARY}>
            {t('olim_cta_explore')}
            <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2.25} />
          </Link>
          <a href={`#${MENTOR_SECTION_ID}`} className={CTA_SECONDARY}>{t('olim_cta_mentor')}</a>
        </>
      ) : (
        <>
          <Link href="/signup" className={CTA_PRIMARY}>
            {t('olim_cta_join')}
            <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={2.25} />
          </Link>
          <Link href="/login" className={CTA_SECONDARY}>{t('nav_login')}</Link>
        </>
      )}
    </div>
  )

  return (
    <>
      <Navbar />
      <main className="below-header member-canvas overflow-x-hidden">
        {/* Hero */}
        <section aria-labelledby="olim-title" className="relative">
          <div className="max-w-4xl mx-auto px-5 sm:px-6 pt-10 pb-10 sm:pt-14 sm:pb-12 text-center">
            {/* A member's welcome waits for the profile, so a fallback name never flashes first. */}
            <h1
              id="olim-title"
              className={`text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.1] text-ink text-balance break-words ${member ? (profileLoaded ? 'greet-in' : 'invisible') : ''}`}
            >
              {member
                ? firstName ? t('olim_member_welcome').replace('{name}', firstName) : t('olim_member_welcome_generic')
                : t('olim_title')}
            </h1>
            {/* A short brand rule under the headline: the hero's one accent. */}
            <span aria-hidden="true" className="mx-auto mt-5 block h-1 w-14 rounded-full bg-brand" />
            <p className={`mt-5 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-body ${memberFade}`}>{t(member ? 'olim_member_sub' : 'olim_sub')}</p>
            <div className="mt-8">{ctas}</div>
          </div>
        </section>

        <SectionDivider />

        {/* How It Works */}
        <section aria-labelledby="olim-how-title" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="text-center mb-8 sm:mb-10">
            <h2 id="olim-how-title" className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{t('olim_how_title')}</h2>
            <p className={`mt-3 text-copy sm:text-base text-body ${memberFade}`}>{t(member ? 'olim_member_how_sub' : 'olim_how_sub')}</p>
          </div>
          {/* Guests: the free promise, a frosted-glass chip before the steps
              (its emerald beacon pings only when motion is welcome). Members:
              their active status. */}
          {member ? (
            <div role="status" className="greet-in mx-auto mb-8 sm:mb-10 flex max-w-2xl items-center gap-3 sm:gap-4 rounded-2xl border border-brand/15 bg-brandTint px-4 py-4 sm:px-6">
              <IconFrame icon={ShieldCheck} tone="white" />
              <p className="min-w-0 text-start">
                <strong className="block text-base sm:text-lg font-black text-ink">{t('olim_member_badge')}</strong>
                <span className="text-sm sm:text-copy text-body">{t('olim_member_status_note')}</span>
              </p>
            </div>
          ) : (
            <div className="mb-8 sm:mb-10 text-center">
              <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200/70 bg-white/80 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rtl:tracking-normal text-slate-700 shadow-[0_2px_8px_rgba(0,56,184,0.06)] backdrop-blur-md">
                <span aria-hidden="true" className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>{t('olim_free_badge')}</span>
              </p>
            </div>
          )}
          <Reveal>
          <ol className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.titleKey} className={`relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-8px_rgba(15,23,42,.08)] ${memberFade}`}>
                <div className="flex items-center justify-between gap-3">
                  <IconFrame icon={step.icon} tone={step.done ? 'success' : 'brand'} />
                  {step.done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                      <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2.5} />
                      {t('olim_step_done')}
                    </span>
                  ) : (
                    <span className="text-4xl font-black text-slate-100 tabular-nums" aria-hidden="true">{i + 1}</span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{t(step.titleKey)}</h3>
                <p className="mt-1.5 text-copy leading-relaxed text-body">{t(step.descKey)}</p>
                {step.link && (
                  <Link href={step.link.href} className="tap-target mt-auto inline-flex items-center gap-1.5 self-start pt-3 text-sm font-semibold text-brand [@media(hover:hover)]:hover:underline">
                    {t(step.link.labelKey)}
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 rtl:-scale-x-100" strokeWidth={2.25} />
                  </Link>
                )}
              </li>
            ))}
          </ol>
          </Reveal>
        </section>

        <SectionDivider />

        {/* Benefits */}
        <section aria-labelledby="olim-benefits-title">
          <Reveal className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 id="olim-benefits-title" className="text-center text-xl sm:text-2xl font-bold tracking-tight text-ink mb-4 sm:mb-6 lg:mb-8">{t('olim_benefits_title')}</h2>
            {/* Below 1024px one swipe row, as on the home page (ValueProps): the
                next card peeks in, a swipe settles on a card's centre, the page
                never drags sideways, and dots under it follow the card in view
                (useSnapIndex), mirroring with the row in Hebrew. From 1024px a
                four-column grid. The py keeps the cards' shadow and hover lift
                clear of the row's clipping. */}
            <ul ref={benefitsRef} className="-mx-4 px-4 scroll-px-4 flex gap-4 overflow-x-auto overscroll-x-contain py-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 sm:scroll-px-6 lg:mx-0 lg:px-0 lg:py-0 lg:grid lg:grid-cols-4 lg:gap-6 lg:overflow-visible">
              {BENEFITS.map((b) => (
                <li key={b.titleKey} id={b.id} className="flex w-[260px] flex-shrink-0 snap-center scroll-mt-24 sm:w-[270px] lg:w-auto">
                  <article aria-labelledby={`${b.titleKey}-title`} className="flex w-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition duration-200 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-brand/25 [@media(hover:hover)]:hover:shadow-card-hover motion-reduce:transform-none">
                    <IconFrame icon={b.icon} size="sm" />
                    <h3 id={`${b.titleKey}-title`} className="mt-4 text-title font-bold text-ink text-balance">{t(b.titleKey)}</h3>
                    <p className="mt-1.5 text-meta leading-relaxed text-body">{t(b.descKey)}</p>
                  </article>
                </li>
              ))}
            </ul>
            <SnapDots count={BENEFITS.length} active={activeBenefit} onSelect={showBenefit} className="lg:hidden" />

            <SectionDivider className="my-10 sm:my-12" />
            <div>
              <h3 className="text-center text-lg sm:text-xl font-bold text-ink mb-5">{t('olim_categories_title')}</h3>
              <ul className="flex flex-wrap justify-center gap-2.5">
                {OLIM_CATEGORIES.map((c) => (
                  <li key={c.labelKey} className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full border border-slate-200 bg-white ps-1.5 pe-4 py-1.5 text-sm font-semibold tracking-tight text-ink shadow-sm">
                    <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-sky-200/60 bg-brandTint text-brand">
                      <c.icon aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    {t(c.labelKey)}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        <SectionDivider />

        <SegmentCards member={member} joinable={!loading && !user} currentType={profile?.customerType ?? null} />

        <SectionDivider />

        {/* Key numbers */}
        <section aria-labelledby="olim-numbers-title" className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <h2 id="olim-numbers-title" className="text-center text-xl sm:text-2xl font-bold tracking-tight text-ink mb-6 sm:mb-8">{t('olim_numbers_title')}</h2>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {STATS.map((s, i) => (
              // The Reveal box is the stat's own group (a <dl> allows one div level).
              <Reveal key={s.labelKey} delay={i * 60} className="flex h-full flex-col items-center rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 text-center shadow-card">
                <dt className="order-2 mt-2 text-sm leading-snug text-body">{t(s.labelKey)}</dt>
                <dd className="order-1 flex flex-col items-center">
                  <IconFrame icon={s.icon} size="sm" className="mb-3" />
                  <bdi className="font-display text-4xl sm:text-5xl font-extrabold text-brand tabular-nums" style={{ letterSpacing: '-0.03em' }}>
                    {s.value === null ? s.text : <CountUp value={s.value} />}
                  </bdi>
                </dd>
              </Reveal>
            ))}
          </dl>
        </section>

        <SectionDivider />

        {/* The mentor request (members) or its sign-up gate (guests). id="mentor"
            keeps older /olim#mentor links landing here; the card itself is #mentor-section. */}
        {/* The last block on the page, so it clears the home indicator. */}
        <div id="mentor" className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-[calc(4rem+env(safe-area-inset-bottom))] scroll-mt-[calc(var(--header-offset)+16px)]">
          <MentorRequestCard />
        </div>
      </main>
    </>
  )
}
