import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { EnglishOnly } from '../../i18n/LangProvider'

// The auth flow is English-only. The root view sets `direction` from the app
// language, so this container pins left-to-right for these screens even when
// the app itself is in Hebrew.
export default function AuthLayout() {
  return (
    <EnglishOnly>
      <View style={styles.ltr}>
        <Stack screenOptions={{ headerShown: false, contentStyle: styles.ltr }} />
      </View>
    </EnglishOnly>
  )
}

const styles = StyleSheet.create({
  ltr: { flex: 1, direction: 'ltr' },
})
