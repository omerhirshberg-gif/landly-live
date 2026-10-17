import { ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TERMS_SECTIONS } from '@shared/legal/termsSections'
import AppText from '../../components/AppText'
import ScreenHeader from '../../components/ScreenHeader'
import { useLang } from '../../i18n/LangProvider'
import { colors, radius } from '../../theme'

// Terms of Service (web: /terms), in the settings stack: the same sections
// as the website (lib/legal/termsSections.ts), in the member's language and
// reading direction. Back (the button or the swipe) returns to Settings.
export default function TermsScreen() {
  const { t } = useLang()

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('nav_terms_link')} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.card}>
          <AppText accessibilityRole="header" style={styles.title}>{t('terms_title')}</AppText>
          <AppText style={styles.updated}>
            {t('terms_updated_label')} {t('terms_updated_date')}
          </AppText>

          {TERMS_SECTIONS.map((section) => (
            <View key={section.heading} style={styles.section}>
              <AppText accessibilityRole="header" style={styles.heading}>{t(section.heading)}</AppText>
              {section.body.map((part) =>
                Array.isArray(part) ? (
                  <AppText key={part[1]} style={styles.paragraph}>
                    <AppText style={styles.label}>{t(part[0])}</AppText> {t(part[1])}
                  </AppText>
                ) : (
                  <AppText key={part} style={styles.paragraph}>{t(part)}</AppText>
                )
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 20 },
  title: { fontSize: 22, lineHeight: 30, fontWeight: '800', color: colors.heading },
  updated: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  section: { marginTop: 24 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '700', color: colors.heading, marginBottom: 6 },
  paragraph: { fontSize: 15, lineHeight: 24, color: colors.body, marginTop: 4 },
  label: { fontWeight: '700', color: colors.heading },
})
