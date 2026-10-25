'use client'

import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { REPLY_MAX } from '@/lib/whatsapp/replyLimits'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { relativeTime } from './time'

const MAX_HEIGHT = 160

// Phones and tablets without a mouse: the on-screen Enter adds a line and the
// send button sends, as in WhatsApp's mobile app. Everywhere else Enter
// sends and Shift+Enter adds a line, as in WhatsApp Web.
const TOUCH_FIRST = '(hover: none) and (pointer: coarse)'

function subscribeTouchFirst(onChange: () => void) {
  const media = window.matchMedia(TOUCH_FIRST)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const useTouchFirst = () =>
  useSyncExternalStore(
    subscribeTouchFirst,
    () => window.matchMedia(TOUCH_FIRST).matches,
    () => false
  )

type EnterKey = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'metaKey' | 'ctrlKey' | 'isComposing' | 'keyCode'>

/** Whether this keydown sends the reply rather than adding a line. */
export function sendsOnEnter(e: EnterKey, touchFirst: boolean): boolean {
  if (e.key !== 'Enter' || e.shiftKey) return false
  // Mid-word in an IME (Android keyboards report keyCode 229): Enter confirms the word.
  if (e.isComposing || e.keyCode === 229) return false
  // ⌘/Ctrl+Enter still sends from a touch device's hardware keyboard.
  return !touchFirst || e.metaKey || e.ctrlKey
}

interface ReplyComposerProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  sending: boolean
  /** Meta's 24-hour window: closed means only templates may be sent. */
  windowOpen: boolean
  lastInboundAt: string | null
  now: number
}

export default function ReplyComposer({ value, onChange, onSend, sending, windowOpen, lastInboundAt, now }: ReplyComposerProps) {
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const touchFirst = useTouchFirst()
  const canSend = windowOpen && !sending && value.trim().length > 0 && value.trim().length <= REPLY_MAX

  // Grows with its text up to MAX_HEIGHT, then scrolls.
  useLayoutEffect(() => {
    const el = fieldRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
  }, [value])

  if (!windowOpen) {
    return (
      <div className="shrink-0 border-t border-[#E2E8F0] bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-[#475569]">
        <i className="fa-solid fa-lock me-2 text-[#94A3B8]" aria-hidden="true" />
        The member last wrote{' '}
        <bdi dir="ltr" className="font-semibold">
          {relativeTime(lastInboundAt, now)}
        </bdi>{' '}
        ago. WhatsApp only allows replies within 24 hours of their last message; the chat reopens when they write again.
      </div>
    )
  }

  return (
    <form
      className="shrink-0 border-t border-[#E2E8F0] bg-white px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={fieldRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (!sendsOnEnter(e.nativeEvent, touchFirst)) return
            e.preventDefault()
            if (canSend) onSend()
          }}
          rows={1}
          dir="auto"
          enterKeyHint={touchFirst ? 'enter' : 'send'}
          maxLength={REPLY_MAX}
          // Read-only rather than disabled while sending, so focus stays for the next reply.
          readOnly={sending}
          aria-busy={sending}
          placeholder="Reply as Landly…"
          aria-label="Reply to the member"
          aria-describedby="reply-hint"
          className="block min-h-12 w-full resize-none rounded-xl border border-[#CBD5E1] bg-white px-4 py-3 text-base leading-6 text-[#0F172A] outline-none transition-[border-color,box-shadow] placeholder:text-[#94A3B8] focus:border-[#0038B8] focus:ring-4 focus:ring-[#0038B8]/15 read-only:bg-[#F8FAFC]"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sending ? 'Sending' : 'Send reply'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0038B8] text-white shadow-sm shadow-[#0038B8]/25 transition-colors hover:bg-[#002A8A] active:bg-[#002066] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0038B8] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 [-webkit-tap-highlight-color:transparent]"
        >
          {sending ? <ButtonSpinner /> : <i className="fa-solid fa-paper-plane" aria-hidden="true" />}
        </button>
      </div>
      <p id="reply-hint" className="mt-1.5 hidden text-[11px] text-[#94A3B8] sm:block">
        {touchFirst ? (
          'Enter for a new line · '
        ) : (
          <>
            <kbd className="font-sans">Enter</kbd> to send · <kbd className="font-sans">Shift</kbd> + <kbd className="font-sans">Enter</kbd> for new line ·{' '}
          </>
        )}
        Sent on WhatsApp as Landly · The bot stays quiet for 24 hours after a reply
      </p>
    </form>
  )
}
