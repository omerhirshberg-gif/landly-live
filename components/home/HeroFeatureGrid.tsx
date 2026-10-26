'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import CategoryIcon from '@/components/ui/CategoryIcon'
import { formatSavings } from '@/lib/format'
import type { HeroFeature } from '@/lib/home/showcase'
import { useLang } from '@/lib/i18n/useLang'
import { localizeText } from '@/lib/i18n/contentTranslation'
import { localizedBusinessName } from '@/lib/business/businessText'

// The hero's 2×2 of tactile cards (lib/home/showcase.ts pickHeroFeatures):
// three real offers, each opening its page, or three categories when there
// aren't enough savings to show, then "Explore Perks" into the catalogue.
// A quiet Mediterranean set: luminous sky, warm editorial cream, a white card
// floating on a soft brand shadow, and royal brand blue. Square on phones (a
// touch taller under 380px), a little wider than tall beside the copy on
// desktop. Shekel amounts sit in <bdi> so they stay whole inside Hebrew.
// Laid out loosely, not as a spreadsheet: the second column sits a little
// lower and each card leans under a degree, the leans mirrored in RTL like
// the discount badge. With a real pointer (or keyboard focus) a card
// straightens and lifts 6px under a soft brand shadow; a press settles it to
// 98%. Reduced motion keeps the pose but drops the movement.
const CARD =
  'group relative isolate flex h-full w-full flex-col overflow-hidden rounded-3xl p-4 sm:p-5 aspect-square max-[379px]:aspect-[4/5] lg:aspect-[1.1/1] ' +
  'transition-[transform,box-shadow] duration-300 ease-out-expo [@media(hover:hover)]:hover:-translate-y-1.5 [@media(hover:hover)]:hover:rotate-0 focus-visible:rotate-0 ' +
  'hover:shadow-[0_12px_32px_-8px_rgba(0,56,184,0.18)] active:scale-[0.98] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ' +
  'motion-reduce:transition-none motion-reduce:[@media(hover:hover)]:hover:translate-y-0 motion-reduce:active:scale-100'

// The three offer surfaces, in grid order: the card and its faint corner glyph.
const THEMES = [
  { card: 'border border-sky-200/80 bg-gradient-to-br from-sky-50 to-sky-100/70 text-ink', glyph: 'text-sky-300/40', layout: 'sky' },
  { card: 'border border-creamLine bg-gradient-to-br from-cream to-creamDeep text-ink', glyph: 'text-brand/[0.06]', layout: 'cream' },
  { card: 'border border-slate-200/80 bg-white text-ink shadow-[0_4px_20px_-4px_rgba(0,56,184,0.08)]', glyph: 'text-slate-200/60', layout: 'white' },
] as const

type Theme = (typeof THEMES)[number]

// Each card's lean, in grid order (the three offers, then Explore Perks).
const TILTS = [
  '-rotate-[0.75deg] rtl:rotate-[0.75deg]',
  'rotate-[1deg] rtl:-rotate-[1deg]',
  'rotate-[0.5deg] rtl:-rotate-[0.5deg]',
  '-rotate-[0.85deg] rtl:rotate-[0.85deg]',
] as const

// The merchant over each offer: a small uppercase eyebrow.
const EYEBROW = 'truncate text-micro font-bold uppercase tracking-wider rtl:tracking-normal'

// The second column sits lower; the list's bottom padding keeps that clear of the buttons.
const ITEM = 'flex even:translate-y-2 sm:even:translate-y-3'

export default function HeroFeatureGrid({ features }: { features: readonly HeroFeature[] }) {
  const { t } = useLang()
  return (
    <ul aria-label={t('landing_savings_title')} className="grid grid-cols-2 gap-3 max-[379px]:gap-2.5 pb-2 sm:pb-3 text-start">
      {features.map((feature, i) => (
        <li key={feature.key} className={ITEM}>
          <FeatureCard feature={feature} theme={THEMES[i % THEMES.length]} tilt={TILTS[i % THEMES.length]} />
        </li>
      ))}
      <li className={ITEM}>
        <Link
          href="/categories"
          className={`${CARD} ${TILTS[3]} bg-gradient-to-br from-brand to-brandDark text-white shadow-[0_8px_24px_rgba(0,56,184,0.24)]`}
        >
          {/* A glass circle with the arrow, which nudges toward its corner on hover. */}
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center self-end rounded-full border border-white/25 bg-white/15 backdrop-blur-sm">
            <ArrowUpRight
              aria-hidden="true"
              className="h-5 w-5 rtl:-scale-x-100 transition-transform duration-300 ease-out-expo [@media(hover:hover)]:group-hover:-translate-y-0.5 [@media(hover:hover)]:group-hover:translate-x-0.5 rtl:[@media(hover:hover)]:group-hover:-translate-x-0.5 motion-reduce:transform-none"
              strokeWidth={2}
            />
          </span>
          <span className="mt-auto text-xl sm:text-heading-sm font-black uppercase leading-tight tracking-tight">{t('nav_cta')}</span>
        </Link>
      </li>
    </ul>
  )
}

