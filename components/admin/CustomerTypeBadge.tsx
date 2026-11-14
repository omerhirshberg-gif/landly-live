import { BookOpen, Bus, CircleHelp, Compass, GraduationCap, House, Plane, Shield, Sparkles, type LucideIcon } from 'lucide-react'
import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR, canonicalCustomerType } from '@/lib/customerTypes'
import { translations } from '@/lib/i18n/translations'
import { useAdminT } from '@/lib/admin/translations'
import type { AdminLocale } from '@/lib/admin/adminLocale'

// A member's type as the admin shows it: its line icon, its label and the
// type's own colour (lib/customerTypes.ts), the same colours as the business
// dashboard's member segments. '' is a member who hasn't picked one yet.

const ICONS: Record<string, LucideIcon> = {
  student: GraduationCap,
  new_oleh: Compass,
  veteran_oleh: House,
  lone_soldier: Shield,
  taglit: Bus,
  long_term_program: BookOpen,
  traveler: Plane,
  other: Sparkles,
  '': CircleHelp,
}

export function customerTypeInfo(rawType: string, locale: AdminLocale = 'en'): { label: string; Icon: LucideIcon; color: string } {
  const type = canonicalCustomerType(rawType)
  const option = CUSTOMER_TYPES.find((o) => o.value === type)
  return {
    label: option ? translations[locale][option.labelKey] : locale === 'he' ? 'לא צוין' : 'Not set',
    Icon: ICONS[option ? type : ''] ?? CircleHelp,
    color: option?.color ?? CUSTOMER_TYPE_UNSET_COLOR,
  }
}

export default function CustomerTypeBadge({ type, note = '' }: { type: string; note?: string }) {
  const { locale } = useAdminT()
  const { label, Icon, color } = customerTypeInfo(type, locale)
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold leading-snug ring-1 ring-inset"
      style={{ color, backgroundColor: `${color}14`, ['--tw-ring-color' as string]: `${color}33` }}
      title={note || undefined}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <bdi className="truncate" dir="auto">
        {type === 'other' && note ? note : label}
      </bdi>
    </span>
  )
}
