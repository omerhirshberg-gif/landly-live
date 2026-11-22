// The expiry pill over a perk card's picture: "Ends 14.03", or the urgent "Ends tomorrow" within 48 hours.
// Pure: the caller passes `now` and gets a translation key plus the date text, never a sentence.

const HOUR_MS = 60 * 60 * 1000

export type ExpiryPill =
  | { kind: 'urgent'; key: 'card_expires_tomorrow' | 'card_expires_on'; date: string }
  | { kind: 'normal'; key: 'card_expires_on'; date: string }
  | { kind: 'expired'; key: 'card_expired'; date: string }

const two = (n: number) => String(n).padStart(2, '0')
/** DD.MM in Israel's calendar, whatever the device's timezone. */
function shortDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Jerusalem' }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? two(0)
  return `${get('day')}.${get('month')}`
}

/** YYYY-MM-DD in Israel's calendar. */
const dayKey = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(ms))

export function expiryPill(expiry: Date | null | undefined, now: number): ExpiryPill | null {
  if (!expiry || Number.isNaN(expiry.getTime())) return null
  const left = expiry.getTime() - now
  const date = shortDate(expiry)
  if (left < 0) return { kind: 'expired', key: 'card_expired', date }
  // Within 48 hours the pill turns urgent; it says "tomorrow" only when Israel's calendar says so.
  if (left <= 48 * HOUR_MS) return { kind: 'urgent', key: dayKey(expiry.getTime()) === dayKey(now + 24 * HOUR_MS) ? 'card_expires_tomorrow' : 'card_expires_on', date }
  return { kind: 'normal', key: 'card_expires_on', date }
}
