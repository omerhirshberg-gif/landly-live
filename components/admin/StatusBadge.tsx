const TONES = {
  emerald: 'bg-[#ECFDF5] text-emerald-700 ring-emerald-600/15',
  amber: 'bg-[#FFFBEB] text-amber-700 ring-amber-600/15',
  blue: 'bg-[#EFF6FF] text-blue-700 ring-blue-600/15',
  slate: 'bg-[#F1F5F9] text-[#475569] ring-slate-500/15',
} as const

export type StatusTone = keyof typeof TONES

interface StatusBadgeProps {
  tone: StatusTone
  icon?: string
  children: React.ReactNode
  className?: string
}

export default function StatusBadge({ tone, icon, children, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {icon && <i className={`fa-solid ${icon} text-[10px]`} aria-hidden="true" />}
      {children}
    </span>
  )
}

interface OfferStatusInput {
  active: boolean
  expiryDate: string | null
  totalQuantity: number | null
  claimedCount: number
}

/** Why an offer isn't live, from the same fields lib/admin/offerStatus.ts decides on. */
export function OfferStatusBadge({ offer }: { offer: OfferStatusInput }) {
  if (offer.active) return <StatusBadge tone="emerald" icon="fa-circle-check">Active</StatusBadge>
  if (offer.totalQuantity !== null && offer.claimedCount >= offer.totalQuantity) {
    return <StatusBadge tone="amber" icon="fa-box-open">Sold out</StatusBadge>
  }
  if (offer.expiryDate && new Date(offer.expiryDate).getTime() <= Date.now()) {
    return <StatusBadge tone="amber" icon="fa-clock">Expired</StatusBadge>
  }
  return <StatusBadge tone="slate">Not active</StatusBadge>
}
