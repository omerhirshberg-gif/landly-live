'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { floatingClearance } from '@/lib/layout/floatingClearance'
import type { TranslationKey } from '@/lib/i18n/translations'
import { useLang } from '@/lib/i18n/useLang'
import {
  isBubbleDismissed,
  isWidgetHidden,
  rememberBubbleDismissed,
  rememberWidgetHidden,
  showsWhatsAppWidget,
  whatsappChatHref,
} from '@/lib/support/whatsapp'

// The floating WhatsApp support button, bottom right in every language,
// lined up with the accessibility button bottom left (cdn.enable.co.il):
// both 20px in from their side and centred on one line, --floating-base in
// globals.css. A green badge
// with a slow breathing glow (still under reduced motion, globals.css
// .wa-glow), and a speech bubble that rises in a moment after the page
// loads: "Need help?". Both open a chat with the support line, the greeting
// pre-filled in the site language, in a new tab. The bubble's X (or Escape)
// closes it for the rest of the tab session; the small X on the badge hides
// the whole widget for the session. It's in the server HTML, so the badge
// is a working wa.me link before (or without) JavaScript; a tab that hid it
// is marked on <html> before the first paint (WHATSAPP_HIDDEN_SCRIPT,
// globals.css .wa-hidden), so a hidden widget never flashes in on load, and
// drops out of the tree once sessionStorage is read. The whole widget rises above
// anything covering the bottom of the screen -- the cookie bar, an offer's
// purchase bar on phones (lib/layout/floatingClearance.ts) -- so it never
// hides a button. Off on staff, checkout and sign-in pages (lib/support/whatsapp.ts).

export const BUBBLE_DELAY_MS = 2000

const tabStorage = () => window.sessionStorage

/** Live clearance for a bottom-anchored button, kept in step with scrolling, resizing and bars coming and going. */
function useFloatingClearance(enabled: boolean): number {
  const [lift, setLift] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const measure = () => {
      frame = 0
      setLift(floatingClearance(document, window.innerHeight))
    }
    // At most once a frame, however many scroll, resize and DOM events arrive.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // A bar can appear later (the cookie notice after its storage check, an
    // offer's bar once the offer loads) or change height (text wrapping).
    const mutations = new MutationObserver(schedule)
    mutations.observe(document.body, { childList: true, subtree: true })
    const sizes = new ResizeObserver(schedule)
    sizes.observe(document.body)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      mutations.disconnect()
      sizes.disconnect()
    }
  }, [enabled])

  const current = enabled ? lift : 0
  // Shared with the accessibility button (globals.css), so it rises with this one.
  useEffect(() => {
    const root = document.documentElement
    if (current) root.style.setProperty('--floating-lift', `${current}px`)
    else root.style.removeProperty('--floating-lift')
    return () => {
      root.style.removeProperty('--floating-lift')
    }
  }, [current])

  return current
}

