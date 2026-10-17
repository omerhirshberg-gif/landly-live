'use client'

import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR, customerTypeLabel } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'

// The member's persona (Student, Developer, …) as a pill in its own colour,
// beside their name on /member and the signed-in home. "Other" shows what
// the member typed for it; no answer yet shows "Member" in grey.
export default function SegmentBadge({ customerType, customerTypeOther }: { customerType?: string; customerTypeOther?: string }) {
  const { t } = useLang()
  const type = customerType ?? ''
  const label = customerTypeLabel(type, customerTypeOther ?? '', t) ?? t('dash_segment_value_unset')
  const color = CUSTOMER_TYPES.find((o) => o.value === type)?.color ?? CUSTOMER_TYPE_UNSET_COLOR

  return (
    <span className="segment-badge" style={{ background: color }}>
      <span>{label}</span>
    </span>
  )
}
