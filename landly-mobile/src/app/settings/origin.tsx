import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@shared/firebase/useAuth'
import { invalidateMemberProfile, useMemberProfile } from '@shared/firebase/useMemberProfile'
import { updateUserCountryOfOrigin } from '@shared/firebase/users'
import CountryOfOriginList from '../../components/CountryOfOriginList'
import Notice from '../../components/Notice'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// Country of origin (web: app/settings/language-region/origin/page.tsx),
// pushed from Language & Region and from the Profile tab's Edit button.
// Choosing a country saves it to users/{uid} at once; its checkmark is the
// confirmation, and only a failed save shows a notice. Back (the button or
// the swipe) returns to wherever the member came from: Profile, or Language
// & Region.
export default function OriginScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  const { profile, loaded } = useMemberProfile(user)
  // The just-chosen country shows at once, before users/{uid} is read again.
  const [chosen, setChosen] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const value = chosen ?? profile?.countryOfOrigin ?? ''

  const choose = async (code: string) => {
    if (!user || code === value) return
    const previous = value
    setChosen(code)
    setFailed(false)
    try {
      await updateUserCountryOfOrigin(user.uid, code)
      invalidateMemberProfile(user.uid)
    } catch {
      setChosen(previous)
      setFailed(true)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader title={t('settings_origin_title')} />
      <View style={styles.content}>
        {failed && (
          <View style={styles.notice}>
            <Notice message={t('settings_save_error')} />
          </View>
        )}
        {loaded && <CountryOfOriginList value={value} onChange={choose} fill />}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // A centred column no wider than 640pt, so an unfolded foldable or a tablet
  // shows a settings page rather than rows stretched edge to edge.
  content: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  notice: { marginBottom: 10 },
})
