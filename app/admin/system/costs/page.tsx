'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { SITE_URL } from '@/lib/config'
import Alert from '@/components/admin/Alert'
import Card, { CardSkeletons } from '@/components/admin/Card'
import PageHeader from '@/components/admin/PageHeader'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { ADMIN_INPUT, ADMIN_SELECT, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import FixedSubscriptions from '@/components/admin/usage/FixedSubscriptions'
import GrandTotal from '@/components/admin/usage/GrandTotal'
import UsageBreakdown from '@/components/admin/usage/UsageBreakdown'
import UsageSummary from '@/components/admin/usage/UsageSummary'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { reportLines, type UsageReport } from '@/lib/usage/usageReport'
import { quotaState, type QuotaChannel } from '@/lib/usage/quota'

// Estimated API usage and cost for one UTC month, from the counters this
// deployment's servers keep (lib/usage/recordUsage.ts): live PROD figures on
// Vercel Production, the DEV project's own on local and Preview (labelled,
// with a pointer to Production). Refreshed every 15 minutes while the tab is
// visible, and on return to it.
const REFRESH_MS = 15 * 60 * 1000
const PRODUCTION_DASHBOARD = `${SITE_URL}/admin/system/costs`

const intlLocale = (locale: string) => (locale === 'he' ? 'he-IL' : 'en-US')

// Coloured like AdminEnvironmentBadge: red PROD, amber DEV.
const ENVIRONMENTS = {
  prod: { label: 'usage.env.prod', tone: 'border-adm-danger-line bg-adm-danger-soft text-adm-danger', dot: 'bg-[#DC2626]' },
  dev: { label: 'usage.env.dev', tone: 'border-adm-warn-line bg-adm-warn-soft text-adm-warn', dot: 'bg-[#F59E0B]' },
  other: { label: 'usage.env.other', tone: 'border-adm-line bg-adm-sunken text-adm-text-2', dot: 'bg-[#94A3B8]' },
} as const satisfies Record<string, { label: AdminKey; tone: string; dot: string }>

function monthLabel(key: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`))
}

function EnvironmentChip({ report }: { report: UsageReport }) {
  const { t } = useAdminT()
  const env = ENVIRONMENTS[report.environment]
  return (
    <span
      title={t('usage.envTitle', { project: report.projectId })}
      className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold uppercase tracking-wider ${env.tone}`}
    >
      <span className={`h-2 w-2 rounded-full ${env.dot}`} aria-hidden="true" />
      {t(env.label)}
      <span aria-hidden="true">·</span>
      <bdi dir="ltr" className="font-medium normal-case tracking-normal opacity-80">
        {report.projectId}
      </bdi>
    </span>
  )
}

