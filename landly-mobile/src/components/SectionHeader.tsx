import { Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { webOnly } from '../lib/webStyles'
import { colors, type } from '../theme'

// "Exclusive Deals", "Curated for you": the member section title, with an
// optional trailing action (See all) on the reading-direction end. The row
// spans the screen's padded width; the title takes the rest of it (and
// truncates), so the action is held at the far end at any width, right in
// English and left in Hebrew.
export default function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.row}>
      <AppText accessibilityRole="header" style={[type.sectionTitle, styles.title]} numberOfLines={1}>
        {title}
      </AppText>
      {action && onAction && (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={8} style={styles.action}>
          <AppText style={styles.actionLabel}>{action}</AppText>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', width: '100%', gap: 12, marginTop: 28, marginBottom: 12 },
  title: { flex: 1, minWidth: 0 },
  action: { flexShrink: 0, minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  actionLabel: { fontSize: 15, fontWeight: '600', color: colors.brand },
})
