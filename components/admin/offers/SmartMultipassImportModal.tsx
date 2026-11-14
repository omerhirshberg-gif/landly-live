'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { MAX_SHEET_ROWS } from '@/lib/inventory/parseCodeSheet'
import { isSheetFile, MAX_SHEET_BYTES, readCodeSheetFile } from '@/lib/inventory/readCodeSheetFile'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Switch from '@/components/admin/Switch'
import PoolSheet from '@/components/admin/inventory/PoolSheet'
import { ADMIN_INPUT, ADMIN_SELECT, ADMIN_LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface PlanPerk { key: string; title: string; brand: string; category: string | null; retailPrice: number | null; memberPrice: number | null; unitCost: number | null; codes: number; expiresFirst: string | null }
interface Existing { offerId: string; title: string; brand: string; remaining: number }
type Planned = { key: string; status: 'new' } | { key: string; status: 'restock'; offer: Existing } | { key: string; status: 'ambiguous'; candidates: Existing[] }
interface Plan { perks: PlanPerk[]; plan: Planned[]; problems: { row: number; reason: string }[]; duplicates: number; badDates: number; hasPerkColumns: boolean; tooMany: boolean; existing: Existing[] }
interface Edit { include?: boolean; retail?: string; member?: string; cost?: string; category?: string; choice?: string }
interface Result { key: string; status: 'created' | 'restocked' | 'failed'; error?: string }

type Phase = 'idle' | 'reading' | 'checking' | 'review' | 'committing' | 'failed-list'
const MAX_SENT_ROWS = 3000
const num = (v: string | number | null | undefined) => (v === '' || v == null ? NaN : Number(v))
const show = (v: number | null) => (v === null ? '' : String(v))

// One file for everything Multipass: the vendor's sheet names its perks and holds their codes. The browser opens
// and previews it; the server re-reads it, says which perks are new and which restock an existing one, and writes
// nothing until the admin confirms. Opened from a perk's row (`fixedPerk`), a plain list of codes goes to that perk.
export default function SmartMultipassImportModal({ onClose, onDone, fixedPerk }: { onClose: () => void; onDone: (message: string) => void; fixedPerk?: { offerId: string; title: string } }) {
  const { t } = useAdminT()
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [matrix, setMatrix] = useState<unknown[][] | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [failures, setFailures] = useState<{ title: string; error: string }[]>([])

  const reset = () => {
    setPhase('idle')
    setMatrix(null)
    setPlan(null)
    setEdits({})
    setFileName('')
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }
  const edit = (key: string, patch: Edit) => setEdits((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))

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
        setPhase('checking')
        const res = await adminFetch('/api/admin/multipass/smart-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'plan', matrix: rows }) })
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error === 'No code column was found in the file.' ? t('smart.noHeader') : t('smart.planFailed'))
        if ((body as Plan).perks.length === 0) throw new Error(t('smart.noPerks'))
        setPlan(body as Plan)
        setPhase('review')
      } catch (err) {
        setPhase('idle')
        setMatrix(null)
        setError(err instanceof Error && err.message ? err.message : t('upload.unreadable'))
      }
    },
    [t],
  )

  // What each perk in the file will become, with the admin's edits applied.
  const rows = useMemo(() => {
    if (!plan) return []
    const fixed = fixedPerk && !plan.hasPerkColumns
    return plan.perks.map((perk, i) => {
      const planned: Planned = fixed ? { key: perk.key, status: 'restock', offer: plan.existing.find((e) => e.offerId === fixedPerk.offerId) ?? { offerId: fixedPerk.offerId, title: fixedPerk.title, brand: '', remaining: 0 } } : plan.plan[i]!
      const e = edits[perk.key] ?? {}
      const include = e.include !== false
      const retail = e.retail ?? show(perk.retailPrice)
      const member = e.member ?? show(perk.memberPrice)
      const cost = e.cost ?? show(perk.unitCost)
      const category = e.category ?? perk.category ?? ''
      const ambiguous = planned.status === 'ambiguous'
      const creates = planned.status === 'new' || (ambiguous && e.choice === 'new')
      const target = planned.status === 'restock' ? planned.offer : ambiguous && e.choice && e.choice !== 'new' ? planned.candidates.find((c) => c.offerId === e.choice) ?? null : null
      const resolved = creates || !!target
      const fieldsOk = !creates || (num(retail) > 0 && num(member) > 0 && num(member) < num(retail) && num(cost) >= 0 && !!category && (BUSINESS_CATEGORIES as readonly string[]).includes(category))
      return { perk, planned, include, retail, member, cost, category, ambiguous, creates, target, resolved, fieldsOk }
    })
  }, [plan, edits, fixedPerk])

  const included = rows.filter((r) => r.include)
  const newRows = rows.filter((r) => r.creates)
  const restockRows = rows.filter((r) => r.target)
  const ambiguousRows = rows.filter((r) => r.ambiguous && !r.resolved)
  const incomplete = included.some((r) => r.creates && !r.fieldsOk)
  const unresolved = included.some((r) => !r.resolved)
  const canCommit = phase === 'review' && included.length > 0 && !incomplete && !unresolved
  const counted = (list: typeof rows) => list.filter((r) => r.include)
  const sum = (list: typeof rows) => counted(list).reduce((n, r) => n + r.perk.codes, 0)

  const commit = async () => {
    if (!matrix || !plan) return
    setPhase('committing')
    setError(null)
    const decisions = included.map((r) => ({
      key: r.perk.key,
      action: r.creates ? 'create' : 'restock',
      ...(r.target ? { offerId: r.target.offerId } : {}),
      ...(r.creates ? { retailPrice: num(r.retail), memberPrice: num(r.member), unitCost: num(r.cost), category: r.category } : {}),
    }))
    const res = await adminFetch('/api/admin/multipass/smart-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'commit', matrix, decisions }) }).catch(() => null)
    const body = await res?.json().catch(() => null)
    if (!res?.ok) {
      setPhase('review')
      return setError(body?.error ?? t('smart.failed'))
    }
    const text = `${t('smart.result', { created: body.created, restocked: body.restocked, added: body.added })}${body.failed > 0 ? ` ${t('smart.resultFailed', { failed: body.failed })}` : ''}`
    if (body.failed === 0) return onDone(text)
    const titles = new Map(rows.map((r) => [r.perk.key, r.perk.title]))
    setFailures((body.results as Result[]).filter((r) => r.status === 'failed').map((r) => ({ title: titles.get(r.key) ?? '', error: r.error ?? '' })))
    setMessage(text)
    setPhase('failed-list')
  }

  const title = fixedPerk ? t('smart.restockTitle') : t('smart.title')

  return (
    <PoolSheet title={title} onClose={phase === 'failed-list' ? () => onDone(message) : onClose} xl>
      <div className="space-y-6">
        {error && <Alert>{error}</Alert>}

        {(phase === 'idle' || phase === 'reading' || phase === 'checking') && (
          <>
            {fixedPerk && <p dir="auto" className="break-words text-base font-semibold text-[#0B1B3D]">{fixedPerk.title}</p>}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]) }}
              className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-[#0038B8] bg-[#F0F7FF]' : 'border-[#CBD5E1] bg-[#F8FAFC]'}`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#0038B8] shadow-sm">
                <i className={`fa-solid ${phase === 'idle' ? 'fa-file-excel' : 'fa-spinner fa-spin'} text-lg`} aria-hidden="true" />
              </span>
              <p className="text-base font-semibold text-[#0B1B3D]">{phase === 'reading' ? t('smart.reading') : phase === 'checking' ? t('smart.checking') : t('smart.drop')}</p>
              <p className="text-sm text-[#475569]">{t('upload.orBrowse')}</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="sr-only" tabIndex={-1} aria-label={t('upload.choose')} onChange={(e) => void handleFile(e.target.files?.[0])} />
              <button type="button" className={SECONDARY_BUTTON} disabled={phase !== 'idle'} onClick={() => inputRef.current?.click()}>
                <i className="fa-solid fa-folder-open text-xs" aria-hidden="true" />
                {t('upload.choose')}
              </button>
              <p className="text-[13px] text-[#64748B]">{t('smart.formats', { n: MAX_SHEET_ROWS })}</p>
            </div>
          </>
        )}

        {(phase === 'review' || phase === 'committing') && plan && (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1B3D]">
              <i className="fa-solid fa-file-excel text-emerald-600" aria-hidden="true" />
              <bdi dir="ltr" className="min-w-0 truncate">{fileName}</bdi>
            </p>
            {plan.tooMany && <Alert tone="warning">{t('smart.tooMany', { n: MAX_SHEET_ROWS })}</Alert>}
            {fixedPerk && !plan.hasPerkColumns && <p className="text-sm text-[#475569]">{t('smart.fixedTarget')}</p>}

            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Stat label={t('smart.summaryNew')} value={counted(newRows).length} hint={t('smart.codesN', { n: sum(newRows) })} tone="good" />
              <Stat label={t('smart.summaryRestock')} value={counted(restockRows).length} hint={t('smart.codesN', { n: sum(restockRows) })} tone="plain" />
              <Stat label={t('smart.summaryIssues')} value={plan.problems.length} hint="" tone={plan.problems.length ? 'warn' : 'plain'} />
            </dl>

            {ambiguousRows.length > 0 && <Alert tone="warning">{t('smart.ambiguous')}</Alert>}
            {incomplete && <Alert tone="warning">{t('smart.needsInput')}</Alert>}

            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.perk.key} className={`rounded-2xl border p-4 transition-colors ${r.include ? 'border-[#E2E8F0] bg-white' : 'border-[#E2E8F0] bg-[#F8FAFC] opacity-70'}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <BidiText lines={2} className="text-base font-semibold text-[#0B1B3D]">{r.perk.title || r.perk.brand}</BidiText>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#64748B]">
                        {r.perk.brand && r.perk.brand !== r.perk.title && <BidiText lines={2}>{r.perk.brand}</BidiText>}
                        <span>{t('smart.codesN', { n: `⁦${r.perk.codes}⁩` })}</span>
                        {r.perk.expiresFirst && <span>{t('smart.col.expiry')}: <bdi dir="ltr" className="tabular-nums">{r.perk.expiresFirst}</bdi></span>}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold ${r.creates ? 'bg-[#F0F7FF] text-[#0038B8]' : r.target ? 'bg-[#F1F5F9] text-[#334155]' : 'bg-amber-50 text-amber-800'}`}>
                      {r.creates ? t('smart.statusNew') : r.target ? t('smart.statusRestock') : t('smart.pickPerk')}
                    </span>
                    {!fixedPerk && (
                      <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 text-[13px] font-medium text-[#475569]">
                        <span className="hidden sm:inline">{t('smart.col.include')}</span>
                        <Switch checked={r.include} onChange={(include) => edit(r.perk.key, { include })} aria-label={`${t('smart.col.include')}: ${r.perk.title}`} />
                      </label>
                    )}
                  </div>

                  {r.include && r.ambiguous && (
                    <div className="mt-3">
                      <label htmlFor={`pick-${r.perk.key}`} className={ADMIN_LABEL}>{t('smart.pickPerk')}</label>
                      <select id={`pick-${r.perk.key}`} className={ADMIN_SELECT} value={edits[r.perk.key]?.choice ?? ''} onChange={(e) => edit(r.perk.key, { choice: e.target.value })}>
                        <option value="">{t('smart.pickPerk')}</option>
                        {(r.planned as Extract<Planned, { status: 'ambiguous' }>).candidates.map((c) => <option key={c.offerId} value={c.offerId}>{`${c.title} · ${c.remaining}`}</option>)}
                        <option value="new">{t('smart.createNew')}</option>
                      </select>
                    </div>
                  )}

                  {r.include && r.creates && (
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field id={`retail-${r.perk.key}`} label={t('smart.col.retail')} value={r.retail} invalid={!(num(r.retail) > 0)} onChange={(retail) => edit(r.perk.key, { retail })} />
                      <Field id={`member-${r.perk.key}`} label={t('smart.col.member')} value={r.member} invalid={!(num(r.member) > 0 && num(r.member) < num(r.retail))} onChange={(member) => edit(r.perk.key, { member })} />
                      <Field id={`cost-${r.perk.key}`} label={t('smart.col.cost')} value={r.cost} invalid={!(num(r.cost) >= 0)} onChange={(cost) => edit(r.perk.key, { cost })} />
                      <div>
                        <label htmlFor={`cat-${r.perk.key}`} className={ADMIN_LABEL}>{t('smart.col.category')}</label>
                        <select id={`cat-${r.perk.key}`} className={ADMIN_SELECT} value={r.category} onChange={(e) => edit(r.perk.key, { category: e.target.value })}>
                          <option value="">{t('smart.pickCategory')}</option>
                          {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {r.include && r.target && (
                    <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div><dt className="text-[13px] text-[#64748B]">{t('smart.col.current')}</dt><dd className="font-semibold tabular-nums text-[#0B1B3D]"><bdi dir="ltr">{r.target.remaining}</bdi></dd></div>
                      <div><dt className="text-[13px] text-[#64748B]">{t('smart.col.added')}</dt><dd className="font-semibold tabular-nums text-emerald-700"><bdi dir="ltr">+{r.perk.codes}</bdi></dd></div>
                      <div><dt className="text-[13px] text-[#64748B]">{t('smart.col.total')}</dt><dd className="font-semibold tabular-nums text-[#0B1B3D]"><bdi dir="ltr">{r.target.remaining + r.perk.codes}</bdi></dd></div>
                    </dl>
                  )}
                </li>
              ))}
            </ul>

            {plan.problems.length > 0 && (
              <details className="group rounded-2xl border border-[#E2E8F0]">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm font-semibold text-[#0B1B3D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0038B8]">
                  {t('smart.attention')}
                  <i className="fa-solid fa-chevron-down text-xs text-[#64748B] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-[#E2E8F0] p-4 text-sm text-[#475569]">
                  {plan.problems.slice(0, 200).map((p, i) => (
                    <li key={i}>{t(`smart.problem.${p.reason}` as AdminKey, { row: `⁦${p.row}⁩` })}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={SECONDARY_BUTTON} disabled={phase === 'committing'} onClick={reset}>{t('smart.chooseAnother')}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={!canCommit} aria-busy={phase === 'committing'} onClick={() => void commit()}>
                {phase === 'committing' ? t('smart.committing') : t('smart.confirm')}
              </button>
            </div>
          </>
        )}

        {phase === 'failed-list' && (
          <>
            <Alert tone="success">{message}</Alert>
            <div>
              <h3 className="mb-2 text-sm font-bold text-[#0B1B3D]">{t('smart.failedTitle')}</h3>
              <ul className="space-y-2">
                {failures.map((f, i) => (
                  <li key={i} className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
                    <BidiText lines={2} className="font-semibold">{f.title}</BidiText>
                    <p>{f.error}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end">
              <button type="button" className={PRIMARY_BUTTON} onClick={() => onDone(message)}>{t('common.done')}</button>
            </div>
          </>
        )}
      </div>
    </PoolSheet>
  )
}

function Field({ id, label, value, invalid, onChange }: { id: string; label: string; value: string; invalid: boolean; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className={ADMIN_LABEL}>{label}</label>
      <input id={id} inputMode="decimal" dir="ltr" autoComplete="off" aria-invalid={invalid || undefined} className={`${ADMIN_INPUT} tabular-nums ${invalid ? 'border-[#F87171]' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: 'good' | 'warn' | 'plain' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-[#0B1B3D]'
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
      <dt className="text-[13px] text-[#64748B]">{label}</dt>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${color}`}><bdi dir="ltr">{value}</bdi></dd>
      {hint && <p className="text-[13px] text-[#64748B]">{hint}</p>}
    </div>
  )
}
