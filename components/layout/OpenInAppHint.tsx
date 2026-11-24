'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLang } from '@/lib/i18n/useLang'
import { appUrlForLink } from '@/lib/navigation/deepLinks'
import type { TranslationKey } from '@/lib/i18n/translations'
import { X } from 'lucide-react'

const STORAGE_KEY = 'landly_open_in_app_dismissed'

// iPadOS Safari reports itself as a Mac; a touch screen gives it away.
function isPhoneOrTablet(): boolean {
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
}

// A quiet "Open in app" bar for an offer or voucher page opened in a phone's
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
      className={`sm:hidden flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white ps-3 pe-2 py-2 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_4px_14px_rgb(15_23_42/0.05)] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={28} height={27} className="h-7 w-7 flex-shrink-0 object-contain" />
      <p className="min-w-0 flex-1 text-meta font-semibold leading-snug text-slate-700">{t('openInApp_text')}</p>
      <a
        href={appUrl}
        className="inline-flex h-8 flex-shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-brand px-3.5 text-[13px] font-semibold tracking-tight text-white transition-colors hover:bg-brandDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {t('openInApp_button')}
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('openInApp_dismiss')}
        className="-my-1 -ms-1 -me-1 inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
