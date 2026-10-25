'use client'

import { clockTime } from './time'
import { parseInteractive, type TranscriptItem, type TranscriptMessage } from './transcript'

// The transcript's two shapes (ChatTranscript.tsx): a bubble for what the
// member wrote or the team sent, and one folded row for each run of the
// bot's automated steps.

const CHOICE = 'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium'

/** The member's message (white, start side) or the team's (Landly blue, end side). */
export default function MessageBubble({ message }: { message: TranscriptMessage }) {
  const outgoing = message.direction === 'out'
  const failed = !!message.error
  const { body, choices } = parseInteractive(message.text)
  const tone = !outgoing
    ? 'rounded-es-md border border-[#E2E8F0] bg-white text-[#0F172A]'
    : failed
      ? 'rounded-ee-md bg-[#FEF2F2] text-[#7F1D1D] ring-1 ring-[#FCA5A5]'
      : `rounded-ee-md bg-[#0038B8] text-white ${message.pending ? 'opacity-75' : ''}`
  return (
    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm transition-opacity sm:max-w-[70%] ${tone}`}>
      {body && (
        <p dir="auto" className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere] ${message.kind === 'media' ? 'italic text-[#64748B]' : ''}`}>
          {body}
        </p>
      )}
      {choices.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {choices.map((choice, i) => (
            <span key={i} dir="auto" className={`${CHOICE} ${outgoing && !failed ? 'bg-white/15 text-white' : 'bg-[#F1F5F9] text-[#475569]'}`}>
              {choice}
            </span>
          ))}
        </div>
      )}
      <div className={`mt-1 flex items-center justify-end gap-1.5 text-[11px] ${outgoing && !failed ? 'text-white/70' : 'text-[#94A3B8]'}`}>
        <bdi dir="ltr" className="tabular-nums">
          {clockTime(message.at)}
        </bdi>
        {message.pending && (
          <i className="fa-regular fa-clock" role="img" aria-label="Sending" />
        )}
      </div>
      {failed && (
        <p className="mt-1 text-xs font-semibold text-[#B91C1C]">
          <i className="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />
          Not delivered: <span dir="auto">{message.error}</span>
        </p>
      )}
    </div>
  )
}

type AutomationItem = Extract<TranscriptItem, { type: 'automation' }>

/** "Bot · 4 automated messages · Chose: 🎁 Browse perks · 10:18", opening onto each step. */
export function AutomationRun({ run }: { run: AutomationItem }) {
  const sent = run.steps.filter((step) => step.direction === 'out').length
  return (
    <details className="group w-full max-w-md rounded-xl border border-dashed border-[#CBD5E1] bg-white/70 text-[#64748B] open:bg-white">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2 text-xs select-none hover:text-[#334155] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] [-webkit-tap-highlight-color:transparent] [&::-webkit-details-marker]:hidden">
        <i className="fa-solid fa-robot shrink-0 text-[#94A3B8]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-[#475569]">Bot</span>
          {` · ${sent} automated message${sent === 1 ? '' : 's'}`}
          {run.lastChoice && (
            <>
              {' · Chose: '}
              <span dir="auto" className="font-medium text-[#475569]">
                {run.lastChoice}
              </span>
            </>
          )}
        </span>
        {run.failed > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#B91C1C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" aria-hidden="true" />
            {run.failed} failed
          </span>
        )}
        <bdi dir="ltr" className="shrink-0 tabular-nums text-[11px] text-[#94A3B8]">
          {clockTime(run.at)}
        </bdi>
        <i className="fa-solid fa-chevron-down shrink-0 text-[10px] text-[#94A3B8] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>
      <ol className="space-y-2 border-t border-[#F1F5F9] px-3 py-2.5">
        {run.steps.map((step) => (
          <AutomationStep key={step.id} step={step} />
        ))}
      </ol>
    </details>
  )
}

function AutomationStep({ step }: { step: TranscriptMessage }) {
  // The member's tap: a chip on their side.
  if (step.direction === 'in') {
    return (
      <li className="flex items-center gap-1.5 text-[11px]">
        <span className="text-[#94A3B8]">Member chose</span>
        <span dir="auto" className={`${CHOICE} border border-[#E2E8F0] bg-white text-[#334155]`}>
          {step.text}
        </span>
      </li>
    )
  }
  const { body, choices, link } = parseInteractive(step.text)
  return (
    <li className="text-xs leading-relaxed">
      {body && (
        <p dir="auto" className="whitespace-pre-wrap break-words text-[#475569] [overflow-wrap:anywhere]">
          {body}
        </p>
      )}
      {(choices.length > 0 || link) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {choices.map((choice, i) => (
            <span key={i} dir="auto" className={`${CHOICE} bg-[#F1F5F9] text-[#64748B]`}>
              {choice}
            </span>
          ))}
          {link && (
            <bdi dir="ltr" className="inline-block max-w-full truncate rounded-full bg-[#F0F7FF] px-2 py-0.5 text-[11px] font-medium text-[#0038B8]">
              {link.replace(/^https?:\/\//, '')}
            </bdi>
          )}
        </div>
      )}
      {step.error && (
        <p className="mt-0.5 font-semibold text-[#B91C1C]">
          <i className="fa-solid fa-circle-exclamation me-1" aria-hidden="true" />
          Not delivered: <span dir="auto">{step.error}</span>
        </p>
      )}
    </li>
  )
}
