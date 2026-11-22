import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { useLang } from '../i18n/LangProvider'
import { tick } from '../lib/haptics'
import { webOnly } from '../lib/webStyles'
import { actionTint, type } from '../theme'

// "Exclusive Deals", "Curated for you": the member section title, with an
// optional trailing action (See all) on the reading-direction end. The row
// spans the screen's padded width; the title takes the rest of it (and
// truncates), so the action is held at the far end at any width, right in
// English and left in Hebrew. `leading` heads the title with a bare 18pt line icon
// at 1.5 stroke, no badge (Home's category rails). No deal count beside the title: the action stays one plain verb. The action is plain text with a chevron (no pill), a 44pt-tall target to the finger.
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
  const { isRtl } = useLang()
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
            // Plain text and a chevron pointing the reading way: no pill, no border.
            <View style={[styles.link, pressed && styles.linkPressed]}>
              <AppText style={styles.actionLabel}>{action}</AppText>
              <LineIcon name="chevronEnd" size={16} color={actionTint.text} strokeWidth={2} flip={isRtl} />
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
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  linkPressed: { opacity: 0.55 },
  actionLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: actionTint.text },
})
