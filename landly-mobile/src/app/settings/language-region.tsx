import { useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import type { User } from 'firebase/auth'
import { useAuth } from '@shared/firebase/useAuth'
import { invalidateMemberProfile, useMemberProfile } from '@shared/firebase/useMemberProfile'
import { updateUserLanguage, updateUserRegion } from '@shared/firebase/users'
import { LANGUAGES } from '@shared/i18n/languages'
import type { Lang } from '@shared/i18n/translations'
import { ISRAEL_REGIONS, ISRAEL_REGION_KEYS, originLabel, type IsraelRegion } from '@shared/profile/countryOfOrigin'
import Notice from '../../components/Notice'
import ScreenHeader from '../../components/ScreenHeader'
import SettingsRow, { SettingsGroup } from '../../components/SettingsRow'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Language & Region (web: app/settings/language-region/page.tsx), the only
// place the language is chosen once signed in: the five languages, applied
// at once (direction included) and saved to users/{uid}.preferredLanguage;
// the country of origin (a row that pushes its list); and where in Israel the
// member lives, saved as they choose.
export default function LanguageRegionScreen() {
  const { t, lang, setLang } = useLang()
  const { user } = useAuth()

  const chooseLanguage = (next: Lang) => {
    if (next === lang) return
    setLang(next)
    if (user) updateUserLanguage(user.uid, next).catch(() => {})
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScreenHeader title={t('nav_lang_region')} />
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <SettingsGroup title={t('settings_language_title')}>
          {LANGUAGES.map((option, i) => (
            <SettingsRow
              key={option.code}
              role="radio"
              title={option.label}
              selected={option.code === lang}
              onPress={() => chooseLanguage(option.code)}
              last={i === LANGUAGES.length - 1}
            />
          ))}
        </SettingsGroup>

        {user && <MemberRegion user={user} />}
      </ScrollView>
    </SafeAreaView>
  )
}

function MemberRegion({ user }: { user: User }) {
  const { t, lang } = useLang()
  const { profile, loaded } = useMemberProfile(user)
  // The just-chosen region shows at once, before users/{uid} is read again.
  const [region, setRegion] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const current = region ?? profile?.israelRegion ?? ''

  const chooseRegion = async (next: IsraelRegion) => {
    if (next === current || !loaded) return
    const previous = current
    setRegion(next)
    setFailed(false)
    try {
      await updateUserRegion(user.uid, next)
      invalidateMemberProfile(user.uid)
    } catch {
      setRegion(previous)
      setFailed(true)
    }
  }

  const origin = profile ? originLabel(profile.countryOfOrigin, lang) : null

  return (
    <>
      <SettingsGroup title={t('settings_origin_title')}>
        <SettingsRow
          icon="flag"
          title={t('profile_origin_label')}
          subtitle={loaded ? origin ?? t('profile_origin_unset') : '…'}
          onPress={() => router.push('/settings/origin')}
          last
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings_region_title')}>
        {ISRAEL_REGIONS.map((r, i) => (
          <SettingsRow
            key={r}
            role="radio"
            title={t(ISRAEL_REGION_KEYS[r])}
            selected={r === current}
            onPress={() => chooseRegion(r)}
            last={i === ISRAEL_REGIONS.length - 1}
          />
        ))}
      </SettingsGroup>

      {failed && <Notice message={t('settings_save_error')} />}
    </>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // A centred column no wider than 640pt, so an unfolded foldable or a tablet
  // shows a settings page rather than rows stretched edge to edge.
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
})
