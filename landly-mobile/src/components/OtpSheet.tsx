import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import * as Clipboard from 'expo-clipboard'
import type { User } from 'firebase/auth'
import {
  CONTACT_CHANGE_FAILED,
  contactChangeErrorKey,
  finishEmailChange,
  requestPhoneChange,
  resendEmailChange,
  resendEndsChange,
  verifyEmailCode,
  verifyPhoneCode,
  type ContactChangeFailure,
  type ContactChangeResult,
  type EmailChangeStart,
  type PhoneChangeStart,
} from '@shared/account/contactChange'
import { auth } from '@shared/firebase/config'
import { formatPhone } from '@shared/auth/onboarding'
import { normalizeOtpInput, OTP_LENGTH, type OtpTarget } from '@shared/auth/otp'
import { useResendCountdown } from '@shared/auth/useResendCountdown'
import AppText from './AppText'
import Button from './Button'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { success as successHaptic } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

const ENTER_MS = 280
const EXIT_MS = 220
const FOCUS_DELAY_MS = ENTER_MS + 20

// The 6-digit code for a pending change in the Profile tab (web:
// components/profile/OtpDialog.tsx): "Verify via WhatsApp" for a new phone
// number, or the code emailed to a new address, in a bottom sheet that slides
// up over a fading scrim (Reanimated; still under the OS's reduced-motion
// setting) and rides above the keyboard. The Modal stays up until the slide
// out has finished. A Modal is its own layout root, so the language's
// direction is set again on the sheet; the digits are always left-to-right.
//
// One real TextInput lies over six drawn boxes, so the iOS/Android
// one-time-code suggestion, a pasted message and screen readers all meet a
// single field; the sixth digit submits. "Paste" reads the clipboard for a
// code copied out of WhatsApp or the email. "Resend code" counts down 60 seconds. The
// whole sheet fits above the keyboard on a 4.7" iPhone SE.
export default function OtpSheet({
  user,
  target,
  resendIn,
  onClose,
  onVerified,
  onEnded,
}: {
  user: User
  /** The pending E.164 number or email address. */
  target: OtpTarget
  /** Seconds before "Resend code" is allowed (from the send that opened this). */
  resendIn: number
  onClose: () => void
  onVerified: () => void
  /** A resend ended the change (resendEndsChange): closes here, and the profile screen shows `message`. */
  onEnded: (message: string) => void
}) {
  const { t, lang, isRtl } = useLang()
  const insets = useSafeAreaInsets()
  const inputRef = useRef<TextInput>(null)
  const [shown, setShown] = useState(true)
  const [code, setCode] = useState('')
  const [focused, setFocused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const { secondsLeft, restart } = useResendCountdown(resendIn)
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Focused once the sheet has slid in, so the keyboard doesn't race the animation.
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS)
    return () => {
      clearTimeout(timer)
      clearTimeout(closing.current)
    }
  }, [])

  const dismiss = (then: () => void) => {
    inputRef.current?.blur()
    setShown(false)
    closing.current = setTimeout(then, EXIT_MS)
  }

  const close = () => {
    if (!busy && shown) dismiss(onClose)
  }

  const isEmail = target.kind === 'email'
  const display = target.kind === 'email' ? target.email : formatPhone(target.phone)

  const failure = (result: ContactChangeFailure) => {
    const message = t(contactChangeErrorKey(result.reason, target.kind))
    return result.reason === 'invalidCode' && result.attemptsLeft
      ? `${message} ${t('otp_attempts_left').replace('{count}', String(result.attemptsLeft))}`
      : message
  }

  const verify = async (value: string) => {
    if (value.length !== OTP_LENGTH || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const result = await user
      .getIdToken()
      .then<ContactChangeResult<{ customToken?: string }>>((idToken) => (isEmail ? verifyEmailCode(idToken, value, API_BASE_URL) : verifyPhoneCode(idToken, value, API_BASE_URL)))
      .catch(() => CONTACT_CHANGE_FAILED)
    if (result.ok) {
      // Every session just ended with the email change; this one signs back in.
      if (isEmail) await finishEmailChange(auth, user, 'customToken' in result ? result.customToken : undefined).catch(() => {})
      setBusy(false)
      successHaptic()
      dismiss(onVerified)
      return
    }
    setBusy(false)
    setError(failure(result))
    setCode('')
    inputRef.current?.focus()
  }

  const resend = async () => {
    if (secondsLeft > 0 || resending) return
    setResending(true)
    setError(null)
    setNotice(null)
    const result = await user
      .getIdToken()
      .then<ContactChangeResult<EmailChangeStart> | ContactChangeResult<PhoneChangeStart>>((idToken) =>
        target.kind === 'email'
          ? resendEmailChange(idToken, lang, API_BASE_URL)
          : requestPhoneChange(idToken, { phone: target.phone, lang, channel: 'whatsapp' }, API_BASE_URL)
      )
      .catch(() => CONTACT_CHANGE_FAILED)
    setResending(false)
    if (result.ok) {
      if ('mode' in result && result.mode === 'direct') {
        dismiss(onClose)
        return
      }
      restart('resendIn' in result ? result.resendIn : 0)
      setCode('')
      // LRI…PDI: the number or address stays left-to-right inside a Hebrew sentence.
      setNotice(isEmail ? t('pending_email_body').replace('{email}', `⁦${display}⁩`) : t('pending_phone_body').replace('{phone}', `⁦${display}⁩`))
      inputRef.current?.focus()
      return
    }
    if (resendEndsChange(result.reason)) {
      dismiss(() => onEnded(failure(result)))
      return
    }
    if (result.retryAfter) restart(result.retryAfter)
    setError(failure(result))
  }

  const onChange = (raw: string) => {
    const next = normalizeOtpInput(raw)
    setCode(next)
    setError(null)
    if (next.length === OTP_LENGTH) verify(next)
  }

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '')
    const pasted = normalizeOtpInput(text)
    if (pasted) onChange(pasted)
    else inputRef.current?.focus()
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {shown && (
          <Animated.View entering={FadeIn.duration(ENTER_MS)} exiting={FadeOut.duration(EXIT_MS)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.scrim} onPress={close} accessibilityRole="button" accessibilityLabel={t('otp_close')} />
          </Animated.View>
        )}
        {shown && (
          <Animated.View
            entering={SlideInDown.duration(ENTER_MS).easing(Easing.out(Easing.cubic))}
            exiting={SlideOutDown.duration(EXIT_MS).easing(Easing.in(Easing.cubic))}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), direction: isRtl ? 'rtl' : 'ltr' }]}
            accessibilityViewIsModal
          >
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={[styles.badge, isEmail && styles.badgeEmail]}>
                <LineIcon name={isEmail ? 'mail' : 'chat'} size={20} color={isEmail ? colors.brand : colors.whatsapp} />
              </View>
              <AppText accessibilityRole="header" style={styles.title}>{t(isEmail ? 'otp_email_title' : 'otp_title')}</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('otp_close')}
                onPress={close}
                disabled={busy}
                hitSlop={6}
                style={({ pressed }) => [styles.closeButton, pressed && styles.closePressed]}
              >
                <LineIcon name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <AppText style={styles.subtitle}>
              {t(isEmail ? 'otp_email_subtitle' : 'otp_subtitle')}{' '}
              <AppText style={styles.number}>{`⁦${display}⁩`}</AppText>
            </AppText>

            <View style={styles.boxesWrap}>
              <View style={styles.boxes} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {Array.from({ length: OTP_LENGTH }, (_, i) => {
                  const active = focused && (i === code.length || (i === OTP_LENGTH - 1 && code.length === OTP_LENGTH))
                  return (
                    <View key={i} style={[styles.box, !!code[i] && styles.boxFilled, active && styles.boxActive, !!error && styles.boxError]}>
                      <AppText ltr style={styles.digit}>{code[i] ?? ''}</AppText>
                    </View>
                  )
                })}
              </View>
              <TextInput
                ref={inputRef}
                value={code}
                onChangeText={onChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                editable={!busy}
                caretHidden
                contextMenuHidden={false}
                accessibilityLabel={t('otp_input_label')}
                style={styles.hiddenInput}
              />
            </View>

            {error ? (
              <AppText accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.error}>{error}</AppText>
            ) : notice ? (
              <AppText accessibilityLiveRegion="polite" style={styles.notice}>{notice}</AppText>
            ) : null}

            <View style={styles.verify}>
              <Button label={t('otp_verify_btn')} onPress={() => verify(code)} busy={busy} disabled={code.length !== OTP_LENGTH} />
            </View>
            <View style={styles.links}>
              <Pressable accessibilityRole="button" onPress={paste} disabled={busy} hitSlop={4} style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}>
                <LineIcon name="copy" size={16} color={colors.brand} />
                <AppText style={styles.linkText}>{t('otp_paste_btn')}</AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: secondsLeft > 0 || resending || busy }}
                onPress={resend}
                disabled={secondsLeft > 0 || resending || busy}
                hitSlop={4}
                style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
              >
                <AppText style={[styles.linkText, (secondsLeft > 0 || resending) && styles.linkDisabled]}>
                  {resending ? '…' : secondsLeft > 0 ? t('otp_resend_in').replace('{seconds}', String(secondsLeft)) : t('otp_resend_btn')}
                </AppText>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { flex: 1, backgroundColor: 'rgba(11, 27, 61, 0.32)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 20,
    ...webOnly({ width: '100%', maxWidth: 480, alignSelf: 'center' }),
  },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.whatsappBg, alignItems: 'center', justifyContent: 'center' },
  badgeEmail: { backgroundColor: colors.brandLight },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.heading },
  closeButton: { width: 44, height: 44, marginEnd: -10, borderRadius: 22, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  closePressed: { backgroundColor: colors.borderLight },
  subtitle: { marginTop: 8, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  number: { fontWeight: '700', color: colors.text },
  boxesWrap: { marginTop: 18, position: 'relative' },
  // Digits read left-to-right in every language.
  boxes: { flexDirection: 'row', direction: 'ltr', gap: 8 },
  box: {
    flex: 1,
    height: 54,
    maxWidth: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.textFaint },
  boxActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  boxError: { borderColor: colors.dangerBorder },
  digit: { fontSize: 24, fontWeight: '700', color: colors.heading },
  // Covers the boxes, so a tap anywhere on them focuses it; 16px so the Expo web build never zooms.
  hiddenInput: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    end: 0,
    opacity: 0,
    color: 'transparent',
    fontSize: 16,
    ...webOnly({ cursor: 'text' }),
  },
  error: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.danger },
  notice: { marginTop: 10, fontSize: 13, fontWeight: '600', color: colors.success },
  verify: { marginTop: 16 },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  link: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, borderRadius: radius.md, ...webOnly({ cursor: 'pointer' }) },
  linkPressed: { opacity: 0.7 },
  linkText: { fontSize: 14, fontWeight: '600', color: colors.brand },
  linkDisabled: { color: colors.textFaint },
})
