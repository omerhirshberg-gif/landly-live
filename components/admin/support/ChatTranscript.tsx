'use client'

import { Fragment, useLayoutEffect, useRef } from 'react'
import type { InboxMessage } from '@/lib/whatsapp/adminInbox'
import { clockTime, dayLabel, sameDay } from './time'

/** How close to the bottom still counts as "reading the latest" (px). */
const STICK_THRESHOLD = 80

interface ChatTranscriptProps {
  /** Resets the scroll position when another chat opens. */
  waId: string
  messages: InboxMessage[] | null
  now: number
}

export default function ChatTranscript({ waId, messages, now }: ChatTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const shownRef = useRef<string | null>(null)

  // New messages scroll into view only if the admin was already at the
  // bottom; opening a chat always starts at its latest message.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !messages) return
    if (shownRef.current !== waId || stickRef.current) el.scrollTop = el.scrollHeight
    shownRef.current = waId
  }, [waId, messages])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      role="log"
      aria-label="Conversation"
      aria-live="polite"
      className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#F8FAFC] px-3 py-4 sm:px-5"
    >
      {messages === null && (
        <div className="space-y-3" aria-label="Loading messages">
          {[60, 40, 70, 50].map((width, i) => (
            <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
              <div className="h-12 rounded-2xl bg-[#E2E8F0] motion-safe:animate-pulse" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      )}
      {messages?.length === 0 && (
        <p className="py-10 text-center text-sm text-[#94A3B8]">No messages saved for this chat yet. New messages will appear here.</p>
      )}
      <ol className="space-y-2">
        {messages?.map((message, i) => (
          <Fragment key={message.id}>
            {(i === 0 || !sameDay(messages[i - 1].at, message.at)) && (
              <li className="flex justify-center py-2" aria-hidden="true">
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">{dayLabel(message.at, now)}</span>
              </li>
            )}
            <li className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
              <MessageBubble message={message} />
            </li>
          </Fragment>
        ))}
      </ol>
    </div>
  )
}

const AUTHOR_LABELS = { member: 'Member', bot: 'Bot', admin: 'Team' } as const

function MessageBubble({ message }: { message: InboxMessage }) {
  const outgoing = message.direction === 'out'
  const failed = !!message.error
  return (
    <div
      className={`max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[70%] ${
        outgoing
          ? `rounded-ee-md ${failed ? 'bg-[#FEF2F2] text-[#7F1D1D] ring-1 ring-[#FCA5A5]' : message.author === 'bot' ? 'bg-[#0038B8]/85 text-white' : 'bg-[#0038B8] text-white'}`
          : 'rounded-es-md border border-[#E2E8F0] bg-white text-[#0F172A]'
      } ${message.kind === 'media' ? 'italic' : ''}`}
    >
      <p dir="auto" className="whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]">
        {message.text}
      </p>
      <div className={`mt-1 flex items-center justify-end gap-2 text-[11px] ${outgoing && !failed ? 'text-white/70' : 'text-[#94A3B8]'}`}>
        {outgoing && <span className="font-semibold">{AUTHOR_LABELS[message.author]}</span>}
        {message.simulated && <span title="Not sent: WhatsApp sending is off in this environment">Simulated</span>}
        <bdi dir="ltr" className="tabular-nums">
          {clockTime(message.at)}
        </bdi>
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
