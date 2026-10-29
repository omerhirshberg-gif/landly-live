import { CUSTOMER_TYPES, CUSTOMER_TYPE_UNSET_COLOR } from '@/lib/customerTypes'
import { translations } from '@/lib/i18n/translations'

// A member's type as the admin shows it: its emoji, its English label and the
// type's own colour (lib/customerTypes.ts), the same colours as the business
// dashboard's member segments. '' is a member who hasn't picked one yet.

const EMOJI: Record<string, string> = {
  student: '🎓',
  new_immigrant: '🇮🇱',
  lone_soldier: '🎖️',
  taglit: '🚌',
  long_term_program: '📚',
  traveler: '✈️',
  other: '✨',
  '': '❔',
}

export function customerTypeInfo(type: string): { label: string; emoji: string; color: string } {
  const option = CUSTOMER_TYPES.find((o) => o.value === type)
  return {
    label: option ? translations.en[option.labelKey] : 'Not set',
    emoji: EMOJI[option ? type : ''] ?? '',
    color: option?.color ?? CUSTOMER_TYPE_UNSET_COLOR,
  }
}

export default function CustomerTypeBadge({ type, note = '' }: { type: string; note?: string }) {
  const { label, emoji, color } = customerTypeInfo(type)
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ring-1 ring-inset"
      style={{ color, backgroundColor: `${color}14`, ['--tw-ring-color' as string]: `${color}33` }}
      title={note || undefined}
    >
      <span aria-hidden="true" className="text-[13px] leading-none">
        {emoji}
      </span>
      <bdi className="truncate" dir="auto">
        {type === 'other' && note ? note : label}
      </bdi>
    </span>
  )
}
