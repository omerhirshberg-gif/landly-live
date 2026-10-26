'use client'

import { useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { useLang } from '@/lib/i18n/useLang'
import { useSettingsBack } from './useSettingsBack'

/** The query Settings' Help & legal rows add to their links (app/settings/page.tsx). */
export const FROM_SETTINGS_PARAM = 'from'
export const FROM_SETTINGS_VALUE = 'settings'

/** A Settings row's link to a page outside /settings, marked so that page offers the way back. */
export function fromSettingsHref(href: string): string {
  return `${href}?${FROM_SETTINGS_PARAM}=${FROM_SETTINGS_VALUE}`
}

// "‹ Back to Settings" above the content of Support, Terms and Privacy, shown
// only when Settings opened them (?from=settings): reached from the footer,
// the navbar or a shared link they keep the plain site header. Back is the
// browser's own when Settings is the page below in history, otherwise it
// replaces this page with /settings (useSettingsBack), so it never strands
// the member. A 44px touch target on phones; the chevron flips in Hebrew.
//
// useSearchParams needs a Suspense boundary on these statically rendered
// pages, so they wrap it in one.
export default function BackToSettings({ className = '' }: { className?: string }) {
  const { t } = useLang()
  const goBack = useSettingsBack('/settings')
  const fromSettings = useSearchParams()?.get(FROM_SETTINGS_PARAM) === FROM_SETTINGS_VALUE
  if (!fromSettings) return null

  return (
    <button
      type="button"
      onClick={goBack}
      className={`tap-target inline-flex items-center gap-2 min-h-[44px] -ms-2 px-2 rounded-lg text-sm font-medium text-slate-500 transition-colors [@media(hover:hover)]:hover:text-brand active:bg-slate-100 cursor-pointer ${className}`}
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.75} />
      <span>{t('settings_back_to_settings')}</span>
    </button>
  )
}
