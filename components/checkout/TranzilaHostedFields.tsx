'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CreditCard, LoaderCircle, Lock, RotateCw } from 'lucide-react'
import { translations, type TranslationKey } from '@/lib/i18n/translations'
import { classifyChargeResult } from '@/lib/payments/hostedFieldsResult'
import {
  HOSTED_FIELDS_APPLE_PAY_SCRIPT_URL, HOSTED_FIELDS_SCRIPT_URL,
  type CardFrameErrorCode, type CardFrameEvent, type CardFrameLang, type CardHolder, type HostedPaymentParams,
} from '@/lib/payments/hostedFieldsProtocol'
import { applePayAvailable, googlePayAvailable } from '@/lib/payments/walletAvailability'

// Tranzila Hosted Fields (https://docs.tranzila.com/docs/payments-and-billing/hosted-fields): the card number, expiry and
// CVV are Tranzila's own iframes inside our slots, so the card data never touches GoLandly (PCI scope stays with Tranzila).
// Apple Pay and Google Pay run through the same SDK and the same Handshake (thtk), notify URL and server confirmation.
// One component serves the website's payment step and the page the app shows in its WebView (app/checkout/card-frame).
// It only reports what happened (onEvent); the voucher exists once the server verifies the charge with Tranzila.
interface HostedFieldsApi {
  onEvent?: (name: string, cb: (event?: unknown) => void) => void
  charge: (params: Record<string, unknown>, cb: ChargeCallback) => void
  chargeGpay?: (params: Record<string, unknown>, cb: ChargeCallback) => void
}
type ChargeCallback = (err: unknown, response: unknown) => void
declare global {
  interface Window {
    TzlaHostedFields?: { create: (options: Record<string, unknown>) => HostedFieldsApi }
    /** From thfapplepay.js. Tranzila: call it directly from the button, never inside a wrapper of your own. */
    hfChargeApple?: (params: Record<string, unknown>, cb: ChargeCallback) => void
  }
}

const scriptPromises = new Map<string, Promise<void>>()
// Fixed URLs only (hostedFieldsProtocol.ts): never read from the server response or a message.
function loadScript(src: string, ready: () => boolean): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (ready()) return Promise.resolve()
  let promise = scriptPromises.get(src)
  if (!promise) {
    promise = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script')
      el.src = src
      el.async = true
      el.onload = () => (ready() ? resolve() : reject(new Error('SDK did not initialise')))
      el.onerror = () => reject(new Error('SDK failed to load'))
      document.head.appendChild(el)
    }).catch((e) => {
      scriptPromises.delete(src)
      document.querySelectorAll(`script[src="${src}"]`).forEach((n) => n.remove())
      throw e
    })
    scriptPromises.set(src, promise)
  }
  return promise
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
// Shown on Apple's payment sheet: title case, no trailing punctuation (Tranzila's labelApple rule).
const APPLE_PAY_LABEL = 'GoLandly'
// If the SDK never reports `ready`, the form still opens after this long rather than staying disabled.
const READY_FALLBACK_MS = 8000
// Google's own button artwork (the asset Google's brand guidelines point to).
const GOOGLE_PAY_BUTTON_SRC = 'https://www.gstatic.com/instantbuy/svg/dark_gpay.svg'

interface Props {
  payment: HostedPaymentParams
  lang: CardFrameLang
  /** The localised price for the Pay button, e.g. "₪25". */
  priceLabel: string
  /** The host is confirming a charge (or otherwise busy): the form is inert. */
  busy?: boolean
  /** An error the host wants shown (a failed confirmation, a decline found by the server). */
  externalError?: CardFrameErrorCode | null
  /** The member's name and email: Tranzila's optional 3-D Secure inputs (card_holder_name / card_holder_email). */
  cardHolder?: CardHolder
  onEvent: (event: CardFrameEvent) => void
}

