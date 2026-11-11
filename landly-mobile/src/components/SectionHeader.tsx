import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import { tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { actionTint, radius, type } from '../theme'

// "Exclusive Deals", "Curated for you": the member section title, with an
// optional trailing action (See all) on the reading-direction end. The row
// spans the screen's padded width; the title takes the rest of it (and
// truncates), so the action is held at the far end at any width, right in
// English and left in Hebrew. `leading` heads the title with a bare 18pt line icon
// at 1.5 stroke, no badge (Home's category rails). No deal count beside the title: the action stays one plain verb. The action is a tinted pill: 32pt to the
// eye, a 44pt-tall target to the finger.
// Web: components/discover/OfferCardRail.tsx.
export default function SectionHeader({
  title,
  action,
  onAction,
  leading,
}: {
  title: string
  action?: string
  onAction?: () => void
  leading?: ReactNode
}) {
  return (
    <View style={styles.row}>
      <View style={styles.heading}>
        {leading && <View style={styles.glyph}>{leading}</View>}
        {/* One line, shrunk to 85% before it gives way; a title that still can't fit wraps to a second line rather than clip mid-word. */}
        <AppText
          accessibilityRole="header"
          style={[type.sectionTitle, styles.title]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {title}
        </AppText>
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', width: '100%', gap: 8, marginTop: 28, marginBottom: 4 },
  heading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The category glyph: a bare 18pt line icon, no badge, so the title keeps the width.
  glyph: { flexShrink: 0, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  title: { flexShrink: 1, minWidth: 0 },
  action: { flexShrink: 0, minHeight: 44, justifyContent: 'center', ...webOnly({ cursor: 'pointer' }) },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.chip,
    borderCurve: 'continuous',
    backgroundColor: actionTint.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: actionTint.border,
  },
  pillPressed: { backgroundColor: actionTint.bgPressed },
  actionLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: actionTint.text },
})
