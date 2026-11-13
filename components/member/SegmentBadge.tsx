'use client'

import { CalendarRange, Compass, GraduationCap, Heart, House, PlaneLanding, Shield, Sparkles, UserRound, type LucideIcon } from 'lucide-react'
import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR, canonicalCustomerType, customerTypeLabel } from '@/lib/customerTypes'
import { useLang } from '@/lib/i18n/useLang'

const ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  new_oleh: PlaneLanding,
  veteran_oleh: House,
  lone_soldier: Shield,
  taglit: Heart,
  long_term_program: CalendarRange,
  traveler: Compass,
  other: Sparkles,
}

// The member's persona (Student, Developer, …) beside their name on /member and
// the signed-in home: a quiet status pill. A white surface with a hairline border and
// a micro shadow, the type's own icon (1.5 stroke) in its hue, then the label in slate.
// "Other" shows what the member typed for it; no answer yet shows "Member" in grey.
// Native twin: landly-mobile/src/components/SegmentBadge.tsx.
export default function SegmentBadge({ customerType, customerTypeOther }: { customerType?: string; customerTypeOther?: string }) {
  const { t } = useLang()
  const type = canonicalCustomerType(customerType ?? '')
  const label = customerTypeLabel(type, customerTypeOther ?? '', t) ?? t('dash_segment_value_unset')
  const color = CUSTOMER_TYPES.find((o) => o.value === type)?.color ?? CUSTOMER_TYPE_UNSET_COLOR
  const Icon = ICONS[type] ?? UserRound

  return (
    <span className="segment-badge" style={{ '--seg': color } as React.CSSProperties}>
      <span className="segment-badge-icon" aria-hidden="true">
        <Icon size={14} strokeWidth={1.5} />
      </span>
      <span className="segment-badge-label">{label}</span>
    </span>
  )
}
