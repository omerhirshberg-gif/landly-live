'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CreditCard, LoaderCircle, Lock, RotateCw } from 'lucide-react'
import { translations, type TranslationKey } from '@/lib/i18n/translations'
import { classifyChargeResult } from '@/lib/payments/hostedFieldsResult'
import {
  HOSTED_FIELDS_SCRIPT_URL, type CardFrameErrorCode, type CardFrameEvent, type CardFrameLang, type HostedPaymentParams,
} from '@/lib/payments/hostedFieldsProtocol'

// Tranzila Hosted Fields (https://docs.tranzila.com/docs/payments-and-billing/hosted-fields): the card number, expiry and
// CVV are Tranzila's own iframes inside our slots, so the card data never touches GoLandly (PCI scope stays with Tranzila).
// One component serves the website's payment step and the page the app shows in its WebView (app/checkout/card-frame).
// It only reports what happened (onEvent); the voucher exists once the server verifies the charge with Tranzila.
interface HostedFieldsApi {
  onEvent?: (name: string, cb: (event: unknown) => void) => void
  charge: (params: Record<string, unknown>, cb: (err: unknown, response: unknown) => void) => void
}
declare global {
  interface Window {
    TzlaHostedFields?: { create: (options: Record<string, unknown>) => HostedFieldsApi }
  }
}

let scriptPromise: Promise<void> | null = null
function loadHostedFieldsScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.TzlaHostedFields) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      // Fixed URL: never read from the server response or a message.
      el.src = HOSTED_FIELDS_SCRIPT_URL
      el.async = true
      el.onload = () => (window.TzlaHostedFields ? resolve() : reject(new Error('Hosted Fields did not initialise')))
      el.onerror = () => reject(new Error('Hosted Fields failed to load'))
      document.head.appendChild(el)
    }).catch((e) => { scriptPromise = null; document.querySelectorAll(`script[src="${HOSTED_FIELDS_SCRIPT_URL}"]`).forEach((n) => n.remove()); throw e })
  }
  return scriptPromise
}

const SLOT = { number: 'tzla-card-number', expiry: 'tzla-card-expiry', cvv: 'tzla-card-cvv' } as const
const ERROR_KEYS: Record<CardFrameErrorCode, TranslationKey> = {
  validation: 'checkout_card_err_validation',
  declined: 'checkout_card_err_declined',
  thtk_expired: 'checkout_card_err_session',
  network: 'checkout_card_err_network',
  '3ds_failed': 'checkout_card_err_3ds',
  load_failed: 'checkout_card_load_failed',
}
const RESPONSE_LANGUAGE: Record<CardFrameLang, string> = { he: 'Hebrew', en: 'English', ru: 'English', fr: 'English', es: 'English' }

interface Props {
  payment: HostedPaymentParams
  lang: CardFrameLang
  /** The localised price for the Pay button, e.g. "₪25". */
  priceLabel: string
  /** The host is confirming a charge (or otherwise busy): the form is inert. */
  busy?: boolean
  /** An error the host wants shown (a failed confirmation, a refused refresh). */
  externalError?: CardFrameErrorCode | null
  onEvent: (event: CardFrameEvent) => void
}

