import { isSupportedCountry, type CountryCode } from 'libphonenumber-js'
import { EXCLUDED_ORIGINS, countryName, flagEmoji, listCountries, type Country } from '@/lib/auth/onboarding'
import type { Lang, TranslationKey } from '@/lib/i18n/translations'

// Where a member moved from (users/{uid}.countryOfOrigin, ISO alpha-2) and
// where in Israel they live now (users/{uid}.israelRegion). Pure data and
// helpers shared by the website (onboarding card, /profile, /settings/
// language-region) and the app (its onboarding card, Profile tab and native
// settings stack), so both list, search and label countries the same way.
// Names are always the full ones (lib/profile/countryNames.ts). Palestine
// (EXCLUDED_ORIGINS) is not offered as an origin.

// Listed first in the origin picker: where most olim come from.
export const ORIGIN_PINNED: readonly CountryCode[] = ['US', 'FR', 'RU', 'UA', 'GB', 'AR', 'BR', 'CA', 'ZA', 'ET', 'DE', 'AU']

export interface OriginCountry extends Country {
  /** The country's name in the active language. */
  name: string
  /** Its English name, so a search in Latin letters works in any language. */
  englishName: string
}

/** A code a member may store as their origin: a country libphonenumber knows, other than EXCLUDED_ORIGINS. */
export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value) && isSupportedCountry(value) && !EXCLUDED_ORIGINS.includes(value)
}

/** The common origins first in their set order, then every other country alphabetically in `lang`. */
export function listOriginCountries(lang: Lang): { pinned: OriginCountry[]; rest: OriginCountry[] } {
  const named = (c: Country): OriginCountry => ({ ...c, name: countryName(c.code, lang), englishName: countryName(c.code, 'en') })
  const { pinned, rest } = listCountries()
  const all = [...pinned, ...rest].filter((c) => !EXCLUDED_ORIGINS.includes(c.code))
  const pinnedSet = new Set<string>(ORIGIN_PINNED)
  return {
    pinned: ORIGIN_PINNED.map((code) => all.find((c) => c.code === code)!).map(named),
    rest: all
      .filter((c) => !pinnedSet.has(c.code))
      .map(named)
      .sort((a, b) => a.name.localeCompare(b.name, lang)),
  }
}

/** Case- and accent-insensitive search over the local name, the English name and the ISO code. */
export function filterCountries(countries: readonly OriginCountry[], query: string): OriginCountry[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = fold(query.trim())
  if (!q) return [...countries]
  return countries.filter((c) => fold(c.name).includes(q) || fold(c.englishName).includes(q) || c.code.toLowerCase() === q)
}

/** "🇺🇸 United States" in `lang`, or null when nothing (or a code not offered) is stored. */
export function originLabel(code: string, lang: Lang): string | null {
  if (!isCountryCode(code)) return null
  return `${flagEmoji(code)} ${countryName(code, lang)}`
}

// ── Region in Israel ────────────────────────────────────────────────────
export const ISRAEL_REGIONS = ['north', 'haifa', 'center', 'tel_aviv', 'jerusalem', 'south', 'abroad'] as const
export type IsraelRegion = (typeof ISRAEL_REGIONS)[number]

export const ISRAEL_REGION_KEYS: Record<IsraelRegion, TranslationKey> = {
  north: 'region_north',
  haifa: 'region_haifa',
  center: 'region_center',
  tel_aviv: 'region_tel_aviv',
  jerusalem: 'region_jerusalem',
  south: 'region_south',
  abroad: 'region_abroad',
}

export function isIsraelRegion(value: unknown): value is IsraelRegion {
  return typeof value === 'string' && (ISRAEL_REGIONS as readonly string[]).includes(value)
}
