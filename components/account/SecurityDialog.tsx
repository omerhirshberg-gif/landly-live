'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from '@/lib/i18n/useLang'
import SecuritySection from './SecuritySection'

// "Privacy & Security", opened from the avatar menu (desktop) or the drawer
// (phones) rather than taking up half of /account: how the member signs in,
// then Change Password for email/password accounts (a Google-only account
// has no Landly password, so it gets a note instead). A native <dialog>
// opened with showModal(): it sits in the top layer above the fixed navbar,
// traps focus and closes on Escape by itself; a click on the backdrop
// closes it too.
export default function SecurityDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, isRtl } = useLang()
  const { user } = useAuth()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!user) return null
  const hasPassword = !!user.providerData?.some((p) => p.providerId === 'password')

  return (
    <dialog
      ref={ref}
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-labelledby="security-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-line bg-[#F8FAFC] p-0 text-start shadow-xl backdrop:bg-[#0B1B3D]/50"
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-brandLight text-brand" aria-hidden="true">
              <i className="fa-solid fa-shield-halved"></i>
            </span>
            <h2 id="security-dialog-title" className="flex-1 min-w-0 text-lg font-bold text-ink">{t('nav_security')}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('onb_close')}
              className="tap-target flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-muted hover:bg-slate-100 hover:text-ink transition-colors"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm mb-4">
            <h3 className="text-xs font-semibold text-slate-500 mb-0.5">{t('security_signin_title')}</h3>
            <p className="text-sm font-bold text-slate-900">{hasPassword ? t('security_method_password') : t('security_method_google')}</p>
            {user.email && <p className="text-sm text-body truncate"><bdi>{user.email}</bdi></p>}
            {!hasPassword && <p className="mt-3 text-sm text-body">{t('security_google_note')}</p>}
          </div>

          {hasPassword && <SecuritySection user={user} />}

          <p className="mt-4 text-center text-xs text-slate-400">
            <Link href="/privacy" onClick={onClose} className="inline-block py-1.5 hover:text-brand">{t('nav_privacy_link')}</Link>
          </p>
        </div>
      )}
    </dialog>
  )
}
