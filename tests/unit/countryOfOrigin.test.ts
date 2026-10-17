import { describe, expect, it } from 'vitest'
import {
  ISRAEL_REGIONS,
  ISRAEL_REGION_KEYS,
  ORIGIN_PINNED,
  filterCountries,
  isCountryCode,
  isIsraelRegion,
  listOriginCountries,
  originLabel,
} from '@/lib/profile/countryOfOrigin'
import { translations } from '@/lib/i18n/translations'
import { getCountries } from 'libphonenumber-js'
import { COUNTRY_NAMES } from '@/lib/profile/countryNames'
import { countryName, listCountries, parseOnboardingDraft } from '@/lib/auth/onboarding'

const LANGS = ['en', 'he', 'ru', 'es', 'fr'] as const

describe('country of origin', () => {
  it('lists the common origins first, then every other country once, A–Z', () => {
    const { pinned, rest } = listOriginCountries('en')
    expect(pinned.map((c) => c.code)).toEqual([...ORIGIN_PINNED])
    const codes = [...pinned, ...rest].map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain('IL')
    const names = rest.map((c) => c.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('names countries in the active language, with the flag', () => {
    expect(originLabel('FR', 'en')).toBe('🇫🇷 France')
    expect(originLabel('FR', 'he')).toBe('🇫🇷 צרפת')
    expect(originLabel('', 'en')).toBeNull()
    expect(originLabel('XX', 'en')).toBeNull()
  })

  it('searches by local name, English name or ISO code, ignoring case and accents', () => {
    const he = listOriginCountries('he')
    const all = [...he.pinned, ...he.rest]
    // France first (a common origin), then French Guiana and French Polynesia.
    expect(filterCountries(all, 'צרפ').map((c) => c.code)).toEqual(['FR', 'GF', 'PF'])
    expect(filterCountries(all, 'france').map((c) => c.code)).toEqual(['FR'])
    expect(filterCountries(all, 'us').map((c) => c.code)).toContain('US')
    const fr = listOriginCountries('fr')
    // "États-Unis" is found without typing the accent.
    expect(filterCountries([...fr.pinned, ...fr.rest], 'etats').map((c) => c.code)).toContain('US')
    expect(filterCountries(all, '   ')).toHaveLength(all.length)
  })

  it('accepts only known ISO codes', () => {
    expect(isCountryCode('US')).toBe(true)
    expect(isCountryCode('us')).toBe(false)
    expect(isCountryCode('XX')).toBe(false)
    expect(isCountryCode(7)).toBe(false)
  })
})

describe('full country names', () => {
  // ISO codes, dotted short forms, ampersands, " - " qualifiers, region tags, Russian о-в(а), Spanish EE. UU.
  const SHORT_FORM = /^[A-Z]{2}$|[.&]|\s-\s|\bSAR\b|САР|\bRAE\b|R\.A\.S|о-ва?\b|EE\.\s?UU|\bSt\b/

  it('names every country in every language in full, with no abbreviation', () => {
    for (const lang of LANGS) {
      for (const code of getCountries()) {
        const name = COUNTRY_NAMES[lang][code]
        expect(name, `${lang}.${code}`).toBeTruthy()
        expect(name, `${lang}.${code}`).not.toMatch(SHORT_FORM)
      }
    }
  })

  it('spells out the names the browser abbreviates', () => {
    expect(countryName('LC', 'en')).toBe('Saint Lucia')
    expect(countryName('BA', 'en')).toBe('Bosnia and Herzegovina')
    expect(countryName('VI', 'en')).toBe('United States Virgin Islands')
    expect(countryName('HK', 'en')).toBe('Hong Kong')
    expect(countryName('CD', 'en')).toBe('Democratic Republic of the Congo')
    expect(countryName('IM', 'ru')).toBe('Остров Мэн')
    expect(countryName('SH', 'ru')).toBe('Остров Святой Елены')
    expect(countryName('VI', 'es')).toBe('Islas Vírgenes de los Estados Unidos')
    expect(countryName('HK', 'fr')).toBe('Hong Kong')
    expect(countryName('CG', 'he')).toBe('הרפובליקה של קונגו')
  })

  it('needs no Intl support from the runtime (the app on Hermes)', () => {
    const original = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames')!
    try {
      Object.defineProperty(Intl, 'DisplayNames', { value: undefined, configurable: true, writable: true })
      expect(countryName('US', 'en')).toBe('United States')
      expect(originLabel('UA', 'he')).toBe('🇺🇦 אוקראינה')
    } finally {
      Object.defineProperty(Intl, 'DisplayNames', original)
    }
  })
})

describe('Palestine', () => {
  it('is not offered as a country of origin in any language', () => {
    for (const lang of LANGS) {
      const { pinned, rest } = listOriginCountries(lang)
      expect([...pinned, ...rest].map((c) => c.code)).not.toContain('PS')
      expect(filterCountries([...pinned, ...rest], 'palest')).toEqual([])
    }
  })

  it('is refused as a stored origin and shows as not set', () => {
    expect(isCountryCode('PS')).toBe(false)
    expect(originLabel('PS', 'en')).toBeNull()
  })

  it('resumes an onboarding draft that had it with the origin unanswered', () => {
    const draft = { step: 'origin', customerType: 'student', customerTypeOther: '', countryOfOrigin: 'PS', country: 'IL', phone: '', phoneSkipped: false }
    expect(parseOnboardingDraft(JSON.stringify(draft))?.countryOfOrigin).toBe('')
  })

  it('keeps its dialing code in the phone number picker', () => {
    const { pinned, rest } = listCountries()
    expect([...pinned, ...rest].map((c) => c.code)).toContain('PS')
  })
})

describe('region in Israel', () => {
  it('has the seven regions, each translated in all five languages', () => {
    expect(ISRAEL_REGIONS).toEqual(['north', 'haifa', 'center', 'tel_aviv', 'jerusalem', 'south', 'abroad'])
    for (const lang of LANGS) for (const r of ISRAEL_REGIONS) expect(translations[lang][ISRAEL_REGION_KEYS[r]], `${lang}.${r}`).toBeTruthy()
    expect(isIsraelRegion('haifa')).toBe(true)
    expect(isIsraelRegion('mars')).toBe(false)
  })
})

describe('profile, origin and settings translations', () => {
  it('has every new string in all five languages', () => {
    const keys = [
      'nav_profile', 'onb_step_origin', 'onb_panel_origin', 'onb_origin_title', 'onb_origin_subtitle', 'onb_originRequired',
      'origin_search_label', 'origin_search_placeholder', 'origin_no_results', 'origin_common', 'origin_all',
      'profile_origin_label', 'profile_origin_unset', 'profile_region_label',
      'settings_language_title', 'settings_region_title', 'settings_origin_title', 'settings_saved', 'settings_save_error', 'settings_gear_label',
      'security_sessions_title', 'security_this_device', 'security_this_device_sub', 'security_signout_all', 'security_signout_all_sub',
      'security_signout_all_confirm', 'security_signout_all_yes', 'security_signout_all_busy', 'security_signout_all_error',
      'security_data_title', 'security_data_privacy', 'security_data_delete',
    ] as const
    for (const lang of LANGS) for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
    expect([translations.en.nav_profile, translations.he.nav_profile]).toEqual(['Profile', 'פרופיל'])
  })

  it('drops the old "My Account" label', () => {
    for (const lang of LANGS) expect('nav_account' in translations[lang]).toBe(false)
  })
})
