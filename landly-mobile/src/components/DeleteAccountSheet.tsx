import { useState } from 'react'
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { User } from 'firebase/auth'
import { SUPPORT_EMAIL } from '@shared/config'
import { DELETION_DETAILS_MAX, DELETION_REASONS, DELETION_REASON_KEYS, type DeletionReason } from '@shared/account/deletionReasons'
import { hasAppleSignIn, type AppleRevocation } from '@shared/account/appleRevocation'
import { requestAccountDeletion, type DeletionRequestResult } from '@shared/account/requestAccountDeletion'
import AppText from './AppText'
import { useModalSidePadding } from './SheetSlot'
import Button from './Button'
import Checkbox from './Checkbox'
import Notice from './Notice'
import { confirmAndRevokeApple } from '../auth/appleRevocation'
import { useLang } from '../i18n/LangProvider'
import { API_BASE_URL } from '../lib/env'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// Settings' red "Delete Account" row (Danger zone) and the request form it
// opens (web: components/settings/DeleteAccountForm.tsx on
// /settings/delete-account), posting to the same
// /api/account/delete-request: the account email (read-only), an optional
// reason and note, and a required "I understand" box. Once sent, iOS and
// Android confirm with a native alert that closes the sheet; the Expo web
// build (where Alert is a no-op) shows the confirmation in the sheet, as the
// website does. An account with Sign in with Apple confirms with Apple first
// on iOS and in the browser build, which revokes Landly's Apple tokens
// (auth/appleRevocation.ts); backing out sends nothing. Android can't confirm
// with Apple, so its request goes out marked 'unavailable', and any request
// whose tokens weren't revoked says how to remove Landly in the Apple Account
// settings. A page sheet on iOS, full screen on Android; a Modal is its own layout root, so the language's
// direction is set again on its content.
export default function DeleteAccountSheet({ user }: { user: User }) {
  const { t, lang, isRtl } = useLang()
  // Full screen on a phone; from 600pt its content sits in a centred, dialog-wide column.
  const sidePadding = useModalSidePadding()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<DeletionReason | null>(null)
  const [details, setDetails] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<DeletionRequestResult | null>(null)
  const appleAccount = hasAppleSignIn(user)
  // Android has no Apple sheet: the button stays the plain one there.
  const confirmWithApple = appleAccount && Platform.OS !== 'android'
  const [appleMismatch, setAppleMismatch] = useState(false)
  const [appleRevocation, setAppleRevocation] = useState<AppleRevocation | undefined>(undefined)

  const show = () => {
    setReason(null)
    setDetails('')
    setConfirmed(false)
    setResult(null)
    setAppleMismatch(false)
    setAppleRevocation(undefined)
    setOpen(true)
  }
  const close = () => {
    if (!sending) setOpen(false)
  }

  const submit = async () => {
    if (!confirmed || sending) return
    setSending(true)
    setResult(null)
    setAppleMismatch(false)
    let next: DeletionRequestResult
    let revocation: AppleRevocation | undefined
    try {
      if (appleAccount) {
        const apple = await confirmAndRevokeApple(user, lang)
        if (apple.status !== 'done') {
          setAppleMismatch(apple.status === 'mismatch')
          setSending(false)
          return
        }
        revocation = apple.appleRevocation
        setAppleRevocation(revocation)
      }
      const idToken = await user.getIdToken()
      next = await requestAccountDeletion(idToken, { reason, details: details.trim(), lang, appleRevocation: revocation }, API_BASE_URL)
    } catch {
      next = 'unauthorized'
    }
    setSending(false)
    setResult(next)
    if (next === 'sent' && Platform.OS !== 'web') {
      const body = revocation && revocation !== 'revoked' ? `${t('del_success_body')}\n\n${t('del_apple_manual')}` : t('del_success_body')
      Alert.alert(t('del_success_title'), body, [{ text: t('del_done'), onPress: () => setOpen(false) }], {
        cancelable: false,
      })
    }
  }

  const error = appleMismatch
    ? t('del_apple_mismatch')
    : result === 'rateLimited'
      ? t('del_rate_limited')
      : result === 'unauthorized'
        ? t('del_session_expired')
        : result === 'failed' || result === 'offline'
          ? `${t('del_error')} ${SUPPORT_EMAIL}`
          : null
  const sentOnWeb = result === 'sent' && Platform.OS === 'web'

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('del_row_sub')}
        onPress={show}
        android_ripple={{ color: colors.dangerBorder }}
        style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && styles.rowPressed]}
      >
        <View style={styles.iconBox}>
          <TrashIcon />
        </View>
        <View style={styles.rowText}>
          <AppText style={styles.rowTitle}>{t('del_row_title')}</AppText>
          <AppText style={styles.rowSub}>{t('del_row_sub')}</AppText>
        </View>
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.dangerBorder}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={isRtl && styles.flip}
        >
          <Path d="m9 6 6 6-6 6" />
        </Svg>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView
          style={[styles.sheet, { direction: isRtl ? 'rtl' : 'ltr', paddingHorizontal: sidePadding }]}
          edges={Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
        >
          <View style={styles.header}>
            <AppText accessibilityRole="header" style={styles.title}>
              {sentOnWeb ? t('del_success_title') : t('del_title')}
            </AppText>
            <Pressable accessibilityRole="button" onPress={close} disabled={sending} hitSlop={12} style={styles.close}>
              <AppText style={styles.closeText}>{t('settings_close')}</AppText>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            {sentOnWeb ? (
              <>
                <Notice message={t('del_success_body')} tone="success" />
                {appleRevocation && appleRevocation !== 'revoked' && <AppText style={styles.appleManual}>{t('del_apple_manual')}</AppText>}
                <View style={styles.gap} />
                <Button label={t('del_done')} onPress={() => setOpen(false)} />
              </>
            ) : (
              <>
                <AppText style={styles.intro}>{t('del_intro')}</AppText>
                {confirmWithApple && <AppText style={styles.intro}>{t('del_apple_note')}</AppText>}

                <View style={styles.card}>
                  <AppText style={styles.label}>{t('del_email_label')}</AppText>
                  <AppText ltr style={styles.value}>{user.email ?? ''}</AppText>
                </View>

                <AppText style={styles.sectionLabel}>{t('del_reason_label')}</AppText>
                <View accessibilityRole="radiogroup" style={[styles.card, styles.cardFlush]}>
                  {DELETION_REASONS.map((r, i) => {
                    const selected = r === reason
                    return (
                      <Pressable
                        key={r}
                        accessibilityRole="radio"
                        accessibilityState={{ selected, disabled: sending }}
                        disabled={sending}
                        // Tapping the chosen reason again clears it: the reason is optional.
                        onPress={() => setReason(selected ? null : r)}
                        style={[styles.reasonRow, i < DELETION_REASONS.length - 1 && styles.rowBorder]}
                      >
                        <AppText style={[styles.reasonLabel, selected && styles.reasonSelected]}>{t(DELETION_REASON_KEYS[r])}</AppText>
                        <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
                      </Pressable>
                    )
                  })}
                </View>

                <AppText style={styles.sectionLabel}>{t('del_details_label')}</AppText>
                <TextInput
                  accessibilityLabel={t('del_details_label')}
                  value={details}
                  onChangeText={setDetails}
                  editable={!sending}
                  multiline
                  maxLength={DELETION_DETAILS_MAX}
                  textAlignVertical="top"
                  placeholderTextColor={colors.textFaint}
                  style={[styles.details, { textAlign: isRtl ? 'right' : 'left', writingDirection: isRtl ? 'rtl' : 'ltr' }]}
                />

                <View style={styles.confirm}>
                  <Checkbox label={t('del_confirm')} checked={confirmed} onChange={(v) => !sending && setConfirmed(v)} />
                </View>

                {error && (
                  <View style={styles.gapSmall}>
                    <Notice message={error} tone="error" />
                  </View>
                )}

                <Button label={sending ? t('del_sending') : t(confirmWithApple ? 'del_submit_apple' : 'del_submit')} onPress={submit} disabled={!confirmed} busy={sending} variant="danger" />
                <View style={styles.gapSmall} />
                <Button label={t('del_cancel')} onPress={close} disabled={sending} variant="secondary" />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  )
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.danger} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...webOnly({ cursor: 'pointer' }),
  },
  rowPressed: { backgroundColor: colors.dangerBg },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.dangerBg, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.danger },
  rowSub: { marginTop: 1, fontSize: 13, color: colors.textMuted },
  flip: { transform: [{ scaleX: -1 }] },
  sheet: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.heading },
  close: { minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  closeText: { fontSize: 16, fontWeight: '600', color: colors.brand },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  intro: { fontSize: 15, lineHeight: 22, color: colors.body, marginBottom: 16 },
  appleManual: { fontSize: 15, lineHeight: 22, color: colors.body, marginTop: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  cardFlush: { paddingVertical: 0 },
  label: { fontSize: 12, color: colors.textFaint, marginBottom: 2 },
  value: { fontSize: 16, fontWeight: '600', color: colors.heading },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 48,
    paddingVertical: 12,
    ...webOnly({ cursor: 'pointer' }),
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  reasonLabel: { flex: 1, fontSize: 15, color: colors.body },
  reasonSelected: { fontWeight: '700', color: colors.heading },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.textFaint, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  details: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    // 16px keeps iOS Safari (Expo web) from zooming into the field.
    fontSize: 16,
    lineHeight: 22,
    color: colors.heading,
    backgroundColor: colors.white,
    marginBottom: 20,
  },
  confirm: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    marginBottom: 20,
  },
  gap: { height: 20 },
  gapSmall: { height: 12 },
})
