'use client'

import { useState } from 'react'
import Alert from '@/components/admin/Alert'
import Card from '@/components/admin/Card'
import { ButtonSpinner } from '@/components/admin/FormSection'
import { ADMIN_INPUT, ADMIN_SELECT, PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/admin/formStyles'
import FreeTierMeter from '@/components/admin/usage/FreeTierMeter'
import { adminFetch } from '@/lib/admin/adminSession'
import { useAdminT } from '@/lib/admin/translations'
import { MAX_AMOUNT } from '@/lib/usage/fixedSubscriptions'
import { formatCount, formatIls, type Currency } from '@/lib/usage/pricing'
import { meterStatus, type FixedLine, type UsageReport } from '@/lib/usage/usageReport'

// "Fixed Subscriptions & Platform Tiers": flat plan fees (Vercel Pro, editable
// here, stored in system_config/fixed_subscriptions), Resend's free tier and
// Tranzila's readiness. Tranzila's fee rates are code constants (lib/usage/pricing.ts).

const ICONS = { subscription: 'fa-cloud', resend: 'fa-envelope', tranzila: 'fa-credit-card' } as const

const priceText = (price: NonNullable<FixedLine['price']>) =>
  price.currency === 'USD' ? `$${price.amount.toFixed(2)}` : formatIls(price.amount)

function Editor({ line, report, onSaved, onClose }: { line: FixedLine; report: UsageReport; onSaved: (service: string) => void; onClose: () => void }) {
  const { t } = useAdminT()
  const [amount, setAmount] = useState(String(line.price?.amount ?? 0))
  const [currency, setCurrency] = useState<Currency>(line.price?.currency ?? 'USD')
  const [active, setActive] = useState(line.status !== 'inactive')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    const value = Number(amount)
    if (!amount.trim() || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) return setError(t('usage.fixed.invalid'))
    setSaving(true)
    setError(null)
    // The whole list is saved: the other subscriptions as the page shows them, this one as edited.
    const items = report.fixed.lines
      .filter((other) => other.kind === 'subscription' && other.price)
      .map((other) => (other.id === line.id ? { id: other.id, label: other.label, amount: value, currency, active } : { id: other.id, label: other.label, amount: other.price!.amount, currency: other.price!.currency, active: other.status !== 'inactive' }))
    try {
      const res = await adminFetch('/api/admin/system/costs/subscriptions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
      if (!res.ok) throw new Error()
      onSaved(line.label)
    } catch {
      setError(t('usage.fixed.failed'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-xl border border-adm-line/80 bg-adm-sunken p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`fx-amount-${line.id}`} className="mb-1.5 block text-sm font-medium text-adm-text">
            {t('usage.fixed.amount')}
          </label>
          <input id={`fx-amount-${line.id}`} dir="ltr" type="number" inputMode="decimal" min={0} max={MAX_AMOUNT} step="0.01" className={`${ADMIN_INPUT} tabular-nums`} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div>
          <label htmlFor={`fx-currency-${line.id}`} className="mb-1.5 block text-sm font-medium text-adm-text">
            {t('usage.fixed.currency')}
          </label>
          <select id={`fx-currency-${line.id}`} className={ADMIN_SELECT} value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
            <option value="USD">USD ($)</option>
            <option value="ILS">ILS (₪)</option>
          </select>
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-adm-text">
        <input type="checkbox" className="h-5 w-5 accent-[var(--adm-accent,#2563eb)]" checked={active} onChange={(event) => setActive(event.target.checked)} />
        {t('usage.fixed.active')}
      </label>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className={`${PRIMARY_BUTTON} w-full sm:w-auto`} disabled={saving}>
          {saving && <ButtonSpinner />}
          {saving ? t('usage.fixed.saving') : t('usage.fixed.save')}
        </button>
        <button type="button" className={`${SECONDARY_BUTTON} w-full sm:w-auto`} onClick={onClose} disabled={saving}>
          {t('usage.fixed.cancel')}
        </button>
      </div>
    </form>
  )
}

function Row({ line, report, onSaved }: { line: FixedLine; report: UsageReport; onSaved: (service: string) => void }) {
  const { t } = useAdminT()
  const [editing, setEditing] = useState(false)
  const money = (value: number) => formatIls(value)

  let detail: React.ReactNode = null
  if (line.kind === 'subscription') {
    detail = line.status === 'inactive' ? t('usage.fixed.inactive') : t('usage.fixed.planFee')
  } else if (line.kind === 'resend') {
    const free = line.freeAllowance ?? 0
    detail = (
      <>
        <span className="font-medium text-adm-text-2">
          {t('usage.fixed.resendFree')} · <bdi dir="ltr">{t('usage.fixed.resendEmails', { used: formatCount(line.used ?? 0), free: formatCount(free) })}</bdi>
        </span>
        {free > 0 && <FreeTierMeter service={line.label} coverage={(line.used ?? 0) / free} status={meterStatus((line.used ?? 0) / free, line.status === 'over' ? 1 : 0)} />}
        {line.status === 'over' && <span className="mt-1 block text-adm-warn">{t('usage.fixed.resendOver')}</span>}
      </>
    )
  } else {
    detail =
      line.status === 'notConfigured' ? (
        t('usage.fixed.tranzilaNone')
      ) : line.unavailable ? (
        t('usage.fixed.tranzilaUnavailable')
      ) : (
        <bdi dir="ltr">{t('usage.fixed.tranzilaOn', { n: formatCount(line.transactions ?? 0), volume: formatIls(line.volumeIls ?? 0) })}</bdi>
      )
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-adm-sunken text-adm-text-2">
          <i className={`fa-solid ${ICONS[line.kind]}`} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <p className="font-semibold text-adm-text">{line.label}</p>
              {line.price && (
                <p className="text-xs text-adm-muted">
                  <bdi dir="ltr" className="tabular-nums">
                    {t('usage.fixed.perMonth', { price: priceText(line.price) })}
                    {line.price.currency === 'USD' && ` @ ${report.fx.usdToIls.toFixed(4)}`}
                  </bdi>
                </p>
              )}
            </div>
            <p className="text-lg font-extrabold tabular-nums text-adm-text">
              <bdi dir="ltr">{money(line.netIls)}</bdi>
            </p>
          </div>
          <div className="mt-1 text-xs text-adm-muted">{detail}</div>
          {line.kind === 'subscription' && !editing && (
            <button type="button" className={`${SECONDARY_BUTTON} mt-3 min-h-11 px-4 text-sm`} aria-label={t('usage.fixed.editAria', { service: line.label })} onClick={() => setEditing(true)}>
              <i className="fa-solid fa-pen" aria-hidden="true" />
              {t('usage.fixed.edit')}
            </button>
          )}
        </div>
      </div>
      {editing && (
        <Editor
          line={line}
          report={report}
          onClose={() => setEditing(false)}
          onSaved={(service) => {
            setEditing(false)
            onSaved(service)
          }}
        />
      )}
    </li>
  )
}

export default function FixedSubscriptions({ report, onSaved }: { report: UsageReport; onSaved: (service: string) => void }) {
  const { t } = useAdminT()
  return (
    <Card className="p-4 sm:p-6">
      <h2 className="text-base font-bold text-adm-text">{t('usage.fixed.title')}</h2>
      <p className="mt-1 text-sm text-adm-text-2">{t('usage.fixed.subtitle')}</p>
      <ul className="mt-4 divide-y divide-adm-line/80">
        {report.fixed.lines.map((line) => (
          <Row key={line.id} line={line} report={report} onSaved={onSaved} />
        ))}
      </ul>
    </Card>
  )
}