export default function UsageCostsPage() {
  const { t, locale } = useAdminT()
  const [month, setMonth] = useState<string | null>(null)
  const [report, setReport] = useState<UsageReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendNotice, setSendNotice] = useState<{ tone: 'success' | 'warning' | 'error'; text: string } | null>(null)
  // Only the latest request may update the page (a month switch mid-refresh).
  const latest = useRef(0)

  const load = useCallback(async (selected: string | null) => {
    const id = ++latest.current
    setLoading(true)
    try {
      const res = await adminFetch(`/api/admin/usage${selected ? `?month=${selected}` : ''}`)
      const data = await res.json()
      if (id !== latest.current) return
      if (!res.ok) throw new Error(data.error ?? t('usage.page.loadFailed'))
      setReport(data as UsageReport)
      setError(null)
    } catch (err) {
      if (id === latest.current) setError(err instanceof Error ? err.message : t('usage.page.loadFailed'))
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

  // After a top-up the new quota shows at once; the reload that follows settles every figure.
  const applyQuota = useCallback(
    (channel: QuotaChannel, quota: number) => {
      setReport((current) => (current ? { ...current, quota: { ...current.quota, [channel]: quotaState(current.quota[channel].sent, quota) } } : current))
      void load(month)
    },
    [load, month]
  )

  // Emails the shown month's report (HTML + CSV) to the accounting inbox, in the admin's language.
  const sendReport = useCallback(async () => {
    if (!report) return
    setSending(true)
    setSendNotice(null)
    try {
      const res = await adminFetch('/api/admin/system/costs/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: report.month, lang: locale }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) return setSendNotice({ tone: 'warning', text: t('usage.sendReport.throttled') })
      if (!res.ok) return setSendNotice({ tone: 'error', text: t('usage.sendReport.failed') })
      const month = `\u2066${report.month}\u2069`
      setSendNotice(
        data.status === 'simulated'
          ? { tone: 'warning', text: t('usage.sendReport.simulated', { month }) }
          : { tone: 'success', text: t('usage.sendReport.sent', { month, to: `\u2066${data.to}\u2069` }) }
      )
    } catch {
      setSendNotice({ tone: 'error', text: t('usage.sendReport.failed') })
    } finally {
      setSending(false)
    }
  }, [report, locale, t])

  const over = report ? reportLines(report).filter((line) => line.status === 'over') : []

  return (
    <div>
      <PageHeader
        title={t('usage.page.title')}
        subtitle={
          <p className="max-w-2xl">
            {t('usage.page.subtitle')}
            {report && (
              <span className="mt-1 block text-xs text-adm-muted">
                {t('usage.page.updated', {
                  time: `\u2066${new Intl.DateTimeFormat(intlLocale(locale), { hour: '2-digit', minute: '2-digit' }).format(new Date(report.generatedAt))}\u2069`,
                  min: '\u206615\u2069',
                })}
              </span>
            )}
          </p>
        }
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {report && <EnvironmentChip report={report} />}
            <div className="flex w-full gap-2 sm:w-auto">
              <label htmlFor="usage-month" className="sr-only">
                {t('usage.page.billingMonth')}
              </label>
              <select
                id="usage-month"
                className={`${ADMIN_SELECT} min-w-0 flex-1 sm:w-48 sm:flex-none`}
                value={report?.month ?? ''}
                disabled={!report}
                onChange={(event) => setMonth(event.target.value)}
              >
                {(report?.months ?? []).map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key, locale)}
                  </option>
                ))}
              </select>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => void load(month)} disabled={loading}>
                {loading ? <ButtonSpinner /> : <i className="fa-solid fa-rotate-right" aria-hidden="true" />}
                {t('usage.page.refresh')}
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
            <p className="flex items-start gap-2 rounded-xl border border-adm-warn-line bg-adm-warn-soft px-4 py-3 text-sm text-adm-warn">
              <i className="fa-solid fa-circle-info mt-0.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                {t('usage.notProd')}{' '}
                <a href={PRODUCTION_DASHBOARD} className="break-words font-semibold underline underline-offset-2 hover:text-adm-text">
                  <bdi dir="ltr">www.golandly.com/admin/system/costs</bdi>
                </a>
                .
              </span>
            </p>
          )}

          {over.length > 0 && (
            <Alert tone="warning">
              {t('usage.overTier', { services: over.map((line) => line.service).join(', ') })}
            </Alert>
          )}

          <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-adm-sunken text-adm-text-2">
                <i className="fa-solid fa-coins" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-adm-text-2">
                  <span className="font-semibold text-adm-text">{t('usage.rate.label')}</span>
                  <bdi dir="ltr" className="text-lg font-bold tabular-nums text-adm-text">
                    {report.fx.usdToIls.toFixed(4)}
                  </bdi>
                  {report.fx.updatedAt && (
                    <span>
                      {t('usage.rate.updated', {
                        date: `\u2066${new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(report.fx.updatedAt))}\u2069`,
                      })}
                    </span>
                  )}
                </p>
                <p className={`mt-0.5 text-xs ${report.fx.stale || report.fx.source === 'default' ? 'text-adm-warn' : 'text-adm-muted'}`}>
                  {t(`usage.rate.source.${report.fx.source}` as AdminKey)}
                  {report.fx.stale && <> · {t('usage.rate.stale')}</>}
                </p>
                <p className="mt-1 text-xs text-adm-muted">{t('usage.rate.hint')}</p>
              </div>
            </div>
            <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={() => void sendReport()} disabled={sending}>
              {sending ? <ButtonSpinner /> : <i className="fa-solid fa-envelope" aria-hidden="true" />}
              {sending ? t('usage.sendReport.sending') : t('usage.sendReport.button')}
            </button>
          </Card>

          {sendNotice && <Alert tone={sendNotice.tone}>{sendNotice.text}</Alert>}

          <UsageSummary report={report} />
          <UsageBreakdown groups={report.groups} quota={report.quota} onQuota={applyQuota} onStale={() => void load(month)} />

          <FixedSubscriptions
            report={report}
            onSaved={(service) => {
              setSendNotice({ tone: 'success', text: t('usage.fixed.saved', { service }) })
              void load(month)
            }}
          />
          <GrandTotal report={report} />

          <p className="px-1 text-xs leading-relaxed text-adm-muted">
            {t('usage.projectNote', { project: `\u2066${report.projectId}\u2069` })}
          </p>

          <Card className="flex items-start gap-3 p-4 sm:p-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-adm-ok-soft text-adm-ok">
              <i className="fa-solid fa-database" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-adm-text">{t('usage.firestoreTitle')}</p>
              <p className="mt-1 text-sm text-adm-text-2">
                {t('usage.firestoreBody', { quota: '\u206650k reads / 20k writes / 5GB storage\u2069' })}
              </p>
              <p className="mt-1 text-xs text-adm-muted">
                {t('usage.firestoreNote')}
              </p>
            </div>
          </Card>

          <p className="text-xs text-adm-muted">
            {t('usage.footer', { month: monthLabel(report.month, locale), date: `\u2066${report.pricesVerifiedAt}\u2069`, rate: `\u2066${report.fx.usdToIls.toFixed(4)}\u2069` })}
          </p>
        </div>
      )}
    </div>
  )
}
