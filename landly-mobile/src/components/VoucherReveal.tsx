import { useEffect, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import AppText from './AppText'
import LineIcon from './LineIcon'
import VoucherQRCode from './VoucherQRCode'
import { useLang } from '../i18n/LangProvider'
import { success, tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// A physical card turn: slightly springy, settling without a wobble.
const FLIP_SPRING = { damping: 14, stiffness: 90 }
const FADE_MS = 200

// The voucher screen's two concealed parts (web: components/member/
// VoucherReveal.tsx): the QR code and the numeric code each sit on the back
// of a card that turns over -- 180° on its Y axis, on the UI thread -- when
// the member taps to show it at the counter. The back isn't rendered until
// the first reveal; the face turned away takes no touches and is hidden from
// screen readers. In Hebrew the card turns the other way, toward the reading
// direction; under Reduce Motion it crossfades instead.

function FlipCard({ flipped, front, back, style }: { flipped: boolean; front: ReactNode; back: ReactNode; style: ViewStyle }) {
  const { isRtl } = useLang()
  const reduced = useReducedMotion()
  // 0 shows the front, 1 the back.
  const turn = useSharedValue(0)
  const direction = isRtl ? -1 : 1

  useEffect(() => {
    turn.set(reduced ? withTiming(flipped ? 1 : 0, { duration: FADE_MS }) : withSpring(flipped ? 1 : 0, FLIP_SPRING))
  }, [flipped, reduced, turn])

  // Each face is also hidden past the halfway turn, for platforms that ignore backfaceVisibility.
  const frontStyle = useAnimatedStyle(() => {
    const value = turn.get()
    if (reduced) return { opacity: 1 - value }
    return { opacity: value < 0.5 ? 1 : 0, transform: [{ perspective: 1200 }, { rotateY: `${direction * value * 180}deg` }] }
  })
  const backStyle = useAnimatedStyle(() => {
    const value = turn.get()
    if (reduced) return { opacity: value }
    return { opacity: value < 0.5 ? 0 : 1, transform: [{ perspective: 1200 }, { rotateY: `${direction * (value * 180 - 180)}deg` }] }
  })

  return (
    <View style={style}>
      <Animated.View
        style={[styles.face, frontStyle]}
        pointerEvents={flipped ? 'none' : 'auto'}
        accessibilityElementsHidden={flipped}
        importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
      >
        {front}
      </Animated.View>
      <Animated.View
        style={[styles.face, styles.faceBack, backStyle]}
        pointerEvents={flipped ? 'auto' : 'none'}
        accessibilityElementsHidden={!flipped}
        importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
      >
        {back}
      </Animated.View>
    </View>
  )
}

/** Turns the card, with a tick; the back is rendered from the first reveal on. */
function useFlip() {
  const [shown, setShown] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const toggle = () => {
    tick()
    setRevealed(true)
    setShown((value) => !value)
  }
  return { shown, revealed, toggle }
}

/** A watermarked card until "Show QR Code"; it turns over to the scannable code, black on white. */
export function QrReveal({ redeemKey }: { redeemKey: string }) {
  const { t } = useLang()
  const { shown, revealed, toggle } = useFlip()
  return (
    <View style={styles.section}>
      <FlipCard
        flipped={shown}
        style={styles.qrCard}
        front={
          <View style={[styles.faceBody, styles.watermark]}>
            <Watermark />
            <LineIcon name="qrCode" size={72} color={colors.border} strokeWidth={1.6} />
            <AppText style={styles.qrPrompt}>{t('voucher_qr_tap_reveal')}</AppText>
            <AppText style={styles.qrHidden}>{t('voucher_qr_hidden')}</AppText>
            <RevealButton primary icon="qrCode" label={t('voucher_show_qr')} expanded={false} onPress={toggle} />
          </View>
        }
        back={
          <View style={styles.faceBody}>
            {revealed && <VoucherQRCode redeemKey={redeemKey} size={208} />}
            <AppText style={styles.hint}>{t('voucher_qr_label')}</AppText>
            <RevealButton icon="close" label={t('voucher_hide_qr')} expanded onPress={toggle} />
          </View>
        }
      />
    </View>
  )
}

/** The redemption code masked as dots until "Show Code"; the card turns over to the code and its copy button. */
export function CodeReveal({ code }: { code: string }) {
  const { t } = useLang()
  const { shown, revealed, toggle } = useFlip()
  return (
    <View style={styles.section}>
      <AppText style={styles.codeLabel}>{t('voucher_redemption_code_label')}</AppText>
      <FlipCard
        flipped={shown}
        style={styles.codeCard}
        front={
          <View style={[styles.faceBody, styles.watermark]}>
            <Watermark />
            <AppText ltr style={[styles.code, styles.codeMasked]} accessibilityLabel={t('voucher_code_hidden')}>
              {'•'.repeat(Math.max(code.length, 8))}
            </AppText>
            <RevealButton icon="lock" label={t('voucher_show_code')} expanded={false} onPress={toggle} />
          </View>
        }
        back={
          <View style={styles.faceBody}>
            {revealed && <AppText ltr style={styles.code} selectable>{code}</AppText>}
            <View style={styles.codeActions}>
              <RevealButton icon="close" label={t('voucher_hide_code')} expanded onPress={toggle} />
              {revealed && <CopyCodeButton code={code} />}
            </View>
          </View>
        }
      />
    </View>
  )
}

/** A faint diagonal weave behind the concealed side, like the security print on a ticket. */
function Watermark() {
  return (
    <View style={styles.weave} pointerEvents="none">
      {Array.from({ length: 14 }, (_, i) => (
        <View key={i} style={[styles.weaveLine, { left: i * 28 - 120 }]} />
      ))}
    </View>
  )
}

function RevealButton({ label, icon, primary, expanded, onPress }: {
  label: string
  icon: 'qrCode' | 'close' | 'lock'
  primary?: boolean
  expanded: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      style={({ pressed }) => [styles.button, primary ? styles.buttonPrimary : styles.buttonOutline, pressed && (primary ? styles.buttonPrimaryPressed : styles.buttonOutlinePressed)]}
    >
      <LineIcon name={icon} size={16} color={primary ? colors.white : colors.text} strokeWidth={2.2} />
      <AppText style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</AppText>
    </Pressable>
  )
}

function CopyCodeButton({ code }: { code: string }) {
  const { t } = useLang()
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    AccessibilityInfo.announceForAccessibility(t(status === 'copied' ? 'voucher_code_copied' : 'voucher_copy_failed'))
    const timer = setTimeout(() => setStatus('idle'), 2000)
    return () => clearTimeout(timer)
  }, [status, t])

  const copy = async () => {
    try {
      const copied = await Clipboard.setStringAsync(code)
      if (copied) success()
      setStatus(copied ? 'copied' : 'failed')
    } catch {
      setStatus('failed')
    }
  }

  const label = status === 'copied' ? t('voucher_code_copied') : status === 'failed' ? t('voucher_copy_failed') : t('voucher_copy_code')
  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={t('voucher_copy_code')}
      style={({ pressed }) => [styles.button, styles.copy, pressed && styles.copyPressed]}
    >
      <LineIcon
        name={status === 'copied' ? 'check' : status === 'failed' ? 'close' : 'copy'}
        size={16}
        color={status === 'failed' ? colors.danger : status === 'copied' ? colors.success : colors.brand}
        strokeWidth={2.2}
      />
      <AppText style={styles.copyText}>{label}</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', alignSelf: 'stretch' },
  // Both faces fill the card; its size is fixed so the turn never reflows the screen.
  qrCard: { width: 288, maxWidth: '100%', height: 372 },
  codeCard: { width: 320, maxWidth: '100%', minHeight: 216 },
  face: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  faceBack: { ...StyleSheet.absoluteFill },
  faceBody: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 18 },
  watermark: { backgroundColor: colors.background },
  weave: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  weaveLine: { position: 'absolute', top: -60, width: 10, height: 520, backgroundColor: colors.borderLight, transform: [{ rotate: '45deg' }] },
  qrPrompt: { fontSize: 14, fontWeight: '700', color: colors.text, textAlign: 'center', maxWidth: 220, marginTop: 14 },
  qrHidden: { fontSize: 12, color: colors.textMuted, textAlign: 'center', maxWidth: 200, marginTop: 4 },
  hint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
  codeLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  code: { fontSize: 30, fontWeight: '900', color: colors.textStrong, letterSpacing: 5, textAlign: 'center' },
  codeMasked: { color: colors.border },
  codeActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 8 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    marginTop: 14,
    borderRadius: radius.pill,
    ...webOnly({ cursor: 'pointer' }),
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonPrimaryPressed: { backgroundColor: colors.brandDark },
  buttonOutline: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  buttonOutlinePressed: { backgroundColor: colors.borderLight },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  buttonTextPrimary: { color: colors.white },
  copy: { backgroundColor: colors.brandTint },
  copyPressed: { backgroundColor: colors.brandLight },
  copyText: { fontSize: 14, fontWeight: '700', color: colors.brand },
})
