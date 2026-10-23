import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { signOut, type User } from 'firebase/auth'
import type { CountryCode } from 'libphonenumber-js'
import { formatPhone, phoneToE164, splitPhone } from '@shared/auth/onboarding'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { invalidateMemberProfile, useMemberProfile } from '@shared/firebase/useMemberProfile'
import { useLiveUserDocument } from '@shared/firebase/useLiveUserDocument'
import { updateUserProfileDetails, type UserDocument } from '@shared/firebase/users'
import { CONTACT_CHANGE_FAILED, cancelPendingChange, contactChangeErrorKey, requestPhoneChange, type ContactChangeResult } from '@shared/account/contactChange'
import type { OtpTarget } from '@shared/auth/otp'
import { customerTypeLabel, isCustomerType } from '@shared/customerTypes'
import { ISRAEL_REGIONS, ISRAEL_REGION_KEYS, isIsraelRegion, originLabel } from '@shared/profile/countryOfOrigin'
import AppText from '../../components/AppText'
import AvatarPicker from '../../components/AvatarPicker'
import Button from '../../components/Button'
import ChangeEmailForm from '../../components/ChangeEmailForm'
import CountryOfOriginList from '../../components/CountryOfOriginList'
import Notice from '../../components/Notice'
import LineIcon from '../../components/LineIcon'
import OtpSheet from '../../components/OtpSheet'
import PendingChangeNotice from '../../components/PendingChangeNotice'
import TextField from '../../components/TextField'
import CountryCodePicker from '../../auth/onboarding/CountryCodePicker'
import PersonaStep from '../../auth/onboarding/PersonaStep'
import { useLang } from '../../i18n/LangProvider'
import { API_BASE_URL } from '../../lib/env'
import { webOnly } from '../../lib/webStyles'
import { colors, radius, type } from '../../theme'

// The Profile tab (web: /profile): who the member is and their details, all
// the editable ones behind a single Edit profile button (ProfileDetails).
// The gear at the header's trailing edge (top right,
// top left in Hebrew) pushes the settings stack, where language, Privacy &
// Security, help and the account-deletion request live.
export default function ProfileScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  // Falls back to the Auth record until (or if) users/{uid} is read.
  const { profile, initials, photoURL } = useMemberProfile(user)
  // Read live, so a verified email or phone change shows (and its notice clears) at once.
  const live = useLiveUserDocument(user?.uid ?? null)

  const name = live.profile?.displayName || profile?.displayName || user?.displayName || ''
  const email = live.profile?.email || profile?.email || user?.email || ''

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

        {user && <ProfileDetails user={user} name={name} email={email} profile={live.profile} loaded={live.loaded} />}

        <Button label={t('nav_logout')} onPress={() => signOut(auth)} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  )
}

const SAVED_NOTICE_MS = 3000

interface Details {
  phone: string
  customerType: string
  customerTypeOther: string
  countryOfOrigin: string
  israelRegion: string
}

const detailsOf = (profile: UserDocument | null): Details => ({
  phone: profile?.phone ?? '',
  customerType: profile?.customerType ?? '',
  customerTypeOther: profile?.customerTypeOther ?? '',
  countryOfOrigin: profile?.countryOfOrigin ?? '',
  israelRegion: profile?.israelRegion ?? '',
})

type Status = { tone: 'info' | 'error'; text: string } | null

