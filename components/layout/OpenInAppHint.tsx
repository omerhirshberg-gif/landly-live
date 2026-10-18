'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/useLang'
import { appUrlForLink } from '@/lib/navigation/deepLinks'
import type { TranslationKey } from '@/lib/i18n/translations'

const STORAGE_KEY = 'landly_open_in_app_dismissed'

// iPadOS Safari reports itself as a Mac; a touch screen gives it away.
function isPhoneOrTablet(): boolean {
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
}

// A quiet "Open in app" card for an offer or voucher page opened in a phone's
// browser (e.g. from the order confirmation email). It links to the same
// screen in the Expo app over the landly:// scheme (lib/navigation/deepLinks.ts)
// and never redirects by itself, so a visitor without the app is never sent to
// a dead link. Desktop never sees it: it renders only on iOS/Android browsers,
// and sm:hidden keeps it off wide windows too. Once dismissed it stays away.
export default function OpenInAppHint({ className = '' }: { className?: string }) {
  const { t } = useLang()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const appUrl = appUrlForLink(pathname)

  useEffect(() => {
    if (!isPhoneOrTablet()) return
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage unavailable — the hint will just reappear next visit
    }
  }

  if (!visible || !appUrl) return null
  return <OpenInAppBar t={t} appUrl={appUrl} onDismiss={dismiss} className={className} />
}

/** The card itself, split out so it renders (and tests) without the device and storage checks. */
export function OpenInAppBar({ t, appUrl, onDismiss, className = '' }: {
  t: (key: TranslationKey) => string
  appUrl: string
  onDismiss: () => void
  className?: string
}) {
  return (
    <div
      role="region"
      aria-label={t('openInApp_text')}
      className={`sm:hidden flex items-center gap-3 rounded-2xl border border-slate-100 bg-white ps-3 pe-1.5 py-2 shadow-sm ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={28} height={27} className="h-7 w-7 flex-shrink-0 object-contain" />
      <p className="flex-1 min-w-0 text-[13px] font-semibold leading-snug text-slate-700">{t('openInApp_text')}</p>
      <a
        href={appUrl}
        className="tap-target flex-shrink-0 rounded-full bg-brand px-4 py-1.5 text-[13px] font-bold text-white whitespace-nowrap transition-colors hover:bg-brandDark"
      >
        {t('openInApp_button')}
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('openInApp_dismiss')}
        className="tap-target inline-flex flex-shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-slate-600"
      >
        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    </div>
  )
}
