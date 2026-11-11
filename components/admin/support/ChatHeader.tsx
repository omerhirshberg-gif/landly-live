'use client'

import { useState } from 'react'
import type { AdminStatus, InboxConversation } from '@/lib/whatsapp/adminInbox'
import { useAdminT } from '@/lib/admin/translations'
import BackButton from '@/components/admin/BackButton'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { CategoryBadge, ConversationStatusBadge, LanguageBadge } from './ConversationBadges'
import { dayTime, phoneOf } from './time'

const RESOLVE_BUTTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold whitespace-nowrap bg-emerald-600 text-white shadow-sm ' +
  'transition-colors hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] ' +
  'disabled:cursor-not-allowed disabled:opacity-70 [-webkit-tap-highlight-color:transparent]'

interface ChatHeaderProps {
  conversation: InboxConversation
  onBack: () => void
  onStatus: (status: AdminStatus) => void
  /** The status being saved, while a change is in flight. */
  pendingStatus: AdminStatus | null
  now: number
}

export default function ChatHeader({ conversation, onBack, onStatus, pendingStatus, now }: ChatHeaderProps) {
  const { waId, name, uid, lang, langSelected, status, category, windowOpen, followUp } = conversation
  const { t, locale } = useAdminT()
  const [copied, setCopied] = useState(false)

  const copyUid = () => {
    if (!uid) return
    navigator.clipboard
      ?.writeText(uid)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }

  const busy = pendingStatus !== null
  return (
    // On a phone this is the top of a full-screen panel, so it clears the notch itself.
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#E2E8F0] px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-3 sm:px-4 md:pt-3">
      <div className="basis-full md:hidden">
        <BackButton onClick={onBack} className="-ms-2">
          {t('support.allChats')}
        </BackButton>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words text-lg font-bold leading-snug text-[#0B1B3D] xl:text-xl">
            {name ? <span dir="auto">{name}</span> : <bdi dir="ltr">{phoneOf(waId)}</bdi>}
          </h2>
          <LanguageBadge lang={lang} selected={langSelected} />
          <ConversationStatusBadge status={status} />
          {category && status !== 'active' && <CategoryBadge category={category} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B]">
          <a
            href={`https://wa.me/${waId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 hover:text-[#0038B8] active:text-[#0038B8] md:min-h-0"
            aria-label={t('support.openWhatsApp', { phone: phoneOf(waId) })}
          >
            <i className="fa-brands fa-whatsapp" aria-hidden="true" />
            <bdi dir="ltr">{phoneOf(waId)}</bdi>
          </a>
          {uid ? (
            <button
              type="button"
              onClick={copyUid}
              title={t('support.copyUid')}
              className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-md bg-[#F1F5F9] px-2.5 font-mono text-[13px] text-[#475569] hover:bg-[#E2E8F0] active:bg-[#E2E8F0] md:min-h-0 md:px-1.5 md:py-0.5"
            >
              <i className={`fa-solid ${copied ? 'fa-check text-emerald-600' : 'fa-user'}`} aria-hidden="true" />
              <span className="truncate">
                <bdi dir="ltr">{uid}</bdi>
              </span>
            </button>
          ) : (
            <span className="rounded-md border border-dashed border-[#CBD5E1] px-1.5 py-0.5 text-[13px]">{t('support.notMember')}</span>
          )}
        </div>
        {followUp && status !== 'resolved' && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[#64748B]">
            <i className="fa-regular fa-clock" aria-hidden="true" />
            <span>
              {followUp.sentAt
                ? t('support.followSent', { sent: `\u2066${dayTime(followUp.sentAt, now, locale)}\u2069`, due: `\u2066${dayTime(followUp.dueAt, now, locale)}\u2069` })
                : followUp.stage === 'nudge'
                  ? t('support.followIf', { due: `\u2066${dayTime(followUp.dueAt, now, locale)}\u2069` })
                  : t('support.autoIf', { due: `\u2066${dayTime(followUp.dueAt, now, locale)}\u2069` })}
            </span>
          </p>
        )}
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        {status === 'escalated' && (
          <button type="button" onClick={() => onStatus('active')} disabled={busy} className={`${SECONDARY_BUTTON} flex-1 px-4 sm:flex-none`} title={t('support.backToBotTitle')}>
            {pendingStatus === 'active' ? <ButtonSpinner /> : <i className="fa-solid fa-robot text-sm" aria-hidden="true" />}
            {t('support.backToBot')}
          </button>
        )}
        {status === 'resolved' ? (
          <button type="button" onClick={() => onStatus('escalated')} disabled={busy} className={`${SECONDARY_BUTTON} flex-1 px-4 sm:flex-none`}>
            {pendingStatus === 'escalated' ? <ButtonSpinner /> : <i className="fa-solid fa-rotate-left text-sm" aria-hidden="true" />}
            {t('support.reopen')}
          </button>
        ) : (
          <button
            type="button"
            id="btn_ticket_resolved"
            onClick={() => onStatus('resolved')}
            disabled={busy}
            className={`${RESOLVE_BUTTON} flex-1 sm:flex-none`}
            title={
              windowOpen ? t('support.resolveTitle') : t('support.resolveSilentTitle')
            }
          >
            {pendingStatus === 'resolved' ? <ButtonSpinner /> : <i className="fa-solid fa-circle-check text-sm" aria-hidden="true" />}
            {windowOpen ? t('support.resolveThank') : t('support.resolveSilent')}
          </button>
        )}
      </div>
    </div>
  )
}
