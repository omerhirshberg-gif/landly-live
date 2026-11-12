'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { filterLeads, type AdminLead, type LeadFilters, type PrelaunchStats } from '@/lib/admin/prelaunchStats'
import { PERSONAS, PRELAUNCH_LANGS, REFERRAL_SOURCES } from '@/lib/prelaunch/copy'
import Alert from '@/components/admin/Alert'
import BidiText from '@/components/admin/BidiText'
import Card, { CardSkeletons } from '@/components/admin/Card'
import EmptyState from '@/components/admin/EmptyState'
import { ResultCount, SearchInput } from '@/components/admin/ListToolbar'
import PageHeader from '@/components/admin/PageHeader'
import PrelaunchTable, { langName, personaName, referralSourceName } from '@/components/admin/PrelaunchTable'
import StatCard from '@/components/admin/StatCard'
import { ADMIN_INPUT, ADMIN_LABEL, SECONDARY_BUTTON, SECTION_HEADING } from '@/components/admin/formStyles'
import { useAdminT } from '@/lib/admin/translations'

interface LeadsResponse {
  leads: AdminLead[]
  stats: PrelaunchStats
  projectId: string
  listId: string
  generatedAt: string
}

const NO_FILTERS: LeadFilters = { query: '', lang: null, persona: null }

