'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import { maskCode, MAX_SHEET_ROWS, parseCodeSheet, PREVIEW_ROWS, type ParsedSheet } from '@/lib/inventory/parseCodeSheet'
import { isSheetFile, MAX_SHEET_BYTES, readCodeSheetFile } from '@/lib/inventory/readCodeSheetFile'
import Alert from '@/components/admin/Alert'
import { ADMIN_HINT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import PoolSheet from './PoolSheet'

export interface RaayonitStock {
  poolId: string
  title: string
  faceValueAgorot: number | null
}

interface Group { amount: number; count: number; stock: RaayonitStock | null }

// Raayonit's two-column Excel file (voucher code, voucher amount) added to the voucher stocks.
// The file is opened and checked here and each amount goes to the stock of that value, so one
// file with 100 and 150 vouchers fills both; with `fixed`, only that stock is filled. The
// server re-checks every row and stores the codes encrypted.
export default function RaayonitStockModal({ stocks, fixed, onClose, onDone }: { stocks: RaayonitStock[]; fixed?: RaayonitStock; onClose: () => void; onDone: (message: string) => void }) {
  const { t } = useAdminT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; sheet: ParsedSheet } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (picked: File | undefined) => {
    if (!picked) return
    setError(null)
    if (!isSheetFile(picked)) return setError(t('upload.unsupported'))
    if (picked.size > MAX_SHEET_BYTES) return setError(t('upload.tooLarge'))
    setReading(true)
    try {
      const sheet = parseCodeSheet(await readCodeSheetFile(picked))
      if (sheet.entries.length === 0) setError(t('upload.noCodes'))
      else setFile({ name: picked.name, sheet })
    } catch {
      setError(t('upload.unreadable'))
    }
    setReading(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [t])

  const groups = useMemo<Group[]>(() => {
    if (!file) return []
    const counts = new Map<number, number>()
    for (const entry of file.sheet.entries) counts.set(entry.amount, (counts.get(entry.amount) ?? 0) + 1)
    return [...counts].sort((a, b) => a[0] - b[0]).map(([amount, count]) => ({
      amount, count, stock: stocks.find((s) => s.faceValueAgorot === amount * 100 && (!fixed || s.poolId === fixed.poolId)) ?? null,
    }))
  }, [file, stocks, fixed])
  const addable = groups.filter((g) => g.stock)

  const commit = async () => {
    if (!file || addable.length === 0) return
    setSaving(true)
    setError(null)
    const total = { added: 0, duplicates: 0, invalid: 0, wrong: 0 }
    try {
      for (const group of addable) {
        const rows = file.sheet.entries.filter((e) => e.amount === group.amount)
        const res = await adminFetch(`/api/admin/pools/${group.stock!.poolId}/codes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? t('upload.failed'))
        total.added += body.added ?? 0
        total.duplicates += body.duplicates ?? 0
        total.invalid += body.invalid ?? 0
        total.wrong += body.wrongAmount ?? 0
      }
      onDone(t('upload.result', { added: total.added, duplicates: total.duplicates, invalid: total.invalid, wrong: total.wrong }))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.failed'))
      setSaving(false)
    }
  }

  return (
    <PoolSheet title={t('upload.title')} onClose={onClose} wide>
      {error && <Alert className="mb-4">{error}</Alert>}
      {!file ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]) }}
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-adm-accent bg-adm-accent-soft' : 'border-adm-line-strong bg-adm-sunken'}`}
        >
          <p className="text-base font-semibold text-adm-text">{reading ? t('upload.reading') : t('upload.drop')}</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" tabIndex={-1} aria-label={t('upload.choose')} onChange={(e) => void handleFile(e.target.files?.[0])} />
          <button type="button" className={SECONDARY_BUTTON} disabled={reading} onClick={() => inputRef.current?.click()}>
            <i className="fa-solid fa-folder-open text-xs" aria-hidden="true" />
            {t('upload.choose')}
          </button>
          <p className="text-xs text-adm-muted">{t('upload.formats', { n: MAX_SHEET_ROWS })}</p>
          {fixed && fixed.faceValueAgorot !== null && <p className={ADMIN_HINT}>{t('upload.onlyFixed', { value: fixed.faceValueAgorot / 100 })}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-adm-text">
            <i className="fa-solid fa-file-excel text-adm-ok" aria-hidden="true" />
            <bdi dir="ltr" className="min-w-0 truncate">{file.name}</bdi>
          </p>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-adm-muted">{t('upload.byValue')}</h3>
            <ul className="space-y-2">
              {groups.map((group) => (
                <li key={group.amount} className={`rounded-xl border px-4 py-3 text-sm ${group.stock ? 'border-adm-line bg-adm-surface text-adm-text' : 'border-adm-danger-line text-adm-danger'}`}>
                  {group.stock
                    ? t('upload.row', { value: group.amount, n: group.count, name: `\u2068${group.stock.title}\u2069` })
                    : fixed && fixed.faceValueAgorot !== null ? t('upload.skippedOther', { value: group.amount, n: group.count, only: fixed.faceValueAgorot / 100 }) : t('upload.noStock', { value: group.amount })}
                </li>
              ))}
            </ul>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div><dt className="text-adm-muted">{t('upload.duplicates')}</dt><dd className="font-semibold tabular-nums text-adm-text"><bdi dir="ltr">{file.sheet.duplicates}</bdi></dd></div>
            <div><dt className="text-adm-muted">{t('upload.empty')}</dt><dd className="font-semibold tabular-nums text-adm-text"><bdi dir="ltr">{file.sheet.empty}</bdi></dd></div>
            <div><dt className="text-adm-muted">{t('upload.badAmounts')}</dt><dd className="font-semibold tabular-nums text-adm-text"><bdi dir="ltr">{file.sheet.badAmounts}</bdi></dd></div>
          </dl>
          <div className="admin-table-scroll overflow-x-auto rounded-xl border border-adm-line bg-adm-surface">
            <table className="w-full min-w-[300px] text-start text-xs" aria-label={t('upload.preview')}>
              <thead className="bg-adm-sunken font-semibold text-adm-muted">
                <tr><th scope="col" className="px-3 py-2 text-start">{t('upload.col.code')}</th><th scope="col" className="px-3 py-2 text-start">{t('upload.col.amount')}</th></tr>
              </thead>
              <tbody className="divide-y divide-adm-line">
                {file.sheet.entries.slice(0, PREVIEW_ROWS).map((entry, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono"><bdi dir="ltr">{maskCode(entry.code)}</bdi></td>
                    <td className="px-3 py-2 tabular-nums"><bdi dir="ltr">₪{entry.amount}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={ADMIN_HINT}>{t('upload.maskedNote')}</p>
          {!file.sheet.headerFound && <Alert tone="warning">{t('upload.noHeader')}</Alert>}
          {file.sheet.tooMany && <Alert tone="warning">{t('upload.tooMany', { n: MAX_SHEET_ROWS })}</Alert>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={PRIMARY_BUTTON} disabled={saving || addable.length === 0} onClick={() => void commit()}>
              {saving ? t('upload.committing') : addable.length === 0 ? t('upload.nothing') : t('upload.commit', { n: addable.reduce((sum, g) => sum + g.count, 0) })}
            </button>
            <button type="button" className={SECONDARY_BUTTON} disabled={saving} onClick={() => setFile(null)}>{t('upload.chooseAnother')}</button>
          </div>
        </div>
      )}
    </PoolSheet>
  )
}
