'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { APP_STORE_HREF, GOOGLE_PLAY_HREF, STORE_FALLBACK_PATH } from '@/lib/appLinks'
import { useLang } from '@/lib/i18n/useLang'

// The stores' own marks, as vectors: Lucide draws no brand logos.
const APPLE_PATH = 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701'
const PLAY_PATH = 'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z'

const BADGE = 'relative inline-flex min-h-[52px] rounded-xl border px-4 py-2'
const ACTION = 'inline-flex min-h-[52px] min-w-[152px] items-center justify-center rounded-xl px-6 py-3 text-base font-semibold transition-[transform,background-color] duration-200 ease-out-expo [@media(hover:hover)]:hover:-translate-y-1 active:scale-[.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transform-none'

function StoreBadge({ href, path, small, name, soon }: { href: string; path: string; small: string; name: string; soon: string }) {
  const live = href !== STORE_FALLBACK_PATH
  // The brand names read left to right in every language.
  const face = (
    <span dir="ltr" className="inline-flex items-center gap-2.5">
      <svg aria-hidden="true" viewBox="0 0 24 24" className={`h-6 w-6 shrink-0 ${live ? '' : 'text-slate-400'}`} fill="currentColor"><path d={path} /></svg>
      <span className="text-start leading-tight">
        <span className={`block text-nano font-medium ${live ? 'text-white/75' : ''}`}>{small}</span>
        <span className="block text-sm font-bold">{name}</span>
      </span>
    </span>
  )

  if (live) {
    return (
      <a
        href={href}
        className={`${BADGE} border-slate-800 bg-ink text-white shadow-[0_8px_20px_-8px_rgba(11,27,61,.6)] transition-transform duration-200 ease-out-expo [@media(hover:hover)]:hover:-translate-y-1 active:scale-[.98] focus-visible:ring-2 focus-visible:ring-brand/40 motion-reduce:transform-none`}
      >
        {face}
      </a>
    )
  }

  // No listing yet: not a link at all, so neither a tap nor the keyboard can land on it.
  return (
    <div className={`${BADGE} cursor-default border-slate-200/80 bg-slate-100 text-slate-500`}>
      {face}
      <span className="absolute -top-2 -end-2 rounded-md bg-brand px-2 py-1 text-nano font-bold leading-none text-white shadow-sm">{soon}</span>
    </div>
  )
}

// The landing's way in: that it's free, then joining with signing in beside it,
// over both store badges. A badge is live once its store has a listing (lib/appLinks.ts) and
// says "Soon" until then. The two actions share a width so they read as a pair.
export default function StoreButtons() {
  const { t } = useLang()
  const soon = t('deals_card_soon_badge')

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-col items-center gap-3">
        <p className="inline-flex max-w-full items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 sm:text-sm">
          <Check aria-hidden="true" className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
          <span>{t('landing_free_badge')}</span>
        </p>
        <div className="flex flex-row flex-wrap items-center justify-center gap-3.5 sm:gap-4">
          <Link href="/signup" className={`${ACTION} bg-brand text-white shadow-sm [@media(hover:hover)]:hover:bg-brandDark`}>
            {t('landing_cta_join')}
          </Link>
          <Link href="/login" className={`${ACTION} border border-slate-200 bg-white text-slate-800 shadow-sm [@media(hover:hover)]:hover:bg-slate-50`}>
            {t('nav_login')}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StoreBadge href={APP_STORE_HREF} path={APPLE_PATH} small={t('landing_store_apple_small')} name="App Store" soon={soon} />
        <StoreBadge href={GOOGLE_PLAY_HREF} path={PLAY_PATH} small={t('landing_store_play_small')} name="Google Play" soon={soon} />
      </div>
    </div>
  )
}
