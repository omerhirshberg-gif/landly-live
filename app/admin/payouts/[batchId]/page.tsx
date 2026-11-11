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

interface Detail {
  id: string; status: string; valueDate: string; voucherCount: number; merchantCount: number; totalAgorot: number; mock: boolean; institutionCodeUsed: string
  fileName: string | null; fileSha256: string | null; createdAt: string | null; paidAt: string | null
  lines: { businessId: string; businessName: string; voucherCount: number; grossAgorot: number; commissionAgorot: number; netAgorot: number }[]
}

export default function PayoutBatchPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const [batch, setBatch] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'void' | 'paid' | null>(null)

  const load = useCallback(async () => {
    const res = await adminFetch(`/api/admin/payouts/${encodeURIComponent(batchId)}`)
    const body = await res.json().catch(() => null)
    if (!res.ok) return setError(body?.error ?? 'Could not load this batch.')
    setBatch(body)
  }, [batchId])
  useEffect(() => { void load() }, [load])

  const act = async (action: 'void' | 'paid') => {
    setError(null)
    const res = await adminFetch(`/api/admin/payouts/${encodeURIComponent(batchId)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? 'The action failed.')
    setConfirm(null)
    void load()
  }

  if (!batch) return error ? <Alert>{error}</Alert> : <CardSkeletons count={2} />
  const hasFile = batch.status === 'file_generated' || batch.status === 'paid'
  return (
    <div className="space-y-6">
      <PageHeader title="Payout batch" />
      {batch.mock && <MasavModeBadge institutionCode={batch.institutionCodeUsed} />}
      {error && <Alert>{error}</Alert>}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Total to pay</p>
            <p className="text-3xl font-extrabold tracking-tight text-[#0B1B3D]"><bdi dir="ltr">{money(batch.totalAgorot)}</bdi></p>
            <p className="mt-1 text-sm text-slate-500">Pay date <bdi dir="ltr">{formatIsraeliDate(batch.valueDate)}</bdi> · {batch.merchantCount} {batch.merchantCount === 1 ? 'merchant' : 'merchants'} · {batch.voucherCount} {batch.voucherCount === 1 ? 'voucher' : 'vouchers'}</p>
          </div>
          <StatusBadge tone={batch.status === 'paid' ? 'emerald' : batch.status === 'void' ? 'slate' : 'blue'}>{batch.status.replace('_', ' ')}</StatusBadge>
        </div>
        <dl className="mt-5 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
          <div><dt className="text-slate-400">Created</dt><dd className="font-medium text-slate-700"><bdi dir="ltr">{formatIsraeliDateTime(batch.createdAt)}</bdi></dd></div>
          {batch.fileName && <div><dt className="text-slate-400">File</dt><dd className="break-all font-mono text-slate-700"><bdi dir="ltr">{batch.fileName}</bdi></dd></div>}
          {batch.fileSha256 && <div className="sm:col-span-2"><dt className="text-slate-400">SHA-256</dt><dd className="break-all font-mono text-slate-700"><bdi dir="ltr">{batch.fileSha256}</bdi></dd></div>}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
          {hasFile && <a href={`/api/admin/payouts/${encodeURIComponent(batch.id)}/file`} className={PRIMARY_BUTTON}><i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> Download .dat</a>}
          {batch.status === 'file_generated' && <button type="button" onClick={() => setConfirm('paid')} className={SECONDARY_BUTTON}>Mark as paid</button>}
          {batch.status !== 'paid' && batch.status !== 'void' && <button type="button" onClick={() => setConfirm('void')} className={DANGER_BUTTON}>Void batch</button>}
        </div>
        {confirm && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <span className="text-sm font-medium text-slate-700">{confirm === 'void' ? 'Release these vouchers so a later batch can pay them?' : 'Confirm the bank has processed this file?'}</span>
            <button type="button" onClick={() => act(confirm)} className={confirm === 'void' ? DANGER_BUTTON : PRIMARY_BUTTON}>Confirm</button>
            <button type="button" onClick={() => setConfirm(null)} className={SECONDARY_BUTTON}>Cancel</button>
          </div>
        )}
      </Card>
      <section aria-labelledby="lines-h">
        <h2 id="lines-h" className={SECTION_HEADING}>Merchants</h2>
        <Card className="divide-y divide-slate-100">
          {batch.lines.map((l) => (
            <div key={l.businessId} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-3.5 text-sm">
              <span className="min-w-0 truncate font-medium text-[#0B1B3D]"><BidiText>{l.businessName}</BidiText></span>
              <span className="flex items-center gap-4 text-xs text-slate-500">
                <span>{l.voucherCount} {l.voucherCount === 1 ? 'voucher' : 'vouchers'}</span>
                <span>Commission <bdi dir="ltr">{money(l.commissionAgorot)}</bdi></span>
                <span className="text-sm font-semibold text-[#0B1B3D]"><bdi dir="ltr">{money(l.netAgorot)}</bdi></span>
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
