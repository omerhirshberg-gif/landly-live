import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signOut } from 'firebase/auth'
import { auth } from '@shared/firebase/config'
import { useAuth } from '@shared/firebase/useAuth'
import { getUserDocument, updateUserLanguage, type UserDocument } from '@shared/firebase/users'
import { LANGUAGES } from '@shared/i18n/languages'
import type { Lang } from '@shared/i18n/translations'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import { useLang } from '../../i18n/LangProvider'
import { colors, radius } from '../../theme'

export default function ProfileScreen() {
  const { t, lang, setLang } = useLang()
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserDocument | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getUserDocument(user.uid)
      .then((doc) => { if (!cancelled) setProfile(doc) })
      .catch(() => {
        // Falls back to the Auth record below
      })
    return () => { cancelled = true }
  }, [user])

  // Same account-level preference the website reads on login.
  const chooseLanguage = (next: Lang) => {
    setLang(next)
    if (user) updateUserLanguage(user.uid, next).catch(() => {})
  }

  const name = profile?.displayName || user?.displayName || ''
  const email = profile?.email || user?.email || ''

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText style={styles.title}>{t('dash_tab_profile')}</AppText>

        <View style={styles.card}>
          <Row label={t('profile_name_label')} value={name || t('profile_no_phone')} />
          <Row label={t('profile_email_label')} value={email} ltr />
          <Row label={t('profile_phone_label')} value={profile?.phone || t('profile_no_phone')} ltr={!!profile?.phone} last />
        </View>

        <AppText style={styles.sectionTitle}>{t('profile_language_title')}</AppText>
        <View style={styles.card}>
          {LANGUAGES.map((option, i) => {
            const selected = option.code === lang
            return (
              <Pressable
                key={option.code}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => chooseLanguage(option.code)}
                style={[styles.langRow, i < LANGUAGES.length - 1 && styles.rowBorder]}
              >
                <AppText style={[styles.langLabel, selected && styles.langSelected]}>{option.label}</AppText>
                {selected && <View style={styles.dot} />}
              </Pressable>
            )
          })}
        </View>

        <Button label={t('nav_logout')} onPress={() => signOut(auth)} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
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
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: '900', color: colors.textStrong, marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  row: { paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  rowValue: { fontSize: 16, fontWeight: '600', color: colors.textStrong },
  langRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  langLabel: { fontSize: 16, color: colors.text },
  langSelected: { fontWeight: '700', color: colors.brand },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
})