export default function TranzilaHostedFields({ payment, lang, priceLabel, busy = false, externalError = null, onEvent }: Props) {
  const t = useCallback((key: TranslationKey) => translations[lang][key] ?? translations.en[key], [lang])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<CardFrameErrorCode | null>(null)
  const [badFields, setBadFields] = useState<string[]>([])
  const fieldsRef = useRef<HostedFieldsApi | null>(null)
  // The thtk is refreshed by the host without recreating the fields, so the member's typing survives.
  const paymentRef = useRef(payment)
  paymentRef.current = payment
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const submittingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    loadHostedFieldsScript()
      .then(() => {
        if (cancelled || !window.TzlaHostedFields) return
        const fields = window.TzlaHostedFields.create({
          sandbox: false, // Tranzila: always false; there is no separate sandbox host.
          fields: {
            credit_card_number: { selector: `#${SLOT.number}`, placeholder: '0000 0000 0000 0000', tabindex: 1 },
            expiry: { selector: `#${SLOT.expiry}`, placeholder: t('checkout_card_expiry_placeholder'), tabindex: 2, version: '1' },
            cvv: { selector: `#${SLOT.cvv}`, placeholder: 'CVV', tabindex: 3 },
          },
          // 16px stops iOS Safari zooming into the field. Style keys to be confirmed against Tranzila's styles reference.
          styles: {
            input: { 'font-size': '16px', height: '46px', color: '#0f172a', 'font-family': 'inherit', padding: '0 14px', border: '0', background: 'transparent' },
            '.invalid': { color: '#dc2626' },
          },
        })
        fieldsRef.current = fields
        setStatus('ready')
        onEventRef.current({ v: 1, type: 'ready' })
      })
      .catch(() => {
        if (cancelled) return
        setStatus('failed')
        onEventRef.current({ v: 1, type: 'error', code: 'load_failed' })
      })
    return () => {
      cancelled = true
      fieldsRef.current = null
      // Tranzila's iframes live in our slots; drop them so a remount starts clean.
      for (const id of Object.values(SLOT)) document.getElementById(id)?.replaceChildren()
    }
    // The fields are created once per attempt; the language only changes placeholders on the next attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const submit = () => {
    const fields = fieldsRef.current
    if (!fields || submittingRef.current || busy) return
    setError(null)
    setBadFields([])
    const current = paymentRef.current
    if (Date.now() >= current.expiresAtMs) {
      setError('thtk_expired')
      onEventRef.current({ v: 1, type: 'error', code: 'thtk_expired' })
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    onEventRef.current({ v: 1, type: 'submitting' })
    let settled = false
    const done = (err: unknown, response: unknown) => {
      if (settled) return
      settled = true
      submittingRef.current = false
      setSubmitting(false)
      const outcome = classifyChargeResult(err, response)
      if (outcome.ok) {
        onEventRef.current({ v: 1, type: 'charged' })
        return
      }
      setError(outcome.code)
      setBadFields(outcome.fields)
      onEventRef.current({ v: 1, type: 'error', code: outcome.code })
    }
    try {
      fields.charge({
        terminal_name: current.terminal,
        amount: current.amountAgorot / 100,
        thtk: current.thtk,
        tran_mode: 'A',
        currency_code: 'ILS',
        response_language: RESPONSE_LANGUAGE[lang],
        notify_url: current.notifyUrl,
      }, done)
    } catch {
      done(new Error('charge failed'), null)
    }
  }

  const shownError = externalError ?? error
  const inert = busy || submitting || status !== 'ready'
  const bad = (name: string) => badFields.includes(name)
  const slot = (invalid: boolean) =>
    `h-12 min-h-12 w-full overflow-hidden rounded-xl border bg-white transition-shadow [&>iframe]:h-full [&>iframe]:w-full focus-within:ring-2 focus-within:ring-brand/40 ${invalid ? 'border-red-400' : 'border-slate-200'}`

  return (
    <div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-sky-200/60 bg-brandTint text-brand">
          <CreditCard className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <h2 className="text-start text-base font-bold text-ink">{t('checkout_card_title')}</h2>
      </div>

      <div className="relative mt-5">
        <div aria-busy={status === 'loading' || undefined} className={status === 'ready' ? '' : 'pointer-events-none opacity-40'}>
          <label className="mb-1.5 block text-start text-xs font-bold text-slate-700" dir="auto">{t('checkout_card_number_label')}</label>
          <div id={SLOT.number} dir="ltr" className={slot(bad('credit_card_number'))} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-start text-xs font-bold text-slate-700" dir="auto">{t('checkout_card_expiry_label')}</label>
              <div id={SLOT.expiry} dir="ltr" className={slot(bad('expiry'))} />
            </div>
            <div>
              <label className="mb-1.5 block text-start text-xs font-bold text-slate-700" dir="auto">{t('checkout_card_cvv_label')}</label>
              <div id={SLOT.cvv} dir="ltr" className={slot(bad('cvv'))} />
            </div>
          </div>
        </div>
        {status === 'loading' && (
          <div role="status" className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={2} />
            <span>{t('checkout_card_loading')}</span>
          </div>
        )}
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {(shownError || status === 'failed') && (
          <p role="alert" className="mt-3 text-start text-sm font-semibold text-red-600" dir="auto">
            {t(ERROR_KEYS[status === 'failed' ? 'load_failed' : shownError!])}
          </p>
        )}
      </div>

      {status === 'failed' ? (
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="ds-btn ds-btn-secondary ds-btn-wrap mt-3 w-full">
          <RotateCw aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
          <span>{t('checkout_card_retry')}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={inert}
          aria-busy={submitting || busy || undefined}
          className="checkout-pay ds-btn ds-btn-primary ds-btn-wrap mt-3 w-full"
        >
          {submitting || busy
            ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" strokeWidth={2} />
            : <Lock aria-hidden="true" className="h-4 w-4" strokeWidth={2} />}
          <span dir="auto">{t('checkout_pay_button').replace('{price}', priceLabel)}</span>
        </button>
      )}

      <p className="mt-4 flex items-start gap-2 text-start text-xs leading-5 text-slate-500" dir="auto">
        <Lock aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.75} />
        <span>{t('checkout_card_secure_note')}</span>
      </p>
    </div>
  )
}
