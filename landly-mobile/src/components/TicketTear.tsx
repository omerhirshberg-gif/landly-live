import { StyleSheet, View } from 'react-native'
import { colors } from '../theme'

const NOTCH = 18

// The perforation across a pass (VoucherPass.tsx, VoucherTicket.tsx): a dashed
// hairline between two semicircular bites out of the card's side edges. The
// bites are discs in the screen's own colour laid over the edge, so they need
// no mask; they sit on the start and end edges, so Hebrew mirrors them. The
// parent card must not clip (its shadow), and `notchColor` is the colour
// behind it.
export default function TicketTear({ notchColor = colors.background }: { notchColor?: string }) {
  return (
    <View style={styles.row} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {/* A 1pt window onto a 2pt dashed box: React Native draws dashes on all four sides or none. */}
      <View style={styles.window}>
        <View style={styles.dashes} />
      </View>
      <View style={[styles.notch, styles.notchStart, { backgroundColor: notchColor }]} />
      <View style={[styles.notch, styles.notchEnd, { backgroundColor: notchColor }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: { height: NOTCH, justifyContent: 'center', marginHorizontal: -1 },
  window: { height: 1, overflow: 'hidden', marginHorizontal: NOTCH / 2 + 8 },
  dashes: { height: 2, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 1 },
  notch: { position: 'absolute', top: 0, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
  notchStart: { start: -NOTCH / 2 },
  notchEnd: { end: -NOTCH / 2 },
})
