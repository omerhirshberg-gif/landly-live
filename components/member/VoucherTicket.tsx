import type { ReactNode } from 'react'
import TicketTear from './TicketTear'

// The voucher page's pass (the app: VoucherTicket.tsx): one white card in two
// parts, `top` (the cover, the business, what it is) and `stub` (the codes, the
// order), parted by the perforation. Not clipped, so the bites in its edges and
// its shadow both draw; the cover rounds its own top corners.
export default function VoucherTicket({ top, stub }: { top: ReactNode; stub: ReactNode }) {
  return (
    <article className="rounded-3xl border border-slate-100 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
      {top}
      <TicketTear />
      <div className="px-5 pb-5 pt-4 sm:px-7 sm:pb-7">{stub}</div>
    </article>
  )
}