export default function TranzilaHostedFields({ payment, lang, priceLabel, busy = false, externalError = null, cardHolder, onEvent }: Props) {
  const t = useCallback((key: TranslationKey) => translations[lang][key] ?? translations.en[key], [lang])
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<CardFrameErrorCode | null>(null)
  const [badFields, setBadFields] = useState<string[]>([])
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [appleReady, setAppleReady] = useState(false)
  const fieldsRef = useRef<HostedFieldsApi | null>(null)
  // The thtk is refreshed by the host without recreating the fields, so the member's typing survives.
  const paymentRef = useRef(payment)
  const onEventRef = useRef(onEvent)
  const busyRef = useRef(busy)
  const langRef = useRef(lang)
  const cardHolderRef = useRef(cardHolder)
  const submittingRef = useRef(false)
  useEffect(() => { paymentRef.current = payment; onEventRef.current = onEvent; busyRef.current = busy; langRef.current = lang; cardHolderRef.current = cardHolder })

  const markReady = useCallback(() => {
    setStatus((current) => {
      if (current === 'ready') return current
      onEventRef.current({ v: 1, type: 'ready' })
      return 'ready'
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setGoogleEnabled(false)
    const fallback = setTimeout(() => { if (!cancelled && fieldsRef.current) markReady() }, READY_FALLBACK_MS)
    loadScript(HOSTED_FIELDS_SCRIPT_URL, () => !!window.TzlaHostedFields)
      .then(() => {
        if (cancelled || !window.TzlaHostedFields) return
        const fields = window.TzlaHostedFields.create({
          sandbox: false, // Tranzila: always false; there is no separate sandbox host.
          fields: {
            credit_card_number: { selector: `#${SLOT.number}`, placeholder: '0000 0000 0000 0000', tabindex: 1 },
            expiry: { selector: `#${SLOT.expiry}`, placeholder: t('checkout_card_expiry_placeholder'), tabindex: 2, version: '1' },
            cvv: { selector: `#${SLOT.cvv}`, placeholder: 'CVV', tabindex: 3 },
          },
          // 16px stops iOS Safari zooming into the field. Tranzila documents only input/select height and width; the rest is
          // to be confirmed with Tranzila. Valid/invalid look comes from the documented container classes (see `slot`).
          styles: {
            input: { 'font-size': '16px', height: '46px', color: '#0f172a', 'font-family': 'inherit' },
          },
        })
        fieldsRef.current = fields
        // The SDK says when its iframes are ready (docs: onEvent('ready')); googleIsEnable says a Google Pay wallet is usable.
        fields.onEvent?.('ready', () => { if (!cancelled) markReady() })
        fields.onEvent?.('googleIsEnable', () => { if (!cancelled) setGoogleEnabled(true) })
        // Enter inside a hosted field submits, as in any form.
        fields.onEvent?.('submit', () => { if (!cancelled) submitCard() })
      })
      .catch(() => {
        if (cancelled) return
        setStatus('failed')
        onEventRef.current({ v: 1, type: 'error', code: 'load_failed' })
      })
    return () => {
      cancelled = true
      clearTimeout(fallback)
      fieldsRef.current = null
      // Tranzila's iframes live in our slots; drop them so a remount starts clean.
      for (const id of Object.values(SLOT)) document.getElementById(id)?.replaceChildren()
    }
    // The fields are created once per attempt; the language only changes placeholders on the next attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  // Apple Pay: only where the browser has it AND the terminal enabled it; its script then loads.
  const wantsApple = payment.wallets.applePay
  useEffect(() => {
    if (!wantsApple || !applePayAvailable(payment.wallets, window)) return
    let cancelled = false
    loadScript(HOSTED_FIELDS_APPLE_PAY_SCRIPT_URL, () => typeof window.hfChargeApple === 'function')
      .then(() => { if (!cancelled) setAppleReady(true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [wantsApple, payment.wallets])

  const chargeParams = (withCardHolder = true) => {
    const current = paymentRef.current
    return {
      terminal_name: current.terminal,
      amount: current.amountAgorot / 100,
      thtk: current.thtk,
      tran_mode: 'A',
      currency_code: 'ILS',
      response_language: RESPONSE_LANGUAGE[langRef.current],
      notify_url: current.notifyUrl,
      // Documented optional 3-D Secure inputs for card and Google Pay charges (Apple Pay's parameter list does not include them; issuers approve more often without a challenge when they have them).
      ...(withCardHolder && cardHolderRef.current?.name ? { card_holder_name: cardHolderRef.current.name } : {}),
      ...(withCardHolder && cardHolderRef.current?.email ? { card_holder_email: cardHolderRef.current.email } : {}),
      // force_txn_on_3ds_fail is deliberately not sent: the terminal default applies until Tranzila confirms the setting.
    }
  }

  // The same ending for a card, Apple Pay or Google Pay charge.
  const begin = (): ChargeCallback | null => {
    if (submittingRef.current || busyRef.current) return null
    setError(null)
    setBadFields([])
    if (Date.now() >= paymentRef.current.expiresAtMs) {
      setError('thtk_expired')
      onEventRef.current({ v: 1, type: 'error', code: 'thtk_expired' })
      return null
    }
    submittingRef.current = true
    setSubmitting(true)
    onEventRef.current({ v: 1, type: 'submitting' })
    let settled = false
    return (err, response) => {
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
  }

  const submitCard = () => {
    const fields = fieldsRef.current
    if (!fields) return
    const done = begin()
    if (!done) return
    try { fields.charge(chargeParams(), done) } catch { done(new Error('charge failed'), null) }
  }

  const submitGoogle = () => {
    const fields = fieldsRef.current
    if (!fields?.chargeGpay) return
    const done = begin()
    if (!done) return
    try { fields.chargeGpay(chargeParams(), done) } catch { done(new Error('charge failed'), null) }
  }

  // Tranzila: hfChargeApple must be called straight from the click (no wrapper of our own around the SDK call), so the
  // gesture reaches Apple's payment sheet.
  const submitApple = () => {
    if (typeof window.hfChargeApple !== 'function') return
    const done = begin()
    if (!done) return
    try { window.hfChargeApple({ ...chargeParams(false), labelApple: APPLE_PAY_LABEL }, done) } catch { done(new Error('charge failed'), null) }
  }

  const shownError = externalError ?? error
  const inert = busy || submitting || status !== 'ready'
  const bad = (name: string) => badFields.includes(name)
  // Tranzila puts hosted-fields-valid / hosted-fields-invalid on the container (docs); badFields covers errors from a charge.
  const slot = (invalid: boolean) =>
    `h-12 min-h-12 w-full overflow-hidden rounded-xl border bg-white transition-shadow [&>iframe]:h-full [&>iframe]:w-full focus-within:ring-2 focus-within:ring-brand/40 [&.hosted-fields-invalid]:border-red-400 ${invalid ? 'border-red-400' : 'border-slate-200'}`
  const showApple = status === 'ready' && appleReady && applePayAvailable(payment.wallets, typeof window === 'undefined' ? undefined : window)
  const showGoogle = status === 'ready' && googlePayAvailable(payment.wallets, googleEnabled)
  const wallets = showApple || showGoogle

  return (
    <div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-sky-200/60 bg-brandTint text-brand">
          <CreditCard className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <h2 className="text-start text-base font-bold text-ink">{t('checkout_card_title')}</h2>
      </div>

      {wallets && (
        <div className="mt-5" dir="ltr">
          <div className="flex flex-col gap-3">
            {showApple && (
              <button type="button" onClick={submitApple} disabled={inert} aria-label={t('checkout_wallet_apple_aria')} lang={lang} className="apple-pay-btn disabled:opacity-60">
                Apple Pay
              </button>
            )}
            {showGoogle && (
              <button
                type="button"
                onClick={submitGoogle}
                disabled={inert}
                aria-label={t('checkout_wallet_google_aria')}
                className="google-pay-btn disabled:opacity-60"
                style={{ backgroundImage: `url(${GOOGLE_PAY_BUTTON_SRC})` }}
              />
            )}
          </div>
          <div className="my-5 flex items-center gap-3 text-xs font-semibold text-slate-500" dir="auto">
            <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
            <span>{t('checkout_wallet_divider')}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
      )}

      <div className={`relative ${wallets ? '' : 'mt-5'}`}>
        <div aria-busy={status === 'loading' || undefined} className={status === 'ready' ? '' : 'pointer-events-none opacity-40'}>
          <label className="mb-1.5 block text-start text-xs font-bold text-slate-700">{t('checkout_card_number_label')}</label>
          <div id={SLOT.number} dir="ltr" className={slot(bad('credit_card_number'))} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-start text-xs font-bold text-slate-700">{t('checkout_card_expiry_label')}</label>
              <div id={SLOT.expiry} dir="ltr" className={slot(bad('expiry'))} />
            </div>
            <div>
              <label className="mb-1.5 block text-start text-xs font-bold text-slate-700">{t('checkout_card_cvv_label')}</label>
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
          onClick={submitCard}
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