function Breakdown({ rows, total }: { rows: { key: string; label: string; count: number }[]; total: number }) {
  return (
    <ul className="mt-3 space-y-2">
      {rows.map(({ key, label, count }) => (
        <li key={key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-[#475569]">{label}</span>
            <span className="font-semibold tabular-nums text-[#0B1B3D]">{count}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
            <div className="h-full rounded-full bg-[#0038B8]" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Who has saved a spot on /join: the totals, where they came from, and every
// lead, searchable and filterable, with whether it reached the mailing list.
// Retrying a failed sync is the only thing here that writes. Export downloads
// what the filters show, so a Hebrew broadcast is one dropdown away. Leads are
// personal data with a marketing consent attached: opt-outs go through
// scripts/delete-prelaunch-lead.mjs.
export default function PrelaunchLeadsPage() {
  const { t } = useAdminT()
  const [data, setData] = useState<LeadsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [filters, setFilters] = useState(NO_FILTERS)

  const load = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/prelaunch')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setData(body)
    } catch {
      setError(t('leads.loadFailed'))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => data?.leads ?? [], [data])
  const filtered = useMemo(() => filterLeads(rows, filters), [rows, filters])
  const set = (patch: Partial<LeadFilters>) => setFilters((prev) => ({ ...prev, ...patch }))

  const exportCsv = async () => {
    setExporting(true)
    setError(null)
    try {
      const params = new URLSearchParams({ format: 'csv', q: filters.query, lang: filters.lang ?? '', persona: filters.persona ?? '' })
      const res = await adminFetch(`/api/admin/prelaunch?${params}`)
      if (!res.ok) throw new Error()
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'landly-prelaunch-leads.csv'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError(t('leads.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('leads.title')}
        subtitle={
          data ? (
            t('leads.subtitleLive', { project: `\u2066${data.projectId}\u2069`, time: `\u2066${formatIsraeliDateTime(data.generatedAt)}\u2069` })
          ) : (
            t('leads.subtitle')
          )
        }
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" className={`${SECONDARY_BUTTON} flex-1 sm:flex-none`} onClick={() => void load()} disabled={refreshing} aria-busy={refreshing}>
              <i className={`fa-solid fa-arrows-rotate text-xs ${refreshing ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
              {refreshing ? t('leads.refreshing') : t('leads.refresh')}
            </button>
            <button type="button" className={`${SECONDARY_BUTTON} flex-1 sm:flex-none`} onClick={() => void exportCsv()} disabled={exporting || !filtered.length} aria-busy={exporting}>
              <i className="fa-solid fa-file-csv text-sm" aria-hidden="true" />
              {exporting ? t('leads.exporting') : t('leads.export')}
            </button>
          </div>
        }
      />

      {error && <Alert className="mb-6">{error}</Alert>}

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-3 sm:gap-4">
          <StatCard label={t('leads.statTotal')} value={data ? data.stats.total : null} icon="fa-rocket" accent="blue" emptyHint={t('leads.statTotalHint')} />
          <StatCard label={t('leads.statFounding')} value={data ? data.stats.foundingMembers : null} icon="fa-award" accent="amber" />
        </div>
        {data ? (
          <>
            <Card className="p-4 sm:p-6">
              <h2 className={SECTION_HEADING}>{t('leads.languages')}</h2>
              <Breakdown total={data.stats.total} rows={PRELAUNCH_LANGS.map((lang) => ({ key: lang, label: langName(lang), count: data.stats.byLang[lang] }))} />
            </Card>
            <Card className="p-4 sm:p-6">
              <h2 className={SECTION_HEADING}>{t('leads.personas')}</h2>
              <Breakdown total={data.stats.total} rows={[...PERSONAS, 'none' as const].map((key) => ({ key, label: personaName(key, t), count: data.stats.byPersona[key] }))} />
            </Card>
            <Card className="p-4 sm:p-6">
              <h2 className={SECTION_HEADING}>{t('leads.heard')}</h2>
              <Breakdown total={data.stats.total} rows={[...REFERRAL_SOURCES, 'none' as const].map((key) => ({ key, label: referralSourceName(key, t), count: data.stats.byReferralSource[key] }))} />
            </Card>
            <Card className="p-4 sm:col-span-2 sm:p-6">
              <h2 className={SECTION_HEADING}>{t('leads.referrers')}</h2>
              {data.stats.topReferrers.length ? (
                <ol className="mt-3 space-y-2">
                  {data.stats.topReferrers.map((referrer) => (
                    <li key={referrer.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 text-[#0B1B3D]">
                        <BidiText>{referrer.name}</BidiText>
                        <code className="block truncate text-xs text-[#475569]">{referrer.id}</code>
                      </span>
                      <span className="font-semibold tabular-nums text-[#0B1B3D]">{referrer.count}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-[#475569]">{t('leads.noReferred')}</p>
              )}
            </Card>
          </>
        ) : (
          !error && <CardSkeletons count={4} className="h-64" />
        )}
      </div>

      {data && rows.length === 0 && <EmptyState icon="fa-rocket" title={t('leads.emptyTitle')} description={t('leads.emptyDesc')} />}

      {rows.length > 0 && (
        <>
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_12rem_12rem] lg:items-end">
            <SearchInput value={filters.query} onChange={(query) => set({ query })} label={t('leads.search')} placeholder={t('leads.searchPlaceholder')} />
            <div>
              <label htmlFor="lead-lang" className={ADMIN_LABEL}>{t('leads.language')}</label>
              <select id="lead-lang" className={ADMIN_INPUT} value={filters.lang ?? ''} onChange={(event) => set({ lang: (event.target.value || null) as LeadFilters['lang'] })}>
                <option value="">{t('leads.allLanguages')}</option>
                {PRELAUNCH_LANGS.map((lang) => <option key={lang} value={lang}>{langName(lang)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="lead-persona" className={ADMIN_LABEL}>{t('leads.persona')}</label>
              <select id="lead-persona" className={ADMIN_INPUT} value={filters.persona ?? ''} onChange={(event) => set({ persona: (event.target.value || null) as LeadFilters['persona'] })}>
                <option value="">{t('leads.allPersonas')}</option>
                {[...PERSONAS, 'none' as const].map((key) => <option key={key} value={key}>{personaName(key, t)}</option>)}
              </select>
            </div>
          </div>
          <ResultCount shown={filtered.length} total={rows.length} noun={t('leads.noun')} />
          {filtered.length ? (
            <PrelaunchTable rows={filtered} listId={data?.listId ?? ''} onRetried={load} onRetryError={setError} />
          ) : (
            <EmptyState icon="fa-magnifying-glass" title={t('leads.noMatchTitle')} description={t('leads.noMatchDesc')} />
          )}
        </>
      )}
    </div>
  )
}
