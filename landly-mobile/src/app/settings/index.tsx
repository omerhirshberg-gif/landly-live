import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { APP_VERSION } from '@shared/config'
import { useAuth } from '@shared/firebase/useAuth'
import { useMemberProfile } from '@shared/firebase/useMemberProfile'
import { LANGUAGES } from '@shared/i18n/languages'
import { originLabel } from '@shared/profile/countryOfOrigin'
import AppText from '../../components/AppText'
import DeleteAccountSheet from '../../components/DeleteAccountSheet'
import ScreenHeader from '../../components/ScreenHeader'
import SettingsRow, { SettingsGroup } from '../../components/SettingsRow'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Settings (web: app/settings/page.tsx), opened by the Profile tab's gear:
// every row pushes its own native screen in this stack (Language & Region,
// Privacy & Security, Support & Help, Terms of Service, Privacy Policy), and
// back or a swipe returns here; the Danger
// zone keeps the account-deletion request (App Store 5.1.1(v)) in its native
// sheet. Sign Out stays on the Profile tab.
export default function SettingsScreen() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const { profile } = useMemberProfile(user)

  const currentLang = LANGUAGES.find((l) => l.code === lang)?.label ?? lang
  const origin = profile ? originLabel(profile.countryOfOrigin, lang) : null

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('nav_settings_heading')} fallback="/profile" />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <SettingsGroup title={t('settings_group_prefs')}>
          <SettingsRow
            icon="globe"
            title={t('nav_lang_region')}
            subtitle={origin ? `${currentLang} · ${origin}` : currentLang}
            onPress={() => router.push('/settings/language-region')}
            last
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings_group_account')}>
          <SettingsRow icon="shield" title={t('nav_security')} subtitle={t('nav_security_sub')} onPress={() => router.push('/settings/privacy-security')} last />
        </SettingsGroup>

        <SettingsGroup title={t('settings_group_help')}>
          <SettingsRow icon="help" title={t('nav_support_title')} subtitle={t('nav_support_sub')} onPress={() => router.push('/settings/support')} />
          <SettingsRow icon="file" title={t('nav_terms_link')} onPress={() => router.push('/settings/terms')} />
          <SettingsRow icon="lock" title={t('nav_privacy_link')} onPress={() => router.push('/settings/privacy')} last />
        </SettingsGroup>

        {user && (
          <SettingsGroup title={t('settings_group_danger')} tone="danger">
            <DeleteAccountSheet user={user} />
          </SettingsGroup>
        )}

        <AppText style={styles.version}>
          Landly · {t('nav_version')} {APP_VERSION}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  version: { fontSize: 12, color: colors.textFaint, textAlign: 'center' },
})
