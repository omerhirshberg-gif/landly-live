'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { adminFetch } from '@/lib/admin/adminSession'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { ADMIN_INPUT, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import EnvironmentSwitch from '@/components/admin/usage/EnvironmentSwitch'
import SourceStatus from '@/components/admin/usage/SourceStatus'
import UsageBreakdown from '@/components/admin/usage/UsageBreakdown'
import UsageSummary from '@/components/admin/usage/UsageSummary'
import { isUsageView, type UsageReport, type UsageView } from '@/lib/usage/usageReport'

// Estimated API usage and cost for one UTC month, for PROD, DEV or both
// combined (?view=, default combined), from the counters the servers keep
// (lib/usage/recordUsage.ts). The two projects share one billing account, so
// Combined is the actual bill. Refreshed every minute while the tab is
// visible, and on return to it.
const REFRESH_MS = 60_000

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const UPDATED_LABEL = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' })
const VIEW_NAMES: Record<UsageView, string> = { combined: 'Combined', prod: 'Production', dev: 'Development' }
const ENV_NAMES = { prod: 'Production', dev: 'Development' } as const

function monthLabel(key: string): string {
  return MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`))
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <CardSkeletons count={4} className="h-28" />
    </div>
  )
}

function UsageCosts() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rawView = searchParams.get('view')
  const view: UsageView = isUsageView(rawView) ? rawView : 'combined'

  const [month, setMonth] = useState<string | null>(null)
  const [report, setReport] = useState<UsageReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // Only the latest request may update the page (a switch mid-refresh).
  const latest = useRef(0)

  const load = useCallback(async (selectedMonth: string | null, selectedView: UsageView) => {
    const id = ++latest.current
    setLoading(true)
    try {
      const query = new URLSearchParams({ view: selectedView, ...(selectedMonth ? { month: selectedMonth } : {}) })
      const res = await adminFetch(`/api/admin/usage?${query}`)
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

  useEffect(() => {
    void load(month, view)
    const refresh = () => {
      if (document.visibilityState === 'visible') void load(month, view)
    }
    const timer = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [load, month, view])

  const changeView = (next: UsageView) => {
    if (next === view) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', next)
    router.replace(`${pathname}?${params}`, { scroll: false })
  }

  // A report for another view is still on screen while the new one loads.
  const shown = report?.view === view ? report : null
  const over = shown?.lines.filter((line) => line.status === 'over') ?? []
  const missing = shown?.sources.filter((source) => source.status !== 'ok') ?? []

  return (
    <div>
      <PageHeader
        title="Usage & Costs"
        subtitle={
          <p className="max-w-3xl">
            Estimated monthly API usage from Landly&rsquo;s own server counters (UTC months), for production, development,
            or both on their shared billing account. An estimate, not a Google or Meta invoice.
          </p>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto lg:flex-row">
            <EnvironmentSwitch value={view} onChange={changeView} />
            <div className="flex w-full gap-2 sm:w-auto">
              <label htmlFor="usage-month" className="sr-only">
                Billing month
              </label>
              <select
                id="usage-month"
                className={`${ADMIN_INPUT} min-w-0 flex-1 sm:w-52 sm:flex-none`}
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
              <button type="button" className={SECONDARY_BUTTON} onClick={() => void load(month, view)} disabled={loading}>
                {loading ? <ButtonSpinner /> : <i className="fa-solid fa-rotate-right" aria-hidden="true" />}
                Refresh
              </button>
            </div>
          </div>
        }
      />

      {error && <Alert className="mb-4">{error}</Alert>}

      {!shown ? (
        <SkeletonCards />
      ) : (
        <div className="space-y-6">
          <SourceStatus sources={shown.sources} />

          {!shown.available ? (
            <Alert>
              {VIEW_NAMES[view]} figures are unavailable: {missing.map((source) => source.message).join(' ') || 'no counters could be read.'}
            </Alert>
          ) : (
            <>
              {shown.partial && (
                <Alert tone="warning">
                  This total is partial: {missing.map((source) => `${ENV_NAMES[source.env]}: ${source.message}`).join(' ')}
                  It covers {shown.sources.filter((source) => source.status === 'ok').map((source) => ENV_NAMES[source.env]).join(' and ')} only.
                </Alert>
              )}
              {over.length > 0 && (
                <Alert tone="warning">
                  Past the free tier this month: {over.map((line) => line.service).join(', ')}. Units beyond it are billed at the
                  rates below.
                </Alert>
              )}

              <UsageSummary report={shown} />

              {shown.sharedFreeTier && (
                <p className="flex items-start gap-2 text-sm text-[#475569]">
                  <i className="fa-solid fa-circle-info mt-0.5 shrink-0 text-[#0038B8]" aria-hidden="true" />
                  <span>
                    Free tiers are shared by both projects (one Google Cloud billing account and one Meta account). This view
                    prices {VIEW_NAMES[view]} as if it had them to itself; <strong className="font-semibold">Combined</strong> shows
                    what is actually billed.
                  </span>
                </p>
              )}

              <UsageBreakdown lines={shown.lines} />
            </>
          )}

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
            {monthLabel(shown.month)} · {VIEW_NAMES[shown.view]} · prices checked <bdi dir="ltr">{shown.pricesVerifiedAt}</bdi> ·
            USD → ILS at <bdi dir="ltr">{shown.fx.usdToIls.toFixed(2)}</bdi> · updated{' '}
            <bdi dir="ltr">{UPDATED_LABEL.format(new Date(shown.generatedAt))}</bdi>
          </p>
        </div>
      )}
    </div>
  )
}

// useSearchParams needs a Suspense boundary for the page to prerender.
export default function UsageCostsPage() {
  return (
    <Suspense fallback={<SkeletonCards />}>
      <UsageCosts />
    </Suspense>
  )
}
