'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { MAX_BATCH_OFFERS, parseOffersSheet, type ParsedOffersSheet } from '@/lib/admin/offersBatch'
import { downloadOffersTemplate } from '@/lib/admin/offersTemplate'
import { isSheetFile, MAX_SHEET_BYTES, readCodeSheetFile } from '@/lib/inventory/readCodeSheetFile'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import PoolSheet from '@/components/admin/inventory/PoolSheet'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

type Phase = 'idle' | 'reading' | 'ready' | 'committing'
interface BusinessRef { uid: string; businessName: string; businessId: string }
const MAX_SENT_ROWS = 1000

const formatPrice = (value: number) => `₪${Number.isInteger(value) ? value : value.toFixed(2)}`

// Many offers at once from a spreadsheet. The file is opened and checked here in the
// browser against the real list of businesses, each row marked ready or told exactly
// which cell is wrong; the server then re-checks every row and writes the valid ones.
export default function BatchOffersUploadModal({ onClose, onDone, embedded = false }: { onClose: () => void; onDone: (message: string) => void; embedded?: boolean }) {
  const { t } = useAdminT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [matrix, setMatrix] = useState<unknown[][] | null>(null)
  const [businesses, setBusinesses] = useState<BusinessRef[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminFetch('/api/admin/businesses')
      .then((res) => res.json())
      .then((data) => setBusinesses(data.businesses ?? []))
      .catch(() => setError(t('wizard.loadBusinessesFailed')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lookup = useMemo(() => {
    const byKey = new Map<string, string>()
    for (const b of businesses ?? []) if (b.businessId) byKey.set(b.businessId.trim().toLowerCase(), b.uid)
    for (const b of businesses ?? []) byKey.set(b.uid.toLowerCase(), b.uid)
    return (key: string) => byKey.get(key.trim().toLowerCase()) ?? null
  }, [businesses])
  const names = useMemo(() => new Map((businesses ?? []).map((b) => [b.uid, b.businessName])), [businesses])
  const parsed: ParsedOffersSheet | null = useMemo(() => (matrix && businesses ? parseOffersSheet(matrix, lookup) : null), [matrix, businesses, lookup])
  const valid = parsed?.rows.filter((r) => r.offer).length ?? 0
  const invalid = (parsed?.rows.length ?? 0) - valid

  const reset = () => {
    setPhase('idle')
    setMatrix(null)
    setFileName('')
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setError(null)
      if (!isSheetFile(file)) return setError(t('upload.unsupported'))
      if (file.size > MAX_SHEET_BYTES) return setError(t('upload.tooLarge'))
      setPhase('reading')
      setFileName(file.name)
      try {
        const rows = (await readCodeSheetFile(file)).slice(0, MAX_SENT_ROWS)
        setMatrix(rows)
        setPhase('ready')
      } catch {
        setPhase('idle')
        setError(t('upload.unreadable'))
      }
    },
    [t],
  )

  const commit = async () => {
    if (!matrix) return
    setPhase('committing')
    setError(null)
    const res = await adminFetch('/api/admin/offers/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'create', matrix }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    if (!res?.ok) {
      setPhase('ready')
      return setError(body?.error ?? t('batch.failed'))
    }
    const multipass = parsed?.rows.filter((r) => r.offer?.fulfillmentType === 'multipass_pool').length ?? 0
    const failed = (body.failedRows?.length ?? 0) + (body.invalid ?? 0)
    onDone(`${t('batch.result', { created: body.created, failed })}${multipass > 0 ? ` ${t('batch.resultPools', { n: multipass })}` : ''} ${t('batch.translationNote')}`)
  }

  const showFile = parsed && (phase === 'ready' || phase === 'committing')

  const body = (
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}

        {!showFile && (
          <>
            <div className="flex justify-end">
              <button type="button" className={SECONDARY_BUTTON} onClick={() => void downloadOffersTemplate()}>
                <DownloadIcon />
                {t('batch.template')}
              </button>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                void handleFile(e.dataTransfer.files[0])
              }}
              className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragging ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#CBD5E1] bg-[#F8FAFC]'}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0038B8] shadow-sm">
                <i className={`fa-solid ${phase === 'reading' ? 'fa-spinner fa-spin' : 'fa-file-excel'} text-lg`} aria-hidden="true" />
              </span>
              <p className="text-base font-semibold text-[#0B1B3D]">{phase === 'reading' ? t('upload.reading') : t('batch.drop')}</p>
              <p className="text-sm text-[#475569]">{t('upload.orBrowse')}</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" tabIndex={-1} aria-label={t('upload.choose')} onChange={(e) => void handleFile(e.target.files?.[0])} />
              <button type="button" className={SECONDARY_BUTTON} disabled={phase === 'reading' || businesses === null} onClick={() => inputRef.current?.click()}>
                <i className="fa-solid fa-folder-open text-xs" aria-hidden="true" />
                {businesses === null ? t('batch.loadingBusinesses') : t('upload.choose')}
              </button>
              <p className="text-xs text-[#64748B]">{t('batch.formats', { n: MAX_BATCH_OFFERS })}</p>
            </div>
          </>
        )}

        {showFile && (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1B3D]">
              <i className="fa-solid fa-file-excel text-emerald-600" aria-hidden="true" />
              <bdi dir="ltr" className="min-w-0 truncate">{fileName}</bdi>
            </p>
            {parsed.missingColumns.length > 0 ? (
              <Alert>{t('batch.missingColumns', { cols: parsed.missingColumns.join(', ') })}</Alert>
            ) : parsed.rows.length === 0 ? (
              <Alert>{t('batch.noRows')}</Alert>
            ) : (
              <>
                {parsed.tooMany && <Alert tone="warning">{t('batch.tooMany', { n: MAX_BATCH_OFFERS })}</Alert>}
                <p className="text-sm font-semibold text-[#0B1B3D]" aria-live="polite">{t('batch.summary', { valid, invalid })}</p>
                <div className="admin-table-scroll overflow-x-auto rounded-xl border border-[#E2E8F0]">
                  <table className="w-full min-w-[720px] text-start text-sm">
                    <thead className="bg-[#F8FAFC] text-xs font-semibold text-[#64748B]">
                      <tr>
                        <th scope="col" className="w-16 px-4 py-2 text-start">{t('batch.col.row')}</th>
                        <th scope="col" className="px-4 py-2 text-start">{t('batch.col.offer')}</th>
                        <th scope="col" className="px-4 py-2 text-start">{t('batch.col.business')}</th>
                        <th scope="col" className="px-4 py-2 text-start">{t('batch.col.price')}</th>
                        <th scope="col" className="min-w-[260px] px-4 py-2 text-start">{t('batch.col.check')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {parsed.rows.map((row) => {
                        const bad = row.errors.length > 0
                        return (
                          <tr key={row.row} className={bad ? 'bg-[#FEF2F2]' : undefined}>
                            <td className="px-4 py-2 align-top tabular-nums text-[#475569]"><bdi dir="ltr">{row.row}</bdi></td>
                            <td className="px-4 py-2 align-top"><BidiText lines={2} className="font-semibold text-[#0B1B3D]">{row.title || '—'}</BidiText></td>
                            <td className="px-4 py-2 align-top text-[#475569]">
                              {row.offer ? <BidiText lines={2}>{row.offer.brandName || names.get(row.offer.businessUid) || ''}</BidiText> : <bdi dir="ltr" className="font-mono text-xs">{row.businessKey || '—'}</bdi>}
                            </td>
                            <td className="px-4 py-2 align-top tabular-nums text-[#475569]">
                              {row.offer ? <bdi dir="ltr">{formatPrice(row.offer.offerPrice)} / {formatPrice(row.offer.originalPrice)}</bdi> : '—'}
                            </td>
                            <td className="px-4 py-2 align-top">
                              {bad ? (
                                <ul className="space-y-1 text-[#B91C1C]">
                                  {row.errors.map((e) => (
                                    <li key={e.cell + e.code} className="flex items-start gap-2">
                                      <i className="fa-solid fa-circle-xmark mt-0.5 text-xs" aria-hidden="true" />
                                      <span><bdi dir="ltr" className="font-mono font-semibold">{e.cell}</bdi>: {t(`batch.err.${e.code}` as AdminKey)}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="inline-flex items-center gap-2 font-semibold text-emerald-700">
                                  <i className="fa-solid fa-circle-check" aria-hidden="true" />
                                  {t('batch.ready')}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {invalid > 0 && <p className="text-xs text-[#64748B]">{t('batch.skipNote')}</p>}
              </>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={SECONDARY_BUTTON} disabled={phase === 'committing'} onClick={reset}>
                {t('batch.chooseAnother')}
              </button>
              <button type="button" className={PRIMARY_BUTTON} disabled={phase === 'committing' || valid === 0} aria-busy={phase === 'committing'} onClick={() => void commit()}>
                {phase === 'committing' ? t('batch.committing') : t('batch.commit', { n: valid })}
              </button>
            </div>
          </>
        )}
      </div>
  )
  if (embedded) return body
  return (
    <PoolSheet title={t('batch.title')} onClose={onClose} xl>
      {body}
    </PoolSheet>
  )
}

export function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  )
}
