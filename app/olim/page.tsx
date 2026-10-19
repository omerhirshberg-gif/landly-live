'use client'

import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import MentorRequestCard from '@/components/olim/MentorRequestCard'
import { MENTOR_SECTION_ID } from '@/components/olim/mentorSection'
import { CATEGORY_TILES } from '@/lib/categories'
import { useAuth } from '@/lib/firebase/useAuth'
import { useMemberProfile } from '@/lib/firebase/useMemberProfile'
import { useLang } from '@/lib/i18n/useLang'
import { LANGUAGES } from '@/lib/i18n/languages'
import type { TranslationKey } from '@/lib/i18n/translations'

type Step = { icon: string; titleKey: TranslationKey; descKey: TranslationKey; link?: { href: string; labelKey: TranslationKey }; done?: boolean }

// Guests: how joining works.
const GUEST_STEPS: Step[] = [
  { icon: 'fa-user-plus', titleKey: 'olim_step1_title', descKey: 'olim_step1_desc' },
  { icon: 'fa-id-card', titleKey: 'olim_step2_title', descKey: 'olim_step2_desc' },
  { icon: 'fa-gift', titleKey: 'olim_step3_title', descKey: 'olim_step3_desc' },
]

// Members: already in, so the first step is done and the other two are actions.
const MEMBER_STEPS: Step[] = [
  { icon: 'fa-circle-check', titleKey: 'olim_mstep1_title', descKey: 'olim_mstep1_desc', link: { href: '/profile', labelKey: 'olim_mstep1_link' }, done: true },
  { icon: 'fa-gift', titleKey: 'olim_mstep2_title', descKey: 'olim_mstep2_desc', link: { href: '/categories', labelKey: 'olim_mstep2_link' } },
  { icon: 'fa-handshake-angle', titleKey: 'olim_mstep3_title', descKey: 'olim_mstep3_desc', link: { href: `#${MENTOR_SECTION_ID}`, labelKey: 'olim_mstep3_link' } },
]

const BENEFITS: { icon: string; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: 'fa-ticket', titleKey: 'olim_card_title', descKey: 'olim_card_desc' },
  { icon: 'fa-scale-balanced', titleKey: 'olim_rights_title', descKey: 'olim_rights_desc' },
  { icon: 'fa-handshake-angle', titleKey: 'olim_mentor_title', descKey: 'olim_mentor_desc' },
]

// The categories new arrivals ask about first.
const OLIM_CATEGORIES: { emoji: string; labelKey: TranslationKey }[] = [
  { emoji: '👶', labelKey: 'cats_kids' },
  { emoji: '🏠', labelKey: 'cats_home' },
  { emoji: '📊', labelKey: 'cats_insurance' },
  { emoji: '🏥', labelKey: 'olim_cat_health' },
  { emoji: '📚', labelKey: 'olim_cat_ulpan' },
  { emoji: '🚗', labelKey: 'cats_cars' },
]

// The design-system buttons in their on-dark variants (globals.css .ds-btn-inverse).
const ctaPrimary = 'ds-btn ds-btn-inverse ds-btn-wrap shadow-[0_8px_24px_rgba(0,0,0,.18)]'
const ctaSecondary = 'ds-btn ds-btn-outline-inverse ds-btn-wrap'

