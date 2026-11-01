'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle, Smartphone, Wallet } from 'lucide-react'
import QRCode from 'qrcode'
import { auth } from '@/lib/firebase/config'
import { useLang } from '@/lib/i18n/useLang'
import { fetchWalletAvailability, requestWalletPass, walletFailureMessage, type WalletFailure } from '@/lib/wallet/walletClient'
import { canOfferWalletPass, walletBadgePath, walletSupport, type WalletSupport } from '@/lib/wallet/walletSupport'

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

// The voucher page's way into Apple Wallet, under the codes: Apple's own badge
// on iPhone, iPad and Mac Safari, a quiet hand-off to the phone on a desktop
// browser, and nothing on Android. It stays away until the server says it can
// sign passes (app/api/wallet/apple/availability), so it never offers what
// can't work.
//
// Apple's rules for the badge: its own artwork only, at its own proportions,
// with 0.1 of its height clear around it, and no dimming, shadow, hover
// effect or animation. At 48px high it clears the 44px touch target by itself;
// the padding is its clear space, inside the button so taps there still count. So it has none of the page's hover lifts, and stays at
// full strength while the pass loads. Being artwork it never mirrors in
// Hebrew; it's centred, so nothing around it has to.
export default function AddToAppleWallet({ voucher }: {
  voucher: { id: string; status: string; redeemToken: string | null; expiresAt: Date | null }
}) {
  const { t } = useLang()
  // Known only in the browser; null renders nothing, on the server too.
  const [support, setSupport] = useState<WalletSupport | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<WalletFailure | 'mock' | null>(null)

  const eligible = canOfferWalletPass(voucher, Date.now())

  useEffect(() => {
    if (!eligible) return
    const device = walletSupport(navigator.userAgent, navigator.maxTouchPoints)
    if (device === 'none') return
    let cancelled = false
    fetchWalletAvailability('').then((available) => {
      if (!cancelled && available) setSupport(device)
    })
    return () => { cancelled = true }
  }, [eligible])

  const add = async () => {
    const member = auth.currentUser
    if (!member || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const link = await requestWalletPass(await member.getIdToken(), voucher.id, '')
      if (!link.ok) {
        setNotice(link.reason)
      } else if (link.mock) {
        // Local development with no certificates: Wallet would refuse it, so
        // this only proves the whole path up to the file works.
        setNotice((await fetch(link.url)).ok ? 'mock' : 'passDownload')
      } else {
        // A plain navigation: iOS turns it into Wallet's preview; a blob wouldn't.
        window.location.assign(link.url)
      }
    } catch {
      setNotice('unavailable')
    } finally {
      setBusy(false)
    }
  }

  if (!eligible || !support) return null

  return (
    <div className="mt-6 flex flex-col items-center gap-3 border-t border-slate-100 pt-6 text-center">
      {support === 'handoff' ? (
        <IPhoneHandoff voucherId={voucher.id} />
      ) : (
        <>
          <div className="relative">
            <WalletBadge busy={busy} onPress={add} />
            {busy && (
              <span role="status" className="absolute start-full top-1/2 ms-2 -translate-y-1/2">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin text-brand motion-reduce:animate-none" strokeWidth={1.75} />
                <span className="sr-only">{t('wallet_add_busy')}</span>
              </span>
            )}
          </div>
          {support === 'in-app' && <p className="max-w-xs text-xs text-slate-500">{t('wallet_open_in_safari')}</p>}
        </>
      )}
      {notice && (
        <p role={notice === 'mock' ? 'status' : 'alert'} className={`wallet-notice max-w-xs text-xs font-semibold [text-wrap:balance] ${notice === 'mock' ? 'text-slate-500' : 'text-red-600'}`}>
          {t(notice === 'mock' ? 'wallet_mock_notice' : walletFailureMessage(notice))}
        </p>
      )}
    </div>
  )
}

/**
 * The member's language, then English, the badge's two tries; with neither file
 * in public/wallet/ yet, a plain button that doesn't imitate it. Height is
 * fixed and width follows, so the artwork keeps its own proportions.
 */
function WalletBadge({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  const { t, lang } = useLang()
  const [attempt, setAttempt] = useState<0 | 1 | 2>(lang === 'en' ? 1 : 0)
  const label = t('wallet_add_label')

  if (attempt === 2) {
    return (
      <button type="button" onClick={onPress} aria-busy={busy} className="ds-btn ds-btn-md ds-btn-secondary">
        <Wallet aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        <span>{label}</span>
      </button>
    )
  }
  return (
    <button type="button" onClick={onPress} aria-busy={busy} aria-label={label} className={`block rounded-lg p-1.5 ${FOCUS}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={walletBadgePath(attempt === 0 ? lang : 'en')}
        alt=""
        draggable={false}
        onError={() => setAttempt((value) => (value === 0 ? 1 : 2))}
        className="block h-12 w-auto max-w-full"
      />
    </button>
  )
}

/**
 * On a desktop browser: a link that opens a QR code of this voucher's page, to
 * finish on a phone. It's the page's address, behind sign-in, and never the
 * redemption code, so the dialog is safe to leave open on a shared screen.
 */
function IPhoneHandoff({ voucherId }: { voucherId: string }) {
  const { t } = useLang()
  const dialog = useRef<HTMLDialogElement>(null)
  const [qr, setQr] = useState<string | null>(null)

  const open = () => {
    dialog.current?.showModal()
    if (qr) return
    QRCode.toDataURL(`${window.location.origin}/member/vouchers/${encodeURIComponent(voucherId)}`, { margin: 1, width: 400, color: { dark: '#000000', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(null))
  }

  return (
    <>
      <button type="button" onClick={open} className={`inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-slate-600 transition-colors [@media(hover:hover)]:hover:text-brand ${FOCUS}`}>
        <Smartphone aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
        <span>{t('wallet_on_iphone_trigger')}</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="wallet-handoff-title"
        onClick={(event) => { if (event.target === dialog.current) dialog.current?.close() }}
        className="wallet-dialog m-auto w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-slate-200/80 bg-white p-0 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <h2 id="wallet-handoff-title" className="text-lg font-bold tracking-tight text-ink">{t('wallet_on_iphone_title')}</h2>
          <p className="text-sm text-slate-600">{t('wallet_on_iphone_body')}</p>
          {qr
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={qr} alt="" width={200} height={200} className="rounded-lg" />
            : <div className="h-[200px] w-[200px] rounded-lg bg-slate-100 animate-pulse motion-reduce:animate-none" />}
          <button type="button" onClick={() => dialog.current?.close()} className="ds-btn ds-btn-md ds-btn-secondary mt-1 w-full">
            {t('wallet_on_iphone_close')}
          </button>
        </div>
      </dialog>
    </>
  )
}
