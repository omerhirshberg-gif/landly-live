'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate, formatIsraeliDateTime } from '@/lib/admin/formatDate'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Card, { CardSkeletons } from '@/components/admin/Card'
import MasavModeBadge from '@/components/admin/MasavModeBadge'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import { DANGER_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'
import { formatShekel as money } from '@/lib/finance/format'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'

interface Detail {
  id: string; status: string; valueDate: string; voucherCount: number; merchantCount: number; totalAgorot: number; mock: boolean; institutionCodeUsed: string
  fileName: string | null; fileSha256: string | null; createdAt: string | null; paidAt: string | null
  lines: { businessId: string; businessName: string; voucherCount: number; grossAgorot: number; commissionAgorot: number; netAgorot: number }[]
}

export default function PayoutBatchPage() {
  const { t, tn } = useAdminT()
  const { batchId } = useParams<{ batchId: string }>()
  const [batch, setBatch] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'void' | 'paid' | null>(null)

  const load = useCallback(async () => {
    const res = await adminFetch(`/api/admin/payouts/${encodeURIComponent(batchId)}`)
    const body = await res.json().catch(() => null)
    if (!res.ok) return setError(body?.error ?? t('payBatch.loadFailed'))
    setBatch(body)
  }, [batchId])
  useEffect(() => { void load() }, [load])

  const act = async (action: 'void' | 'paid') => {
    setError(null)
    const res = await adminFetch(`/api/admin/payouts/${encodeURIComponent(batchId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? t('payBatch.actionFailed'))
    setConfirm(null)
    void load()
  }

  if (!batch) return error ? <Alert>{error}</Alert> : <CardSkeletons count={2} />
  const hasFile = batch.status === 'file_generated' || batch.status === 'paid'
  return (
    <div className="space-y-6">
      <PageHeader title={t('payBatch.title')} />
      {batch.mock && <MasavModeBadge institutionCode={batch.institutionCodeUsed} />}
      {error && <Alert>{error}</Alert>}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">{t('payBatch.total')}</p>
            <p className="text-3xl font-extrabold tracking-tight text-[#0B1B3D]"><bdi dir="ltr">{money(batch.totalAgorot)}</bdi></p>
            <p className="mt-1 text-sm text-slate-500">{t('payBatch.summary', { date: `\u2066${formatIsraeliDate(batch.valueDate)}\u2069`, merchants: tn('payBatch.merchant', batch.merchantCount), vouchers: tn('payBatch.voucher', batch.voucherCount) })}</p>
          </div>
          <StatusBadge tone={batch.status === 'paid' ? 'emerald' : batch.status === 'void' ? 'slate' : 'blue'}>{batch.status in { file_generated: 1, paid: 1, void: 1 } ? t(`payBatch.status.${batch.status}` as AdminKey) : batch.status.replace('_', ' ')}</StatusBadge>
        </div>
        <dl className="mt-5 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
          <div><dt className="text-slate-400">{t('payBatch.created')}</dt><dd className="font-medium text-slate-700"><bdi dir="ltr">{formatIsraeliDateTime(batch.createdAt)}</bdi></dd></div>
          {batch.fileName && <div><dt className="text-slate-400">{t('payBatch.file')}</dt><dd className="break-all font-mono text-slate-700"><bdi dir="ltr">{batch.fileName}</bdi></dd></div>}
          {batch.fileSha256 && <div className="sm:col-span-2"><dt className="text-slate-400">SHA-256</dt><dd className="break-all font-mono text-slate-700"><bdi dir="ltr">{batch.fileSha256}</bdi></dd></div>}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
          {hasFile && <a href={`/api/admin/payouts/${encodeURIComponent(batch.id)}/file`} className={PRIMARY_BUTTON}><i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> {t('payBatch.download')}</a>}
          {batch.status === 'file_generated' && <button type="button" onClick={() => setConfirm('paid')} className={SECONDARY_BUTTON}>{t('payBatch.markPaid')}</button>}
          {batch.status !== 'paid' && batch.status !== 'void' && <button type="button" onClick={() => setConfirm('void')} className={DANGER_BUTTON}>{t('payBatch.voidBatch')}</button>}
        </div>
        {confirm && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-sm font-medium text-slate-700">{confirm === 'void' ? t('payBatch.confirmVoid') : t('payBatch.confirmPaid')}</span>
            <button type="button" onClick={() => act(confirm)} className={confirm === 'void' ? DANGER_BUTTON : PRIMARY_BUTTON}>{t('payBatch.confirm')}</button>
            <button type="button" onClick={() => setConfirm(null)} className={SECONDARY_BUTTON}>{t('common.cancel')}</button>
          </div>
        )}
      </Card>
      <section aria-labelledby="lines-h">
        <h2 id="lines-h" className={SECTION_HEADING}>{t('payBatch.merchants')}</h2>
        <Card className="divide-y divide-slate-100">
          {batch.lines.map((l) => (
            <div key={l.businessId} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3.5 text-sm">
              <span className="min-w-0 truncate font-medium text-[#0B1B3D]"><BidiText>{l.businessName}</BidiText></span>
              <span className="flex items-center gap-4 text-xs text-slate-500">
                <span>{tn('payBatch.voucher', l.voucherCount)}</span>
                <span>{t('payBatch.commission', { amount: `\u2066${money(l.commissionAgorot)}\u2069` })}</span>
                <span className="text-sm font-semibold text-[#0B1B3D]"><bdi dir="ltr">{money(l.netAgorot)}</bdi></span>
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