// /olim: a showcase page for everyone making their life in Israel (new
// immigrants, lone soldiers, students, travellers), not only olim. A
// high-contrast hero, How It Works, the benefits as raised cards (Lone
// Soldiers among them), the categories newcomers need first, a row of key
// numbers, the mentor request, then a closing call to action. Every number is
// a fact about the product (free, its five languages, the 48-hour mentor
// promise, the category count), never a made-up audience size.
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
  const { loaded: profileLoaded, firstName } = useMemberProfile(member ? user : null)
  const steps = member ? MEMBER_STEPS : GUEST_STEPS
  // Member-only text fades in, so the switch from the prerendered guest copy reads as intended.
  const memberFade = member ? 'greet-in' : ''

  const STATS: { value: string; labelKey: TranslationKey }[] = [
    { value: '₪0', labelKey: 'olim_stat_free' },
    { value: String(LANGUAGES.length), labelKey: 'olim_stat_languages' },
    { value: '48', labelKey: 'olim_stat_mentor' },
    { value: String(CATEGORY_TILES.length), labelKey: 'olim_stat_categories' },
  ]

  // Held empty while auth loads, so neither set of buttons flashes.
  const ctas = (
    <div className="flex min-h-[52px] flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
      {loading ? null : user ? (
        <>
          <Link href="/categories" className={ctaPrimary}>
            {t('olim_cta_explore')}
            <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
          </Link>
          <a href={`#${MENTOR_SECTION_ID}`} className={ctaSecondary}>{t('olim_cta_mentor')}</a>
        </>
      ) : (
        <>
          <Link href="/signup" className={ctaPrimary}>
            {t('olim_cta_join')}
            <i className="fa-solid fa-arrow-right text-xs rtl:-scale-x-100" aria-hidden="true"></i>
          </Link>
          <Link href="/login" className={ctaSecondary}>{t('nav_login')}</Link>
        </>
      )}
    </div>
  )

  return (
    <>
      <Navbar />
      <main className="below-header member-canvas overflow-x-hidden">
        {/* Hero */}
        <section aria-labelledby="olim-title" className="relative overflow-hidden bg-[linear-gradient(135deg,#0B1B3D_0%,#002A8A_45%,#0038B8_100%)] text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -top-32 -end-24 h-80 w-80 rounded-full bg-brandGradientStart/40 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -start-24 h-80 w-80 rounded-full bg-brandLight/20 blur-3xl" />
          <div className="relative max-w-4xl mx-auto px-5 sm:px-6 pt-12 pb-14 sm:pt-20 sm:pb-20 text-center">
            <span className={`inline-flex max-w-full items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-balance backdrop-blur-sm ${memberFade}`}>
              <i className={`fa-solid ${member ? 'fa-circle-check' : 'fa-people-group'} flex-shrink-0 text-[11px]`} aria-hidden="true"></i>
              {t(member ? 'olim_member_badge' : 'olim_hero_badge')}
            </span>
            {/* A member's welcome waits for the profile, so a fallback name never flashes first. */}
            <h1
              id="olim-title"
              className={`mt-5 text-[34px] leading-[1.1] sm:text-5xl lg:text-[56px] font-black text-balance break-words ${member ? (profileLoaded ? 'greet-in' : 'invisible') : ''}`}
              style={{ letterSpacing: '-0.03em' }}
            >
              {member
                ? firstName ? t('olim_member_welcome').replace('{name}', firstName) : t('olim_member_welcome_generic')
                : t('olim_title')}
            </h1>
            <p className={`mt-5 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-white/80 ${memberFade}`}>{t(member ? 'olim_member_sub' : 'olim_sub')}</p>
            <div className="mt-8">{ctas}</div>
          </div>
        </section>

        {/* How It Works */}
        <section aria-labelledby="olim-how-title" className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="text-center mb-8 sm:mb-10">
            <h2 id="olim-how-title" className="text-2xl sm:text-4xl font-black text-ink" style={{ letterSpacing: '-0.02em' }}>{t('olim_how_title')}</h2>
            <p className={`mt-3 text-[15px] sm:text-base text-body ${memberFade}`}>{t(member ? 'olim_member_how_sub' : 'olim_how_sub')}</p>
          </div>
          {/* Guests: the free promise, stated outright before the steps. Members: their active status. */}
          {member ? (
            <div role="status" className="greet-in mx-auto mb-8 sm:mb-10 flex max-w-2xl items-center gap-3 sm:gap-4 rounded-2xl border border-brand/15 bg-brandTint px-4 py-4 sm:px-6">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white" aria-hidden="true">
                <i className="fa-solid fa-shield-halved text-base"></i>
              </span>
              <p className="min-w-0 text-start">
                <strong className="block text-base sm:text-lg font-black text-ink">{t('olim_member_badge')}</strong>
                <span className="text-sm sm:text-[15px] text-body">{t('olim_member_status_note')}</span>
              </p>
            </div>
          ) : (
            <div className="mx-auto mb-8 sm:mb-10 flex max-w-2xl items-center gap-3 sm:gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:px-6">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
                <i className="fa-solid fa-check text-base"></i>
              </span>
              <p className="min-w-0 text-start">
                <strong className="block text-base sm:text-lg font-black text-emerald-900">{t('olim_free_badge')}</strong>
                <span className="text-sm sm:text-[15px] text-emerald-800">{t('olim_free_note')}</span>
              </p>
            </div>
          )}
          <ol className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.titleKey} className={`relative flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-8px_rgba(15,23,42,.08)] ${memberFade}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${step.done ? 'bg-emerald-50 text-emerald-600' : 'bg-brandLight text-brand'}`} aria-hidden="true">
                    <i className={`fa-solid ${step.icon} text-base`}></i>
                  </span>
                  {step.done ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                      <i className="fa-solid fa-check text-[10px]" aria-hidden="true"></i>
                      {t('olim_step_done')}
                    </span>
                  ) : (
                    <span className="text-4xl font-black text-slate-100 tabular-nums" aria-hidden="true">{i + 1}</span>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-bold text-ink">{t(step.titleKey)}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-body">{t(step.descKey)}</p>
                {step.link && (
                  <Link href={step.link.href} className="tap-target mt-auto inline-flex items-center gap-1.5 self-start pt-3 text-sm font-semibold text-brand [@media(hover:hover)]:hover:underline">
                    {t(step.link.labelKey)}
                    <i className="fa-solid fa-arrow-right text-[11px] rtl:-scale-x-100" aria-hidden="true"></i>
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits */}
        <section aria-labelledby="olim-benefits-title" className="bg-white border-y border-slate-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <h2 id="olim-benefits-title" className="text-center text-2xl sm:text-4xl font-black text-ink mb-8 sm:mb-10" style={{ letterSpacing: '-0.02em' }}>{t('olim_benefits_title')}</h2>
            <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
              {BENEFITS.map((b) => (
                <div key={b.titleKey} className="rounded-2xl border border-slate-200/80 bg-canvas p-6 transition duration-200 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_12px_32px_-12px_rgba(0,56,184,.25)] motion-reduce:transform-none">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white shadow-[0_6px_16px_rgba(0,56,184,.25)]" aria-hidden="true">
                    <i className={`fa-solid ${b.icon} text-base`}></i>
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-ink">{t(b.titleKey)}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-body">{t(b.descKey)}</p>
                </div>
              ))}
            </div>

            {/* Lone soldiers: what Landly offers them, and the member type to pick when joining. */}
            <section id="lone-soldiers" aria-labelledby="lone-soldiers-title" className="scroll-mt-24 mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 rounded-2xl border border-brand/15 bg-brandLight/60 p-6 sm:p-8">
              <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm" aria-hidden="true">🎖️</span>
              <div className="min-w-0">
                <h2 id="lone-soldiers-title" className="text-xl sm:text-2xl font-black text-ink mb-2">{t('olim_lone_title')}</h2>
                <p className="text-[15px] leading-relaxed text-body">{t('olim_lone_desc')}</p>
              </div>
            </section>

            <div className="mt-10 sm:mt-12">
              <h3 className="text-center text-lg sm:text-xl font-bold text-ink mb-5">{t('olim_categories_title')}</h3>
              <ul className="flex flex-wrap justify-center gap-2.5">
                {OLIM_CATEGORIES.map((c) => (
                  <li key={c.labelKey} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink">
                    <span aria-hidden="true">{c.emoji}</span>
                    {t(c.labelKey)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Key numbers */}
        <section aria-labelledby="olim-numbers-title" className="max-w-5xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <h2 id="olim-numbers-title" className="text-center text-2xl sm:text-4xl font-black text-ink mb-8 sm:mb-10" style={{ letterSpacing: '-0.02em' }}>{t('olim_numbers_title')}</h2>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {STATS.map((s) => (
              <div key={s.labelKey} className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 text-center shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_-8px_rgba(15,23,42,.08)]">
                <dt className="order-2 mt-2 text-sm leading-snug text-body">{t(s.labelKey)}</dt>
                <dd className="order-1 text-4xl sm:text-5xl font-black text-brand tabular-nums" style={{ letterSpacing: '-0.03em' }}>
                  <bdi>{s.value}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* The mentor request (members) or its sign-up gate (guests). id="mentor"
            keeps older /olim#mentor links landing here; the card itself is #mentor-section. */}
        <div id="mentor" className="max-w-4xl mx-auto px-4 sm:px-6 pb-14 sm:pb-20 scroll-mt-[calc(var(--header-offset)+16px)]">
          <MentorRequestCard />
        </div>

        {/* Next steps */}
        <section aria-labelledby="olim-final-title" className="max-w-4xl mx-auto px-4 sm:px-6 pb-[calc(4rem+env(safe-area-inset-bottom))]">
          <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0B1B3D_0%,#0038B8_100%)] px-6 py-10 sm:px-12 sm:py-14 text-center text-white shadow-[0_16px_40px_rgba(0,56,184,.25)]">
            <div aria-hidden="true" className="pointer-events-none absolute -top-24 -end-16 h-56 w-56 rounded-full bg-brandGradientStart/40 blur-3xl" />
            <h2 id="olim-final-title" className="relative text-2xl sm:text-4xl font-black text-balance" style={{ letterSpacing: '-0.02em' }}>{t(member ? 'olim_member_final_title' : 'olim_final_title')}</h2>
            <p className="relative mt-3 mb-7 max-w-xl mx-auto text-[15px] sm:text-base text-white/80">{t(member ? 'olim_member_final_sub' : 'olim_final_sub')}</p>
            <div className="relative">{ctas}</div>
          </div>
        </section>
      </main>
    </>
  )
}
