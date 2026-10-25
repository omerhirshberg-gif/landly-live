// Times in the support inbox, always in the admin's own timezone and in
// English (the admin UI's language). Callers wrap them in <bdi dir="ltr">.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short' })
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const fullDate = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)

/** "now", "5m", "3h", "Mon", "12 Mar": the list's timestamp. */
export function relativeTime(iso: string | null, now: number): string {
  if (!iso) return ''
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const ago = Math.max(0, now - at)
  if (ago < MINUTE) return 'now'
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)}m`
  if (ago < DAY) return `${Math.floor(ago / HOUR)}h`
  if (ago < 7 * DAY) return weekday.format(at)
  return shortDate.format(at)
}

/** "14:05": a message's time. */
export const clockTime = (iso: string) => (iso ? clock.format(Date.parse(iso)) : '')

/** "Today", "Yesterday" or "Mon, 12 Mar 2026": the transcript's day separators. */
export function dayLabel(iso: string, now: number): string {
  const day = startOfDay(Date.parse(iso))
  const today = startOfDay(now)
  if (day === today) return 'Today'
  if (day === startOfDay(today - 12 * HOUR)) return 'Yesterday'
  return fullDate.format(day)
}

export const sameDay = (a: string, b: string) => startOfDay(Date.parse(a)) === startOfDay(Date.parse(b))

/** "+972501234567" from a WhatsApp ID. */
export const phoneOf = (waId: string) => `+${waId}`
