'use client'

import { useEffect, useState } from 'react'
import { LoaderCircle, Wallet } from 'lucide-react'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'
import { fetchWalletAvailability, requestGoogleWalletLink, walletFailureMessage, type WalletFailure } from '@/lib/wallet/walletClient'
import { canOfferWalletPass, googleWalletBadgePath, googleWalletSupport, type GoogleWalletSupport } from '@/lib/wallet/walletSupport'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// The voucher page's way into Google Wallet, beside Apple's (AddToAppleWallet.tsx): Google's
// own "Add to Google Wallet" badge on Android and on desktop browsers, nothing on iPhone and
// iPad (Apple Wallet only there). It stays away until the server says it can issue passes
// (app/api/wallet/google/availability), so it never offers what can't work. The link opened is
// Google's save page; signed in there, the pass lands in the member's Google account and syncs
// to their phone.
//
// Google's rules for the badge: its own artwork only, unmodified (never recoloured, restyled,
// animated or mirrored), at least 48px high, with 8px clear on every side, and the language's
// own version where one exists, else English. The padding below is that clear space, inside the
// button so taps there still count.
export default function AddToGoogleWallet({ voucher }: {
  voucher: { id: string; status: string; redeemToken: string | null; expiresAt: Date | null; externalCode?: string | null; redemptionKind?: string | null }
}) {
  const { t } = useLang()
  const [support, setSupport] = useState<GoogleWalletSupport | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<WalletFailure | null>(null)
  const [desktop, setDesktop] = useState(false)

  const eligible = canOfferWalletPass(voucher, Date.now())

  useEffect(() => {
    if (!eligible) return
    const device = googleWalletSupport(navigator.userAgent, navigator.maxTouchPoints)
    if (device === 'none') return
    let cancelled = false
    fetchWalletAvailability('', 'google').then((available) => {
      if (cancelled || !available) return
      setSupport(device)
      setDesktop(!/Android/i.test(navigator.userAgent))
    })
    return () => { cancelled = true }
  }, [eligible])

  const add = async () => {
    const member = auth.currentUser
    if (!member || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const link = await requestGoogleWalletLink(await member.getIdToken(), voucher.id, '')
      if (!link.ok) setNotice(link.reason)
      // A plain navigation to Google's save page: on Android it hands over to Google Wallet.
      else window.location.assign(link.url)
    } catch {
      setNotice('unavailable')
    } finally {
      setBusy(false)
    }
  }

  if (!eligible || !support) return null

  return (
    <div className="wallet-section mt-6 flex flex-col items-center gap-3 border-t border-slate-100 pt-5 text-center [.wallet-section+&]:mt-0 [.wallet-section+&]:border-0 [.wallet-section+&]:pt-0">
      <div className="relative">
        <GoogleBadge busy={busy} onPress={add} />
        {busy && (
          <span role="status" className="absolute start-full top-1/2 ms-2 -translate-y-1/2">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none" strokeWidth={1.75} />
            <span className="sr-only">{t('wallet_add_busy')}</span>
          </span>
        )}
      </div>
      {support === 'in-app' && <p className="max-w-xs text-xs text-slate-500">{t('wallet_google_open_in_chrome')}</p>}
      {desktop && <p className="max-w-xs text-xs text-slate-500">{t('wallet_google_desktop_hint')}</p>}
      {notice && (
        <p role="alert" className="wallet-notice max-w-xs text-xs font-semibold [text-wrap:balance] text-red-600">
          {t(walletFailureMessage(notice))}
        </p>
      )}
    </div>
  )
}

/** The member's language, then English (Google's rule); with neither file, a plain button that doesn't imitate it. */
function GoogleBadge({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const { t, lang } = useLang()
  const [attempt, setAttempt] = useState<0 | 1 | 2>(lang === 'en' ? 1 : 0)
  const label = t('wallet_google_add_label')

  if (attempt === 2) {
    return (
      <button type="button" onClick={onPress} aria-busy={busy} className="ds-btn ds-btn-md ds-btn-secondary">
        <Wallet aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button type="button" onClick={onPress} aria-busy={busy} aria-label={label} className={`block rounded-full p-2 ${FOCUS}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={googleWalletBadgePath(attempt === 0 ? lang : 'en')}
        alt=""
        draggable={false}
        height={48}
        onError={() => setAttempt((value) => (value === 0 ? 1 : 2))}
        className="block h-12 w-auto max-w-full"
      />
    </button>
  )
}
