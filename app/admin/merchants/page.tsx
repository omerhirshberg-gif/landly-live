'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { en } from '@/lib/admin/translations/en'
import { termsLabel } from '@/components/admin/offers/WizardParts'
import { isPaymentTerms } from '@/lib/merchants/terms'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'

interface InviteRow { id: string; businessName: string; contactEmail: string; commissionRate: number; paymentTerms: string; status: string; createdAt: string | null; expiresAt: string | null; completedAt: string | null; batchId: string | null }
interface BusinessRow { id: string; name: string; hasTerms: boolean; onboarded: boolean }

const TONE: Record<string, StatusTone> = { pending: 'blue', opened: 'blue', processing: 'amber', completed: 'emerald', expired: 'slate', revoked: 'rose' }

export default function MerchantInvitesPage() {
  const { t } = useAdminT()
  const [data, setData] = useState<{ invites: InviteRow[]; businesses: BusinessRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await adminFetch('/api/admin/merchants/invites')
    if (!res.ok) return setError(t('mer.loadFailed'))
    setData(await res.json())
  }, [])
  useEffect(() => { void load() }, [load])

  const revoke = async (id: string) => {
    const res = await adminFetch(`/api/admin/merchants/invites/${id}/revoke`, { method: 'POST' })
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? t('mer.revokeFailed'))
    void load()
  }

  const notOnboarded = (data?.businesses ?? []).filter((b) => !b.onboarded)

  return (
    <>
      <PageHeader
        title={t('route.Merchant Invites')}
        subtitle={t('mer.subtitle')}
        actions={<>
          <Link href="/admin/merchants/batch" className={SECONDARY_BUTTON}><i className="fa-solid fa-file-csv" aria-hidden="true" /> {t('mer.batchUpload')}</Link>
          <Link href="/admin/merchants/invite" className={PRIMARY_BUTTON}><i className="fa-solid fa-plus" aria-hidden="true" /> {t('mer.invite')}</Link>
        </>}
      />
      {error && <Alert className="mb-4">{error}</Alert>}
      {!data && !error && <CardSkeletons count={3} />}
      {data && data.invites.length === 0 && <EmptyState icon="fa-envelope-open-text" title={t('mer.emptyTitle')} description={t('mer.emptyBody')} />}
      {data && data.invites.length > 0 && (
        <Card className="divide-y divide-slate-100">
          {data.invites.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0B1B3D]"><BidiText>{i.businessName}</BidiText></p>
                <p className="truncate text-xs text-slate-500"><bdi dir="ltr">{i.contactEmail}</bdi></p>
                <p className="text-xs text-slate-500"><bdi dir="ltr">{Number((i.commissionRate * 100).toFixed(2))}%</bdi> · {isPaymentTerms(i.paymentTerms) ? termsLabel(t, i.paymentTerms) : i.paymentTerms}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400"><bdi dir="ltr">{i.status === 'completed' ? formatIsraeliDate(i.completedAt) : `${t('mer.expires')} ${formatIsraeliDate(i.expiresAt)}`}</bdi></span>
                <StatusBadge tone={TONE[i.status] ?? 'slate'}>{`mer.status.${i.status}` in en ? t(`mer.status.${i.status}` as AdminKey) : i.status}</StatusBadge>
                {(i.status === 'pending' || i.status === 'opened') && (
                  <button type="button" onClick={() => revoke(i.id)} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-rose-700 hover:underline">{t('mer.revoke')}</button>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
      {notOnboarded.length > 0 && (
        <section className="mt-10" aria-labelledby="legacy-h">
          <h2 id="legacy-h" className={SECTION_HEADING}>{t('mer.withoutAgreement')}</h2>
          <Card className="divide-y divide-slate-100">
            {notOnboarded.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <span className="truncate font-medium text-[#0B1B3D]"><BidiText>{b.name}</BidiText></span>
                <StatusBadge tone={b.hasTerms ? 'blue' : 'amber'}>{b.hasTerms ? t('mer.termsSet') : t('mer.noTerms')}</StatusBadge>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-slate-400">{t('mer.legacyNote')}</p>
        </section>
      )}
    </>
  )
}
