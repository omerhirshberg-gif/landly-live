import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import { useAuth } from '@shared/firebase/useAuth'
import { fetchWalletAvailability, requestWalletPass, walletFailureMessage, type WalletFailure } from '@shared/wallet/walletClient'
import { canOfferWalletPass, walletBadgePath, walletSupport } from '@shared/wallet/walletSupport'
import Button from './Button'
import Notice from './Notice'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { colors } from '../theme'

type Voucher = { id: string; status: string; redeemToken: string | null; expiresAt: Date | null }

// Reanimated drops this under the system's Reduce Motion.
const NOTICE_IN = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 4 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(180)

// The Expo web build: the same decision as the website, on Apple's browsers
// only. A plain navigation to the pass is what opens Wallet's preview.
export default function AddToAppleWallet({ voucher }: { voucher: Voucher }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [now] = useState(Date.now)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<WalletFailure | 'mock' | null>(null)
  // As on the website: the member's language, English, then a plain button.
  const [badgeAttempt, setBadgeAttempt] = useState<0 | 1 | 2>(lang === 'en' ? 1 : 0)

  const device = walletSupport(navigator.userAgent, navigator.maxTouchPoints)
  const supported = device === 'badge' || device === 'in-app'
  const eligible = canOfferWalletPass(voucher, now)

  useEffect(() => {
    if (!supported || !eligible) return
    let cancelled = false
    fetchWalletAvailability(API_BASE_URL).then((next) => {
      if (!cancelled) setAvailable(next)
    })
    return () => {
      cancelled = true
    }
  }, [supported, eligible])

  const add = async () => {
    if (!user || busy) return
    setBusy(true)
    setNotice(null)
    try {
      const link = await requestWalletPass(await user.getIdToken(), voucher.id, API_BASE_URL)
      if (!link.ok) setNotice(link.reason)
      else if (link.mock) setNotice('mock')
      else window.location.assign(link.url)
    } catch {
      setNotice('unavailable')
    } finally {
      setBusy(false)
    }
  }

  if (!supported || !eligible || !available) return null

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.row}>
        {badgeAttempt === 2 ? (
          <Button label={t('wallet_add_label')} variant="secondary" busy={busy} onPress={add} />
        ) : (
          // Apple's artwork from the web app, untouched: fixed height, its own width, and the padding is its clear space.
          <button type="button" onClick={add} aria-busy={busy} aria-label={t('wallet_add_label')} style={BADGE_BUTTON}>
            <img
              src={`${API_BASE_URL}${walletBadgePath(badgeAttempt === 0 ? lang : 'en')}`}
              alt=""
              draggable={false}
              onError={() => setBadgeAttempt((value) => (value === 0 ? 1 : 2))}
              style={BADGE_IMAGE}
            />
          </button>
        )}
        {notice && (
          <Animated.View entering={NOTICE_IN}>
            <Notice tone={notice === 'mock' ? 'info' : 'error'} message={t(notice === 'mock' ? 'wallet_mock_notice' : walletFailureMessage(notice))} />
          </Animated.View>
        )}
      </View>
    </>
  )
}

const BADGE_BUTTON = { display: 'block', padding: 6, border: 0, background: 'none', cursor: 'pointer' } as const
const BADGE_IMAGE = { display: 'block', height: 48, width: 'auto', maxWidth: '100%' } as const

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 24 },
  row: { alignItems: 'center', gap: 12 },
})
