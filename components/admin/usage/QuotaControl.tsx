import { useEffect, useRef, useState } from 'react'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import type { QuotaChannel, QuotaChannelState } from '@/lib/usage/quota'
import { formatCount } from '@/lib/usage/pricing'
import QuotaMeter from './QuotaMeter'

// One 019 channel's package quota inside its service row: lifetime sent of
// the purchased quota, the balance left and a "+1,000" top-up. The top-up
// asks first (inline, not a browser dialog), sends the quota it showed so a
// stale click is refused (409), and hands the answer to the page. Numbers sit
// in <bdi dir="ltr"> and spacing is logical, so it reads the same in Hebrew.

const STATUS_TEXT = { ok: 'text-adm-text-2', warn: 'text-adm-warn', critical: 'text-adm-danger' } as const
const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent/60 disabled:cursor-not-allowed disabled:opacity-60'
const ADD_BUTTON = `${BUTTON_BASE} border border-adm-line/90 bg-adm-surface text-adm-text shadow-sm hover:border-adm-line-strong hover:bg-adm-raised`
const CONFIRM_BUTTON = `${BUTTON_BASE} bg-adm-accent text-adm-on-accent hover:bg-adm-accent-hover`
const CANCEL_BUTTON = `${BUTTON_BASE} text-adm-text-2 hover:bg-adm-raised`

type Phase = 'idle' | 'confirming' | 'saving'

function Num({ children }: { children: React.ReactNode }) {
  return (
    <bdi dir="ltr" className="tabular-nums">
      {children}
    </bdi>
  )
}

export default function QuotaControl({
  channel,
  service,
  state,
  onQuota,
  onStale,
}: {
  channel: QuotaChannel
  service: string
  state: QuotaChannelState
  /** The quota after a successful top-up. */
  onQuota: (channel: QuotaChannel, quota: number) => void
  /** The page's figures were out of date: reload them. */
  onStale: () => void
}) {
  const { t } = useAdminT()
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const addRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Focus follows the swap between the button and its question, and returns.
  useEffect(() => {
    if (phase === 'confirming') confirmRef.current?.focus()
  }, [phase])

  const cancel = () => {
    setPhase('idle')
    requestAnimationFrame(() => addRef.current?.focus())
  }

  const confirm = async () => {
    setPhase('saving')
    setError(null)
    try {
      const res = await adminFetch('/api/admin/usage/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, from: state.quota }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data.quota === 'number') {
        onQuota(channel, data.quota)
        setNotice(t('usage.quota.updated', { service: isolated, quota: `⁦${formatCount(data.quota)}⁩` }))
      } else if (res.status === 409) {
        // The answer carries the current quota; without it (another project's document) reload everything.
        if (typeof data.quota === 'number') onQuota(channel, data.quota)
        else onStale()
        setError(t('usage.quota.conflict'))
      } else {
        setError(t('usage.quota.failed'))
      }
    } catch {
      setError(t('usage.quota.failed'))
    }
    setPhase('idle')
    requestAnimationFrame(() => addRef.current?.focus())
  }

  const saving = phase === 'saving'
  // The service name is Latin text inside a sentence: isolated, so a Hebrew sentence keeps its punctuation in place.
  const isolated = `\u2066${service}\u2069`
  return (
    <div className="mt-2.5 space-y-2" onKeyDown={(event) => event.key === 'Escape' && phase === 'confirming' && cancel()}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-adm-muted">{t('usage.quota.lifetime')}</span>
        <span className="font-semibold text-adm-text">
          <Num>
            {formatCount(state.sent)} / {formatCount(state.quota)}
          </Num>
        </span>
      </div>
      <QuotaMeter service={service} pct={state.pct} status={state.status} />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className={`text-xs font-semibold ${STATUS_TEXT[state.status]}`}>
          {state.over > 0
            ? t('usage.quota.over', { count: `⁦${formatCount(state.over)}⁩` })
            : t('usage.quota.remaining', { count: `⁦${formatCount(state.remaining)}⁩` })}
        </span>
        {phase === 'idle' ? (
          <button ref={addRef} type="button" className={ADD_BUTTON} aria-label={t('usage.quota.topupAria', { service: isolated })} onClick={() => setPhase('confirming')}>
            <Num>+1,000</Num>
          </button>
        ) : (
          <div role="group" aria-label={t('usage.quota.confirm', { service: isolated })} className="flex w-full flex-wrap items-center gap-2">
            <span className="w-full text-xs font-medium text-adm-text">{t('usage.quota.confirm', { service: isolated })}</span>
            <button ref={confirmRef} type="button" className={CONFIRM_BUTTON} disabled={saving} aria-busy={saving} onClick={() => void confirm()}>
              {saving ? <ButtonSpinner /> : null}
              {t('usage.quota.confirmYes')}
            </button>
            <button type="button" className={CANCEL_BUTTON} disabled={saving} onClick={cancel}>
              {t('usage.quota.cancel')}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-adm-danger-line bg-adm-danger-soft px-3 py-2 text-xs font-medium text-adm-danger">
          <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{error}</span>
        </p>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {saving ? t('usage.quota.saving') : notice}
      </span>
    </div>
  )
}
