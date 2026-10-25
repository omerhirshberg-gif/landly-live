import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isCustomerType, personaNote } from '@shared/customerTypes'
import { useAuth } from '@shared/firebase/useAuth'
import { invalidateMemberProfile, useMemberProfile } from '@shared/firebase/useMemberProfile'
import { updateUserCustomerType } from '@shared/firebase/users'
import PersonaStep from '../../auth/onboarding/PersonaStep'
import AppText from '../../components/AppText'
import Button from '../../components/Button'
import Notice from '../../components/Notice'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { colors } from '../../theme'

// The member type (Student, New Immigrant, Lone Soldier, ...) (web:
// app/settings/member-type/page.tsx), pushed from the Profile tab's Edit
// button. The onboarding chips; "Other" keeps its optional note, so unlike
// Country of origin this saves on Save rather than on each tap. Back (the
// button or the swipe) returns to Profile.
export default function MemberTypeScreen() {
  const { t } = useLang()
  const { user } = useAuth()
  const { profile, loaded } = useMemberProfile(user)
  // The member's edits; null until they touch a field, so the stored values show.
  const [type, setType] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle')

  const storedType = profile?.customerType ?? ''
  const storedNote = profile?.customerTypeOther ?? ''
  const value = type ?? storedType
  const noteValue = note ?? storedNote
  const changed = value !== storedType || personaNote(value, noteValue) !== personaNote(storedType, storedNote)
  const canSave = changed && isCustomerType(value)

  const save = async () => {
    if (!user || saving || !isCustomerType(value) || !changed) return
    setSaving(true)
    setStatus('idle')
    try {
      await updateUserCustomerType(user.uid, value, noteValue)
      invalidateMemberProfile(user.uid)
      setStatus('saved')
    } catch {
      setStatus('failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader title={t('signup_customerTypeLabel')} />
      <ScrollView showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {loaded && (
          <>
            <AppText style={styles.prompt}>{t('onb_persona_title')}</AppText>
            <PersonaStep
              value={value}
              onChange={(next) => {
                setType(next)
                setStatus('idle')
              }}
              note={noteValue}
              onNoteChange={(next) => {
                setNote(next)
                setStatus('idle')
              }}
              onSubmit={save}
            />
            {status !== 'idle' && (
              <View style={styles.notice}>
                <Notice
                  message={status === 'saved' ? t('profile_save_success') : t('settings_save_error')}
                  tone={status === 'saved' ? 'success' : 'error'}
                />
              </View>
            )}
            <Button label={t('profile_save_btn')} onPress={save} busy={saving} disabled={!canSave} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  // A centred column no wider than 640pt, so an unfolded foldable or a tablet
  // shows a settings page rather than rows stretched edge to edge.
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  prompt: { fontSize: 16, fontWeight: '600', color: colors.heading, marginBottom: 16 },
  notice: { marginBottom: 12 },
})
