'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDate } from '@/lib/admin/formatDate'
import { formatShekel as money } from '@/lib/finance/format'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { en } from '@/lib/admin/translations/en'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Card from '@/components/admin/Card'
import MasavModeBadge from '@/components/admin/MasavModeBadge'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'

interface Line { businessId: string; businessName: string; voucherIds: string[]; grossAgorot: number; commissionAgorot: number; netAgorot: number; notYetDue: number; blocked: string | null }
interface Preview { valueDate: string; lines: Line[]; readyCount: number; readyVouchers: number; readyNetAgorot: number }
interface Batch { id: string; status: string; valueDate: string; voucherCount: number; merchantCount: number; totalAgorot: number; mock: boolean; fileName: string | null; createdAt: string | null }
interface Overview { masav: { institutionCode: string; sendingCode: string; isMock: boolean } | null; masavError: string | null; encryptionConfigured: boolean; batches: Batch[] }

const TONE: Record<string, StatusTone> = { file_generated: 'blue', paid: 'emerald', void: 'slate', locking: 'amber' }

const israelToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())

// Monthly merchant settlement: pick the payment date, review who is paid and
// who is held back (and why), then lock the vouchers and generate the MASAV
// file. Nothing is written until "Lock and generate".
export default function PayoutsPage() {
  const { t, tn } = useAdminT()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [valueDate, setValueDate] = useState(israelToday())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ batchId: string; fileName: string } | null>(null)

  const load = useCallback(async () => {
    const res = await adminFetch('/api/admin/payouts')
    if (res.ok) setOverview(await res.json())
    else setError(t('pay.loadFailed'))
  }, [])
  useEffect(() => { void load() }, [load])

  const call = async (action: 'preview' | 'create') => {
    setBusy(true); setError(null)
    const res = await adminFetch('/api/admin/payouts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, valueDate }) })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) { setConfirming(false); return setError(body?.error ?? t('pay.requestFailed')) }
    if (action === 'preview') { setPreview(body); setDone(null); setConfirming(false) }
    else { setDone(body); setPreview(null); setConfirming(false); void load() }
  }

  return (
    <div className="space-y-8">
      <PageHeader title={t('route.Payouts')} />
      {overview?.masav?.isMock && <MasavModeBadge institutionCode={overview.masav.institutionCode} />}
      {overview?.masavError && <Alert>{overview.masavError}</Alert>}
      {overview && !overview.encryptionConfigured && <Alert tone="warning"><bdi dir="ltr" className="font-mono">BUSINESS_FINANCIALS_KEY</bdi> {t('pay.keyMissing')}</Alert>}
      {error && <Alert>{error}</Alert>}
      {done && (
        <Alert tone="warning">
          {t('pay.batchCreated', { file: '' })}<bdi dir="ltr">{done.fileName}</bdi> <a className="font-bold underline" href={`/api/admin/payouts/${done.batchId}/file`}>{t('pay.download')}</a> {t('pay.or')} <Link className="font-bold underline" href={`/admin/payouts/${done.batchId}`}>{t('pay.openBatch')}</Link>.
        </Alert>
      )}

      <section aria-labelledby="new-h">
        <h2 id="new-h" className={SECTION_HEADING}>{t('pay.new')}</h2>
        <Card className="space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem]">
              <label htmlFor="value-date" className={ADMIN_LABEL}>{t('pay.date')}</label>
              <input id="value-date" type="date" value={valueDate} min={israelToday()} onChange={(e) => { setValueDate(e.target.value); setPreview(null) }} className={ADMIN_INPUT} />
            </div>
            <button type="button" onClick={() => call('preview')} disabled={busy || !valueDate} className={SECONDARY_BUTTON}>{busy && !confirming ? t('pay.checking') : t('pay.preview')}</button>
          </div>
          <p className={ADMIN_HINT}>{t('pay.hint')}</p>

          {preview && (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr><th className="px-4 py-2.5 text-start">{t('pay.col.merchant')}</th><th className="px-4 py-2.5 text-end">{t('pay.col.vouchers')}</th><th className="px-4 py-2.5 text-end">{t('pay.col.gross')}</th><th className="px-4 py-2.5 text-end">{t('pay.col.commission')}</th><th className="px-4 py-2.5 text-end">{t('pay.col.net')}</th><th className="px-4 py-2.5 text-start">{t('pay.col.status')}</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.lines.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('pay.empty')}</td></tr>}
                    {preview.lines.map((l) => (
                      <tr key={l.businessId} className={l.blocked && l.blocked !== 'nothing_due' ? 'bg-amber-50/40' : ''}>
                        <td className="px-4 py-2.5 font-medium text-[#0B1B3D]"><BidiText>{l.businessName}</BidiText></td>
                        <td className="px-4 py-2.5 text-end tabular-nums">{l.voucherIds.length}{l.notYetDue > 0 && <span className="text-xs text-slate-400"> <bdi dir="ltr">{t('pay.notDue', { n: l.notYetDue })}</bdi></span>}</td>
                        <td className="px-4 py-2.5 text-end tabular-nums"><bdi dir="ltr">{money(l.grossAgorot)}</bdi></td>
                        <td className="px-4 py-2.5 text-end tabular-nums"><bdi dir="ltr">{money(l.commissionAgorot)}</bdi></td>
                        <td className="px-4 py-2.5 text-end font-semibold tabular-nums"><bdi dir="ltr">{money(l.netAgorot)}</bdi></td>
                        <td className="px-4 py-2.5">{l.blocked ? <StatusBadge tone={l.blocked === 'nothing_due' ? 'slate' : 'amber'} icon="fa-circle-pause">{t(`pay.block.${l.blocked}` as AdminKey)}</StatusBadge> : <StatusBadge tone="emerald" icon="fa-circle-check">{t('pay.ready')}</StatusBadge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-slate-600"><span className="font-bold text-[#0B1B3D]">{tn('pay.merchants', preview.readyCount)}</span>, <span className="font-bold text-[#0B1B3D]">{tn('pay.vouchers', preview.readyVouchers)}</span>, {t('pay.total')} <span className="font-bold text-[#0B1B3D]"><bdi dir="ltr">{money(preview.readyNetAgorot)}</bdi></span></p>
                {!confirming ? (
                  <button type="button" disabled={preview.readyCount === 0} onClick={() => setConfirming(true)} className={PRIMARY_BUTTON}>{t('pay.lock')}</button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-amber-800">{t('pay.confirm', { n: preview.readyVouchers })}</span>
                    <button type="button" onClick={() => call('create')} disabled={busy} className={PRIMARY_BUTTON}>{busy ? t('pay.locking') : t('pay.yesLock')}</button>
                    <button type="button" onClick={() => setConfirming(false)} className={SECONDARY_BUTTON}>{t('common.cancel')}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      </section>

      <section aria-labelledby="batches-h">
        <h2 id="batches-h" className={SECTION_HEADING}>{t('pay.batches')}</h2>
        <Card className="divide-y divide-slate-100">
          {overview && overview.batches.length === 0 && <p className="p-5 text-sm text-slate-500">{t('pay.noBatches')}</p>}
          {overview?.batches.map((b) => (
            <Link key={b.id} href={`/admin/payouts/${b.id}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-5 py-4 transition-colors hover:bg-slate-50/70">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0B1B3D]">{t('pay.payDate')} <bdi dir="ltr">{formatIsraeliDate(b.valueDate)}</bdi></p>
                <p className="truncate text-xs text-slate-500">{tn('pay.merchants', b.merchantCount)} · {tn('pay.vouchers', b.voucherCount)} · <bdi dir="ltr">{money(b.totalAgorot)}</bdi></p>
              </div>
              <div className="flex items-center gap-2">
                {b.mock && <StatusBadge tone="amber">{t('pay.test')}</StatusBadge>}
                <StatusBadge tone={TONE[b.status] ?? 'slate'}>{`pay.status.${b.status}` in en ? t(`pay.status.${b.status}` as AdminKey) : b.status}</StatusBadge>
              </div>
            </Link>
          ))}
        </Card>
      </section>
    </div>
  )
}
