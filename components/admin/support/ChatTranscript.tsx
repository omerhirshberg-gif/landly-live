'use client'

import { Fragment, useLayoutEffect, useMemo, useRef } from 'react'
import MessageBubble, { AutomationRun, SystemNote } from './MessageBubble'
import { dayLabel, sameDay } from './time'
import { groupTranscript, itemAt, type TranscriptMessage } from './transcript'

/** How close to the bottom still counts as "reading the latest" (px). */
const STICK_THRESHOLD = 80

interface ChatTranscriptProps {
  /** Resets the scroll position when another chat opens. */
  waId: string
  messages: TranscriptMessage[] | null
  now: number
}

export default function ChatTranscript({ waId, messages, now }: ChatTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const shownRef = useRef<string | null>(null)
  const items = useMemo(() => (messages ? groupTranscript(messages) : null), [messages])
  // Outside production the bot and the team only log their sends (lib/whatsapp/graph.ts whatsappLive).
  const simulated = messages?.some((message) => message.simulated) ?? false

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
      {simulated && (
        <p className="mb-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#94A3B8]">
          <i className="fa-solid fa-flask" aria-hidden="true" />
          Test environment: replies are logged here, not sent on WhatsApp.
        </p>
      )}
      <ol className="space-y-2">
        {items?.map((item, i) => {
          const at = itemAt(item)
          return (
            <Fragment key={item.type === 'message' ? item.message.id : `run-${item.id}`}>
              {(i === 0 || !sameDay(itemAt(items[i - 1]), at)) && (
                <li className="flex justify-center py-2" aria-hidden="true">
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#64748B] ring-1 ring-[#E2E8F0]">{dayLabel(at, now)}</span>
                </li>
              )}
              {item.type === 'message' && item.message.author === 'system' ? (
                <li className="flex justify-center">
                  <SystemNote message={item.message} />
                </li>
              ) : item.type === 'message' ? (
                <li className={`flex ${item.message.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <MessageBubble message={item.message} />
                </li>
              ) : (
                <li className="flex justify-center">
                  <AutomationRun run={item} />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </div>
  )
}
