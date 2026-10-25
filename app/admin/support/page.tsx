'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { AdminStatus, InboxConversation, InboxMessage } from '@/lib/whatsapp/adminInbox'
import { adminFetch } from '@/lib/admin/adminSession'
import { announceNeedsReply } from '@/lib/admin/needsReply'
import { useVisualViewport } from '@/lib/admin/useVisualViewport'
import Alert from '@/components/admin/Alert'
import BackButton from '@/components/admin/BackButton'
import ChatHeader from '@/components/admin/support/ChatHeader'
import ChatTranscript from '@/components/admin/support/ChatTranscript'
import ConversationList, { type InboxFilter } from '@/components/admin/support/ConversationList'
import ReplyComposer from '@/components/admin/support/ReplyComposer'
import type { TranscriptMessage } from '@/components/admin/support/transcript'

// The WhatsApp support inbox: conversations on the left, the open chat on
// the right, with ?c=<waId> naming the open chat. Opening a chat from the
// list adds a history entry, so the browser's back button and edge swipe
// (iOS Safari, Android Chrome) return to the list; switching between chats
// replaces it, so back never steps through every chat looked at. Firestore isn't readable
// from the browser, so the list refreshes every LIST_POLL_MS and the open
// chat every CHAT_POLL_MS, paused while the tab is hidden.
//
// A reply or a status change shows at once: the draft clears into a pending
// bubble, and the chat stops counting as waiting (the ☰ and sidebar badges
// follow the list). Until the server agrees, an override keeps a poll that
// started earlier from bringing the old state back.
//
// Phones get one pane at a time, edge to edge (AdminShell's full-bleed
// main): the list fills the screen below the header, and an open chat is a
// fixed panel over the whole visible viewport (lib/admin/useVisualViewport.ts),
// so the reply box sits right above the keyboard on iOS and Android alike.

const LIST_POLL_MS = 4_000
const CHAT_POLL_MS = 4_000
/** An optimistic change gives way to the server's state after this long, whatever it says. */
const OVERRIDE_MS = 15_000

// Only the panes scroll. On a phone they fill the visible viewport below the
// admin header; from md, the viewport below the header, the page's top
// padding (2rem) and the bottom padding (2rem or the home indicator). The
// header already names the page, so there is no title row.
const PANES_VARS = {
  '--panes-h': 'calc(var(--vv-height, var(--app-dvh)) - var(--admin-header-h))',
  '--panes-h-md': 'calc(var(--app-dvh) - var(--admin-header-h-md) - 2rem - max(2rem, env(safe-area-inset-bottom, 0px)))',
} as React.CSSProperties

const DESKTOP_QUERY = '(min-width: 768px)'

/** While a chat is open on a phone, the page behind its fixed panel doesn't scroll (or rubber-band). */
function usePhoneScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const media = window.matchMedia(DESKTOP_QUERY)
    const previous = document.body.style.overflow
    const apply = () => {
      document.body.style.overflow = media.matches ? previous : 'hidden'
    }
    apply()
    media.addEventListener('change', apply)
    return () => {
      media.removeEventListener('change', apply)
      document.body.style.overflow = previous
    }
  }, [locked])
}

interface Chat {
  conversation: InboxConversation
  messages: InboxMessage[]
}

interface Override {
  patch: Pick<InboxConversation, 'needsReply'> & Partial<Pick<InboxConversation, 'status'>>
  /** When it was made; a member message after this is real news. */
  since: number
}

/** Adds `message` unless a poll already brought it. */
const withMessage = (messages: InboxMessage[], message: InboxMessage) =>
  messages.some((m) => m.id === message.id) ? messages : [...messages, message]

/**
 * Runs `task` now and every `ms` while the tab is visible, and again when it
 * becomes visible; starts over whenever `key` changes, and stops while it is null.
 */
