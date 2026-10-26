'use client'

import { useState } from 'react'
import type { AdminStatus, InboxConversation } from '@/lib/whatsapp/adminInbox'
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
          All chats
        </BackButton>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-lg font-bold text-[#0B1B3D]">
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
            aria-label={`Open ${phoneOf(waId)} in WhatsApp`}
          >
            <i className="fa-brands fa-whatsapp" aria-hidden="true" />
            <bdi dir="ltr">{phoneOf(waId)}</bdi>
          </a>
          {uid ? (
            <button
              type="button"
              onClick={copyUid}
              title="Copy member UID"
              className="inline-flex min-h-11 max-w-full items-center gap-1 rounded-md bg-[#F1F5F9] px-2.5 font-mono text-[11px] text-[#475569] hover:bg-[#E2E8F0] active:bg-[#E2E8F0] md:min-h-0 md:px-1.5 md:py-0.5"
            >
              <i className={`fa-solid ${copied ? 'fa-check text-emerald-600' : 'fa-user'}`} aria-hidden="true" />
              <span className="truncate">
                <bdi dir="ltr">{uid}</bdi>
              </span>
            </button>
          ) : (
            <span className="rounded-md border border-dashed border-[#CBD5E1] px-1.5 py-0.5 text-[11px]">Not a member</span>
          )}
        </div>
        {followUp && status !== 'resolved' && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-[#64748B]">
            <i className="fa-regular fa-clock" aria-hidden="true" />
            {followUp.sentAt ? (
              <span>
                Follow-up sent <bdi dir="ltr">{dayTime(followUp.sentAt, now)}</bdi> · auto-resolves ~<bdi dir="ltr">{dayTime(followUp.dueAt, now)}</bdi>
              </span>
            ) : followUp.stage === 'nudge' ? (
              <span>
                Follow-up ~<bdi dir="ltr">{dayTime(followUp.dueAt, now)}</bdi> if no reply
              </span>
            ) : (
              <span>
                Auto-resolves ~<bdi dir="ltr">{dayTime(followUp.dueAt, now)}</bdi> if no reply
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        {status === 'escalated' && (
          <button type="button" onClick={() => onStatus('active')} disabled={busy} className={`${SECONDARY_BUTTON} flex-1 px-4 sm:flex-none`} title="Let the bot answer this member again">
            {pendingStatus === 'active' ? <ButtonSpinner /> : <i className="fa-solid fa-robot text-sm" aria-hidden="true" />}
            Back to bot
          </button>
        )}
        {status === 'resolved' ? (
          <button type="button" onClick={() => onStatus('escalated')} disabled={busy} className={`${SECONDARY_BUTTON} flex-1 px-4 sm:flex-none`}>
            {pendingStatus === 'escalated' ? <ButtonSpinner /> : <i className="fa-solid fa-rotate-left text-sm" aria-hidden="true" />}
            Reopen
          </button>
        ) : (
          <button
            type="button"
            id="btn_ticket_resolved"
            onClick={() => onStatus('resolved')}
            disabled={busy}
            className={`${RESOLVE_BUTTON} flex-1 sm:flex-none`}
            title={
              windowOpen
                ? 'Marks it resolved and thanks the member in their language'
                : 'Meta’s 24-hour window has closed: marks it resolved without a message to the member'
            }
          >
            {pendingStatus === 'resolved' ? <ButtonSpinner /> : <i className="fa-solid fa-circle-check text-sm" aria-hidden="true" />}
            {windowOpen ? 'Resolve & thank' : 'Resolve (no message)'}
          </button>
        )}
      </div>
    </div>
  )
}
