import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ErrorBoundaryProps } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import AppText from './AppText'
import Button from './Button'
import { colors, radius } from '../theme'
import { useLang } from '../i18n/LangProvider'

// What a route shows when it throws while rendering: a calm card with "Try
// again" instead of the app closing. Exported as `ErrorBoundary` from the root
// layout, the tab layout and the screens that carry money or a pass (checkout,
// offer, voucher, order confirmation), so one broken screen leaves the rest of
// the app (and the tab bar) up. It sits above the language provider when the
// root layout itself fails; useLang then falls back to English, left to right.
// Same words as the website's error page (err_title, err_body, err_retry).
export default function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useLang()
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card} accessibilityRole="alert">
        <AppText style={styles.title}>{t('err_title')}</AppText>
        <AppText style={styles.body}>{t('err_body')}</AppText>
        <View style={styles.action}>
          <Button label={t('err_retry')} onPress={() => void retry()} large />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  body: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  action: { marginTop: 16 },
})
