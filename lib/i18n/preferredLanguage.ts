import { getUserDocument } from '@/lib/firebase/users'
import { translations, Lang } from './translations'

/**
 * Fetches the account's saved language and returns it only if it's a real,
 * supported language AND differs from `currentLang` — so callers can just
 * `if (result) setLang(result)` without re-deriving the "is this worth
 * switching to" check themselves. Returns null on no doc / no preference /
 * already-matching preference.
 */
export async function resolvePreferredLanguage(uid: string, currentLang: Lang): Promise<Lang | null> {
  const doc = await getUserDocument(uid)
  const preferred = doc?.preferredLanguage as Lang | undefined
  if (preferred && translations[preferred] && preferred !== currentLang) return preferred
  return null
}