function usePolling(task: () => void, ms: number, key: string | null = '') {
  const taskRef = useRef(task)
  useEffect(() => {
    taskRef.current = task
  })
  useEffect(() => {
    if (key === null) return
    const run = () => {
      if (!document.hidden) taskRef.current()
    }
    run()
    const timer = setInterval(run, ms)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
    }
  }, [ms, key])
}

export default function SupportInboxPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense>
      <SupportInbox />
    </Suspense>
  )
}

function SupportInbox() {
  const router = useRouter()
  const pathname = usePathname()
  const selected = useSearchParams().get('c')

  const [conversations, setConversations] = useState<InboxConversation[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [filter, setFilter] = useState<InboxFilter>('all')
  const [query, setQuery] = useState('')
  const [chat, setChat] = useState<Chat | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // Replies on their way, by chat: shown after the transcript until the server has them.
  const [pending, setPending] = useState<Record<string, TranscriptMessage[]>>({})
  const [sending, setSending] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<AdminStatus | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  // The chat a response belongs to must still be the open one.
  const selectedRef = useRef(selected)
  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Optimistic changes by chat (see the top of the file).
  const overridesRef = useRef(new Map<string, Override>())
  const withOverride = useCallback((conversation: InboxConversation): InboxConversation => {
    const override = overridesRef.current.get(conversation.waId)
    if (!override) return conversation
    const { patch, since } = override
    const agrees = conversation.needsReply === patch.needsReply && (patch.status === undefined || conversation.status === patch.status)
    const wroteSince = conversation.lastInboundAt !== null && Date.parse(conversation.lastInboundAt) > since
    if (agrees || wroteSince || Date.now() - since > OVERRIDE_MS) {
      overridesRef.current.delete(conversation.waId)
      return conversation
    }
    return { ...conversation, ...patch }
  }, [])

  const upsertConversation = useCallback((conversation: InboxConversation) => {
    setConversations((prev) => prev?.map((c) => (c.waId === conversation.waId ? conversation : c)) ?? prev)
    setChat((prev) => (prev && prev.conversation.waId === conversation.waId ? { ...prev, conversation } : prev))
  }, [])

  /** Shows `patch` on the chat at once; the badges follow the list. */
  const optimistic = (waId: string, patch: Override['patch']) => {
    overridesRef.current.set(waId, { patch, since: Date.now() })
    setConversations((prev) => prev?.map((c) => (c.waId === waId ? { ...c, ...patch } : c)) ?? prev)
    setChat((prev) => (prev && prev.conversation.waId === waId ? { ...prev, conversation: { ...prev.conversation, ...patch } } : prev))
  }

  // Only the newest list request may set the list, however the responses arrive.
  const listSeqRef = useRef(0)
  const loadList = useCallback(() => {
    const seq = ++listSeqRef.current
    adminFetch('/api/admin/whatsapp/conversations')
      .then((res) => res.json())
      .then((data) => {
        if (seq !== listSeqRef.current) return
        if (data.error) throw new Error(data.error)
        setConversations(((data.conversations ?? []) as InboxConversation[]).map(withOverride))
        setListError(null)
        setNow(Date.now())
      })
      .catch(() => {
        if (seq === listSeqRef.current) setListError('Failed to load conversations.')
      })
  }, [withOverride])

  const loadChat = useCallback(() => {
    const waId = selectedRef.current
    if (!waId) return
    adminFetch(`/api/admin/whatsapp/conversations/${encodeURIComponent(waId)}`)
      .then(async (res) => ({ ok: res.ok, status: res.status, data: await res.json() }))
      .then(({ ok, status, data }) => {
        if (selectedRef.current !== waId) return
        if (!ok) throw new Error(status === 404 ? 'This conversation no longer exists.' : (data.error ?? 'Failed to load the conversation.'))
        const conversation = withOverride(data.conversation)
        setChat({ conversation, messages: data.messages })
        setChatError(null)
        // Keep the list row in step with what the chat shows.
        setConversations((prev) => prev?.map((c) => (c.waId === waId ? conversation : c)) ?? prev)
      })
      .catch((err) => {
        if (selectedRef.current === waId) setChatError(err instanceof Error ? err.message : 'Failed to load the conversation.')
      })
  }, [withOverride])

  usePolling(loadList, LIST_POLL_MS)
  usePolling(loadChat, CHAT_POLL_MS, selected)
  useVisualViewport()
  usePhoneScrollLock(!!selected)

  // Another chat opened: drop the previous one's transcript and errors.
  useEffect(() => {
    setChat(null)
    setChatError(null)
    setActionError(null)
  }, [selected])

  // Whether the open chat has a history entry of its own to go back from
  // (it was opened from the list here, not arrived at by a link like the
  // team email's ?c=).
  const pushedRef = useRef(false)
  useEffect(() => {
    if (!selected) pushedRef.current = false
  }, [selected])

  const open = (waId: string) => {
    const href = `${pathname}?c=${encodeURIComponent(waId)}`
    if (selected) {
      router.replace(href, { scroll: false })
    } else {
      pushedRef.current = true
      router.push(href, { scroll: false })
    }
  }

  // "All chats" does what the back gesture would, when there is an entry to go back from.
  const closeChat = () => {
    if (pushedRef.current) router.back()
    else router.replace(pathname, { scroll: false })
  }

  const appendMessage = (waId: string, message: InboxMessage) => {
    setChat((prev) => (prev && prev.conversation.waId === waId ? { ...prev, messages: withMessage(prev.messages, message) } : prev))
  }

  const send = async () => {
    const waId = selected
    const text = (waId && drafts[waId]?.trim()) || ''
    if (!waId || !text || sending) return
    // The draft clears into a pending bubble, and the chat stops waiting, before the request leaves.
    const placeholder: TranscriptMessage = {
      id: `pending-${Date.now()}`,
      direction: 'out',
      author: 'admin',
      kind: 'text',
      text,
      at: new Date().toISOString(),
      pending: true,
    }
    setDrafts((prev) => ({ ...prev, [waId]: '' }))
    setPending((prev) => ({ ...prev, [waId]: [...(prev[waId] ?? []), placeholder] }))
    optimistic(waId, { needsReply: false })
    setSending(true)
    setActionError(null)
    let sent = false
    try {
      const res = await adminFetch('/api/admin/whatsapp/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waId, message: text }),
      })
      const data = await res.json()
      if (res.ok) {
        sent = true
        appendMessage(waId, data.message)
      } else if (res.status === 409) {
        setActionError('More than 24 hours have passed since the member last wrote, so WhatsApp no longer accepts free-form replies.')
      } else {
        if (data.message) appendMessage(waId, data.message)
        setActionError(data.error ?? 'Failed to send the reply.')
      }
    } catch {
      setActionError('Failed to send the reply. Check your connection and try again.')
    } finally {
      setPending((prev) => ({ ...prev, [waId]: (prev[waId] ?? []).filter((m) => m.id !== placeholder.id) }))
      if (!sent) {
        // Nothing went out: the chat is still waiting, and the text comes back unless something new was typed.
        overridesRef.current.delete(waId)
        setDrafts((prev) => (prev[waId] ? prev : { ...prev, [waId]: text }))
      }
      setSending(false)
      loadChat()
      loadList()
    }
  }

  const changeStatus = async (status: AdminStatus) => {
    const waId = selected
    if (!waId || pendingStatus) return
    setPendingStatus(status)
    setActionError(null)
    // Resolved or back to the bot: no longer waiting for the team, from this moment.
    if (status !== 'escalated') optimistic(waId, { status, needsReply: false })
    try {
      const res = await adminFetch('/api/admin/whatsapp/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waId, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update the status.')
      upsertConversation(data.conversation)
      if (status === 'resolved' && !data.notified && data.conversation.windowOpen) {
        setActionError('Marked resolved, but the sign-off message could not be sent.')
      }
    } catch (err) {
      overridesRef.current.delete(waId)
      setActionError(err instanceof Error ? err.message : 'Failed to update the status.')
    } finally {
      setPendingStatus(null)
      loadChat()
      loadList()
    }
  }

  // Until the chat itself loads, the list row is enough for the header.
  const conversation = chat?.conversation ?? conversations?.find((c) => c.waId === selected) ?? null
  const awaiting = conversations?.filter((c) => c.needsReply).length ?? 0
  const listLoaded = conversations !== null
  const openPending = selected ? pending[selected] : undefined
  const transcript = useMemo<TranscriptMessage[] | null>(
    () => (chat ? (openPending?.length ? [...chat.messages, ...openPending] : chat.messages) : null),
    [chat, openPending]
  )

  // The shell's badges follow this list instead of waiting for their own poll.
  useEffect(() => {
    if (listLoaded) announceNeedsReply(awaiting)
  }, [listLoaded, awaiting])

  return (
    <div>
      {/* The admin header names the page (mobile title, desktop breadcrumbs). */}
      <h1 className="sr-only">WhatsApp Support</h1>

      <div
        className="grid h-[var(--panes-h)] min-h-[20rem] overflow-hidden bg-white md:h-[var(--panes-h-md)] md:min-h-[26rem] md:grid-cols-[22rem_1fr] md:rounded-2xl md:border md:border-[#E2E8F0] md:shadow-sm"
        style={PANES_VARS}
      >
        <section aria-label="Conversations" className={`min-h-0 flex-col border-[#E2E8F0] md:flex md:border-e ${selected ? 'hidden' : 'flex'}`}>
          <ConversationList
            conversations={conversations}
            error={listError}
            filter={filter}
            onFilter={setFilter}
            query={query}
            onQuery={setQuery}
            selected={selected}
            onSelect={open}
            awaiting={awaiting}
            now={now}
          />
        </section>

        {/* On a phone an open chat covers the visible viewport, header included: its own header has the way back. */}
        <section
          aria-label="Chat"
          className={`min-h-0 min-w-0 flex-col bg-white md:static md:z-auto md:flex md:h-auto ${
            selected ? 'fixed inset-x-0 top-[var(--vv-top,0px)] z-40 flex h-[var(--vv-height,var(--app-dvh))]' : 'hidden'
          }`}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0F7FF] text-xl text-[#0038B8]">
                <i className="fa-regular fa-comments" aria-hidden="true" />
              </div>
              <p className="mt-4 text-base font-semibold text-[#0B1B3D]">Choose a conversation</p>
              <p className="mt-1 max-w-xs text-sm text-[#64748B]">Replies go out on WhatsApp as Landly, in whatever language you write them.</p>
            </div>
          ) : !conversation ? (
            <div className="flex flex-1 flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))] md:pt-4">
              <BackButton onClick={closeChat} className={`-ms-2 self-start ${chatError ? '' : 'md:hidden'}`}>
                All chats
              </BackButton>
              {chatError ? <Alert>{chatError}</Alert> : <div className="h-16 rounded-xl bg-[#F1F5F9] motion-safe:animate-pulse" aria-label="Loading conversation" />}
            </div>
          ) : (
            <>
              <ChatHeader conversation={conversation} onBack={closeChat} onStatus={changeStatus} pendingStatus={pendingStatus} />
              {(actionError || (chatError && chat)) && (
                <Alert className="mx-3 mt-3 shrink-0" tone={actionError?.startsWith('Marked resolved') ? 'warning' : 'error'}>
                  {actionError ?? chatError}
                </Alert>
              )}
              <ChatTranscript waId={conversation.waId} messages={transcript} now={now} />
              <ReplyComposer
                value={drafts[conversation.waId] ?? ''}
                onChange={(value) => setDrafts((prev) => ({ ...prev, [conversation.waId]: value }))}
                onSend={send}
                sending={sending}
                windowOpen={conversation.windowOpen}
                lastInboundAt={conversation.lastInboundAt}
                now={now}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
