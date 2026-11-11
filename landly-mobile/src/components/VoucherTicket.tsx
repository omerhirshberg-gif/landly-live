import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import TicketTear from './TicketTear'
import { colors, radius } from '../theme'

// The voucher screen's pass: one white card in two parts, `top` (the cover, the
// business, what it is) and `stub` (the codes, the order), parted by the
// perforation. Web: components/member/VoucherTicket.tsx. Not clipped, so the
// bites in the edges (TicketTear.tsx) and the card's shadow both draw; the
// cover clips its own top corners (DealMedia).
export default function VoucherTicket({ top, stub }: { top: ReactNode; stub: ReactNode }) {
  return (
    <View style={styles.ticket}>
      {top}
      <TicketTear />
      <View style={styles.stub}>{stub}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 15,
    elevation: 3,
  },
  stub: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
})
