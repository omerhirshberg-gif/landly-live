import { useEffect, useState } from 'react'
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '@shared/firebase/useAuth'
import { fetchWalletAvailability, nativePassFailure, requestWalletPass, walletFailureMessage, type WalletFailure } from '@shared/wallet/walletClient'
import { canOfferWalletPass } from '@shared/wallet/walletSupport'
import { AppleWallet, AppleWalletButton } from '../../modules/apple-wallet'
import Button from './Button'
import Notice from './Notice'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { impact, success, warning } from '../lib/haptics'
import { colors } from '../theme'

type Voucher = { id: string; status: string; redeemToken: string | null; expiresAt: Date | null }

// Reanimated drops this under the system's Reduce Motion.
const NOTICE_IN = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 4 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(180)

// The voucher screen's way into Apple Wallet, under the codes (web:
// components/member/AddToAppleWallet.tsx). On iPhone it's the system's own
// PKAddPassButton (modules/apple-wallet), which follows the device's language
// rather than the app's. Without that module, as in Expo Go, a plain button
// opens the pass in the in-app browser, which hands it to Wallet. Nothing on
// Android. Shown only once the server says it can sign passes.
export default function AddToAppleWallet({ voucher }: { voucher: Voucher }) {
  const { t } = useLang()
  const { user } = useAuth()
  const [now] = useState(Date.now)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<WalletFailure | 'mock' | null>(null)

  const supported = Platform.OS === 'ios' && (AppleWallet?.canAddPasses() ?? true)
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

  const fail = (reason: WalletFailure, detail?: string) => {
    // The one place a developer sees why; the member gets the short version.
    if (__DEV__) console.warn(`Apple Wallet: ${reason}`, detail ?? '')
    warning()
    setNotice(reason)
  }

  const add = async () => {
    if (!user || busy) return
    impact()
    setBusy(true)
    setNotice(null)
    try {
      const link = await requestWalletPass(await user.getIdToken(), voucher.id, API_BASE_URL)
      if (!link.ok) {
        fail(link.reason)
      } else if (link.mock) {
        // Local development with no certificates: Wallet would refuse it.
        if ((await fetch(link.url)).ok) setNotice('mock')
        else fail('passDownload')
      } else if (AppleWallet) {
        await AppleWallet.addPass(link.url)
        success()
      } else {
        await WebBrowser.openBrowserAsync(link.url)
      }
    } catch (error) {
      const { code, message } = error as { code?: unknown; message?: string }
      fail(nativePassFailure(code), message)
    } finally {
      setBusy(false)
    }
  }

  if (!supported || !eligible || !available) return null

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.row}>
        {AppleWalletButton ? (
          <View style={styles.badge}>
            <AppleWalletButton style={StyleSheet.absoluteFill} onAddPress={add} />
            {busy && <ActivityIndicator style={styles.spinner} color={colors.brand} accessibilityLabel={t('wallet_add_busy')} />}
          </View>
        ) : (
          <Button label={t('wallet_add_label')} variant="secondary" busy={busy} onPress={add} />
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

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 24 },
  row: { alignItems: 'center', gap: 12 },
  // The system button draws to this frame: 48 high like the web badge, never stretched to the card.
  badge: { height: 48, width: 240 },
  spinner: { position: 'absolute', top: 14, end: -32 },
})