export default function WhatsAppWidget() {
  const pathname = usePathname()
  const { t, isRtl } = useLang()
  // null until sessionStorage is read after mount (the server can't know);
  // until then the head script's class hides a widget this tab closed.
  const [hidden, setHidden] = useState<boolean | null>(null)
  const shown = showsWhatsAppWidget(pathname) && hidden !== true
  const lift = useFloatingClearance(shown)
  // Closed until the delay passes, and only if this tab hasn't dismissed it.
  const [bubbleOpen, setBubbleOpen] = useState(false)

  useEffect(() => {
    setHidden(isWidgetHidden(tabStorage))
  }, [])

  useEffect(() => {
    if (!shown || isBubbleDismissed(tabStorage)) return
    const timer = window.setTimeout(() => setBubbleOpen(true), BUBBLE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [shown])

  const hide = () => {
    setHidden(true)
    setBubbleOpen(false)
    rememberWidgetHidden(tabStorage)
  }

  const dismiss = () => {
    setBubbleOpen(false)
    rememberBubbleDismissed(tabStorage)
  }

  useEffect(() => {
    if (!bubbleOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [bubbleOpen])

  if (!shown) return null
  return (
    <WhatsAppWidgetView
      href={whatsappChatHref(t('whatsapp_prefill'))}
      lift={lift}
      bubbleOpen={bubbleOpen}
      onDismiss={dismiss}
      onHide={hide}
      t={t}
      isRtl={isRtl}
    />
  )
}

/** The widget's markup, split out so it renders (and tests) without the timer, storage and measuring. */
export function WhatsAppWidgetView({
  href,
  lift,
  bubbleOpen,
  onDismiss,
  onHide,
  t,
  isRtl,
}: {
  href: string
  lift: number
  bubbleOpen: boolean
  onDismiss: () => void
  /** The badge's X: hides the whole widget for the tab session. */
  onHide: () => void
  t: (key: TranslationKey) => string
  isRtl: boolean
}) {
  return (
    // Bottom right always (dir="ltr" pins the corner); the bubble's own text follows the language.
    // Inset by the right safe area too, so a landscape notch or cutout never covers it.
    <div
      dir="ltr"
      className="wa-widget fixed right-[calc(1.25rem+env(safe-area-inset-right,0px))] z-[890] flex flex-col items-end"
      style={{ bottom: 'var(--floating-base)', transform: lift ? `translateY(-${lift}px)` : undefined }}
    >
      {/* A plain box (not display: contents, which drops the live region in some Safari versions). */}
      <div aria-live="polite" className="flex flex-col items-end">
        {bubbleOpen && (
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="wa-bubble relative mb-3 w-max max-w-[240px] rounded-2xl border border-slate-100 bg-white/95 p-3 pe-9 shadow-lg backdrop-blur-md"
          >
            <a href={href} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2">
              <span className="block text-sm font-bold text-[#0B1B3D]">{t('whatsapp_bubble_title')}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[#475569]">{t('whatsapp_bubble_sub')}</span>
            </a>
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('whatsapp_bubble_dismiss')}
              // A 28px visible circle in a 44px touch area.
              className="absolute top-1.5 end-1.5 flex h-7 w-7 items-center justify-center rounded-full p-1 text-slate-400 transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {/* The badge, with a small X at its top left (toward the page) that hides the widget for the session. */}
      <div className="relative">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('whatsapp_badge_label')}
          className="wa-badge relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition-transform duration-200 [@media(hover:hover)]:hover:scale-[1.08] active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/40"
        >
          <span aria-hidden="true" className="wa-glow pointer-events-none absolute inset-0 rounded-full bg-[#25D366]" />
          <svg viewBox="0 0 32 32" width="30" height="30" fill="currentColor" aria-hidden="true" className="relative">
            <path d="M16.04 3C8.86 3 3.02 8.82 3.02 16c0 2.29.6 4.53 1.74 6.5L3 29l6.68-1.74A13 13 0 0 0 16.04 29C23.2 29 29 23.18 29 16S23.2 3 16.04 3Zm0 23.8c-2.03 0-4.02-.55-5.76-1.58l-.41-.25-3.96 1.03 1.06-3.86-.27-.42A10.76 10.76 0 0 1 5.24 16c0-5.96 4.85-10.8 10.8-10.8 5.95 0 10.78 4.84 10.78 10.8 0 5.95-4.84 10.8-10.78 10.8Zm5.92-8.09c-.32-.16-1.92-.95-2.22-1.06-.3-.11-.51-.16-.73.16-.21.32-.84 1.06-1.03 1.27-.19.22-.38.24-.7.08-.32-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.91-1.8-2.23-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.21 0-.56.08-.86.4-.3.32-1.13 1.1-1.13 2.69 0 1.58 1.16 3.12 1.32 3.33.16.22 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.03.13.62-.09 1.92-.78 2.19-1.54.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z" />
          </svg>
        </a>
        <button
          type="button"
          onClick={onHide}
          aria-label={t('whatsapp_widget_close')}
          // A 22px visible circle in a 34px touch area (above WCAG's 24px minimum),
          // kept that small so it takes little of the badge's own tap area.
          className="absolute -left-1.5 -top-1.5 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