function FeatureCard({ feature, theme, tilt }: { feature: HeroFeature; theme: Theme; tilt: string }) {
  const { t, lang } = useLang()
  const glyph = (
    <span aria-hidden="true" className={`pointer-events-none absolute -bottom-3 -end-3 -z-10 ${theme.glyph}`}>
      <CategoryIcon category={feature.kind === 'offer' ? feature.offer.category : feature.category} className="h-20 w-20 sm:h-24 sm:w-24" strokeWidth={1.25} />
    </span>
  )

  if (feature.kind === 'category') {
    return (
      <Link href={feature.href} className={`${CARD} ${tilt} ${theme.card} justify-end`}>
        {glyph}
        <span className="text-lg sm:text-xl font-black leading-tight tracking-tight">{t(feature.labelKey)}</span>
        <span className="mt-1 text-xs font-bold uppercase tracking-wider rtl:tracking-normal text-brand">{t('home_see_all')}</span>
      </Link>
    )
  }

  const { offer, savings, percent } = feature
  const name = localizedBusinessName(offer, lang)
  const title = localizeText(offer.title, offer.translations, lang, 'title')
  const amount = formatSavings(savings, lang)
  const [savedBefore, savedAfter] = t('landing_savings_badge').split('{amount}')
  const nameProps = { lang: name.lang ?? undefined, dir: 'auto' as const }
  const titleProps = { lang: title.lang ?? undefined, dir: 'auto' as const }

  if (theme.layout === 'sky') {
    return (
      <Link href={feature.href} className={`${CARD} ${tilt} ${theme.card}`}>
        {glyph}
        <span className={`${EYEBROW} text-brand`} {...nameProps}>{name.text}</span>
        <span className="mt-1 line-clamp-2 text-lg sm:text-xl font-black leading-[1.25] tracking-tight" {...titleProps}>{title.text}</span>
        <span className="mt-auto self-start rounded-full bg-white px-3 py-1 text-meta font-black text-brand shadow-sm">
          {savedBefore}<bdi>{amount}</bdi>{savedAfter}
        </span>
      </Link>
    )
  }

  if (theme.layout === 'cream') {
    return (
      <Link href={feature.href} className={`${CARD} ${tilt} ${theme.card}`}>
        {glyph}
        <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
          <span aria-hidden="true" className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
          <span className={EYEBROW} {...nameProps}>{name.text}</span>
        </span>
        <span className="mt-1 line-clamp-2 text-meta sm:text-sm font-medium leading-snug text-slate-600" {...titleProps}>{title.text}</span>
        {/* The amount set large inside the phrase, whichever side of it the language puts the words. */}
        <span className="mt-auto flex flex-wrap items-baseline gap-x-1 font-black text-brand">
          {savedBefore.trim() && <span className="text-xs uppercase tracking-wider rtl:tracking-normal">{savedBefore.trim()}</span>}
          <bdi className="text-page sm:text-3xl leading-none tracking-tight">{amount}</bdi>
          {savedAfter.trim() && <span className="text-xs uppercase tracking-wider rtl:tracking-normal">{savedAfter.trim()}</span>}
        </span>
      </Link>
    )
  }

  return (
    <Link href={feature.href} className={`${CARD} ${tilt} ${theme.card}`}>
      {glyph}
      {percent > 0 && (
        <span className="self-start -rotate-2 rtl:rotate-2 rounded-lg bg-sky-100 px-2.5 py-1 text-meta font-black uppercase text-brand">
          {t('offer_percent_off').replace('{n}', String(percent))}
        </span>
      )}
      <span className={`mt-auto ${EYEBROW} text-slate-500`} {...nameProps}>{name.text}</span>
      <span className="mt-1 line-clamp-2 text-title sm:text-lg font-black leading-tight tracking-tight" {...titleProps}>{title.text}</span>
    </Link>
  )
}
