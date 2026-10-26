'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/i18n/useLang'
import { backAction, backLabelKey } from '@/lib/navigation/back'
import { previousPath, willReplace } from '@/lib/navigation/previousPath'
import { ArrowLeft, ChevronLeft } from 'lucide-react'

interface BackButtonProps {
  /** Where back goes when there's no in-app page behind this one (opened directly). */
  fallback: string
  /** The visible text (pill) or accessible name (icon); defaults to "Back". */
  label?: string
  /** Name the page back returns to ("Back to Home", "Back to Discover"...) instead of `label`. */
  contextLabel?: boolean
  /** 'pill': arrow and text. 'icon': a round arrow-only button, named by aria-label. */
  variant?: 'pill' | 'icon'
  /** Always go to `fallback`, never through history (lib/navigation/back.ts). */
  force?: boolean
  className?: string
}

// The back button of secondary pages (offer, category, checkout). A real
// <button>, 48px square at least, with a visible focus ring; the arrow
// points left in left-to-right languages and right in Hebrew. It steps back
// through the browser's history when there's an in-app page to return to,
// so it agrees with the browser's back and the iOS/Android edge swipe, which
// globals.css deliberately leaves free.
export default function BackButton({ fallback, label, contextLabel = false, variant = 'pill', force = false, className = '' }: BackButtonProps) {
  const { t } = useLang()
  const router = useRouter()
  // The in-app history only exists in the browser, so the contextual text is
  // read after mount; the server and the first render say plain "Back".
  const [contextKey, setContextKey] = useState<ReturnType<typeof backLabelKey>>('nav_back')
  useEffect(() => {
    if (contextLabel) setContextKey(backLabelKey(previousPath()))
  }, [contextLabel])
  const text = contextLabel ? t(contextKey) : (label ?? t('nav_back'))

  const goBack = () => {
    const action = backAction(fallback, previousPath(), force)
    if (action.kind === 'back') router.back()
    else {
      willReplace()
      router.replace(action.href)
    }
  }

  const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={goBack}
        aria-label={text}
        className={`tap-target inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink transition-colors active:bg-slate-200 [@media(hover:hover)]:hover:bg-slate-100 ${focus} ${className}`}
      >
        <ChevronLeft aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.75} />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={goBack}
      className={`tap-target -ms-2 inline-flex min-h-12 items-center gap-2 rounded-full pe-4 ps-3 text-sm font-semibold text-brand transition-colors active:bg-[#E0EDFF] [@media(hover:hover)]:hover:bg-brandTint ${focus} ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.75} />
      <span>{text}</span>
    </button>
  )
}
