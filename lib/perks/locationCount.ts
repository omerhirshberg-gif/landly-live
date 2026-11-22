import { perksCountLabel } from '../categories'
import type { TranslationKey } from '../i18n/translations'

/** "24 perks", or under a location filter with both kinds: "12 nearby · 12 nationwide". Shared with the Expo app. */
export function locationCountLabel(nearby: number, nationwide: number, t: (key: TranslationKey) => string): string {
  if (nearby > 0 && nationwide > 0) return t('loc_split_count').replace('{near}', String(nearby)).replace('{nat}', String(nationwide))
  return perksCountLabel(nearby + nationwide, t)
}
