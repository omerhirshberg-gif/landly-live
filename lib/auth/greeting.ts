import type { TranslationKey } from '@/lib/i18n/translations'

// The app lock's welcome-back line (landly-mobile/src/auth/AppLock.tsx):
// a time-of-day greeting by first name, and when the member last came in on
// this device ("23.10.2026 17:36"). Pure and dependency-free, so the website
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

/**
 * The lock screen's "Last sign-in" stamp: the numeric date and the time in the
 * member's language ("23.10.2026 17:36" in Hebrew, "10/23/2026 17:36" in
 * English). `hour12` follows the device's clock setting when known.
 */
export function formatLastEntry(at: Date, lang: string, hour12?: boolean): string {
  const format = (options: Intl.DateTimeFormatOptions) => {
    try {
      return new Intl.DateTimeFormat(lang, options).format(at)
    } catch {
      return new Intl.DateTimeFormat('en', options).format(at)
    }
  }
  const date = format({ day: '2-digit', month: '2-digit', year: 'numeric' })
  // 24-hour times keep the leading zero (09:41); 12-hour ones don't (9:41 AM).
  const time = format(hour12 ? { hour: 'numeric', minute: '2-digit', hour12: true } : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  return `${date} ${time}`
}
