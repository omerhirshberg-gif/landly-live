import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { mergeOtpInput, OTP_LENGTH } from '@shared/auth/otp'
import AppText from './AppText'
import { warning as warningHaptic } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

export interface OtpCodeInputHandle {
  focus: () => void
  /** Drops the keyboard for good: the field is not refocused when it is enabled again. */
  blur: () => void
  /** A wrong code: a short sideways shake and the error haptic. The shake is skipped under Reduce Motion. */
  shake: () => void
}

// Offsets (px) and step length of the wrong-code shake: a decaying side to side, about 300 ms in all.
const SHAKE_OFFSETS = [-10, 8, -6, 4, 0]
const SHAKE_STEP_MS = 60

// Six drawn boxes over one real TextInput (the web twin is
// components/auth/OtpCodeInput.tsx): the iOS/Android one-time-code
// suggestion, a pasted message and screen readers all meet a single field,
// the value is one string, and Backspace simply removes the last digit.
// mergeOtpInput turns whatever arrives (typing, an autofill, a paste with
// spaces or dashes, a paste over a partial code) into at most six digits.
// The boxes read left-to-right in every language. While `disabled` (a
// request is out) the field is not editable; when it is enabled again the
// keyboard comes back if it had been up, so a wrong code or a resend never
// leaves the member tapping the boxes.
const OtpCodeInput = forwardRef<OtpCodeInputHandle, {
  value: string
  onChange: (next: string) => void
  error?: boolean
  disabled?: boolean
  label: string
}>(function OtpCodeInput({ value, onChange, error = false, disabled = false, label }, ref) {
  const inputRef = useRef<TextInput>(null)
  const [focused, setFocused] = useState(false)
  const keyboardUp = useRef(false)
  const reduced = useReducedMotion()
  const offset = useSharedValue(0)
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
      blur: () => {
        keyboardUp.current = false
        inputRef.current?.blur()
      },
      shake: () => {
        warningHaptic()
        if (reduced) return
        offset.set(withSequence(...SHAKE_OFFSETS.map((x) => withTiming(x, { duration: SHAKE_STEP_MS }))))
      },
    }),
    [offset, reduced]
  )

  // The keyboard returns once a request has finished (the field was not editable meanwhile).
  useEffect(() => {
    if (!disabled && keyboardUp.current) inputRef.current?.focus()
  }, [disabled])

  const handleChange = useCallback((raw: string) => onChange(mergeOtpInput(value, raw)), [onChange, value])

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.boxes, rowStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const active = focused && (i === value.length || (i === OTP_LENGTH - 1 && value.length === OTP_LENGTH))
          return (
            <View key={i} style={[styles.box, !!value[i] && styles.boxFilled, active && styles.boxActive, error && styles.boxError]}>
              <AppText ltr style={styles.digit}>{value[i] ?? ''}</AppText>
            </View>
          )
        })}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => {
          keyboardUp.current = true
          setFocused(true)
        }}
        onBlur={() => {
          // A field switched off by `disabled` loses focus without the member leaving it.
          if (!disabled) keyboardUp.current = false
          setFocused(false)
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        editable={!disabled}
        caretHidden
        contextMenuHidden={false}
        accessibilityLabel={label}
        style={styles.hiddenInput}
      />
    </View>
  )
})

export default OtpCodeInput

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
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
})
