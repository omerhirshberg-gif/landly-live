import { useState } from 'react'
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import type { User } from 'firebase/auth'
import AppText from './AppText'
import ChangePassword from './ChangePassword'
import { useLang } from '../i18n/LangProvider'
import { webOnly } from '../lib/webStyles'
import { colors, radius } from '../theme'

// The Profile tab's "Privacy & Security" row and the sheet it opens (web:
// components/account/SecurityDialog.tsx): how the member signs in, then
// Change Password for email/password accounts; a Google-only account has no
// Landly password, so it gets a note instead. iOS presents it as a native
// page sheet (swipe down to dismiss); Android slides up full screen and
// closes with the system back gesture. A Modal is its own layout root, so the
// language's direction is set again on its content.
export default function SecuritySheet({ user }: { user: User }) {
  const { t, isRtl } = useLang()
  const [open, setOpen] = useState(false)
  const hasPassword = user.providerData.some((p) => p.providerId === 'password')

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        android_ripple={{ color: colors.border }}
        style={({ pressed }) => [styles.row, pressed && Platform.OS === 'ios' && styles.rowPressed]}
      >
        <View style={styles.iconBox}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </Svg>
        </View>
        <AppText style={styles.rowTitle}>{t('nav_security')}</AppText>
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.textFaint}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={isRtl && styles.flip}
        >
          <Path d="m9 6 6 6-6 6" />
        </Svg>
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={[styles.sheet, { direction: isRtl ? 'rtl' : 'ltr' }]} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
          <View style={styles.header}>
            <AppText accessibilityRole="header" style={styles.title}>{t('nav_security')}</AppText>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12} style={styles.close}>
              <AppText style={styles.closeText}>{t('onb_close')}</AppText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
            <View style={styles.card}>
              <AppText style={styles.label}>{t('security_signin_title')}</AppText>
              <AppText style={styles.value}>{hasPassword ? t('security_method_password') : t('security_method_google')}</AppText>
              {!!user.email && <AppText ltr style={styles.email}>{user.email}</AppText>}
              {!hasPassword && <AppText style={styles.note}>{t('security_google_note')}</AppText>}
            </View>
            {hasPassword && <ChangePassword user={user} />}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
    ...webOnly({ cursor: 'pointer' }),
  },
  rowPressed: { backgroundColor: colors.background },
  iconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.heading },
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
  title: { fontSize: 20, fontWeight: '700', color: colors.heading },
  close: { minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  closeText: { fontSize: 16, fontWeight: '600', color: colors.brand },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
  },
  label: { fontSize: 12, color: colors.textFaint, marginBottom: 2 },
  value: { fontSize: 16, fontWeight: '600', color: colors.heading },
  email: { marginTop: 2, fontSize: 14, color: colors.body },
  note: { marginTop: 12, fontSize: 14, lineHeight: 20, color: colors.body },
})
