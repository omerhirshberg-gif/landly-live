import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { signOut, type User } from 'firebase/auth'
import type { CountryCode } from 'libphonenumber-js'
import { formatPhone, phoneToE164, splitPhone } from '@shared/auth/onboarding'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { invalidateMemberProfile, useMemberProfile } from '@shared/firebase/useMemberProfile'
import { updateUserPhone } from '@shared/firebase/users'
import { customerTypeLabel } from '@shared/customerTypes'
import { ISRAEL_REGION_KEYS, isIsraelRegion, originLabel } from '@shared/profile/countryOfOrigin'
import AppText from '../../components/AppText'
import AvatarPicker from '../../components/AvatarPicker'
import Button from '../../components/Button'
import Notice from '../../components/Notice'
import LineIcon from '../../components/LineIcon'
import TextField from '../../components/TextField'
import CountryCodePicker from '../../auth/onboarding/CountryCodePicker'
import { useLang } from '../../i18n/LangProvider'
import { webOnly } from '../../lib/webStyles'
import { colors, radius, type } from '../../theme'

// The Profile tab (web: /profile): who the member is and their details, with
// the phone editable in place and country of origin and region editable on
// their settings screens, which back (the button or the swipe) closes
// straight back to this tab: they open alone, without the Settings menu
// under them. The gear at the header's trailing edge (top right,
// top left in Hebrew) pushes the settings stack, where language, Privacy &
// Security, help and the account-deletion request live.
export default function ProfileScreen() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  // Falls back to the Auth record until (or if) users/{uid} is read.
  const { profile, loaded, initials, photoURL } = useMemberProfile(user)
  const unset = loaded ? t('profile_origin_unset') : '…'

  const name = profile?.displayName || user?.displayName || ''
  const email = profile?.email || user?.email || ''

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          <AppText accessibilityRole="header" style={[type.screenTitle, styles.title]}>
            {t('nav_profile')}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settings_gear_label')}
            onPress={() => router.push('/settings')}
            hitSlop={6}
            style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
          >
            <LineIcon name="gear" size={24} color={colors.heading} />
          </Pressable>
        </View>

        <View style={[styles.card, styles.identity]}>
          {user && <AvatarPicker user={user} uri={photoURL} initials={initials} />}
          {!!name && <AppText style={styles.identityName}>{name}</AppText>}
          {!!email && (
            <AppText ltr style={styles.identityEmail}>
              {email}
            </AppText>
          )}
        </View>

        <View style={styles.card}>
          <Row label={t('profile_name_label')} value={name || t('profile_no_phone')} />
          <Row label={t('profile_email_label')} value={email} ltr />
          {user ? (
            <PhoneRow user={user} stored={profile?.phone ?? ''} />
          ) : (
            <Row label={t('profile_phone_label')} value={t('profile_no_phone')} />
          )}
          {/* Read-only; "Other" shows what the member typed for it. */}
          <Row
            label={t('signup_customerTypeLabel')}
            value={customerTypeLabel(profile?.customerType ?? '', profile?.customerTypeOther ?? '', t) ?? t('profile_no_phone')}
          />
          <EditRow
            label={t('profile_origin_label')}
            value={originLabel(profile?.countryOfOrigin ?? '', lang) ?? unset}
            onEdit={() => router.push('/settings/origin')}
          />
          <EditRow
            label={t('profile_region_label')}
            value={profile && isIsraelRegion(profile.israelRegion) ? t(ISRAEL_REGION_KEYS[profile.israelRegion]) : unset}
            onEdit={() => router.push('/settings/language-region')}
            last
          />
        </View>

        <Button label={t('nav_logout')} onPress={() => signOut(auth)} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  )
}

const SAVED_NOTICE_MS = 3000

