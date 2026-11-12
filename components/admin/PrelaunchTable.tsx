'use client'

import { useCallback, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { displayPhone, whatsappHref } from '@/lib/admin/businessPhone'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { leadFullName, type AdminLead } from '@/lib/admin/prelaunchStats'
import { PRELAUNCH_COPY, type Persona, type PrelaunchLang, type ReferralSource } from '@/lib/prelaunch/copy'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import BidiText from './BidiText'
import DataTable, { type Column } from './DataTable'
import StatusBadge from './StatusBadge'

type Translate = (key: AdminKey, vars?: Record<string, string | number>) => string

/** A persona's name (the form's own English wording), or "not answered" in the admin's language. */
export const personaName = (key: Persona | 'none', t: Translate) => (key === 'none' ? t('leadTable.notAnswered') : PRELAUNCH_COPY.en.personas[key])

export const referralSourceName = (key: ReferralSource | 'none', t: Translate) => (key === 'none' ? t('leadTable.notAnswered') : PRELAUNCH_COPY.en.referralSources[key])

export const langName = (lang: PrelaunchLang) => lang.toUpperCase()

// The codes lib/marketing/ravMesser.server records.
const SYNC_ERRORS: Record<string, AdminKey> = {
  token: 'leadTable.err.token',
  timeout: 'leadTable.err.timeout',
  network: 'leadTable.err.network',
  refused: 'leadTable.err.refused',
}

function syncErrorText(code: string | null, t: Translate) {
  if (code?.startsWith('http_')) return t('leadTable.err.http', { code: code.slice(5) })
  return t((code && SYNC_ERRORS[code]) || 'leadTable.err.failed')
}

function LangPill({ lang }: { lang: PrelaunchLang }) {
  return <span className="inline-flex rounded-full bg-[#F0F7FF] px-2.5 py-0.5 text-xs font-bold text-[#0038B8]">{langName(lang)}</span>
}

/** The page they signed up on, and their preferred language when it's a different one. */
function LangCell({ lead }: { lead: AdminLead }) {
  const { t } = useAdminT()
  return (
    <span className="inline-flex items-center gap-1">
      <LangPill lang={lead.lang} />
      {lead.preferredLanguage !== lead.lang && (
        <span title={t('leadTable.prefers', { lang: langName(lead.preferredLanguage) })} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="text-xs text-[#64748B]">→</span>
          <span className="sr-only">{t('leadTable.prefersSr')}</span>
          <LangPill lang={lead.preferredLanguage} />
        </span>
      )}
    </span>
  )
}

function PersonaBadge({ lead }: { lead: AdminLead }) {
  const { t } = useAdminT()
  if (!lead.persona) return <span className="text-sm text-[#64748B]">—</span>
  return (
    <span className="block min-w-0">
      <span className="inline-flex whitespace-nowrap rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">{personaName(lead.persona, t)}</span>
      {lead.personaOtherDescription && (
        <span title={lead.personaOtherDescription} className="mt-1 block text-xs text-[#475569] [overflow-wrap:anywhere]"><BidiText>{lead.personaOtherDescription}</BidiText></span>
      )}
    </span>
  )
}

function ReferralSourceCell({ source }: { source: ReferralSource | null }) {
  const { t } = useAdminT()
  return source
    ? <span title={referralSourceName(source, t)} className="block truncate text-sm text-[#0B1B3D]">{referralSourceName(source, t)}</span>
    : <span className="text-sm text-[#64748B]">—</span>
}

function PhoneCell({ phone }: { phone: string }) {
  const { t } = useAdminT()
  return (
    <span className="flex items-center gap-2">
      <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{displayPhone(phone)}</bdi>
      <a
        href={whatsappHref(phone)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('leadTable.openWhatsapp', { phone: displayPhone(phone) })}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#128C4B] transition-colors hover:bg-[#ECFDF5]"
      >
        <i className="fa-brands fa-whatsapp text-lg" aria-hidden="true" />
      </a>
    </span>
  )
}

function Referral({ lead }: { lead: AdminLead }) {
  const { t } = useAdminT()
  return (
    <span className="block min-w-0 text-xs">
      <code className="block truncate text-[#0B1B3D]">{lead.id}</code>
      {lead.referredBy && <code className="block truncate text-xs text-[#475569]">{t('leadTable.via', { id: lead.referredBy })}</code>}
    </span>
  )
}

function Utm({ lead }: { lead: AdminLead }) {
  if (!lead.utmSource && !lead.utmCampaign) return <span className="text-sm text-[#64748B]">—</span>
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
  const { t } = useAdminT()
  if (lead.syncStatus === 'synced') {
    return <StatusBadge tone="emerald" icon="fa-circle-check"><span>{t('leadTable.synced', { list: `\u2066${listId}\u2069` })}</span></StatusBadge>
  }
  if (lead.syncStatus === 'pending') return <StatusBadge tone="amber" icon="fa-clock">{t('leadTable.pending')}</StatusBadge>
  const reason = syncErrorText(lead.syncError, t)
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex items-center gap-1">
        <span title={reason}><StatusBadge tone="rose" icon="fa-triangle-exclamation">{t('leadTable.failed')}</StatusBadge></span>
        <button
          type="button"
          onClick={() => onRetry(lead)}
          disabled={retrying}
          aria-busy={retrying}
          title={t('leadTable.retry', { reason })}
          aria-label={t('leadTable.retryAria', { email: lead.email, reason })}
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
        <span className="shrink-0"><LangCell lead={lead} /></span>
      </div>
      {(lead.persona || lead.referralSource) && (
        <div className="mt-1 flex items-start justify-between gap-3">
          <PersonaBadge lead={lead} />
          {lead.referralSource && <span className="shrink-0"><ReferralSourceCell source={lead.referralSource} /></span>}
        </div>
      )}
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
  const { t } = useAdminT()
  const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())

  const retry = useCallback(async (lead: AdminLead) => {
    setRetrying((prev) => new Set(prev).add(lead.id))
    try {
      const res = await adminFetch('/api/admin/prelaunch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      if (!res.ok) onRetryError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? t('leadTable.err.failed'))
      await onRetried()
    } catch {
      onRetryError(t('leadTable.err.failed'))
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev)
        next.delete(lead.id)
        return next
      })
    }
  }, [onRetried, onRetryError, t])

  const syncProps = useCallback((lead: AdminLead) => ({
    listId,
    retrying: retrying.has(lead.id),
    onRetry: (row: AdminLead) => void retry(row),
  }), [listId, retrying, retry])

  const columns = useMemo<readonly Column<AdminLead>[]>(() => (
    [
      { id: 'name', header: t('leadTable.col.name'), cell: (lead) => <span title={leadFullName(lead)}><BidiText>{leadFullName(lead)}</BidiText></span>, sortValue: (lead) => leadFullName(lead) },
      { id: 'phone', header: t('leadTable.col.whatsapp'), cell: (lead) => <PhoneCell phone={lead.phone} />, width: 'w-52' },
      { id: 'email', header: t('leadTable.col.email'), cell: (lead) => <bdi dir="ltr" className="block truncate">{lead.email}</bdi>, sortValue: (lead) => lead.email, width: 'w-44' },
      { id: 'persona', header: t('leadTable.col.persona'), cell: (lead) => <PersonaBadge lead={lead} />, sortValue: (lead) => lead.persona ?? '', width: 'w-40' },
      { id: 'source', header: t('leadTable.col.source'), cell: (lead) => <ReferralSourceCell source={lead.referralSource} />, sortValue: (lead) => lead.referralSource ?? '', width: 'w-56' },
      { id: 'lang', header: t('leadTable.col.lang'), cell: (lead) => <LangCell lead={lead} />, sortValue: (lead) => lead.lang, width: 'w-32' },
      { id: 'date', header: t('leadTable.col.registered'), cell: (lead) => <bdi dir="ltr" className="whitespace-nowrap tabular-nums">{formatIsraeliDateTime(lead.createdAt)}</bdi>, sortValue: (lead) => lead.createdAt ?? '', width: 'w-40' },
      { id: 'referral', header: t('leadTable.col.referral'), cell: (lead) => <Referral lead={lead} />, width: 'w-32' },
      { id: 'utm', header: t('leadTable.col.utm'), cell: (lead) => <Utm lead={lead} />, width: 'w-28' },
      {
        id: 'sync',
        header: t('leadTable.col.sync'),
        cell: (lead) => <SyncStatus lead={lead} {...syncProps(lead)} />,
        sortValue: (lead) => lead.syncStatus,
        width: 'w-48',
      },
    ]
  ), [syncProps, t])

  return (
    // Ten columns need this width: narrower screens beside the sidebar scroll the table, not the page.
    <div className="lg:overflow-x-auto">
      <div className="lg:min-w-[104rem]">
        <DataTable
          label={t('leadTable.label')}
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
