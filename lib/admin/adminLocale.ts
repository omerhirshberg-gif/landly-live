// The admin portal's own language (English or Hebrew), independent of the
// public site's. Kept in a cookie so the server renders the right `dir` on
// the first paint, with localStorage as the fallback when cookies are off.

export type AdminLocale = 'en' | 'he'

export const ADMIN_LANG_COOKIE = 'admin_lang'
export const ADMIN_LANG_STORAGE_KEY = 'admin_lang'
export const DEFAULT_ADMIN_LOCALE: AdminLocale = 'en'

export function parseAdminLocale(value: unknown): AdminLocale {
  return value === 'he' ? 'he' : DEFAULT_ADMIN_LOCALE
}

export function dirOf(locale: AdminLocale): 'ltr' | 'rtl' {
  return locale === 'he' ? 'rtl' : 'ltr'
}

/** The locale stored in a `Cookie` header or `document.cookie` string, or null when absent. */
export function localeFromCookieString(cookies: string | null | undefined): AdminLocale | null {
  const match = cookies?.match(new RegExp(`(?:^|;\\s*)${ADMIN_LANG_COOKIE}=([^;]*)`))
  return match ? parseAdminLocale(decodeURIComponent(match[1]!)) : null
}

/** Browser only: the cookie, then localStorage, else English. Never throws. */
export function readStoredLocale(): AdminLocale {
  try {
    const fromCookie = localeFromCookieString(document.cookie)
    if (fromCookie) return fromCookie
  } catch {}
  try {
    return parseAdminLocale(localStorage.getItem(ADMIN_LANG_STORAGE_KEY))
  } catch {}
  return DEFAULT_ADMIN_LOCALE
}

/** Browser only: remembers the choice for a year in both places. Never throws. */
export function persistLocale(locale: AdminLocale) {
  try {
    document.cookie = `${ADMIN_LANG_COOKIE}=${locale}; path=/admin; max-age=31536000; samesite=lax`
  } catch {}
  try {
    localStorage.setItem(ADMIN_LANG_STORAGE_KEY, locale)
  } catch {}
}
