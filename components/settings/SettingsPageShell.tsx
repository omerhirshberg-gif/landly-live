'use client'

import Navbar from '@/components/layout/Navbar'
import { useLang } from '@/lib/i18n/useLang'
import { useSettingsBack } from './useSettingsBack'
import { useSwipeBack } from './useSwipeBack'

// The frame of /settings and each of its sub-pages: the navbar, then a
// header with the back button on the leading side and the title truly
// centred (an equal spacer trails), then the page. Every settings screen is
// a real route, never a sheet or dialog.
//
// Back climbs the settings hierarchy (useSettingsBack.ts): a
// sub-page returns to its parent page (Country of origin to Language &
// Region, the others to Settings) even when it was opened from somewhere
// else, and Settings itself returns to the previous page. On touch screens
// the page can also be swiped back like turning a page (useSwipeBack.ts),
// which does the same; the browser's own back and edge swipe keep working.
export default function SettingsPageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { t, isRtl } = useLang()
  const goBack = useSettingsBack()
  const pageRef = useSwipeBack<HTMLDivElement>(goBack, isRtl)

  return (
    <>
      <Navbar />
      <div ref={pageRef} className="pt-16 member-canvas min-h-dvh">
        <div className="max-w-xl lg:max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
          <div className="grid grid-cols-[44px_1fr_44px] items-center mb-5">
            <button
              type="button"
              onClick={goBack}
              aria-label={t('settings_back')}
              className="tap-target flex items-center justify-center w-11 h-11 rounded-full text-ink transition-colors [@media(hover:hover)]:hover:bg-slate-100 active:bg-slate-200"
            >
              <i className="fa-solid fa-chevron-left rtl:-scale-x-100" aria-hidden="true"></i>
            </button>
            <h1 className="text-center text-lg sm:text-xl font-bold text-ink truncate">{title}</h1>
            <span aria-hidden="true"></span>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
