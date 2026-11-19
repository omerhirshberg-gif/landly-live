'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { useAdminT } from '@/lib/admin/translations'
import Alert from '@/components/admin/Alert'
import StatusBadge, { type StatusTone } from '@/components/admin/StatusBadge'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'

interface Counts { rows: number; liveBrands: number; existing: number; added: number; addedKnown: number; pendingReview: number; reactivated: number; archived: number; unchanged: number }
interface Report {
  date: string
  status: 'ok' | 'aborted_guard' | 'error' | 'skipped'
  dry: boolean
  abortReason?: string
  finishedAt?: string | null
  counts: Counts | null
  added: { key: string; nameHe: string; kind: 'known' | 'unknown' }[]
  reactivated: { key: string; nameHe: string; kind: 'known' | 'unknown' }[]
  archived: { id: string; nameHe: string }[]
}

const STATUS_TONE: Record<Report['status'], StatusTone> = { ok: 'emerald', aborted_guard: 'amber', error: 'rose', skipped: 'slate' }

// The daily Raayonit sync at a glance (the run the 04:00 cron did, from raayonit_sync_logs) and the manual path: preview the
// difference first (nothing is written), then confirm to apply it. New partners no rule knows yet wait in "Pending review".
export default function RaayonitSyncPanel({ pending, onChanged }: { pending: number; onChanged: () => void }) {
  const { t } = useAdminT()
  const [last, setLast] = useState<Report | null | undefined>(undefined)
  const [preview, setPreview] = useState<Report | null>(null)
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/raayonit/review')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLast(data.lastRun ? { ...data.lastRun, counts: data.lastRun.counts, reactivated: [] } : null)
    } catch {
      setLast(null)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const run = async (apply: boolean, force = false) => {
    setBusy(apply ? 'apply' : 'preview')
    setMessage(null)
    try {
      const res = await adminFetch('/api/admin/raayonit/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'diff', apply, force }) })
      const data = (await res.json().catch(() => ({}))) as Report & { error?: string }
      if (!res.ok) throw new Error(data.error)
      if (apply) {
        setPreview(null)
        setMessage(data.status === 'ok' ? { tone: 'success', text: t('rs.applied') } : { tone: 'error', text: t('rs.stopped', { reason: data.abortReason ?? data.status }) })
        await load()
        onChanged()
      } else {
        setPreview(data)
      }
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message || t('rs.failed') })
    } finally {
      setBusy(null)
    }
  }

  const counts = last?.counts
  const stats: { key: string; label: string; value: number | null }[] = [
    { key: 'added', label: t('rs.added'), value: counts?.added ?? null },
    { key: 'archived', label: t('rs.archived'), value: counts?.archived ?? null },
    { key: 'pending', label: t('rs.pending'), value: pending },
    { key: 'unchanged', label: t('rs.unchanged'), value: counts?.unchanged ?? null },
  ]
  const changes = preview ? preview.added.length + preview.reactivated.length + preview.archived.length : 0

  return (
    <section aria-labelledby="raayonit-sync" className="mb-8 rounded-2xl border border-adm-line bg-adm-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="raayonit-sync" className="text-base font-bold tracking-tight text-adm-text">{t('rs.title')}</h2>
          <p className="mt-1 text-sm text-adm-muted">{t('rs.subtitle')}</p>
        </div>
        {last && <StatusBadge tone={STATUS_TONE[last.status]} icon={last.status === 'ok' ? 'fa-circle-check' : 'fa-triangle-exclamation'}>{t(`rs.status.${last.status}` as 'rs.status.ok')}</StatusBadge>}
      </div>

      <p className="mt-3 text-sm text-adm-text-2">
        {last === undefined ? t('rs.loading') : last ? <>{t('rs.lastRun')}: <bdi dir="ltr" className="tabular-nums font-semibold">{formatIsraeliDateTime(last.finishedAt)}</bdi></> : t('rs.never')}
      </p>
      {last?.abortReason && <Alert tone="warning" className="mt-3">{t('rs.stopped', { reason: last.abortReason })}</Alert>}

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="rounded-xl border border-adm-line bg-adm-sunken px-3 py-3">
            <dt className="text-xs font-semibold text-adm-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-adm-text"><bdi dir="ltr">{s.value ?? '—'}</bdi></dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => void run(false)} disabled={busy !== null}>
          <i className="fa-solid fa-magnifying-glass text-xs" aria-hidden="true" />
          {busy === 'preview' ? t('rc.syncing') : t('rs.runNow')}
        </button>
      </div>
      {message && <Alert tone={message.tone === 'success' ? 'success' : undefined} className="mt-4">{message.text}</Alert>}

      {preview && (
        <div className="mt-4 rounded-xl border border-adm-line-strong bg-adm-sunken p-4" aria-live="polite">
          <h3 className="text-sm font-bold text-adm-text">{t('rs.previewTitle')}</h3>
          {preview.status !== 'ok' ? (
            <Alert tone="warning" className="mt-3">{t('rs.stopped', { reason: preview.abortReason ?? preview.status })}</Alert>
          ) : changes === 0 ? (
            <p className="mt-2 text-sm text-adm-muted">{t('rs.noChanges', { n: preview.counts?.unchanged ?? 0 })}</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm">
              <NameList title={t('rs.added')} tone="emerald" items={preview.added.map((a) => ({ id: a.key, name: a.nameHe, note: a.kind === 'known' ? t('rs.kind.known') : t('rs.kind.unknown') }))} />
              <NameList title={t('rs.reactivated')} tone="blue" items={preview.reactivated.map((a) => ({ id: a.key, name: a.nameHe, note: a.kind === 'known' ? t('rs.kind.known') : t('rs.kind.unknown') }))} />
              <NameList title={t('rs.archived')} tone="amber" items={preview.archived.map((a) => ({ id: a.id, name: a.nameHe, note: '' }))} />
            </div>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {preview.status === 'ok' && changes > 0 && (
              <button type="button" className={`${PRIMARY_BUTTON} w-full sm:w-auto`} onClick={() => void run(true)} disabled={busy !== null}>
                <i className="fa-solid fa-check text-xs" aria-hidden="true" />
                {busy === 'apply' ? t('rc.syncing') : t('rs.confirm')}
              </button>
            )}
            {preview.status === 'aborted_guard' && preview.counts && (
              <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => void run(true, true)} disabled={busy !== null}>
                {busy === 'apply' ? t('rc.syncing') : t('rs.override')}
              </button>
            )}
            <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => setPreview(null)} disabled={busy !== null}>{t('rs.cancel')}</button>
          </div>
        </div>
      )}
    </section>
  )
}

function NameList({ title, tone, items }: { title: string; tone: StatusTone; items: { id: string; name: string; note: string }[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 font-semibold text-adm-text">
        <StatusBadge tone={tone}><bdi dir="ltr" className="tabular-nums">{items.length}</bdi></StatusBadge>
        {title}
      </p>
      <ul className="divide-y divide-adm-line overflow-hidden rounded-lg border border-adm-line bg-adm-surface">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span dir="auto" className="min-w-0 truncate text-adm-text">{i.name}</span>
            {i.note && <span className="shrink-0 text-xs text-adm-muted">{i.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
