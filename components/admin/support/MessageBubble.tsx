'use client'

import { useAdminT } from '@/lib/admin/translations'
import { isAttachmentKind } from '@/lib/whatsapp/attachments'
import AttachmentContent from './media/AttachmentContent'
import { clockTime } from './time'
import { parseInteractive, type TranscriptItem, type TranscriptMessage } from './transcript'

// The transcript's two shapes (ChatTranscript.tsx): a bubble for what the
// member wrote or the team sent, and one folded row for each run of the
// bot's automated steps.

const CHOICE = 'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium'

/** The member's message (white, start side) or the team's (GoLandly blue, end side). */
export default function MessageBubble({ message }: { message: TranscriptMessage }) {
  const { t, locale } = useAdminT()
  const outgoing = message.direction === 'out'
  const failed = !!message.error
  const attachment = isAttachmentKind(message.kind) && message.media ? { kind: message.kind, media: message.media } : null
  // A caption is the member's own words, never bot buttons to split out.
  const { body, choices } = attachment ? { body: message.text, choices: [] } : parseInteractive(message.text)
  const tone = !outgoing
    ? 'rounded-es-md border border-adm-line bg-adm-surface text-adm-text'
    : failed
      ? 'rounded-ee-md bg-adm-danger-soft text-adm-danger ring-1 ring-adm-danger-line'
      : `rounded-ee-md bg-adm-accent text-adm-on-accent ${message.pending ? 'opacity-75' : ''}`
  return (
    <div className={`max-w-[85%] rounded-2xl shadow-sm transition-opacity sm:max-w-[70%] ${attachment ? 'p-1.5 pb-2' : 'px-3.5 py-2'} ${tone}`}>
      {attachment && <AttachmentContent kind={attachment.kind} media={attachment.media} caption={message.text} />}
      {body && (
        <p dir="auto" className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere] ${message.kind === 'media' ? 'italic text-adm-muted' : ''} ${attachment ? 'mt-1.5 px-2' : ''}`}>
          {body}
        </p>
      )}
      {choices.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {choices.map((choice, i) => (
            <span key={i} dir="auto" className={`${CHOICE} ${outgoing && !failed ? 'bg-adm-on-accent/15 text-adm-on-accent' : 'bg-adm-raised text-adm-text-2'}`}>
              {choice}
            </span>
          ))}
        </div>
      )}
      <div className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${attachment ? 'px-2' : ''} ${outgoing && !failed ? 'text-adm-on-accent/70' : 'text-adm-muted'}`}>
        <bdi dir="ltr" className="tabular-nums">
          {clockTime(message.at, locale)}
        </bdi>
        {message.pending && (
          <i className="fa-regular fa-clock" role="img" aria-label={t('support.sending')} />
        )}
      </div>
      {failed && (
        <p className="mt-1 text-xs font-semibold text-adm-danger">
          <i className="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />
          {t('support.notDelivered')} <span dir="auto">{message.error}</span>
        </p>
      )}
    </div>
  )
}

/** A note for the team about the conversation itself ("Auto-resolved: no reply to the check-in"); never sent to the member. */
export function SystemNote({ message }: { message: TranscriptMessage }) {
  const { locale } = useAdminT()
  return (
    <p className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-adm-raised px-3 py-1 text-[11px] text-adm-muted ring-1 ring-adm-line">
      <i className="fa-solid fa-circle-check shrink-0 text-adm-muted" aria-hidden="true" />
      <span className="min-w-0 truncate">{message.text}</span>
      <bdi dir="ltr" className="shrink-0 tabular-nums text-adm-muted">
        {clockTime(message.at, locale)}
      </bdi>
    </p>
  )
}

type AutomationItem = Extract<TranscriptItem, { type: 'automation' }>

/** "Bot · 4 automated messages · Chose: 🎁 Browse perks · 10:18", opening onto each step. */
export function AutomationRun({ run }: { run: AutomationItem }) {
  const { t, tn, locale } = useAdminT()
  const sent = run.steps.filter((step) => step.direction === 'out').length
  return (
    <details className="group w-full max-w-md rounded-xl border border-dashed border-adm-line-strong bg-adm-surface/70 text-adm-muted open:bg-adm-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-xs select-none hover:text-adm-text-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-adm-accent [-webkit-tap-highlight-color:transparent] [&::-webkit-details-marker]:hidden">
        <i className="fa-solid fa-robot shrink-0 text-adm-muted" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-adm-text-2">{t('support.bot')}</span>
          {` · ${tn('support.botMessages', sent)}`}
          {run.lastChoice && (
            <>
              {` · ${t('support.chose')} `}
              <span dir="auto" className="font-medium text-adm-text-2">
                {run.lastChoice}
              </span>
            </>
          )}
        </span>
        {run.failed > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-adm-danger">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" aria-hidden="true" />
            {t('support.failed', { n: run.failed })}
          </span>
        )}
        <bdi dir="ltr" className="shrink-0 tabular-nums text-[11px] text-adm-muted">
          {clockTime(run.at, locale)}
        </bdi>
        <i className="fa-solid fa-chevron-down shrink-0 text-[10px] text-adm-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <ol className="space-y-2 border-t border-adm-line-soft px-3 py-2.5">
        {run.steps.map((step) => (
          <AutomationStep key={step.id} step={step} />
        ))}
      </ol>
    </details>
  )
}

function AutomationStep({ step }: { step: TranscriptMessage }) {
  const { t } = useAdminT()
  // The member's tap: a chip on their side.
  if (step.direction === 'in') {
    return (
      <li className="flex items-center gap-1.5 text-[11px]">
        <span className="text-adm-muted">{t('support.memberChose')}</span>
        <span dir="auto" className={`${CHOICE} border border-adm-line bg-adm-surface text-adm-text-2`}>
          {step.text}
        </span>
      </li>
    )
  }
  const { body, choices, link } = parseInteractive(step.text)
  return (
    <li className="text-xs leading-relaxed">
      {body && (
        <p dir="auto" className="whitespace-pre-wrap break-words text-adm-text-2 [overflow-wrap:anywhere]">
          {body}
        </p>
      )}
      {(choices.length > 0 || link) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {choices.map((choice, i) => (
            <span key={i} dir="auto" className={`${CHOICE} bg-adm-raised text-adm-muted`}>
              {choice}
            </span>
          ))}
          {link && (
            <bdi dir="ltr" className="inline-block max-w-full truncate rounded-full bg-adm-accent-soft px-2 py-0.5 text-[11px] font-medium text-adm-accent">
              {link.replace(/^https?:\/\//, '')}
            </bdi>
          )}
        </div>
      )}
      {step.error && (
        <p className="mt-0.5 font-semibold text-adm-danger">
          <i className="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />
          {t('support.notDelivered')} <span dir="auto">{step.error}</span>
        </p>
      )}
    </li>
  )
}
