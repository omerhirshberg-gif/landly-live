import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import { useAuth } from '@shared/firebase/useAuth'
import { fetchWalletAvailability, requestGoogleWalletLink, walletFailureMessage, type WalletFailure } from '@shared/wallet/walletClient'
import { canOfferWalletPass, googleWalletSupport } from '@shared/wallet/walletSupport'
import Notice from './Notice'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { GOOGLE_WALLET_BADGES } from '../lib/googleWalletBadges'
import { impact, warning } from '../lib/haptics'
import { colors } from '../theme'

type Voucher = { id: string; status: string; redeemToken: string | null; expiresAt: Date | null; externalCode?: string | null; redemptionKind?: string | null }

// Reanimated drops this under the system's Reduce Motion.
const NOTICE_IN = new Keyframe({
  from: { opacity: 0, transform: [{ translateY: 4 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }], easing: Easing.out(Easing.cubic) },
}).duration(180)

// Google's rules for the badge: its own artwork only, unmodified (never recoloured, restyled,
// animated or mirrored: an Image draws it as is, whatever the layout direction), at least 48dp
// high, with 8dp clear on every side, in the language's own version else English. It is a bitmap
// (1x/2x/3x, rendered from Google's SVG by scripts/generate-wallet-assets.mjs), not an SVG: the
// Fabric SVG renderer on Android drew the badge's fill and its hairline outline twice and doubled
// the label.
const BADGE_HEIGHT = 48
const CLEAR_SPACE = 8

// The voucher screen's way into Google Wallet, under the codes and beside Apple's (web:
// components/member/AddToGoogleWallet.tsx). Android only on the phone (iPhone shows Apple
// Wallet and nothing here); the Expo web build follows the website's rules. It opens Google's
// save link, which Android hands to the Google Wallet app. Shown only once the server says it
// can issue passes.
export default function AddToGoogleWallet({ voucher }: { voucher: Voucher }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const [now] = useState(Date.now)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<WalletFailure | null>(null)

  const supported =
    Platform.OS === 'android' ||
    (Platform.OS === 'web' && typeof navigator !== 'undefined' && googleWalletSupport(navigator.userAgent, navigator.maxTouchPoints) !== 'none')
  const eligible = canOfferWalletPass(voucher, now)

  useEffect(() => {
    if (!supported || !eligible) return
    let cancelled = false
    fetchWalletAvailability(API_BASE_URL, 'google').then((next) => {
      if (!cancelled) setAvailable(next)
    })
    return () => {
      cancelled = true
    }
  }, [supported, eligible])

  const add = async () => {
    if (!user || busy) return
    impact()
    setBusy(true)
    setNotice(null)
    try {
      const link = await requestGoogleWalletLink(await user.getIdToken(), voucher.id, API_BASE_URL)
      if (!link.ok) {
        // The one place a developer sees why; the member gets the short version.
        if (__DEV__) console.warn(`Google Wallet: ${link.reason}`)
        warning()
        setNotice(link.reason)
      } else if (Platform.OS === 'web') {
        window.location.assign(link.url)
      } else {
        await Linking.openURL(link.url)
      }
    } catch {
      warning()
      setNotice('unavailable')
    } finally {
      setBusy(false)
    }
  }

  if (!supported || !eligible || !available) return null

  const badge = GOOGLE_WALLET_BADGES[lang as keyof typeof GOOGLE_WALLET_BADGES] ?? GOOGLE_WALLET_BADGES.en
  // The artwork's own proportions: fixed height, width from its aspect ratio (each language's badge has its own).
  const width = Math.round((BADGE_HEIGHT * badge.width) / badge.height)
  const label = t('wallet_google_add_label')

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={styles.badgeRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }} onPress={add} style={styles.badge}>
            <Image source={badge.source} style={{ width, height: BADGE_HEIGHT }} resizeMode="contain" fadeDuration={0} accessibilityIgnoresInvertColors />
          </Pressable>
          {busy && <ActivityIndicator style={styles.spinner} color={colors.brand} accessibilityLabel={t('wallet_add_busy')} />}
        </View>
        {notice && (
          <Animated.View entering={NOTICE_IN}>
            <Notice tone="error" message={t(walletFailureMessage(notice))} />
          </Animated.View>
        )}
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.borderLight, marginTop: 20, marginBottom: 16 },
  row: { alignSelf: 'stretch', alignItems: 'stretch', gap: 12 },
  // Centred, never mirrored; the padding is Google's clear space, inside the tap target.
  badgeRow: { alignSelf: 'center' },
  badge: { padding: CLEAR_SPACE, minHeight: 48, justifyContent: 'center' },
  spinner: { position: 'absolute', top: 18, end: -32 },
})