// The member's details. The name is read-only (a lock marks it). One "Edit
// profile" button at the card header's trailing edge (top right, top left in
// Hebrew) turns the phone (the onboarding's country code picker + number,
// any country), customer type (the onboarding chips, "Other" with its note),
// country of origin (the searchable list) and region in Israel into fields
// at once; "Save changes" writes them to users/{uid} in one update, the same
// write as the website's /profile, and "Cancel" drops them. users/{uid} is
// read live, so a save shows at once.
//
// Email and phone changes are verified before they apply, both with a
// 6-digit code in OtpSheet (web: the same flow). In Edit profile the email
// shows in a field box: its "Change" (email+password members) opens
// ChangeEmailForm, which emails the code to the new address; a Google
// account's address is its Google identity, so its box is locked with a
// note. A new phone number gets a WhatsApp code when verification is on
// (/api/account/change-phone decides, otherwise it saves as before).
// Meanwhile the amber PendingChangeNotice sits under the row until the
// change is verified, on any device.
function ProfileDetails({
  user,
  name,
  email,
  profile,
  loaded,
}: {
  user: User
  name: string
  email: string
  profile: UserDocument | null
  loaded: boolean
}) {
  const { t, lang } = useLang()
  const current = detailsOf(profile)
  const pendingEmail = profile?.pendingEmail ?? ''
  const pendingPhone = profile?.pendingPhone ?? ''
  const canChangeEmail = user.providerData.some((p) => p.providerId === 'password')
  const googleAccount = user.providerData.some((p) => p.providerId === 'google.com')
  const [emailFormOpen, setEmailFormOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Details>(current)
  const [country, setCountry] = useState<CountryCode>('IL')
  const [national, setNational] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<'saved' | 'verified' | 'emailVerified' | null>(null)
  const [otp, setOtp] = useState<{ target: OtpTarget; resendIn: number } | null>(null)
  const [pendingBusy, setPendingBusy] = useState<'cancelEmail' | 'cancelPhone' | null>(null)
  const [emailStatus, setEmailStatus] = useState<Status>(null)
  const [phoneStatus, setPhoneStatus] = useState<Status>(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), SAVED_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  const change = (patch: Partial<Details>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaveError(null)
  }

  const startEdit = () => {
    const split = splitPhone(current.phone)
    setCountry(split.country)
    setNational(split.national)
    setDraft(current)
    setPhoneError(null)
    setSaveError(null)
    setNotice(null)
    setEmailFormOpen(false)
    setEditing(true)
  }

  const save = async () => {
    const trimmed = national.trim()
    const phone = trimmed ? phoneToE164(country, trimmed) : ''
    if (phone === null) {
      setPhoneError(t('phone_invalid_error'))
      return
    }
    const customerType = isCustomerType(draft.customerType) ? draft.customerType : ('' as const)
    setBusy(true)
    setSaveError(null)
    try {
      // A new number is verified first when verification is on: the other
      // fields save now and the number waits in pendingPhone for its code.
      let savedPhone = phone
      let verify: { target: OtpTarget; resendIn: number } | null = null
      if (phone && phone !== current.phone) {
        const start = await requestPhoneChange(await user.getIdToken(), { phone, lang, channel: 'whatsapp' }, API_BASE_URL)
        if (start.ok && start.mode === 'otp') {
          verify = { target: { kind: 'phone', phone }, resendIn: start.resendIn }
        } else if (!start.ok && start.reason === 'rateLimited' && start.retryAfter && phone === pendingPhone) {
          // A code for this very number went out moments ago: enter that one.
          verify = { target: { kind: 'phone', phone }, resendIn: start.retryAfter }
        } else if (!start.ok) {
          setPhoneError(t(contactChangeErrorKey(start.reason)))
          return
        }
        if (verify) savedPhone = current.phone
      }
      const next = { ...draft, phone: savedPhone, customerType }
      await updateUserProfileDetails(user.uid, next)
      invalidateMemberProfile(user.uid)
      setEditing(false)
      setEmailFormOpen(false)
      if (verify) {
        setPhoneStatus(null)
        setOtp(verify)
      } else {
        setNotice('saved')
      }
    } catch {
      setSaveError(t('profile_save_error'))
    } finally {
      setBusy(false)
    }
  }

  const unset = loaded ? t('profile_origin_unset') : '…'

  const pendingAction = async (
    kind: NonNullable<typeof pendingBusy>,
    run: (idToken: string) => Promise<ContactChangeResult>,
    setStatus: (status: Status) => void,
    success: Status
  ) => {
    setPendingBusy(kind)
    setStatus(null)
    const result = await user.getIdToken().then(run).catch(() => CONTACT_CHANGE_FAILED)
    setPendingBusy(null)
    setStatus(result.ok ? success : { tone: 'error', text: t(contactChangeErrorKey(result.reason)) })
  }

  const phoneNotice = !!pendingPhone && (
    <PendingChangeNotice
      message={t('pending_phone_body')}
      placeholder="{phone}"
      value={formatPhone(pendingPhone)}
      icon="chat"
      actionLabel={t('pending_phone_enter')}
      onAction={() => {
        setPhoneStatus(null)
        setOtp({ target: { kind: 'phone', phone: pendingPhone }, resendIn: 0 })
      }}
      onCancel={() => pendingAction('cancelPhone', (idToken) => cancelPendingChange(idToken, 'phone', API_BASE_URL), setPhoneStatus, null)}
      cancelBusy={pendingBusy === 'cancelPhone'}
      status={phoneStatus}
    />
  )

  return (
    <View style={styles.card}>
      <View style={[styles.cardHeader, styles.rowBorder]}>
        <AppText accessibilityRole="header" style={styles.cardTitle}>{t('dash_tab_profile')}</AppText>
        {!editing && (
          <Pressable
            accessibilityRole="button"
            onPress={startEdit}
            disabled={!loaded}
            hitSlop={8}
            style={({ pressed }) => [styles.editButton, pressed && styles.editPressed, !loaded && styles.editDisabled]}
          >
            <AppText style={styles.editText}>{t('profile_edit_profile_btn')}</AppText>
          </Pressable>
        )}
      </View>

      <Row label={t('profile_name_label')} value={name || t('profile_no_phone')} muted={editing} />
      <View style={[styles.row, styles.rowBorder]}>
        <AppText style={editing ? styles.fieldLabel : styles.rowLabel}>{t('profile_email_label')}</AppText>
        {editing ? (
          // A field box: "Change" at its trailing edge for a password account, a lock for a Google one.
          <View style={[styles.emailBox, canChangeEmail && styles.emailBoxAction]}>
            <AppText ltr style={styles.emailBoxValue}>{email}</AppText>
            {canChangeEmail ? (
              !emailFormOpen && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('profile_change_email_btn')}: ${t('profile_email_label')}`}
                  onPress={() => {
                    setEmailStatus(null)
                    setEmailFormOpen(true)
                  }}
                  hitSlop={4}
                  style={({ pressed }) => [styles.changeButton, pressed && styles.editPressed]}
                >
                  <AppText style={styles.changeText}>{t('profile_change_email_btn')}</AppText>
                </Pressable>
              )
            ) : (
              <LineIcon name="lock" size={16} color={colors.textFaint} />
            )}
          </View>
        ) : (
          <AppText ltr style={styles.rowValue}>{email}</AppText>
        )}
        {editing && !canChangeEmail && googleAccount && <AppText style={styles.lockedHint}>{t('profile_email_google_locked')}</AppText>}
        {canChangeEmail && emailFormOpen && editing && (
          <ChangeEmailForm
            user={user}
            pendingEmail={pendingEmail}
            onSent={(sentTo, resendIn) => {
              setEmailFormOpen(false)
              setEmailStatus(null)
              setOtp({ target: { kind: 'email', email: sentTo }, resendIn })
            }}
            onCancel={() => setEmailFormOpen(false)}
          />
        )}
        {!!pendingEmail && !emailFormOpen && (
          <PendingChangeNotice
            message={t('pending_email_body')}
            placeholder="{email}"
            value={pendingEmail}
            icon="mail"
            actionLabel={t('pending_email_enter')}
            onAction={() => {
              setEmailStatus(null)
              setOtp({ target: { kind: 'email', email: pendingEmail }, resendIn: 0 })
            }}
            onCancel={() => pendingAction('cancelEmail', (idToken) => cancelPendingChange(idToken, 'email', API_BASE_URL), setEmailStatus, null)}
            cancelBusy={pendingBusy === 'cancelEmail'}
            status={emailStatus}
          />
        )}
      </View>

      {editing ? (
        <>
          <View style={[styles.row, styles.rowBorder]}>
            <TextField
              label={t('profile_phone_label')}
              prefix={<CountryCodePicker value={country} onChange={(code) => { setCountry(code); setPhoneError(null) }} />}
              value={national}
              onChangeText={(value) => { setNational(value); setPhoneError(null) }}
              error={phoneError}
              placeholder={country === 'IL' ? '50 123 4567' : undefined}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              autoFocus
            />
            {phoneNotice}
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <AppText style={styles.fieldLabel}>{t('signup_customerTypeLabel')}</AppText>
            <PersonaStep
              value={draft.customerType}
              onChange={(customerType) => change({ customerType })}
              note={draft.customerTypeOther}
              onNoteChange={(customerTypeOther) => change({ customerTypeOther })}
              onSubmit={() => {}}
            />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <AppText style={styles.fieldLabel}>{t('profile_origin_label')}</AppText>
            <CountryOfOriginList value={draft.countryOfOrigin} onChange={(countryOfOrigin) => change({ countryOfOrigin })} />
          </View>
          <View style={styles.row}>
            <AppText style={styles.fieldLabel}>{t('profile_region_label')}</AppText>
            <View accessibilityRole="radiogroup" style={styles.regions}>
              {ISRAEL_REGIONS.map((region) => {
                const selected = draft.israelRegion === region
                return (
                  <Pressable
                    key={region}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => change({ israelRegion: region })}
                    style={({ pressed }) => [styles.region, selected && styles.regionSelected, pressed && styles.pressed]}
                  >
                    <AppText style={[styles.regionLabel, selected && styles.regionLabelSelected]}>{t(ISRAEL_REGION_KEYS[region])}</AppText>
                  </Pressable>
                )
              })}
            </View>
          </View>
          {saveError && (
            <View style={styles.saveError}>
              <Notice message={saveError} />
            </View>
          )}
          <View style={styles.editActions}>
            <View style={styles.editAction}>
              <Button
                label={t('profile_cancel_btn')}
                onPress={() => {
                  setEditing(false)
                  setEmailFormOpen(false)
                }}
                disabled={busy}
                variant="secondary"
              />
            </View>
            <View style={styles.editAction}>
              <Button label={t('profile_save_changes_btn')} onPress={save} busy={busy} />
            </View>
          </View>
        </>
      ) : (
        <>
          <Row label={t('profile_phone_label')} value={current.phone ? formatPhone(current.phone) : loaded ? t('profile_no_phone') : '…'} ltr={!!current.phone}>
            {phoneNotice}
          </Row>
          {/* "Other" shows what the member typed for it. */}
          <Row label={t('signup_customerTypeLabel')} value={customerTypeLabel(current.customerType, current.customerTypeOther, t) ?? unset} />
          <Row label={t('profile_origin_label')} value={originLabel(current.countryOfOrigin, lang) ?? unset} />
          <Row
            label={t('profile_region_label')}
            value={isIsraelRegion(current.israelRegion) ? t(ISRAEL_REGION_KEYS[current.israelRegion]) : unset}
            last={!notice}
          />
          {notice && (
            <View style={styles.savedNotice}>
              <Notice message={t(notice === 'emailVerified' ? 'otp_email_success' : notice === 'verified' ? 'otp_success' : 'profile_save_success')} tone="success" />
            </View>
          )}
        </>
      )}
      {otp && (
        <OtpSheet
          user={user}
          target={otp.target}
          resendIn={otp.resendIn}
          onClose={() => setOtp(null)}
          onVerified={() => {
            const kind = otp.target.kind
            setOtp(null)
            // The Auth record already shows the new address: the sheet
            // signed back in (finishEmailChange) after the server changed it.
            invalidateMemberProfile(user.uid)
            setNotice(kind === 'email' ? 'emailVerified' : 'verified')
          }}
        />
      )}
    </View>
  )
}

function Row({ label, value, ltr, last, muted, children }: { label: string; value: string; ltr?: boolean; last?: boolean; muted?: boolean; children?: ReactNode }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <AppText style={styles.rowLabel}>{label}</AppText>
      <AppText ltr={ltr} style={[styles.rowValue, muted && styles.rowValueMuted]}>{value}</AppText>
      {children}
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
  rowValueMuted: { color: colors.body },
  // The title at the start, Edit profile at the trailing edge; the root view's direction mirrors it in Hebrew.
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.heading },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: colors.heading, marginBottom: 10 },
  regions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  region: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  regionSelected: { borderColor: colors.brand, backgroundColor: colors.brandLight },
  regionLabel: { fontSize: 14, fontWeight: '600', color: colors.body },
  regionLabelSelected: { color: colors.brand },
  pressed: { opacity: 0.8 },
  editDisabled: { opacity: 0.6 },
  saveError: { marginBottom: 12 },
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
  // Edit profile's email box: the address takes the free width (wrapping if
  // long); "Change" or the lock sits at its trailing edge.
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingStart: 14,
    paddingEnd: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  emailBoxAction: { paddingEnd: 2 },
  emailBoxValue: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: 16, color: colors.body },
  lockedHint: { marginTop: 6, fontSize: 12, color: colors.textFaint },
  changeButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    justifyContent: 'center',
    ...webOnly({ cursor: 'pointer' }),
  },
  changeText: { fontSize: 15, fontWeight: '600', color: colors.brand },
  editActions: { flexDirection: 'row', gap: 12, paddingTop: 4, paddingBottom: 16 },
  editAction: { flex: 1 },
  savedNotice: { paddingBottom: 16 },
})
