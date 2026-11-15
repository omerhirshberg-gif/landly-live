'use client'

import { useMemo } from 'react'
import { displayPhone, whatsappHref } from '@/lib/admin/businessPhone'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { leadFullName, type AdminLead } from '@/lib/admin/prelaunchStats'
import { PRELAUNCH_COPY, type Persona, type PrelaunchLang, type ReferralSource } from '@/lib/prelaunch/copy'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import BidiText from './BidiText'
import DataTable, { type Column } from './DataTable'

type Translate = (key: AdminKey, vars?: Record<string, string | number>) => string

/** A persona's name (the form's own English wording), or "not answered" in the admin's language. */
export const personaName = (key: Persona | 'none', t: Translate) => (key === 'none' ? t('leadTable.notAnswered') : PRELAUNCH_COPY.en.personas[key])

export const referralSourceName = (key: ReferralSource | 'none', t: Translate) => (key === 'none' ? t('leadTable.notAnswered') : PRELAUNCH_COPY.en.referralSources[key])

export const langName = (lang: PrelaunchLang) => lang.toUpperCase()

function LangPill({ lang }: { lang: PrelaunchLang }) {
  return <span className="inline-flex rounded-md bg-adm-accent-soft px-2.5 py-0.5 text-xs font-bold text-adm-accent">{langName(lang)}</span>
}

/** The page they signed up on, and their preferred language when it's a different one. */
function LangCell({ lead }: { lead: AdminLead }) {
  const { t } = useAdminT()
  return (
    <span className="inline-flex items-center gap-1">
      <LangPill lang={lead.lang} />
      {lead.preferredLanguage !== lead.lang && (
        <span title={t('leadTable.prefers', { lang: langName(lead.preferredLanguage) })} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="text-xs text-adm-muted">→</span>
          <span className="sr-only">{t('leadTable.prefersSr')}</span>
          <LangPill lang={lead.preferredLanguage} />
        </span>
      )}
    </span>
  )
}

function PersonaBadge({ lead }: { lead: AdminLead }) {
  const { t } = useAdminT()
  if (!lead.persona) return <span className="text-sm text-adm-muted">—</span>
  return (
    <span className="block min-w-0">
      <span className="inline-flex whitespace-nowrap rounded-md bg-adm-violet-soft px-2.5 py-0.5 text-xs font-semibold text-adm-violet">{personaName(lead.persona, t)}</span>
      {lead.personaOtherDescription && (
        <span title={lead.personaOtherDescription} className="mt-1 block text-xs text-adm-text-2 [overflow-wrap:anywhere]"><BidiText>{lead.personaOtherDescription}</BidiText></span>
      )}
    </span>
  )
}

function ReferralSourceCell({ source }: { source: ReferralSource | null }) {
  const { t } = useAdminT()
  return source
    ? <span title={referralSourceName(source, t)} className="block truncate text-sm text-adm-text">{referralSourceName(source, t)}</span>
    : <span className="text-sm text-adm-muted">—</span>
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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-adm-ok transition-colors hover:bg-adm-ok-soft"
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
      <code className="block truncate text-adm-text">{lead.id}</code>
      {lead.referredBy && <code className="block truncate text-xs text-adm-text-2">{t('leadTable.via', { id: lead.referredBy })}</code>}
    </span>
  )
}

function Utm({ lead }: { lead: AdminLead }) {
  if (!lead.utmSource && !lead.utmCampaign) return <span className="text-sm text-adm-muted">—</span>
  return (
    <span className="block min-w-0 text-sm">
      <BidiText>{lead.utmSource ?? '—'}</BidiText>
      <span className="block text-xs text-adm-text-2"><BidiText>{lead.utmCampaign ?? '—'}</BidiText></span>
    </span>
  )
}

function LeadCard({ lead }: { lead: AdminLead }) {
  return (
    <div className="min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-semibold text-adm-text"><BidiText>{leadFullName(lead)}</BidiText></div>
        <span className="shrink-0"><LangCell lead={lead} /></span>
      </div>
      {(lead.persona || lead.referralSource) && (
        <div className="mt-1 flex items-start justify-between gap-3">
          <PersonaBadge lead={lead} />
          {lead.referralSource && <span className="shrink-0"><ReferralSourceCell source={lead.referralSource} /></span>}
        </div>
      )}
      <div className="mt-1 text-sm text-adm-text-2"><PhoneCell phone={lead.phone} /></div>
      <bdi dir="ltr" className="block truncate text-sm text-adm-text-2">{lead.email}</bdi>
      <div className="mt-2 flex items-end justify-between gap-3 text-xs text-adm-text-2">
        <Referral lead={lead} />
        <bdi dir="ltr" className="shrink-0 whitespace-nowrap tabular-nums">{formatIsraeliDateTime(lead.createdAt)}</bdi>
      </div>
      {(lead.utmSource || lead.utmCampaign) && <div className="mt-2"><Utm lead={lead} /></div>}
    </div>
  )
}

// The leads, as a table from lg and as cards below it.
export default function PrelaunchTable({ rows }: { rows: readonly AdminLead[] }) {
  const { t } = useAdminT()

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
    ]
  ), [t])

  return (
    // Nine columns need this width: narrower screens beside the sidebar scroll the table, not the page.
    <div className="lg:overflow-x-auto">
      <div className="lg:min-w-[94rem]">
        <DataTable
          label={t('leadTable.label')}
          rows={rows}
          rowKey={(lead) => lead.id}
          columns={columns}
          card={(lead) => <LeadCard lead={lead} />}
          initialSort={{ id: 'date', direction: 'desc' }}
        />
      </div>
    </div>
  )
}
