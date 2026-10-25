import type { Lang } from '@/lib/i18n/translations'
import { INQUIRY_CATEGORY_LABELS, type ConversationStatus, type InquiryCategory } from '@/lib/whatsapp/supportBot'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'

const LANGUAGE_LABELS: Record<Lang, string> = { en: 'English', he: 'Hebrew', ru: 'Russian', fr: 'French', es: 'Spanish' }

/** "HE", with the full name for hover and screen readers; dashed until the member has picked one. */
export function LanguageBadge({ lang, selected = true }: { lang: Lang; selected?: boolean }) {
  const label = `${LANGUAGE_LABELS[lang]}${selected ? '' : ' (not picked yet)'}`
  return (
    <span
      title={label}
      aria-label={`Language: ${label}`}
      className={`inline-flex h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-[11px] font-bold uppercase tracking-wide ${
        selected ? 'bg-[#F0F7FF] text-[#0038B8]' : 'border border-dashed border-[#CBD5E1] text-[#94A3B8]'
      }`}
    >
      {lang}
    </span>
  )
}

const STATUSES: Record<ConversationStatus, { tone: StatusTone; label: string; icon: string }> = {
  active: { tone: 'slate', label: 'With the bot', icon: 'fa-robot' },
  awaiting_user_inquiry: { tone: 'blue', label: 'Writing request', icon: 'fa-pen' },
  escalated: { tone: 'amber', label: 'Escalated', icon: 'fa-headset' },
  resolved: { tone: 'emerald', label: 'Resolved', icon: 'fa-circle-check' },
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const { tone, label, icon } = STATUSES[status]
  return (
    <StatusBadge tone={tone} icon={icon} className="whitespace-nowrap">
      {label}
    </StatusBadge>
  )
}

const CATEGORY_ICONS: Record<InquiryCategory, string> = { order_issue: 'fa-bag-shopping', purchase_help: 'fa-tag', login_help: 'fa-lock', general: 'fa-comment' }

/** The bot topic the member asked the team from: "Existing order", "New order" or "General". */
export function CategoryBadge({ category }: { category: InquiryCategory }) {
  return (
    <span
      title="Topic the member chose in the bot"
      className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md bg-[#F1F5F9] px-1.5 text-[11px] font-semibold text-[#475569]"
    >
      <i className={`fa-solid ${CATEGORY_ICONS[category]} text-[10px] text-[#94A3B8]`} aria-hidden="true" />
      <span className="sr-only">Topic: </span>
      {INQUIRY_CATEGORY_LABELS[category]}
    </span>
  )
}
