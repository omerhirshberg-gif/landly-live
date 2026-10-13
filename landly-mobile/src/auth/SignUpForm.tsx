import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { requestVerificationEmail } from '@shared/auth/requestVerificationEmail'
import { CUSTOMER_TYPES } from '@shared/customerTypes'
import { auth } from '@shared/firebase/config'
import { getAuthErrorMessage } from '@shared/firebase/authErrors'
import { createUserDocument } from '@shared/firebase/users'
import AppText from '../components/AppText'
import Button from '../components/Button'
import Notice from '../components/Notice'
import TextField from '../components/TextField'
import { useSignInGate } from './SignInGate'
import type { PendingVerification } from './VerifyEmailCard'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// Numbers without a "+country" prefix are read as Israeli, matching the web
// form's defaultCountry="IL"; the stored value is E.164 either way, exactly
// what react-phone-number-input saves on the web (same libphonenumber-js).
function toE164(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, 'IL')
  return parsed?.isValid() ? parsed.number : null
}

type FieldErrors = Partial<Record<'fullName' | 'customerType' | 'phone', string>>

// Native counterpart of app/signup/page.tsx's email flow: same fields, same
// user document, same verify-then-sign-in rule. On success the account is
// signed straight back out and `onPendingVerification` swaps in the
// "check your inbox" card.
export default function SignUpForm({ onPendingVerification }: { onPendingVerification: (p: PendingVerification) => void }) {
  const { t, lang } = useLang()
  const { setChecking } = useSignInGate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const clearFieldError = (key: keyof FieldErrors) => setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const handleSubmit = async () => {
    setError(null)
    const e164 = toE164(phone)
    const nextErrors: FieldErrors = {
      fullName: fullName.trim() ? undefined : t('mobile_signup_nameRequired'),
      customerType: customerType ? undefined : t('mobile_signup_typeRequired'),
      phone: e164 ? undefined : t('phone_invalid_error'),
    }
    setFieldErrors(nextErrors)
    if (!e164 || Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    // Keeps the root layout from reacting to the brief unverified session.
    setChecking(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(cred.user, { displayName: fullName.trim() })
      await createUserDocument(cred.user, { phone: e164, customerType, preferredLanguage: lang })
      // Email+password accounts stay locked until the emailed link is
      // clicked: send it, then sign out. The token is kept only to authorize a resend.
      const idToken = await cred.user.getIdToken()
      const initialResult = await requestVerificationEmail(idToken, lang, API_BASE_URL)
      await signOut(auth)
      onPendingVerification({ variant: 'signup', email: cred.user.email ?? email.trim(), idToken, initialResult })
    } catch (err) {
      if (auth.currentUser && !auth.currentUser.emailVerified) await signOut(auth).catch(() => {})
      setError(getAuthErrorMessage(err))
      setSubmitting(false)
    } finally {
      setChecking(false)
    }
  }

  return (
    <View>
      {error && <Notice message={error} />}

      <TextField
        label={t('signup_fullNameLabel')}
        icon="user"
        natural
        value={fullName}
        onChangeText={(v) => {
          setFullName(v)
          clearFieldError('fullName')
        }}
        error={fieldErrors.fullName}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <TextField
        label={t('signup_emailLabel')}
        icon="mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label={t('signup_passwordLabel')}
        icon="lock"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />

      <View style={styles.group}>
        <AppText style={styles.groupLabel}>{t('signup_customerTypeLabel')}</AppText>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {CUSTOMER_TYPES.map((option) => {
            const selected = option.value === customerType
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setCustomerType(option.value)
                  clearFieldError('customerType')
                }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <AppText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{t(option.labelKey)}</AppText>
              </Pressable>
            )
          })}
        </View>
        {fieldErrors.customerType && (
          <AppText accessibilityRole="alert" style={styles.groupError}>{fieldErrors.customerType}</AppText>
        )}
      </View>

      <TextField
        label={t('signup_phoneLabel')}
        icon="phone"
        value={phone}
        onChangeText={(v) => {
          setPhone(v)
          clearFieldError('phone')
        }}
        error={fieldErrors.phone}
        hint={t('signup_phoneNote')}
        placeholder="+972 50 123 4567"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <View style={styles.submit}>
        <Button
          label={submitting ? t('signup_submitBtnBusy') : t('signup_submitBtn')}
          onPress={handleSubmit}
          busy={submitting}
          disabled={!email || !password}
          large
          arrow
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  group: { marginBottom: 16 },
  groupLabel: { marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.text },
  groupError: { marginTop: 6, fontSize: 12, fontWeight: '600', color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    ...webOnly({ cursor: 'pointer', userSelect: 'none' }),
  },
  chipSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  chipLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  chipLabelSelected: { color: colors.brand },
  submit: { marginTop: 8 },
})
