'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/lib/i18n/useLang'

const STORAGE_KEY = 'landly_cookie_notice_seen'

export default function CookieNotice() {
  const { t } = useLang()
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

  if (!visible) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[900] bg-slate-900 text-slate-300 px-5 py-3.5 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <p className="flex-1 min-w-0 text-xs sm:text-[13px] leading-relaxed">{t('cookie_notice_text')}</p>
        <button
          onClick={dismiss}
          className="tap-target bg-white text-slate-900 font-bold text-[13px] px-4 py-2 rounded-full whitespace-nowrap flex-shrink-0"
        >
          {t('cookie_notice_dismiss')}
        </button>
        <button
          onClick={dismiss}
          aria-label={t('cookie_notice_dismiss_aria')}
          className="tap-target text-slate-400 hover:text-white flex-shrink-0"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>
    </div>
  )
}
