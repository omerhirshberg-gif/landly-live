import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { actionTint, colors, radius, type } from '../theme'

// "Exclusive Deals", "Curated for you": the member section title, with an
// optional trailing action (See all) on the reading-direction end. The row
// spans the screen's padded width; the title takes the rest of it (and
// truncates), so the action is held at the far end at any width, right in
// English and left in Hebrew. `leading` heads the title with an icon in a soft
// circular badge (Home's category rails). `count` is the number of deals behind
// the action, shown quietly beside the title instead of inside the link, so
// the action stays one plain verb. The action is a tinted pill: 32pt to the
// eye, a 44pt-tall target to the finger.
// Web: components/discover/OfferCardRail.tsx.
export default function SectionHeader({
  title,
  action,
  onAction,
  leading,
  count,
}: {
  title: string
  action?: string
  onAction?: () => void
  leading?: ReactNode
  count?: number
}) {
  return (
    <View style={styles.row}>
      <View style={styles.heading}>
        {leading && <View style={styles.glyph}>{leading}</View>}
        <AppText accessibilityRole="header" style={[type.sectionTitle, styles.title]} numberOfLines={1}>
          {title}
        </AppText>
        {typeof count === 'number' && (
          // Digits only, left to right in either language.
          <AppText ltr style={styles.count} accessibilityLabel={String(count)}>
            {count}
          </AppText>
        )}
      </View>
      {action && onAction && (
        <Pressable
          accessibilityRole="link"
          onPress={() => {
            tick()
            onAction()
          }}
          hitSlop={{ left: 8, right: 8 }}
          style={styles.action}
        >
          {({ pressed }) => (
            <View style={[styles.pill, pressed && styles.pillPressed]}>
              <AppText style={styles.actionLabel}>{action}</AppText>
            </View>
          )}
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', width: '100%', gap: 12, marginTop: 28, marginBottom: 4 },
  heading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  // A soft circular badge for the category glyph (thin 1.5 line inside).
  glyph: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: actionTint.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: actionTint.border },
  title: { flexShrink: 1, minWidth: 0 },
  count: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textFaint, fontVariant: ['tabular-nums'] },
  action: { flexShrink: 0, minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: actionTint.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: actionTint.border,
  },
  pillPressed: { backgroundColor: actionTint.bgPressed },
  actionLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: actionTint.text },
})
