import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import AppText from './AppText'
import LineIcon from './LineIcon'
import { webOnly } from '../lib/webStyles'
import { colors } from '../theme'

// One fold of the offer screen (web: Fold in components/offers/HowToRedeem.tsx):
// a 48pt header row with its chevron at the end, and the content under it while open.
export default function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <View style={styles.fold}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.header}>
        <AppText accessibilityRole="header" style={styles.title}>{title}</AppText>
        <LineIcon name="chevronDown" size={20} color={colors.brand} strokeWidth={2} style={open ? styles.open : undefined} />
      </Pressable>
      {open && <View style={styles.panel}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  fold: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, ...webOnly({ cursor: 'pointer' }) },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.heading },
  open: { transform: [{ rotate: '180deg' }] },
  panel: { paddingBottom: 12 },
})
