'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/useLang'
import { CONSENT_PATHS, consentParts } from '@/lib/legal/consentText'
import type { TranslationKey } from '@/lib/i18n/translations'
import { X } from 'lucide-react'

const STORAGE_KEY = 'landly_cookie_notice_seen'

// The /join campaign page: a bar over the form would greet every first-time ad
// visitor, and the page carries its own Privacy Policy link.
// The card frame (app/checkout/card-frame) is a fragment inside the app's payment step, not a page.
export function showsCookieNotice(pathname: string | null): boolean {
  return !(pathname === '/join' || pathname?.startsWith('/join/') || pathname === '/checkout/card-frame')
}

// An information notice, not a consent prompt: the site stores only what it
// needs to work (session, language) and runs no advertising or tracking
// cookies, so there is nothing to opt into. The copy speaks only for our own
// code: it makes no promise about what third-party scripts (e.g. the
// accessibility widget, cdn.enable.co.il) store.
//
// Layout: below the navbar (z-1000) and mobile drawer (z-950). On phones the
// text sits above a centred "Got it", clear of the bottom corners where
// floating widget buttons usually sit; from 640px the bar is a single row.
// The bottom padding clears the iOS home indicator.
export default function CookieNotice() {
  const { t } = useLang()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage unavailable — notice will just reappear next visit
    }
  }

  if (!visible || !showsCookieNotice(pathname)) return null
  return <CookieNoticeBar t={t} onDismiss={dismiss} />
}

/** The bar itself, split out so it renders (and tests) without the storage check. */
export function CookieNoticeBar({ t, onDismiss }: { t: (key: TranslationKey) => string; onDismiss: () => void }) {
  return (
    // data-floating-clearance: floating buttons (the WhatsApp widget) rise above the bar while it shows.
    <div
      data-floating-clearance=""
      className="fixed bottom-0 inset-x-0 z-[900] bg-white/85 backdrop-blur-md border-t border-slate-200 text-slate-600 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] ps-[calc(1.25rem+env(safe-area-inset-left,0px))] pe-[calc(1.25rem+env(safe-area-inset-right,0px))] pt-3.5 sm:ps-[calc(1.5rem+env(safe-area-inset-left,0px))] sm:pe-[calc(1.5rem+env(safe-area-inset-right,0px))]"
      style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 min-w-0 text-xs sm:text-meta leading-relaxed text-center sm:text-start">
          {consentParts(t('cookie_notice_text')).map((part, i) =>
            'link' in part ? (
              <a
                key={i}
                href={CONSENT_PATHS.privacy}
                className="font-semibold text-brand underline underline-offset-2 decoration-brand/40 transition-colors hover:text-brandDark hover:decoration-brandDark"
              >
                {t('cookie_notice_privacy_link')}
              </a>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </p>
        <div className="flex items-center justify-center gap-2 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="tap-target bg-brand text-white font-bold text-meta px-6 py-2 rounded-xl whitespace-nowrap transition-colors hover:bg-brandDark"
          >
            {t('cookie_notice_dismiss')}
          </button>
          {/* A second close control only where there's room beside the text. */}
          <button
            onClick={onDismiss}
            aria-label={t('cookie_notice_dismiss_aria')}
            className="hidden sm:inline-flex tap-target items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}
