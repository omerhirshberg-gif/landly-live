'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT, type AdminKey } from '@/lib/admin/translations'
import { en } from '@/lib/admin/translations/en'
import Alert from '@/components/admin/Alert'
import PageHeader from '@/components/admin/PageHeader'
import PoolSheet from '@/components/admin/inventory/PoolSheet'
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import CampaignHistory from './CampaignHistory'
import EmailPreview from './EmailPreview'
import NewsletterComposer from './NewsletterComposer'
import SubscribersList from './SubscribersList'
import { templateContent, templateLang, type TemplateId } from '@/lib/newsletter/templates'
import { DEFAULT_AUDIENCE_STATE, EMPTY_CONTENT, type AudienceCount, type AudienceState, type CampaignRecord, type ContentState } from './types'

const TEST_EMAIL_KEY = 'landly_newsletter_test_email'
const DEFAULT_TEST_EMAIL = 'contact@golandly.com'

type Notice = { tone: 'success' | 'error' | 'warning'; text: string } | null

export default function NewsletterPage() {
  const { t, locale } = useAdminT()
  const [template, setTemplate] = useState<TemplateId | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<TemplateId | null>(null)
  const [content, setContent] = useState<ContentState>(EMPTY_CONTENT)
  const [audience, setAudience] = useState<AudienceState>(DEFAULT_AUDIENCE_STATE)
  const [count, setCount] = useState<AudienceCount>({ status: 'loading', count: 0, cap: 3000, overCap: false, simulated: false, list: [], env: '' })
  const [testEmail, setTestEmail] = useState(DEFAULT_TEST_EMAIL)
  const [testing, setTesting] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignRecord[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const testEmailLoaded = useRef(false)

  // The test address is remembered per browser; the admin's own is not stored anywhere else.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TEST_EMAIL_KEY)
      if (saved) setTestEmail(saved)
    } catch {
      // Storage unavailable: the default stays.
    }
    testEmailLoaded.current = true
  }, [])
  useEffect(() => {
    if (!testEmailLoaded.current) return
    try {
      localStorage.setItem(TEST_EMAIL_KEY, testEmail)
    } catch {
      // Not remembered this time.
    }
  }, [testEmail])

  const errorText = useCallback(
    (body: { error?: string; message?: string; count?: number } | null) => {
      const key = `newsletter.error.${body?.error ?? 'generic'}`
      const resolved = (key in en ? key : 'newsletter.error.generic') as AdminKey
      return t(resolved, { message: body?.message ?? '', n: body?.count ?? '' })
    },
    [t]
  )

  // The recipient count follows the audience, by the same rules the sender uses; a suppression re-runs it.
  const [audienceVersion, setAudienceVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setCount((c) => ({ ...c, status: 'loading' }))
    const params = new URLSearchParams({ kind: audience.kind, segment: audience.segment, lang: audience.lang, includeList: 'true' })
    adminFetch(`/api/admin/newsletter/audience?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('count failed')
        const data = (await res.json()) as { count: number; cap: number; overCap: boolean; mode: string; env: string; list?: AudienceCount['list'] }
        setCount({ status: 'ready', count: data.count, cap: data.cap, overCap: data.overCap, simulated: data.mode === 'simulated', list: data.list ?? [], env: data.env })
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setCount((c) => ({ ...c, status: 'error' }))
      })
    return () => controller.abort()
  }, [audience, audienceVersion])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await adminFetch('/api/admin/newsletter/campaigns')
      if (res.ok) setCampaigns(((await res.json()) as { campaigns: CampaignRecord[] }).campaigns)
    } finally {
      setHistoryLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  // A campaign that is still going out refreshes the log until it closes.
  const inFlight = campaigns?.some((c) => c.status === 'sending') ?? false
  useEffect(() => {
    if (!inFlight) return
    const timer = setInterval(() => void loadHistory(), 4000)
    return () => clearInterval(timer)
  }, [inFlight, loadHistory])

  const hasText = Object.values(content).some((v) => v.trim() !== '')
  function applyTemplate(id: TemplateId) {
    const lang = templateLang(audience.lang, locale === 'he' ? 'he' : 'en')
    setContent(templateContent(id, lang))
    setTemplate(id)
    setPendingTemplate(null)
  }
  // A template overwrites the form, so it asks first when there is something typed.
  function pickTemplate(id: TemplateId) {
    if (hasText && id !== template) setPendingTemplate(id)
    else if (hasText && id === template) return
    else applyTemplate(id)
  }

  async function post(url: string, body: unknown) {
    const res = await adminFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { res, data: (await res.json().catch(() => null)) as Record<string, unknown> | null }
  }

  async function sendTest() {
    setNotice(null)
    setTesting(true)
    try {
      const { res, data } = await post('/api/admin/newsletter/test', { ...content, to: testEmail, lang: audience.lang === 'all' ? 'en' : audience.lang })
      if (!res.ok) return setNotice({ tone: 'error', text: errorText(data) })
      setNotice(data?.simulated ? { tone: 'warning', text: t('newsletter.test.simulated') } : { tone: 'success', text: t('newsletter.test.sent', { email: testEmail }) })
    } catch {
      setNotice({ tone: 'error', text: errorText(null) })
    } finally {
      setTesting(false)
    }
  }

  async function sendCampaign() {
    setNotice(null)
    setSending(true)
    try {
      const { res, data } = await post('/api/admin/newsletter/send', { ...content, audience, expectedCount: count.count })
      setConfirming(false)
      if (!res.ok) {
        if (data?.error === 'audience_changed' && typeof data.count === 'number') setCount((c) => ({ ...c, count: data.count as number }))
        return setNotice({ tone: 'error', text: errorText(data) })
      }
      setNotice({ tone: 'success', text: t('newsletter.send.started', { n: String(data?.recipientCount ?? count.count) }) })
      void loadHistory()
    } catch {
      setConfirming(false)
      setNotice({ tone: 'error', text: errorText(null) })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('nav.newsletter')} subtitle={t('newsletter.subtitle')} visibleTitle />
      {notice && <Alert tone={notice.tone} className="mb-5">{notice.text}</Alert>}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-2">
        <NewsletterComposer
          content={content}
          onContent={setContent}
          audience={audience}
          onAudience={setAudience}
          count={count}
          testEmail={testEmail}
          onTestEmail={setTestEmail}
          testing={testing}
          onTest={sendTest}
          onSend={() => setConfirming(true)}
          template={template}
          onTemplate={pickTemplate}
        />
        <div className="lg:sticky lg:top-4">
          <EmailPreview content={content} lang={audience.lang} />
        </div>
      </div>
      <div className="mt-6">
        <SubscribersList count={count} onChanged={() => setAudienceVersion((v) => v + 1)} />
      </div>
      <div className="mt-10">
        <CampaignHistory campaigns={campaigns} loading={historyLoading} onRefresh={loadHistory} />
      </div>

      {pendingTemplate && (
        <PoolSheet title={t('newsletter.template.confirmTitle')} onClose={() => setPendingTemplate(null)}>
          <p className="text-sm text-adm-text-2">{t('newsletter.template.confirmBody')}</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setPendingTemplate(null)}>{t('newsletter.send.cancel')}</button>
            <button type="button" className={PRIMARY_BUTTON} onClick={() => applyTemplate(pendingTemplate)}>{t('newsletter.template.confirmYes')}</button>
          </div>
        </PoolSheet>
      )}

      {confirming && (
        <PoolSheet title={t('newsletter.send.confirmTitle')} onClose={() => !sending && setConfirming(false)}>
          <p dir="auto" className="rounded-xl border border-adm-line bg-adm-raised px-4 py-3 text-base font-semibold text-adm-text">
            <bdi>{content.subject}</bdi>
          </p>
          <p className="mt-4 text-sm text-adm-text-2">
            {count.simulated
              ? t('newsletter.send.confirmSimulated', { n: count.count.toLocaleString('en-US') })
              : t('newsletter.send.confirmBody', { n: count.count.toLocaleString('en-US') })}
          </p>
          {!count.simulated && count.count > 100 && (
            <Alert tone="warning" className="mt-4">{t('newsletter.send.dailyWarning', { n: count.count.toLocaleString('en-US') })}</Alert>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setConfirming(false)} disabled={sending}>
              {t('newsletter.send.cancel')}
            </button>
            <button type="button" className={PRIMARY_BUTTON} onClick={sendCampaign} disabled={sending}>
              {sending ? t('newsletter.send.sending') : t('newsletter.send.confirm', { n: count.count.toLocaleString('en-US') })}
            </button>
          </div>
        </PoolSheet>
      )}
    </div>
  )
}
