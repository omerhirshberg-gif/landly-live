'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { auth } from '@/lib/firebase/config'
import { useAuth } from '@/lib/firebase/useAuth'
import { useLang } from '@/lib/i18n/useLang'
import { isEmbeddedBrowser } from '@/lib/auth/googleWebSignIn'
import { addPasskey, fetchPasskeys, hasPasskeyHint, passkeySupport } from '@/lib/auth/passkeyClient'
import {
  clearPasskeyOffer,
  isPasskeyOfferDue,
  isPasskeyPromptPage,
  isPasskeyPromptSnoozed,
  snoozePasskeyPrompt,
} from '@/lib/auth/passkeyPrompt'
import { bottomCoverage, FLOATING_CLEARANCE_ATTR } from '@/lib/layout/floatingClearance'
import type { TranslationKey } from '@/lib/i18n/translations'

type Phase = 'offer' | 'adding' | 'added' | 'error'

// "Save a passkey for faster sign-in next time": offered once after a
// password or Google sign-in (lib/auth/passkeyPrompt.ts decides when), on the
// page the member lands on, when the browser supports passkeys and the
// account has none yet. "Add a passkey" runs the same flow as Settings >
// Passkeys; the sign-in just happened, so no password is asked again.
// "Not now", ✕ and Esc hide it for 30 days. A non-modal dialog: it never
// takes focus or blocks the page.
//
// Phones: a sheet across the bottom edge, which the WhatsApp button rises
// above (data-floating-clearance). From 640px: a card in the bottom-left
// corner, away from the WhatsApp button. Either way it sits above the cookie
// bar while that shows.
export default function PasskeyPrompt() {
  const { t, isRtl } = useLang()
  const { user, onboardingComplete } = useAuth()
  const pathname = usePathname()
  const uid = user?.emailVerified ? user.uid : null
  const [shownFor, setShownFor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('offer')
  const [message, setMessage] = useState<TranslationKey | null>(null)
  const [entered, setEntered] = useState(false)
  const [lift, setLift] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const bodyId = useId()

  const onPage = isPasskeyPromptPage(pathname)
  const visible = !!uid && shownFor === uid && onPage

  // Decided once per sign-in, after onboarding, on the first page that can show it.
  useEffect(() => {
    if (!uid || onboardingComplete !== true || !onPage) return
    if (!isPasskeyOfferDue(uid) || isPasskeyPromptSnoozed(uid) || hasPasskeyHint() || isEmbeddedBrowser(navigator.userAgent)) return
    let cancelled = false
    ;(async () => {
      const { webauthn } = await passkeySupport()
      const member = auth.currentUser
      if (cancelled || !webauthn || member?.uid !== uid) return
      const passkeys = await fetchPasskeys(member).catch(() => null)
      if (cancelled) return
      clearPasskeyOffer()
      // null: passkeys are switched off here; a list: the account has one already.
      if (!passkeys || passkeys.length) return
      setPhase('offer')
      setMessage(null)
      setShownFor(uid)
    })()
    return () => {
      cancelled = true
    }
  }, [uid, onboardingComplete, onPage])

  // Slides in on the frame after it mounts.
  useEffect(() => {
    if (!visible) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [visible])

  // Above the cookie bar (or any other bar on the bottom edge), never over it.
  useEffect(() => {
    if (!visible) return
    const measure = () => {
      let next = 0
      document.querySelectorAll(`[${FLOATING_CLEARANCE_ATTR}]`).forEach((el) => {
        if (el !== boxRef.current) next = Math.max(next, bottomCoverage(el.getBoundingClientRect(), window.innerHeight))
      })
      setLift(Math.round(next))
    }
    measure()
    window.addEventListener('resize', measure)
    const mutations = new MutationObserver(measure)
    mutations.observe(document.body, { childList: true })
    return () => {
      window.removeEventListener('resize', measure)
      mutations.disconnect()
    }
  }, [visible])

  const close = (snooze: boolean) => {
    if (snooze && uid) snoozePasskeyPrompt(uid)
    setShownFor(null)
  }

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(phase !== 'added')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only reads uid
  }, [visible, phase])

  // Done: the card says so, then leaves by itself.
  useEffect(() => {
    if (phase !== 'added') return
    const timer = window.setTimeout(() => setShownFor(null), 4000)
    return () => window.clearTimeout(timer)
  }, [phase])

  const add = async () => {
    const member = auth.currentUser
    if (!member) return
    setPhase('adding')
    setMessage(null)
    try {
      const outcome = await addPasskey(member)
      if (outcome.kind === 'added') {
        setPhase('added')
        setMessage('passkeys_added')
      } else if (outcome.kind === 'cancelled') {
        setPhase('offer')
      } else if (outcome.kind === 'reauth') {
        // The sign-in is over 10 minutes old by now: Settings asks for the password first.
        setPhase('error')
        setMessage('passkeys_reauth_title')
      } else {
        setPhase('error')
        setMessage(outcome.code === 'already_registered' ? 'passkeys_err_already' : 'passkeys_err_failed')
      }
    } catch {
      setPhase('error')
      setMessage('passkeys_err_failed')
    }
  }

  if (!visible) return null

  const busy = phase === 'adding'

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      dir={isRtl ? 'rtl' : 'ltr'}
      {...{ [FLOATING_CLEARANCE_ATTR]: '' }}
      className={[
        'fixed z-[880] inset-x-0 bottom-[var(--prompt-lift)] rounded-t-3xl border border-slate-100 bg-white px-5 pt-5 shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.25)]',
        'sm:inset-x-auto sm:left-6 sm:bottom-[calc(var(--prompt-lift)+1.5rem)] sm:w-[380px] sm:rounded-2xl sm:shadow-[0_18px_50px_-12px_rgba(15,23,42,0.35)]',
        'transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      ].join(' ')}
      style={
        {
          '--prompt-lift': `${lift}px`,
          paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl bg-brandTint text-brand" aria-hidden="true">
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="7" r="4" />
            <path d="M2 21v-1a6 6 0 0 1 6-6h2.5" />
            <circle cx="17.5" cy="13.5" r="2.5" />
            <path d="M17.5 16v5M17.5 18.5h2M17.5 21h1.5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-copy font-bold leading-5 text-ink">{t('passkeyPrompt_title')}</h2>
          <p id={bodyId} className="mt-1 text-sm leading-5 text-body">{t('passkeyPrompt_body')}</p>
        </div>
        <button
          type="button"
          onClick={() => close(phase !== 'added')}
          aria-label={t('passkeyPrompt_close')}
          className="tap-target flex-shrink-0 -me-2 -mt-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 [@media(hover:hover)]:hover:bg-slate-50 [@media(hover:hover)]:hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {message && (
        <p
          role={phase === 'added' ? 'status' : 'alert'}
          className={`mt-3 rounded-xl border px-3 py-2 text-meta font-semibold ${phase === 'added' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}
        >
          {t(message)}
          {phase === 'error' && (
            <>
              {' '}
              <Link href="/settings/privacy-security" onClick={() => close(false)} className="underline underline-offset-2">
                {t('passkeyPrompt_settings')}
              </Link>
            </>
          )}
        </p>
      )}

      {phase !== 'added' && (
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={() => close(true)} disabled={busy} className="ds-btn ds-btn-secondary ds-btn-md w-full sm:flex-1">
            {t('passkeyPrompt_later')}
          </button>
          <button
            type="button"
            onClick={add}
            disabled={busy}
            aria-busy={busy || undefined}
            className="ds-btn ds-btn-primary ds-btn-md w-full inline-flex items-center justify-center gap-2 sm:flex-1"
          >
            {busy && <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />}
            {busy ? t('passkeys_adding') : t('passkeyPrompt_add')}
          </button>
        </div>
      )}
    </div>
  )
}