// The phone number, editable in place with the onboarding's field (country
// code picker + number). Saves E.164 to users/{uid}.phone, the same value the
// website's /profile page writes; an empty field removes the number.
function PhoneRow({ user, stored }: { user: User; stored: string }) {
  const { t } = useLang()
  // The just-saved number shows at once, before users/{uid} is read again.
  const [saved, setSaved] = useState<string | null>(null)
  const phone = saved ?? stored
  const [editing, setEditing] = useState(false)
  const [country, setCountry] = useState<CountryCode>('IL')
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(false)

  // Once the re-read profile carries it, the stored value takes over again.
  useEffect(() => {
    if (saved !== null && stored === saved) setSaved(null)
  }, [stored, saved])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(false), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const startEdit = () => {
    const split = splitPhone(phone)
    setCountry(split.country)
    setInput(split.national)
    setError(null)
    setNotice(false)
    setEditing(true)
  }

  const save = async () => {
    const trimmed = input.trim()
    const next = trimmed ? phoneToE164(country, trimmed) : ''
    if (next === null) {
      setError(t('phone_invalid_error'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateUserPhone(user.uid, next)
      setSaved(next)
      invalidateMemberProfile(user.uid)
      setEditing(false)
      setNotice(true)
    } catch {
      setError(t('profile_save_error'))
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <View style={[styles.row, styles.rowBorder]}>
        <TextField
          label={t('profile_phone_label')}
          prefix={<CountryCodePicker value={country} onChange={(code) => { setCountry(code); setError(null) }} />}
          value={input}
          onChangeText={(value) => { setInput(value); setError(null) }}
          error={error}
          placeholder={country === 'IL' ? '50 123 4567' : undefined}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="done"
          onSubmitEditing={save}
          autoFocus
        />
        <View style={styles.editActions}>
          <View style={styles.editAction}>
            <Button label={t('profile_cancel_btn')} onPress={() => setEditing(false)} disabled={busy} variant="secondary" />
          </View>
          <View style={styles.editAction}>
            <Button label={t('profile_save_btn')} onPress={save} busy={busy} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.row, styles.rowBorder]}>
      <View style={styles.phoneRow}>
        <View style={styles.phoneText}>
          <AppText style={styles.rowLabel}>{t('profile_phone_label')}</AppText>
          <AppText ltr={!!phone} style={styles.rowValue}>{phone ? formatPhone(phone) : t('profile_no_phone')}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('profile_edit_btn')} ${t('profile_phone_label')}`}
          onPress={startEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.editButton, pressed && styles.editPressed]}
        >
          <AppText style={styles.editText}>{t('profile_edit_btn')}</AppText>
        </Pressable>
      </View>
      {notice && (
        <View style={styles.savedNotice}>
          <Notice message={t('profile_save_success')} tone="success" />
        </View>
      )}
    </View>
  )
}

// A detail changed on a settings screen: the value, then an Edit button that pushes it.
function EditRow({ label, value, onEdit, last }: { label: string; value: string; onEdit: () => void; last?: boolean }) {
  const { t } = useLang()
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.phoneRow}>
        <View style={styles.phoneText}>
          <AppText style={styles.rowLabel}>{label}</AppText>
          <AppText style={styles.rowValue}>{value}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('profile_edit_btn')} ${label}`}
          onPress={onEdit}
          hitSlop={8}
          style={({ pressed }) => [styles.editButton, pressed && styles.editPressed]}
        >
          <AppText style={styles.editText}>{t('profile_edit_btn')}</AppText>
        </Pressable>
      </View>
    </View>
  )
}

function Row({ label, value, ltr, last }: { label: string; value: string; ltr?: boolean; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      <AppText ltr={ltr} style={styles.rowValue}>{value}</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  title: { flex: 1 },
  // 44pt target at the header's trailing edge; the root view's direction puts it top left in Hebrew.
  gear: { width: 44, height: 44, borderRadius: 22, marginEnd: -8, alignItems: 'center', justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  gearPressed: { backgroundColor: colors.borderLight },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  identity: { alignItems: 'center', paddingVertical: 20 },
  identityName: { marginTop: 12, fontSize: 18, fontWeight: '700', color: colors.heading, textAlign: 'center' },
  identityEmail: { marginTop: 2, fontSize: 14, color: colors.body, textAlign: 'center' },
  row: { paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontSize: 12, color: colors.textFaint, marginBottom: 2 },
  rowValue: { fontSize: 16, fontWeight: '600', color: colors.heading },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  phoneText: { flex: 1, minWidth: 0 },
  editButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.brandLight,
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  editPressed: { backgroundColor: colors.brandTint },
  editText: { fontSize: 15, fontWeight: '600', color: colors.brand },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  editAction: { flex: 1 },
  savedNotice: { marginTop: 12, marginBottom: -16 },
})
