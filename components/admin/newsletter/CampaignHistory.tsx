'use client'

import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import Card from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { SECONDARY_BUTTON } from '@/components/admin/formStyles'
import type { CampaignRecord } from './types'

const STATUS_TONE: Record<CampaignRecord['status'], string> = {
  sending: 'bg-adm-warn-soft text-adm-warn border-adm-warn-line',
  sent: 'bg-adm-ok-soft text-adm-ok border-adm-ok-line',
  partial: 'bg-adm-warn-soft text-adm-warn border-adm-warn-line',
  failed: 'bg-adm-danger-soft text-adm-danger border-adm-danger-line',
  simulated: 'bg-adm-raised text-adm-text-2 border-adm-line',
}

function StatusBadge({ status }: { status: CampaignRecord['status'] }) {
  const { t } = useAdminT()
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status] ?? STATUS_TONE.simulated}`}>
      {t(`newsletter.status.${status}` as AdminKey)}
    </span>
  )
}

function audienceLabel(c: CampaignRecord, t: (key: AdminKey) => string): string {
  const parts: string[] = [t(`newsletter.audience.${c.audience?.kind ?? 'users'}` as AdminKey)]
  if (c.audience?.segment && c.audience.segment !== 'all') parts.push(t(`newsletter.segment.${c.audience.segment}` as AdminKey))
  if (c.audience?.lang && c.audience.lang !== 'all') parts.push(c.audience.lang.toUpperCase())
  return parts.join(' · ')
}

// Read-only log of what was sent: when, what, to whom, how many and how it ended.
export default function CampaignHistory({ campaigns, loading, onRefresh }: { campaigns: CampaignRecord[] | null; loading: boolean; onRefresh: () => void }) {
  const { t } = useAdminT()
  const delivered = (c: CampaignRecord) => t('newsletter.history.delivered', { sent: c.sentCount, n: c.recipientCount })
  return (
    <section aria-labelledby="newsletter-history">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="newsletter-history" className="text-base font-bold tracking-tight text-adm-text">{t('newsletter.history')}</h2>
        <button type="button" onClick={onRefresh} disabled={loading} className={`${SECONDARY_BUTTON} !min-h-11`}>
          <i className={`fa-solid fa-rotate ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {t('newsletter.history.refresh')}
        </button>
      </div>
      {campaigns && campaigns.length === 0 ? (
        <EmptyState icon="fa-paper-plane" title={t('newsletter.history.empty')} />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-adm-line-soft md:hidden">
            {(campaigns ?? []).map((c) => (
              <li key={c.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <bdi dir="auto" className="min-w-0 break-words font-semibold text-adm-text">{c.subject}</bdi>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-1 text-xs text-adm-muted tabular-nums">{formatIsraeliDateTime(c.createdAt)}</p>
                <p className="mt-2 text-sm text-adm-text-2">{audienceLabel(c, t)}</p>
                <p className="mt-0.5 text-sm tabular-nums text-adm-text-2">{delivered(c)}</p>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-adm-line text-xs font-bold uppercase tracking-wider text-adm-muted">
                  {(['date', 'subject', 'audience', 'recipients', 'status', 'sender'] as const).map((col) => (
                    <th key={col} scope="col" className="px-4 py-3 text-start font-bold">{t(`newsletter.history.${col}` as AdminKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-adm-line-soft">
                {(campaigns ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-adm-text-2">{formatIsraeliDateTime(c.createdAt)}</td>
                    <td className="max-w-xs px-4 py-3"><bdi dir="auto" className="block truncate font-semibold text-adm-text">{c.subject}</bdi></td>
                    <td className="px-4 py-3 text-adm-text-2">{audienceLabel(c, t)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-adm-text-2">{delivered(c)}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-adm-text-2">{t('newsletter.history.admin')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  )
}
