'use client'

import Switch from '@/components/admin/Switch'
import { useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Card from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import StatusBadge from '@/components/admin/StatusBadge'
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import { MAX_BATCH_ROWS, parseBatchFile } from '@/lib/merchants/inviteInput'
import { useAdminT } from '@/lib/admin/translations'

type Row = { row: number; ok: true; businessName: string; contactEmail: string } | { row: number; ok: false; errors: string[] }
interface Created { row: number; businessName: string; contactEmail: string; link: string; whatsappHref: string | null; emailed: boolean | null }

const TEMPLATE = 'businessName,contactEmail,contactPhone,commissionRate,paymentTerms,category,language\n"Cafe Example",owner@example.com,050-123-4567,10%,net_30,Restaurants and Cafes,he\n'
const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`

// Stage many merchants at once: choose a CSV or JSON file, see every row's
// problems before anything is created, then create invites for the valid rows.
// Links appear once, here, and can be downloaded as a CSV for a mail merge.
export default function BatchInvitesPage() {
  const { t, tn } = useAdminT()
  const [records, setRecords] = useState<Record<string, unknown>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [created, setCreated] = useState<{ created: Created[]; failed: Row[] } | null>(null)
  const [sendEmail, setSendEmail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async (file: File | undefined) => {
    setError(null); setRows(null); setCreated(null); setRecords(null)
    if (!file) return
    setFileName(file.name)
    try {
      const parsed = parseBatchFile(await file.text())
      setRecords(parsed)
      await run('validate', parsed)
    } catch (e) { setError(e instanceof Error ? e.message : t('batch.readFailed')) }
  }

  async function run(mode: 'validate' | 'create', recs = records) {
    if (!recs) return
    setBusy(true); setError(null)
    const res = await adminFetch('/api/admin/merchants/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: recs, mode, sendEmail }) })
    const body = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) return setError(body?.error ?? t('batch.failed'))
    if (mode === 'validate') setRows(body.rows)
    else setCreated({ created: body.created, failed: body.failed })
  }

  const download = () => {
    if (!created) return
    const csv = 'businessName,contactEmail,link\n' + created.created.map((c) => [c.businessName, c.contactEmail, c.link].map(csvCell).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'merchant-invite-links.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const template = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
    a.download = 'merchant-batch-template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const valid = rows?.filter((r) => r.ok).length ?? 0
  const invalid = rows ? rows.length - valid : 0

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t('batch.title')} subtitle={t('batch.subtitle', { max: MAX_BATCH_ROWS })} actions={<button type="button" onClick={template} className={SECONDARY_BUTTON}><i className="fa-solid fa-download" aria-hidden="true" /> {t('batch.template')}</button>} />
      {error && <Alert className="mb-4">{error}</Alert>}

      {!created && (
        <Card className="space-y-4 p-6">
          <div>
            <label htmlFor="batch-file" className={ADMIN_LABEL}>{t('batch.file')}</label>
            <input id="batch-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => choose(e.target.files?.[0])} className={`${ADMIN_INPUT} file:me-3 file:rounded-lg file:border-0 file:bg-[#F0F7FF] file:px-3 file:py-1.5 file:font-semibold file:text-[#0038B8]`} />
            <p className={ADMIN_HINT}>{t('batch.columns')}</p>
          </div>
          {rows && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold text-[#0B1B3D]" dir="auto">{fileName}</span>
                <StatusBadge tone="emerald">{t('batch.ready', { n: valid })}</StatusBadge>
                {invalid > 0 && <StatusBadge tone="rose">{t('batch.problems', { n: invalid })}</StatusBadge>}
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="bg-slate-50 text-start text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-2.5 text-start">{t('batch.colRow')}</th><th className="px-4 py-2.5 text-start">{t('batch.colMerchant')}</th><th className="px-4 py-2.5 text-start">{t('batch.colResult')}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.row} className={r.ok ? '' : 'bg-rose-50/40'}>
                        <td className="px-4 py-2.5 tabular-nums text-slate-500">{r.row}</td>
                        <td className="px-4 py-2.5">{r.ok ? <><BidiText>{r.businessName}</BidiText> <span className="text-xs text-slate-400"><bdi dir="ltr">{r.contactEmail}</bdi></span></> : '—'}</td>
                        <td className="px-4 py-2.5">{r.ok ? <StatusBadge tone="emerald" icon="fa-circle-check">{t('batch.rowReady')}</StatusBadge> : <ul className="space-y-0.5 text-rose-700">{r.errors.map((m) => <li key={m}>{m}</li>)}</ul>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-[#0B1B3D]">
                <Switch checked={sendEmail} onChange={setSendEmail} />
                {t('batch.emailEach')}
              </label>
              <button type="button" disabled={busy || valid === 0} onClick={() => run('create')} className={`${PRIMARY_BUTTON} w-full sm:w-auto`}>{busy ? t('batch.creating') : tn('batch.create', valid)}</button>
              {invalid > 0 && <p className={ADMIN_HINT}>{t('batch.skipHint')}</p>}
            </>
          )}
        </Card>
      )}

      {created && (
        <Card className="space-y-4 p-6">
          <Alert tone="warning">{tn('batch.created', created.created.length)}</Alert>
          {created.failed.length > 0 && <Alert>{tn('batch.notCreated', created.failed.length, { rows: created.failed.map((f) => `#${f.row}`).join(', ') })}</Alert>}
          <button type="button" onClick={download} className={PRIMARY_BUTTON}><i className="fa-solid fa-file-arrow-down" aria-hidden="true" /> {t('batch.download')}</button>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {created.created.map((c) => (
              <li key={c.row} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium text-[#0B1B3D]"><BidiText>{c.businessName}</BidiText></span>
                <span className="flex items-center gap-3">
                  {c.emailed === true && <StatusBadge tone="emerald">{t('batch.emailed')}</StatusBadge>}
                  {c.emailed === false && <StatusBadge tone="amber">{t('batch.emailFailed')}</StatusBadge>}
                  {c.whatsappHref && <a href={c.whatsappHref} target="_blank" rel="noopener noreferrer" className="min-h-11 content-center text-sm font-semibold text-[#0038B8] hover:underline">{t('batch.whatsapp')}</a>}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
