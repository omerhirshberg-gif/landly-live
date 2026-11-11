'use client'

import type { Lang } from '@/lib/i18n/translations'
import type { ConversationStatus, InquiryCategory } from '@/lib/whatsapp/supportBot'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'

const LANGUAGE_KEYS: Record<Lang, AdminKey> = { en: 'support.lang.en', he: 'support.lang.he', ru: 'support.lang.ru', fr: 'support.lang.fr', es: 'support.lang.es' }

/** "HE", with the full name for hover and screen readers; dashed until the member has picked one. */
export function LanguageBadge({ lang, selected = true }: { lang: Lang; selected?: boolean }) {
  const { t } = useAdminT()
  const name = t(LANGUAGE_KEYS[lang])
  const label = selected ? name : t('support.langNotPicked', { lang: name })
  return (
    <span
      title={label}
      aria-label={t('support.langLabel', { lang: label })}
      className={`inline-flex min-h-6 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] leading-normal font-bold uppercase tracking-wide ${
        selected ? 'bg-[#F0F7FF] text-[#0038B8]' : 'border border-dashed border-[#CBD5E1] text-[#64748B]'
      }`}
    >
      {lang}
    </span>
  )
}

const STATUSES: Record<ConversationStatus, { tone: StatusTone; label: AdminKey; icon: string }> = {
  active: { tone: 'slate', label: 'support.status.active', icon: 'fa-robot' },
  awaiting_user_inquiry: { tone: 'blue', label: 'support.status.awaiting_user_inquiry', icon: 'fa-pen' },
  escalated: { tone: 'amber', label: 'support.status.escalated', icon: 'fa-headset' },
  resolved: { tone: 'emerald', label: 'support.status.resolved', icon: 'fa-circle-check' },
}

export function ConversationStatusBadge({ status }: { status: ConversationStatus }) {
  const { t } = useAdminT()
  const { tone, label, icon } = STATUSES[status]
  return (
    <StatusBadge tone={tone} icon={icon} className="whitespace-nowrap">
      {t(label)}
    </StatusBadge>
  )
}

const CATEGORY_ICONS: Record<InquiryCategory, string> = { order_issue: 'fa-bag-shopping', purchase_help: 'fa-tag', login_help: 'fa-lock', general: 'fa-comment' }

/** The bot topic the member asked the team from: "Existing order", "New order" or "General". */
export function CategoryBadge({ category }: { category: InquiryCategory }) {
  const { t } = useAdminT()
  return (
    <span
      title={t('support.topicTitle')}
      className="inline-flex min-h-6 items-center gap-1 whitespace-nowrap rounded-md bg-[#F1F5F9] px-1.5 text-[13px] leading-normal font-semibold text-[#475569]"
    >
      <i className={`fa-solid ${CATEGORY_ICONS[category]} text-[10px] text-[#64748B]`} aria-hidden="true" />
      <span className="sr-only">{t('support.topic')}</span>
      {t(`support.cat.${category}` as AdminKey)}
    </span>
  )
}
