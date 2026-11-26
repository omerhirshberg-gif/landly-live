// The bridge between the page that owns the order (the web checkout, or the native screen) and the Hosted Fields frame.
// On the web the fields render in-page (components/checkout/TranzilaHostedFields.tsx); in the app they run inside a
// GoLandly-owned page (app/checkout/card-frame) shown in a WebView (or an iframe on the Expo web build), and these messages
// cross that boundary. Everything here is a UI signal: nothing in a message settles a payment. The voucher exists only
// once the server verifies the transaction with Tranzila (lib/payments/settleVerifiedPayment.ts).
//
// No card number, CVV or token is ever in a message: those stay inside Tranzila's own iframes.

/** The one place the Hosted Fields script may load from. Never taken from a message or the server. */
export const HOSTED_FIELDS_SCRIPT_URL = 'https://hf.tranzila.com/assets/js/thostedf.js'

export const CARD_FRAME_PATH = '/checkout/card-frame'
export const CARD_FRAME_VERSION = 1

export interface HostedPaymentParams {
  provider: 'tranzila-hosted-fields'
  terminal: string
  thtk: string
  expiresAtMs: number
  amountAgorot: number
  currency: 'ILS'
  notifyUrl: string
}

export type CardFrameErrorCode = 'validation' | 'declined' | 'thtk_expired' | 'network' | '3ds_failed' | 'load_failed'
export const CARD_FRAME_ERROR_CODES: readonly CardFrameErrorCode[] = ['validation', 'declined', 'thtk_expired', 'network', '3ds_failed', 'load_failed']

export type CardFrameLang = 'he' | 'en' | 'ru' | 'fr' | 'es'
const LANGS: readonly CardFrameLang[] = ['he', 'en', 'ru', 'fr', 'es']

/** Host -> frame. */
export interface CardFrameInit {
  v: 1
  type: 'init'
  payment: HostedPaymentParams
  lang: CardFrameLang
  dir: 'ltr' | 'rtl'
  /** The formatted price for the Pay button (the host already localises it). */
  priceLabel: string
}

/** Host -> frame: the host is confirming the charge with the server (busy), or shows the frame an error of its own. */
export interface CardFrameState {
  v: 1
  type: 'state'
  busy: boolean
  error: CardFrameErrorCode | null
}

/** Frame -> host. `hello` is the frame's listener being attached: the host answers with `init` (and again for a fresh thtk). */
export type CardFrameEvent =
  | { v: 1; type: 'hello' }
  | { v: 1; type: 'ready' }
  | { v: 1; type: 'height'; px: number }
  | { v: 1; type: 'submitting' }
  | { v: 1; type: 'charged' }
  | { v: 1; type: 'error'; code: CardFrameErrorCode }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Messages arrive as objects (postMessage) or JSON strings (the React Native WebView bridge). */
function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    if (data.length > 4096) return null
    try { data = JSON.parse(data) } catch { return null }
  }
  return isRecord(data) && data.v === CARD_FRAME_VERSION ? data : null
}

export function parseHostedPaymentParams(value: unknown): HostedPaymentParams | null {
  if (!isRecord(value)) return null
  const { provider, terminal, thtk, expiresAtMs, amountAgorot, currency, notifyUrl } = value
  if (provider !== 'tranzila-hosted-fields' || currency !== 'ILS') return null
  if (typeof terminal !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(terminal)) return null
  if (typeof thtk !== 'string' || !/^[A-Za-z0-9]{8,128}$/.test(thtk)) return null
  if (typeof expiresAtMs !== 'number' || !Number.isFinite(expiresAtMs)) return null
  if (typeof amountAgorot !== 'number' || !Number.isSafeInteger(amountAgorot) || amountAgorot <= 0) return null
  if (typeof notifyUrl !== 'string' || notifyUrl.length > 512 || !notifyUrl.startsWith('https://')) return null
  return { provider, terminal, thtk, expiresAtMs, amountAgorot, currency, notifyUrl }
}

export function parseCardFrameInit(data: unknown): CardFrameInit | null {
  const m = asRecord(data)
  if (!m || m.type !== 'init') return null
  const payment = parseHostedPaymentParams(m.payment)
  if (!payment || !LANGS.includes(m.lang as CardFrameLang) || (m.dir !== 'ltr' && m.dir !== 'rtl')) return null
  if (typeof m.priceLabel !== 'string' || m.priceLabel.length > 40) return null
  return { v: 1, type: 'init', payment, lang: m.lang as CardFrameLang, dir: m.dir, priceLabel: m.priceLabel }
}

export function parseCardFrameState(data: unknown): CardFrameState | null {
  const m = asRecord(data)
  if (!m || m.type !== 'state' || typeof m.busy !== 'boolean') return null
  if (m.error !== null && !CARD_FRAME_ERROR_CODES.includes(m.error as CardFrameErrorCode)) return null
  return { v: 1, type: 'state', busy: m.busy, error: m.error as CardFrameErrorCode | null }
}

export function parseCardFrameEvent(data: unknown): CardFrameEvent | null {
  const m = asRecord(data)
  if (!m) return null
  switch (m.type) {
    case 'hello': case 'ready': case 'submitting': case 'charged':
      return { v: 1, type: m.type }
    case 'height':
      return typeof m.px === 'number' && Number.isFinite(m.px) && m.px >= 0 && m.px <= 4000 ? { v: 1, type: 'height', px: Math.ceil(m.px) } : null
    case 'error':
      return CARD_FRAME_ERROR_CODES.includes(m.code as CardFrameErrorCode) ? { v: 1, type: 'error', code: m.code as CardFrameErrorCode } : null
    default:
      return null
  }
}

/** Origins the native card step may navigate to inside the WebView: the GoLandly host serving the frame, and Tranzila. */
export function isAllowedCardFrameUrl(url: string, frameOrigin: string): boolean {
  let parsed: URL
  try { parsed = new URL(url) } catch { return false }
  if (url === 'about:blank') return true
  if (parsed.protocol !== 'https:' && parsed.origin !== frameOrigin) return false
  return parsed.origin === frameOrigin || parsed.hostname === 'tranzila.com' || parsed.hostname.endsWith('.tranzila.com')
}
