'use client'

import { useCallback, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { displayPhone, whatsappHref } from '@/lib/admin/businessPhone'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { leadFullName, type AdminLead } from '@/lib/admin/prelaunchStats'
import { PRELAUNCH_COPY, type Persona, type PrelaunchLang } from '@/lib/prelaunch/copy'
import BidiText from './BidiText'
import DataTable, { type Column } from './DataTable'
import StatusBadge from './StatusBadge'

export const PERSONA_NAMES: Record<Persona | 'none', string> = { ...PRELAUNCH_COPY.en.personas, none: 'Not answered' }

export const langName = (lang: PrelaunchLang) => lang.toUpperCase()

// The codes lib/marketing/ravMesser.server records.
const SYNC_ERRORS: Record<string, string> = {
  token: 'Rav Messer refused our credentials.',
  timeout: 'Rav Messer did not answer in time.',
  network: 'Could not reach Rav Messer.',
  refused: 'Rav Messer refused this subscriber.',
}

function syncErrorText(code: string | null) {
  if (code?.startsWith('http_')) return `Rav Messer answered with an error (${code.slice(5)}).`
  return (code && SYNC_ERRORS[code]) || 'The sync failed.'
}

function LangPill({ lang }: { lang: PrelaunchLang }) {
  return <span className="inline-flex rounded-full bg-[#F0F7FF] px-2.5 py-0.5 text-xs font-bold text-[#0038B8]">{langName(lang)}</span>
}

function PersonaBadge({ persona }: { persona: Persona | null }) {
  return persona
    ? <span className="inline-flex whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">{PERSONA_NAMES[persona]}</span>
    : <span className="text-sm text-[#94A3B8]">—</span>
}

function PhoneCell({ phone }: { phone: string }) {
  return (
    <span className="flex items-center gap-2">
      <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{displayPhone(phone)}</bdi>
      <a
        href={whatsappHref(phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open a WhatsApp chat with ${displayPhone(phone)}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#128C4B] transition-colors hover:bg-[#ECFDF5]"
      >
        <i className="fa-brands fa-whatsapp text-lg" aria-hidden="true" />
      </a>
    </span>
  )
}

function Referral({ lead }: { lead: AdminLead }) {
  return (
    <span className="block min-w-0 text-xs">
      <code className="block truncate text-[#0B1B3D]">{lead.id}</code>
      {lead.referredBy && <code className="block truncate text-xs text-[#475569]">via {lead.referredBy}</code>}
    </span>
  )
}

function Utm({ lead }: { lead: AdminLead }) {
  if (!lead.utmSource && !lead.utmCampaign) return <span className="text-sm text-[#94A3B8]">—</span>
  return (
    <span className="block min-w-0 text-sm">
      <BidiText>{lead.utmSource ?? '—'}</BidiText>
      <span className="block text-xs text-[#475569]"><BidiText>{lead.utmCampaign ?? '—'}</BidiText></span>
    </span>
  )
}

interface SyncProps {
  lead: AdminLead
  listId: string
  retrying: boolean
  onRetry: (lead: AdminLead) => void
  /** Touch screens have no tooltip, so the card spells out the reason. */
  showReason?: boolean
}

function SyncStatus({ lead, listId, retrying, onRetry, showReason = false }: SyncProps) {
  if (lead.syncStatus === 'synced') {
    return <StatusBadge tone="emerald" icon="fa-circle-check"><span>Synced (<bdi dir="ltr">{listId}</bdi>)</span></StatusBadge>
  }
  if (lead.syncStatus === 'pending') return <StatusBadge tone="amber" icon="fa-clock">Pending</StatusBadge>
  const reason = syncErrorText(lead.syncError)
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1">
        <span title={reason}><StatusBadge tone="rose" icon="fa-triangle-exclamation">Failed</StatusBadge></span>
        <button
          type="button"
          onClick={() => onRetry(lead)}
          disabled={retrying}
          aria-busy={retrying}
          title={`Retry. ${reason}`}
          aria-label={`Retry the sync for ${lead.email}. ${reason}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#0038B8] transition-colors hover:bg-[#F0F7FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8] disabled:opacity-50"
        >
          <i className={`fa-solid fa-rotate-right text-xs ${retrying ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </span>
      {showReason && <span className="text-xs text-rose-700">{reason}</span>}
    </span>
  )
}

function LeadCard({ lead, sync }: { lead: AdminLead; sync: Omit<SyncProps, 'lead'> }) {
  return (
    <div className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-semibold text-[#0B1B3D]"><BidiText>{leadFullName(lead)}</BidiText></div>
        <span className="flex shrink-0 items-center gap-1.5"><PersonaBadge persona={lead.persona} /><LangPill lang={lead.lang} /></span>
      </div>
      <div className="mt-1 text-sm text-[#475569]"><PhoneCell phone={lead.phone} /></div>
      <bdi dir="ltr" className="block truncate text-sm text-[#475569]">{lead.email}</bdi>
      <div className="mt-2 flex items-end justify-between gap-3 text-xs text-[#475569]">
        <Referral lead={lead} />
        <bdi dir="ltr" className="shrink-0 whitespace-nowrap tabular-nums">{formatIsraeliDateTime(lead.createdAt)}</bdi>
      </div>
      {(lead.utmSource || lead.utmCampaign) && <div className="mt-2"><Utm lead={lead} /></div>}
      <div className="mt-2"><SyncStatus lead={lead} {...sync} showReason /></div>
    </div>
  )
}

// The leads, as a table from lg and as cards below it. A failed lead's Retry
// asks the server to sync it again, then the page reloads the rows.
export default function PrelaunchTable({ rows, listId, onRetried, onRetryError }: {
  rows: readonly AdminLead[]
  listId: string
  onRetried: () => void | Promise<void>
  onRetryError: (message: string) => void
}) {
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())

  const retry = useCallback(async (lead: AdminLead) => {
    setRetrying((prev) => new Set(prev).add(lead.id))
    try {
      const res = await adminFetch('/api/admin/prelaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      if (!res.ok) onRetryError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'The sync failed.')
      await onRetried()
    } catch {
      onRetryError('The sync failed.')
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev)
        next.delete(lead.id)
        return next
      })
    }
  }, [onRetried, onRetryError])

  const syncProps = useCallback((lead: AdminLead) => ({
    listId,
    retrying: retrying.has(lead.id),
    onRetry: (row: AdminLead) => void retry(row),
  }), [listId, retrying, retry])

  const columns = useMemo<readonly Column<AdminLead>[]>(() => (
    [
      { id: 'name', header: 'Name', cell: (lead) => <span title={leadFullName(lead)}><BidiText>{leadFullName(lead)}</BidiText></span>, sortValue: (lead) => leadFullName(lead) },
      { id: 'phone', header: 'WhatsApp', cell: (lead) => <PhoneCell phone={lead.phone} />, width: 'w-52' },
      { id: 'email', header: 'Email', cell: (lead) => <bdi dir="ltr" className="block truncate">{lead.email}</bdi>, sortValue: (lead) => lead.email, width: 'w-44' },
      { id: 'persona', header: 'Persona', cell: (lead) => <PersonaBadge persona={lead.persona} />, sortValue: (lead) => lead.persona ?? '', width: 'w-36' },
      { id: 'lang', header: 'Lang', cell: (lead) => <LangPill lang={lead.lang} />, sortValue: (lead) => lead.lang, width: 'w-20' },
      { id: 'date', header: 'Registered', cell: (lead) => <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{formatIsraeliDateTime(lead.createdAt)}</bdi>, sortValue: (lead) => lead.createdAt ?? '', width: 'w-40' },
      { id: 'referral', header: 'Referral', cell: (lead) => <Referral lead={lead} />, width: 'w-32' },
      { id: 'utm', header: 'UTM', cell: (lead) => <Utm lead={lead} />, width: 'w-28' },
      {
        id: 'sync',
        header: 'Mailing list',
        cell: (lead) => <SyncStatus lead={lead} {...syncProps(lead)} />,
        sortValue: (lead) => lead.syncStatus,
        width: 'w-48',
      },
    ]
  ), [syncProps])

  return (
    // Nine columns need this width: narrower screens beside the sidebar scroll the table, not the page.
    <div className="lg:overflow-x-auto">
      <div className="lg:min-w-[85rem]">
        <DataTable
          label="Pre-launch leads"
          rows={rows}
          rowKey={(lead) => lead.id}
          columns={columns}
          card={(lead) => <LeadCard lead={lead} sync={syncProps(lead)} />}
          initialSort={{ id: 'date', direction: 'desc' }}
        />
      </div>
    </div>
  )
}
