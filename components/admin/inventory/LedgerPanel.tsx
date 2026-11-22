'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { parseCodeSheet } from '@/lib/inventory/parseCodeSheet'
import { isSheetFile, readCodeSheetFile } from '@/lib/inventory/readCodeSheetFile'
import Alert from '@/components/admin/Alert'
import StatusBadge from '@/components/admin/StatusBadge'
import { ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface Product { id: string; title: string; faceValueAgorot: number; salePriceAgorot: number; counts: Record<string, number>; active: boolean }
interface Batch { id: string; fileName: string; rowsTotal: number; rowsOk: number; rowsRejected: number; status: 'pending_approval' | 'approved' | 'rejected'; invoiceTotalExpectedAgorot: number; invoiceTotalActualAgorot: number; stagingComplete: boolean }
interface AlertRow { id: string; kind?: string; message?: string; createdAt: string | null }
interface Change { id: string; kind: string; nameHe?: string; nameEn?: string; day?: string }
interface Overview { products: Product[]; batches: Batch[]; alerts: AlertRow[]; changes: Change[]; raayonitDisplay: boolean }
type Tab = 'stock' | 'batches' | 'alerts' | 'changes'
const STATUSES = ['IN_STOCK', 'RESERVED', 'DELIVERED', 'PARTIALLY_REDEEMED', 'REDEEMED', 'CANCELLED'] as const
const shekels = (agorot: number) => (agorot / 100).toLocaleString('en-IL', { maximumFractionDigits: 2 })

// The unified-ledger view of /admin/inventory: the display switch, stock by status, the two-column Excel import with batch approval,
// open alerts and the 04:00 sync's recorded business changes. Counts only; a code is never sent to this screen.
export default function LedgerPanel() {
  const { t } = useAdminT()
  const [data, setData] = useState<Overview | null>(null)
  const [tab, setTab] = useState<Tab>('stock')
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [invoice, setInvoice] = useState('')
  const [expires, setExpires] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/inventory')
      if (res.ok) setData(await res.json())
    } catch { /* the legacy grid above still works */ }
  }, [])
  useEffect(() => { void load() }, [load])

  async function post(url: string, body: unknown, ok?: (json: Record<string, unknown>) => string | null) {
    setBusy(true); setMsg(null)
    try {
      const res = await adminFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : t('led.failed'))
      const text = ok?.(json); if (text) setMsg({ tone: 'success', text })
      await load()
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : t('led.failed') })
    }
    setBusy(false)
  }

  async function stage(file: File | undefined) {
    if (!file) return
    if (!isSheetFile(file)) return setMsg({ tone: 'error', text: t('upload.unsupported') })
    const sheet = parseCodeSheet(await readCodeSheetFile(file))
    await post('/api/admin/inventory/batches', { fileName: file.name, rows: sheet.entries, invoiceTotal: Number(invoice), expiresAt: expires || null }, (j) => t('led.import.staged').replace('{ok}', String(j.rowsOk)).replace('{rejected}', String(j.rowsRejected)))
    if (fileRef.current) fileRef.current.value = ''
  }

  async function downloadReport(id: string) {
    const res = await adminFetch(`/api/admin/inventory/batches/${id}?format=csv`)
    if (!res.ok) return setMsg({ tone: 'error', text: t('led.failed') })
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a'); a.href = url; a.download = `rejected-rows-${id.slice(0, 12)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  function approve(b: Batch) {
    const differs = b.invoiceTotalExpectedAgorot !== b.invoiceTotalActualAgorot
    const mismatchReason = differs ? window.prompt(t('led.batch.mismatch')) ?? '' : undefined
    if (differs && !mismatchReason) return
    void post(`/api/admin/inventory/batches/${b.id}`, { action: 'approve', mismatchReason })
  }
  function reject(b: Batch) {
    const reason = window.prompt(t('led.batch.reason'))
    if (reason) void post(`/api/admin/inventory/batches/${b.id}`, { action: 'reject', reason })
  }
  function toggleFlag(next: boolean) {
    if (next && !window.confirm(t('led.flag.confirm'))) return
    void post('/api/admin/inventory/flags', { raayonitDisplay: next })
  }

  if (!data) return null
  const tabs: Tab[] = ['stock', 'batches', 'alerts', 'changes']
  return (
    <section aria-labelledby="ledger-title" className="mb-8">
      <h2 id="ledger-title" className="text-base font-bold tracking-tight text-adm-text">{t('led.title')}</h2>
      <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-adm-line bg-adm-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-adm-text">{t('led.flag.title')}</p>
          <p className="text-sm text-adm-muted">{data.raayonitDisplay ? t('led.flag.on') : t('led.flag.off')}</p>
        </div>
        <button type="button" disabled={busy} className={data.raayonitDisplay ? SECONDARY_BUTTON : PRIMARY_BUTTON} onClick={() => toggleFlag(!data.raayonitDisplay)}>
          {data.raayonitDisplay ? t('led.flag.disable') : t('led.flag.enable')}
        </button>
      </div>
      {msg && <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert>}
      <div role="tablist" className="mt-4 flex gap-2 overflow-x-auto">
        {tabs.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`${tab === k ? PRIMARY_BUTTON : SECONDARY_BUTTON} shrink-0`}>
            {t(`led.tab.${k}` as AdminKey)}{k === 'alerts' && data.alerts.length ? ` (${data.alerts.length})` : k === 'changes' && data.changes.length ? ` (${data.changes.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.products.map((p) => (
            <li key={p.id} className="rounded-3xl border border-adm-line bg-adm-surface p-5 shadow-sm">
              <p dir="auto" className="font-semibold text-adm-text">{p.title || `₪${shekels(p.faceValueAgorot)}`}</p>
              <p className="text-sm text-adm-muted">₪{shekels(p.faceValueAgorot)} · ₪{shekels(p.salePriceAgorot)}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {STATUSES.map((s) => (<div key={s} className="flex justify-between"><dt className="text-adm-muted">{t(`led.status.${s}` as AdminKey)}</dt><dd className="font-semibold tabular-nums text-adm-text"><bdi dir="ltr">{p.counts[s] ?? 0}</bdi></dd></div>))}
              </dl>
            </li>
          ))}
        </ul>
      )}

      {tab === 'batches' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-3xl border border-adm-line bg-adm-surface p-5 shadow-sm">
            <p className="font-semibold text-adm-text">{t('led.import.title')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label><span className={ADMIN_LABEL}>{t('led.import.invoice')}</span><input className={ADMIN_INPUT} inputMode="decimal" dir="ltr" value={invoice} onChange={(e) => setInvoice(e.target.value)} /></label>
              <label><span className={ADMIN_LABEL}>{t('led.import.expires')}</span><input className={ADMIN_INPUT} type="date" dir="ltr" value={expires} onChange={(e) => setExpires(e.target.value)} /></label>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => void stage(e.target.files?.[0])} />
            <button type="button" className={`${PRIMARY_BUTTON} mt-3`} disabled={busy || !(Number(invoice) > 0)} onClick={() => fileRef.current?.click()}>{t('led.import.stage')}</button>
          </div>
          <ul className="space-y-3">
            {data.batches.map((b) => (
              <li key={b.id} className="rounded-3xl border border-adm-line bg-adm-surface p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p dir="auto" className="break-all font-semibold text-adm-text">{b.fileName}</p>
                  <StatusBadge tone={b.status === 'approved' ? 'emerald' : b.status === 'rejected' ? 'rose' : 'amber'}>{t(`led.batch.status.${b.status}` as AdminKey)}</StatusBadge>
                </div>
                <p className="mt-1 text-sm text-adm-muted">{t('led.batch.rows').replace('{ok}', String(b.rowsOk)).replace('{total}', String(b.rowsTotal))} · {t('led.batch.total').replace('{expected}', shekels(b.invoiceTotalExpectedAgorot)).replace('{actual}', shekels(b.invoiceTotalActualAgorot))}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.rowsRejected > 0 && <button type="button" className={SECONDARY_BUTTON} onClick={() => void downloadReport(b.id)}>{t('led.batch.report')} ({b.rowsRejected})</button>}
                  {b.status === 'pending_approval' && <button type="button" disabled={busy} className={PRIMARY_BUTTON} onClick={() => approve(b)}>{t('led.batch.approve')}</button>}
                  {b.status === 'pending_approval' && <button type="button" disabled={busy} className={SECONDARY_BUTTON} onClick={() => reject(b)}>{t('led.batch.reject')}</button>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="mt-4 space-y-3">
          <button type="button" disabled={busy} className={SECONDARY_BUTTON} onClick={() => void post('/api/admin/inventory/alerts', { action: 'run' })}>{t('led.alerts.run')}</button>
          {data.alerts.length === 0 ? <p className="text-sm text-adm-muted">{t('led.alerts.none')}</p> : data.alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-3xl border border-adm-line bg-adm-surface p-4 shadow-sm">
              <p dir="auto" className="text-sm text-adm-text">{a.message ?? a.kind}</p>
              <button type="button" disabled={busy} className={SECONDARY_BUTTON} onClick={() => void post('/api/admin/inventory/alerts', { action: 'resolve', id: a.id })}>{t('led.alerts.resolve')}</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'changes' && (
        <div className="mt-4 space-y-3">
          {!data.raayonitDisplay && <Alert tone="warning">{t('led.changes.needFlag')}</Alert>}
          {data.changes.length === 0 ? <p className="text-sm text-adm-muted">{t('led.changes.none')}</p> : data.changes.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-3xl border border-adm-line bg-adm-surface p-4 shadow-sm">
              <p dir="auto" className="text-sm text-adm-text">{c.kind} · {c.nameHe ?? c.nameEn}</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !data.raayonitDisplay} className={PRIMARY_BUTTON} onClick={() => void post('/api/admin/inventory/changes', { action: 'approve', id: c.id })}>{t('led.changes.approve')}</button>
                <button type="button" disabled={busy} className={SECONDARY_BUTTON} onClick={() => void post('/api/admin/inventory/changes', { action: 'dismiss', id: c.id })}>{t('led.changes.dismiss')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
