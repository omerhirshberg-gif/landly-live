'use client'

import { useAdminT } from '@/lib/admin/translations'

const TONES = {
  emerald: 'bg-adm-ok-soft text-adm-ok ring-adm-ok-line',
  amber: 'bg-adm-warn-soft text-adm-warn ring-adm-warn-line',
  rose: 'bg-adm-danger-soft text-adm-danger ring-adm-danger-line',
  blue: 'bg-adm-info-soft text-adm-info ring-adm-info-line',
  slate: 'bg-adm-raised text-adm-text-2 ring-adm-line',
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
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-semibold leading-snug ring-1 ring-inset ${TONES[tone]} ${className}`}
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

/** A member's account state (lib/admin/userStatus.ts); active shows as a quiet dash so suspended and banned stand out. */
export function UserStatusBadge({ status }: { status: 'active' | 'suspended' | 'banned' }) {
  const { t } = useAdminT()
  if (status === 'banned') return <StatusBadge tone="rose" icon="fa-ban">{t('userStatus.banned')}</StatusBadge>
  if (status === 'suspended') return <StatusBadge tone="amber" icon="fa-pause">{t('userStatus.suspended')}</StatusBadge>
  return <StatusBadge tone="emerald">{t('userStatus.active')}</StatusBadge>
}
