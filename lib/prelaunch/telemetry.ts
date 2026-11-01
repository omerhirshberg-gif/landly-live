// First-touch attribution for /join: what the browser saw on arrival, and what
// the server is willing to store of it. Everything here is visitor-controlled,
// so values are bounded and the referrer loses its query string, which can
// carry another site's personal data.

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const
type UtmKey = (typeof UTM_KEYS)[number]

const MAX_UTM_LENGTH = 200
const MAX_REFERRER_LENGTH = 300

export type LeadAttribution = Record<UtmKey, string | null> & {
  referrer: string | null
  /** Parsed from the browser's clock, so never authoritative; createdAt is. */
  clientTimestamp: Date | null
}

export interface ArrivalTelemetry {
  ref: string | null
  attribution: Record<UtmKey, string | null> & { referrer: string | null; clientTimestamp: string | null }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim()
  return text ? text.slice(0, max) : null
}

/** Origin and path only, for http(s) referrers. */
export function cleanReferrer(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.origin}${url.pathname}`.slice(0, MAX_REFERRER_LENGTH)
  } catch {
    return null
  }
}

/** What to send with the form, read from the landing URL once on arrival. */
export function readArrival(search: string, referrer: string, now: Date): ArrivalTelemetry {
  const params = new URLSearchParams(search)
  const utm = Object.fromEntries(UTM_KEYS.map((key) => [key, params.get(key)])) as Record<UtmKey, string | null>
  return {
    ref: params.get('ref'),
    attribution: { ...utm, referrer, clientTimestamp: now.toISOString() },
  }
}

/** The server's view of the attribution a request claimed. Bad values become null. */
export function parseAttribution(value: unknown): LeadAttribution {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const utm = Object.fromEntries(UTM_KEYS.map((key) => [key, cleanText(raw[key], MAX_UTM_LENGTH)])) as Record<UtmKey, string | null>
  const stamp = typeof raw.clientTimestamp === 'string' ? new Date(raw.clientTimestamp) : null
  return {
    ...utm,
    referrer: cleanReferrer(raw.referrer),
    clientTimestamp: stamp && !Number.isNaN(stamp.getTime()) ? stamp : null,
  }
}
