'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { SITE_URL } from '@/lib/config'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { ADMIN_INPUT, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import UsageBreakdown from '@/components/admin/usage/UsageBreakdown'
import UsageSummary from '@/components/admin/usage/UsageSummary'
import { reportLines, type UsageReport } from '@/lib/usage/usageReport'

// Estimated API usage and cost for one UTC month, from the counters this
// deployment's servers keep (lib/usage/recordUsage.ts): live PROD figures on
// Vercel Production, the DEV project's own on local and Preview (labelled,
// with a pointer to Production). Refreshed every 15 minutes while the tab is
// visible, and on return to it.
const REFRESH_MS = 15 * 60 * 1000
const PRODUCTION_DASHBOARD = `${SITE_URL}/admin/system/costs`

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const UPDATED_LABEL = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' })

// Coloured like AdminEnvironmentBadge: red PROD, amber DEV.
const ENVIRONMENTS = {
  prod: { label: 'Production', tone: 'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]', dot: 'bg-[#DC2626]' },
  dev: { label: 'DEV', tone: 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]', dot: 'bg-[#F59E0B]' },
  other: { label: 'Unknown project', tone: 'border-[#E2E8F0] bg-[#F8FAFC] text-[#475569]', dot: 'bg-[#94A3B8]' },
} as const

function monthLabel(key: string): string {
  return MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`))
}

function EnvironmentChip({ report }: { report: UsageReport }) {
  const env = ENVIRONMENTS[report.environment]
  return (
    <span
      title={`Counters from Firebase project ${report.projectId}`}
      className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold uppercase tracking-wider ${env.tone}`}
    >
      <span className={`h-2 w-2 rounded-full ${env.dot}`} aria-hidden="true" />
      {env.label}
      <span aria-hidden="true">·</span>
      <bdi dir="ltr" className="font-medium normal-case tracking-normal opacity-80">
        {report.projectId}
      </bdi>
    </span>
  )
}

export default function UsageCostsPage() {
  const [month, setMonth] = useState<string | null>(null)
  const [report, setReport] = useState<UsageReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Only the latest request may update the page (a month switch mid-refresh).
  const latest = useRef(0)

  const load = useCallback(async (selected: string | null) => {
    const id = ++latest.current
    setLoading(true)
    try {
      const res = await adminFetch(`/api/admin/usage${selected ? `?month=${selected}` : ''}`)
      const data = await res.json()
      if (id !== latest.current) return
      if (!res.ok) throw new Error(data.error ?? 'Failed to load usage.')
      setReport(data as UsageReport)
      setError(null)
    } catch (err) {
      if (id === latest.current) setError(err instanceof Error ? err.message : 'Failed to load usage.')
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [])

  // Polls only while the tab is visible: hiding it stops the timer, and
  // coming back refreshes at once and starts a fresh 15-minute cycle.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      clearInterval(timer)
      timer = undefined
    }
    const start = () => {
      stop()
      timer = setInterval(() => void load(month), REFRESH_MS)
    }
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return stop()
      void load(month)
      start()
    }
    void load(month)
    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load, month])

  const over = report ? reportLines(report).filter((line) => line.status === 'over') : []

  return (
    <div>
      <PageHeader
        title="Usage & Costs"
        subtitle={
          <p className="max-w-2xl">
            Live API usage and estimated cost for the month, from Landly&rsquo;s own server counters (UTC months). An
            estimate, not a Google or Meta invoice.
            {report && (
              <span className="mt-1 block text-xs text-[#94A3B8]">
                Updated <bdi dir="ltr">{UPDATED_LABEL.format(new Date(report.generatedAt))}</bdi> · refreshes every{' '}
                <bdi dir="ltr" className="tabular-nums">
                  15
                </bdi>{' '}
                min
              </span>
            )}
          </p>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {report && <EnvironmentChip report={report} />}
            <div className="flex w-full gap-2 sm:w-auto">
              <label htmlFor="usage-month" className="sr-only">
                Billing month
              </label>
              <select
                id="usage-month"
                className={`${ADMIN_INPUT} min-w-0 flex-1 sm:w-48 sm:flex-none`}
                value={report?.month ?? ''}
                disabled={!report}
                onChange={(event) => setMonth(event.target.value)}
              >
                {(report?.months ?? []).map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </select>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => void load(month)} disabled={loading}>
                {loading ? <ButtonSpinner /> : <i className="fa-solid fa-rotate-right" aria-hidden="true" />}
                Refresh
              </button>
            </div>
          </div>
        }
      />

      {error && <Alert className="mb-4">{error}</Alert>}

      {!report ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <CardSkeletons count={4} className="h-28" />
        </div>
      ) : (
        <div className="space-y-6">
          {report.environment !== 'prod' && (
            <p className="flex items-start gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
              <i className="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                These are this environment&rsquo;s own counters. Production figures are on{' '}
                <a href={PRODUCTION_DASHBOARD} className="break-all font-semibold underline underline-offset-2 hover:text-[#78350F]">
                  www.golandly.com/admin/system/costs
                </a>
                .
              </span>
            </p>
          )}

          {over.length > 0 && (
            <Alert tone="warning">
              Past the free tier this month: {over.map((line) => line.service).join(', ')}. Units beyond it are billed at the
              rates below.
            </Alert>
          )}

          <UsageSummary report={report} />
          <UsageBreakdown groups={report.groups} />

          <Card className="flex items-start gap-3 p-4 sm:p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] text-emerald-700">
              <i className="fa-solid fa-database" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#0B1B3D]">Firestore &amp; Cloud Storage</p>
              <p className="mt-1 text-sm text-[#475569]">
                Platform Database &amp; Storage within standard Firebase Free Tier quotas (
                <bdi dir="ltr">50k reads / 20k writes / 5GB storage</bdi>).
              </p>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Not metered by this dashboard: the Firebase console&rsquo;s Usage tab has the exact figures.
              </p>
            </div>
          </Card>

          <p className="text-xs text-[#94A3B8]">
            {monthLabel(report.month)} · prices checked <bdi dir="ltr">{report.pricesVerifiedAt}</bdi> · USD → ILS at{' '}
            <bdi dir="ltr">{report.fx.usdToIls.toFixed(2)}</bdi>
          </p>
        </div>
      )}
    </div>
  )
}
