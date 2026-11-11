// Times in the support inbox, always in the admin's own timezone and in the
// admin UI's language. Callers wrap them in <bdi dir="ltr">.
import type { AdminLocale } from '@/lib/admin/adminLocale'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const WORDS = {
  en: { now: 'now', min: 'm', hour: 'h', today: 'Today', yesterday: 'Yesterday', tomorrow: 'Tomorrow' },
  he: { now: 'עכשיו', min: ' דק׳', hour: ' שע׳', today: 'היום', yesterday: 'אתמול', tomorrow: 'מחר' },
} as const
const TAGS = { en: 'en-GB', he: 'he-IL' } as const

const formats = (locale: AdminLocale) => {
  const tag = TAGS[locale]
  return {
    clock: new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit', hour12: false }),
    weekday: new Intl.DateTimeFormat(tag, { weekday: 'short' }),
    shortDate: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }),
    fullDate: new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
  }
}
const cache: Partial<Record<AdminLocale, ReturnType<typeof formats>>> = {}
const f = (locale: AdminLocale) => (cache[locale] ??= formats(locale))

const startOfDay = (ms: number) => new Date(ms).setHours(0, 0, 0, 0)

/** "now", "5m", "3h", "Mon", "12 Mar": the list's timestamp. */
export function relativeTime(iso: string | null, now: number, locale: AdminLocale = 'en'): string {
  const w = WORDS[locale]
  if (!iso) return ''
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const ago = Math.max(0, now - at)
  if (ago < MINUTE) return w.now
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)}${w.min}`
  if (ago < DAY) return `${Math.floor(ago / HOUR)}${w.hour}`
  if (ago < 7 * DAY) return f(locale).weekday.format(at)
  return f(locale).shortDate.format(at)
}

/** "14:05": a message's time. */
export const clockTime = (iso: string, locale: AdminLocale = 'en') => (iso ? f(locale).clock.format(Date.parse(iso)) : '')

/** "Today", "Yesterday" or "Mon, 12 Mar 2026": the transcript's day separators. */
export function dayLabel(iso: string, now: number, locale: AdminLocale = 'en'): string {
  const w = WORDS[locale]
  const day = startOfDay(Date.parse(iso))
  const today = startOfDay(now)
  if (day === today) return w.today
  if (day === startOfDay(today - 12 * HOUR)) return w.yesterday
  return f(locale).fullDate.format(day)
}

/** "14:05", "Tomorrow 09:30" or "Wed 18:00": when a follow-up went or goes out. */
export function dayTime(iso: string, now: number, locale: AdminLocale = 'en'): string {
  const w = WORDS[locale]
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const days = Math.round((startOfDay(at) - startOfDay(now)) / DAY)
  const day = days === 0 ? '' : days === 1 ? `${w.tomorrow} ` : days === -1 ? `${w.yesterday} ` : `${f(locale).weekday.format(at)} `
  return `${day}${f(locale).clock.format(at)}`
}

export const sameDay =(a: string, b: string) => startOfDay(Date.parse(a)) === startOfDay(Date.parse(b))

/** "+972501234567" from a WhatsApp ID. */
export const phoneOf = (waId: string) => `+${waId}`
