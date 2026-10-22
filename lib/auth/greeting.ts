import type { TranslationKey } from '@/lib/i18n/translations'

// The app lock's welcome-back line (landly-mobile/src/auth/AppLock.tsx):
// a time-of-day greeting by first name, and when the member last came in on
// this device ("Today, 09:41"). Pure and dependency-free, so the website
// can use it too and tests can pin the boundaries.

export type GreetingPeriod = 'morning' | 'afternoon' | 'evening' | 'night'

/** Morning 05:00–11:59, afternoon 12:00–17:59, evening 18:00–21:59, night 22:00–04:59 (local hours). */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

/** "Good morning, {name}", or the nameless form when there's no first name to greet by. */
export function greetingKey(period: GreetingPeriod, hasName: boolean): TranslationKey {
  return hasName ? `greet_${period}` : `greet_${period}_noName`
}

/**
 * When the member last came in on this device: the stored last entry (an
 * unlock or a sign-in here), else Firebase's last sign-in for the account,
 * else null (the row is hidden).
 */
export function resolveLastEntry(stored: string | null | undefined, firebaseLastSignIn: string | null | undefined): Date | null {
  for (const value of [stored, firebaseLastSignIn]) {
    if (!value) continue
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

// Local midnights; rounding absorbs the hour a daylight-saving change adds or removes.
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/**
 * "Today, 09:41", "Yesterday, 21:10", or a short date with the time
 * ("18 Oct, 14:05"; the year only when it isn't this year), in the
 * member's language. `hour12` follows the device's clock setting when known.
 */
export function formatLastEntry(
  at: Date,
  now: Date,
  lang: string,
  t: (key: 'applock_today' | 'applock_yesterday') => string,
  hour12?: boolean
): string {
  // 24-hour times keep the leading zero (09:41); 12-hour ones don't (9:41 AM).
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: hour12 ? 'numeric' : '2-digit',
    minute: '2-digit',
    ...(hour12 === undefined ? {} : { hour12 }),
  }
  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(lang, options).format(at)
    } catch {
      return at.toISOString().slice(0, 16).replace('T', ' ')
    }
  }
  const days = Math.round((midnight(now) - midnight(at)) / 86_400_000)
  if (days === 0) return t('applock_today').replace('{time}', format(timeOptions))
  if (days === 1) return t('applock_yesterday').replace('{time}', format(timeOptions))
  return format({ day: 'numeric', month: 'short', ...(at.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }), ...timeOptions })
}
