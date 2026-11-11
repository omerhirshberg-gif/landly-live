'use client'

import { useCallback, useRef, useState } from 'react'
import { useAdminT } from '@/lib/admin/translations'
import { maskCode, MAX_SHEET_ROWS, parseCodeSheet, PREVIEW_ROWS, type ParsedSheet } from '@/lib/inventory/parseCodeSheet'
import { isSheetFile, MAX_SHEET_BYTES, readCodeSheetFile } from '@/lib/inventory/readCodeSheetFile'
import Alert from '@/components/admin/Alert'
import { ADMIN_HINT, SECONDARY_BUTTON } from '@/components/admin/formStyles'

export interface WizardCodes {
  fileName: string
  sheet: ParsedSheet
}

// The supplier's code spreadsheet, dropped into the offer wizard (step 3). It is opened
// and checked here, as on Stock & Pools; the rows travel with the offer and the server
// stores them encrypted in the same request that creates the offer and its pool.
export default function WizardCodeDropzone({ value, onChange }: { value: WizardCodes | null; onChange: (value: WizardCodes | null) => void }) {
  const { t } = useAdminT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setError(null)
      if (!isSheetFile(file)) return setError(t('upload.unsupported'))
      if (file.size > MAX_SHEET_BYTES) return setError(t('upload.tooLarge'))
      setReading(true)
      try {
        const sheet = parseCodeSheet(await readCodeSheetFile(file))
        if (sheet.entries.length === 0) setError(t('upload.noCodes'))
        else onChange({ fileName: file.name, sheet })
      } catch {
        setError(t('upload.unreadable'))
      }
      setReading(false)
      if (inputRef.current) inputRef.current.value = ''
    },
    [onChange, t],
  )

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#64748B]">{t('wizard.codesTitle')}</legend>
      <p className={`${ADMIN_HINT} mb-3`}>{t('wizard.codesHint')}</p>
      {error && <Alert className="mb-3">{error}</Alert>}
      {value ? (
        <div className="space-y-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1B3D]">
            <i className="fa-solid fa-file-excel text-emerald-600" aria-hidden="true" />
            <bdi dir="ltr" className="min-w-0 truncate">{value.fileName}</bdi>
          </p>
          <p className="text-sm text-emerald-700">{t('wizard.codesLoaded', { n: value.sheet.entries.length })}</p>
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <div><dt className="text-[#64748B]">{t('upload.duplicates')}</dt><dd className="font-semibold tabular-nums text-[#0B1B3D]"><bdi dir="ltr">{value.sheet.duplicates}</bdi></dd></div>
            <div><dt className="text-[#64748B]">{t('upload.empty')}</dt><dd className="font-semibold tabular-nums text-[#0B1B3D]"><bdi dir="ltr">{value.sheet.empty}</bdi></dd></div>
            <div><dt className="text-[#64748B]">{t('upload.badDates')}</dt><dd className="font-semibold tabular-nums text-[#0B1B3D]"><bdi dir="ltr">{value.sheet.badDates}</bdi></dd></div>
          </dl>
          <div className="admin-table-scroll overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
            <table className="w-full min-w-[360px] text-start text-xs" aria-label={t('wizard.codesPreview')}>
              <thead className="bg-[#F8FAFC] font-semibold text-[#64748B]">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start">{t('wizard.codeCol')}</th>
                  <th scope="col" className="px-3 py-2 text-start">{t('wizard.expiryCol')}</th>
                  <th scope="col" className="px-3 py-2 text-start">{t('wizard.pinCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {value.sheet.entries.slice(0, PREVIEW_ROWS).map((entry, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono"><bdi dir="ltr">{maskCode(entry.code)}</bdi></td>
                    <td className="px-3 py-2 tabular-nums text-[#475569]"><bdi dir="ltr">{entry.expiresAt ?? '—'}</bdi></td>
                    <td className="px-3 py-2 font-mono text-[#475569]"><bdi dir="ltr">{entry.pin ? maskCode(entry.pin) : '—'}</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!value.sheet.headerFound && <Alert tone="warning">{t('upload.noHeader')}</Alert>}
          {value.sheet.tooMany && <Alert tone="warning">{t('upload.tooMany', { n: MAX_SHEET_ROWS })}</Alert>}
          <button type="button" className={SECONDARY_BUTTON} onClick={() => onChange(null)}>
            {t('wizard.codesRemove')}
          </button>
        </div>
      ) : (
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
          className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${dragging ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#CBD5E1] bg-[#F8FAFC]'}`}
        >
          <p className="text-base font-semibold text-[#0B1B3D]">{reading ? t('upload.reading') : t('upload.drop')}</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" tabIndex={-1} aria-label={t('upload.choose')} onChange={(e) => void handleFile(e.target.files?.[0])} />
          <button type="button" className={SECONDARY_BUTTON} disabled={reading} onClick={() => inputRef.current?.click()}>
            <i className="fa-solid fa-folder-open text-xs" aria-hidden="true" />
            {t('upload.choose')}
          </button>
          <p className="text-xs text-[#64748B]">{t('upload.formats', { n: MAX_SHEET_ROWS })}</p>
        </div>
      )}
    </fieldset>
  )
}
