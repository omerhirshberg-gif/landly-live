import type { TranslationKey } from '@/lib/i18n/translations'

// The app lock's welcome-back line (landly-mobile/src/auth/AppLock.tsx):
// a time-of-day greeting by first name, and when the member last came in on
// this device ("23.10.2026 17:36", always the Israeli format). Pure and dependency-free, so the website
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
 * The lock screen's "Last sign-in" stamp, in the Israeli format whatever the
 * language or device clock: DD.MM.YYYY HH:mm, 24-hour ("23.10.2026 09:05").
 * Built by hand, not with Intl, so Hermes and every browser agree.
 */
export function formatLastEntry(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(at.getDate())}.${pad(at.getMonth() + 1)}.${at.getFullYear()} ${pad(at.getHours())}:${pad(at.getMinutes())}`
}
