'use client'

import type { InboxConversation } from '@/lib/whatsapp/adminInbox'
import Alert from '@/components/admin/Alert'
import { ADMIN_INPUT } from '@/components/admin/formStyles'
import { CategoryBadge, ConversationStatusBadge, LanguageBadge } from './ConversationBadges'
import { phoneOf, relativeTime } from './time'

export type InboxFilter = 'all' | 'awaiting' | 'resolved'

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'awaiting', label: 'Awaiting reply' },
  { id: 'resolved', label: 'Resolved' },
]

export function matchesFilter(conversation: InboxConversation, filter: InboxFilter): boolean {
  if (filter === 'awaiting') return conversation.status === 'escalated'
  if (filter === 'resolved') return conversation.status === 'resolved'
  return true
}

/** By name or by any run of the number's digits ("050 123", "+97250…"). */
export function matchesQuery(conversation: InboxConversation, query: string): boolean {
  const text = query.trim().toLowerCase()
  if (!text) return true
  const digits = text.replace(/\D/g, '').replace(/^0/, '')
  return (conversation.name?.toLowerCase().includes(text) ?? false) || (digits.length > 0 && conversation.waId.includes(digits))
}

interface ConversationListProps {
  conversations: InboxConversation[] | null
  error: string | null
  filter: InboxFilter
  onFilter: (filter: InboxFilter) => void
  query: string
  onQuery: (query: string) => void
  selected: string | null
  onSelect: (waId: string) => void
  /** How many chats need a reply; shown here on phones, where the page title row is hidden. */
  awaiting: number
  now: number
}

export default function ConversationList({ conversations, error, filter, onFilter, query, onQuery, selected, onSelect, awaiting, now }: ConversationListProps) {
  // A dash while loading, so the badge (and the tab's width) is there from the first paint.
  const counts = Object.fromEntries(FILTERS.map(({ id }) => [id, conversations ? conversations.filter((c) => matchesFilter(c, id)).length : '–']))
  const visible = conversations?.filter((c) => matchesFilter(c, filter) && matchesQuery(c, query)) ?? []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b border-[#E2E8F0] p-3">
        {awaiting > 0 && (
          <p className="text-xs font-bold text-[#B91C1C] md:hidden" aria-live="polite">
            <bdi dir="ltr">{awaiting}</bdi> awaiting reply
          </p>
        )}
        {/* Three equal columns whatever the labels and counts, so switching tabs never shifts or overflows the row. */}
        <div role="tablist" aria-label="Filter conversations" className="grid grid-cols-3 gap-1 rounded-xl bg-[#F1F5F9] p-1">
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => onFilter(id)}
              className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors active:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] ${
                filter === id ? 'bg-white text-[#0B1B3D] shadow-sm' : 'text-[#64748B] hover:text-[#0B1B3D]'
              }`}
            >
              <span className="min-w-0 truncate">{label}</span>
              <span className={`min-w-[1.5rem] shrink-0 rounded-full px-1.5 text-center text-[11px] tabular-nums ${filter === id ? 'bg-[#F0F7FF] text-[#0038B8]' : 'bg-white/70'}`}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <i className="fa-solid fa-magnifying-glass pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search name or phone"
            aria-label="Search conversations by name or phone"
            className={`${ADMIN_INPUT} ps-10`}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {error && <Alert className="m-3">{error}</Alert>}
        {conversations === null && !error && (
          <ul aria-label="Loading conversations" className="space-y-px p-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="h-[72px] rounded-xl bg-[#F1F5F9] motion-safe:animate-pulse" />
            ))}
          </ul>
        )}
        {conversations !== null && visible.length === 0 && (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F0F7FF] text-lg text-[#0038B8]">
              <i className={`fa-solid ${query ? 'fa-magnifying-glass' : 'fa-inbox'}`} aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#0B1B3D]">{query ? 'No matches' : 'Nothing here'}</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              {query ? 'Try another name or number.' : filter === 'awaiting' ? 'No one is waiting for the team.' : 'Conversations appear when members write on WhatsApp.'}
            </p>
          </div>
        )}
        <ul className="divide-y divide-[#F1F5F9]">
          {visible.map((conversation) => (
            <li key={conversation.waId}>
              <ConversationRow conversation={conversation} active={conversation.waId === selected} onSelect={onSelect} now={now} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function ConversationRow({ conversation, active, onSelect, now }: { conversation: InboxConversation; active: boolean; onSelect: (waId: string) => void; now: number }) {
  const { waId, name, lang, langSelected, status, category, needsReply, lastSnippet, lastInboundAt } = conversation
  return (
    <button
      type="button"
      onClick={() => onSelect(waId)}
      aria-current={active ? 'true' : undefined}
      className={`relative flex min-h-16 w-full items-start gap-3 px-4 py-3 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0038B8] ${
        active ? 'bg-[#F0F7FF] before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-[#0038B8]' : 'hover:bg-[#F8FAFC] active:bg-[#F1F5F9]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`min-w-0 truncate text-[15px] ${needsReply ? 'font-bold text-[#0B1B3D]' : 'font-semibold text-[#0F172A]'}`}>
            {name ? <span dir="auto">{name}</span> : <bdi dir="ltr">{phoneOf(waId)}</bdi>}
          </span>
          <LanguageBadge lang={lang} selected={langSelected} />
          {needsReply && category && <CategoryBadge category={category} />}
        </div>
        {name && (
          <div className="mt-0.5 text-xs text-[#94A3B8]">
            <bdi dir="ltr">{phoneOf(waId)}</bdi>
          </div>
        )}
        <p className={`mt-1 truncate text-[13px] ${needsReply ? 'font-medium text-[#334155]' : 'text-[#64748B]'}`}>
          {lastSnippet?.direction === 'out' && <span className="text-[#94A3B8]">You: </span>}
          <span dir="auto">{lastSnippet?.text ?? ''}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs tabular-nums text-[#94A3B8]">
          <bdi dir="ltr">{relativeTime(lastInboundAt, now)}</bdi>
        </span>
        {needsReply ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-bold text-[#B91C1C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" aria-hidden="true" />
            Needs reply
          </span>
        ) : (
          status !== 'active' && <ConversationStatusBadge status={status} />
        )}
      </div>
    </button>
  )
}
