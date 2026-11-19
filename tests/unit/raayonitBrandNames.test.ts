import { describe, expect, it } from 'vitest'
import { applyCanonical } from '../../lib/inventory/raayonitCanonicalCatalog'
import snapshot from '../../lib/inventory/raayonitCatalog.snapshot.json'
import { finalizeCatalog } from '../../lib/inventory/raayonitSanitize'
import type { RaayonitBrand } from '../../lib/inventory/raayonitCatalog'
import { hasHebrew, officialBrandName, OFFICIAL_BRAND_NAMES } from '../../lib/inventory/raayonitBrandNames'
import { inferRedemption, isolateNumbers } from '../../lib/inventory/raayonitRedemption'
import { localizePlace, latinToCyrillic } from '../../lib/inventory/raayonitPlaceNames'
import { titleIn } from '../../lib/inventory/raayonitCatalogSync'

const brands = finalizeCatalog(applyCanonical((snapshot as { brands: RaayonitBrand[] }).brands))
const LANGS = ['en', 'ru', 'fr', 'es'] as const
const KNOWN_BAD = ['Coffee Cream', 'For fraud', 'Combined', 'Caraway', 'Old-fashioned soap', 'Birch bread', 'Book Junction', 'Tomato Pizza', 'Italy in bedbugs', 'Fury Hotel', 'Kfar Blum Cakes', 'Electrical Lounge', 'Her in the forest']

describe('official brand names', () => {
  it('names Crema Cafe as its commercial name in every language', () => {
    expect(officialBrandName('קפה קרמה', 'en')).toBe('Crema Cafe')
    expect(officialBrandName('קפה קרמה', 'ru')).toBe('Кафе Крема')
    expect(officialBrandName('קפה קרמה', 'fr')).toBe('Crema Café')
    expect(officialBrandName('קפה קרמה', 'es')).toBe('Crema Café')
    expect(officialBrandName('לחם ארז קריית ביאליק', 'en')).toBe('Lechem Erez Kiryat Bialik')
    expect(officialBrandName('שילב', 'en')).toBe('Shilav')
    expect(officialBrandName('כרמא', 'en')).toBe('Karma')
  })

  it('covers every brand written in Hebrew letters, with no Hebrew in any other language', () => {
    for (const brand of brands) {
      for (const lang of LANGS) {
        const name = officialBrandName(brand.nameHe, lang)
        expect(name, `${brand.nameHe} (${lang})`).not.toBeNull()
        expect(hasHebrew(name!), `${brand.nameHe} -> ${name}`).toBe(false)
        expect(KNOWN_BAD.some((bad) => name!.includes(bad)), `${brand.nameHe} -> ${name}`).toBe(false)
      }
    }
  })

  it('keeps Latin-letter brands as written and has no stray glossary rows', () => {
    expect(officialBrandName('FOX', 'ru')).toBe('FOX')
    const hebrewNames = new Set(brands.map((b) => b.nameHe.replace(/\s+/g, ' ').trim()))
    const orphans = [...OFFICIAL_BRAND_NAMES.keys()].filter((k) => k !== 'תו על רב-רשתי' && !hebrewNames.has(k))
    expect(orphans).toEqual([])
  })

  it('writes titles with Super Tav outside Hebrew', () => {
    expect(titleIn('en', { general: false, name: officialBrandName('קפה קרמה', 'en')! })).toBe('Crema Cafe — Super Tav')
  })
})

describe('branch places', () => {
  it('leaves no Hebrew in any branch, city or street in any language', () => {
    for (const brand of brands) for (const b of brand.branches) for (const lang of LANGS) {
      for (const text of [b.name, b.city ?? '', b.address]) expect(hasHebrew(localizePlace(text, lang, brand.nameHe)), `${text} (${lang})`).toBe(false)
    }
  })

  it('uses the glossary for the brand part and the dictionary for the city', () => {
    expect(localizePlace('קפה קרמה נתניה', 'en', 'קפה קרמה')).toBe('Crema Cafe Netanya')
    expect(localizePlace('בן גוריון 31, חיפה', 'ru')).toBe('Бен-Гурион 31, Хайфа')
    expect(latinToCyrillic('Tzomet')).toBe('Цомет')
  })
})

describe('redemption modes', () => {
  const plan = (nameHe: string) => inferRedemption(brands.find((b) => b.nameHe === nameHe)!)
  it('books hotels in advance, spas by phone, and never says "at the cashier" for them', () => {
    expect(plan('VERT').method).toBe('advance_booking')
    expect(plan('VERT').instructions.he).not.toContain('בקופה')
    expect(plan('VERT').instructions.en).toContain('03-9223392')
    expect(plan('ShareSpa').method).toBe('phone_booking')
    expect(plan('JAPAN JAPAN').method).toBe('phone_order')
    expect(plan('קפה קרמה').method).toBe('in_store')
  })

  it('writes every mode in five languages and isolates phone numbers', () => {
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) expect(plan('VERT').instructions[lang].length).toBeGreaterThan(20)
    expect(isolateNumbers('03-9223392 and 50%')).toBe('⁦03-9223392⁩ and ⁦50%⁩')
  })
})

import { applyLocationFilter, badgeKm, closestKm, DEFAULT_RADIUS_KM, type LocationFilter } from '../../lib/perks/locationFilter'
import { ISRAEL_REGIONS, ISRAEL_CITY_COORDS } from '../../lib/israelCities'

describe('location filter', () => {
  const tlv = { lat: 32.0853, lng: 34.7818 }
  const chain = (cities: string[]) => ({ perkScope: 'single_business' as const, branches: cities.map((city) => ({ name: 'x', city, address: '', phone: '', kosher: false })) })
  const gps = (radiusKm: 5 | 15 | 25): LocationFilter => ({ kind: 'gps', coords: tlv, radiusKm })

  it('places a chain by its closest branch', () => {
    const offer = chain(['חיפה', 'תל אביב'])
    expect(closestKm(offer, tlv)).toBeLessThan(1)
    expect(badgeKm(offer, gps(5))).toBe(1)
  })

  it('keeps a multi-chain pass under every filter and drops what is too far', () => {
    const offers: Parameters<typeof applyLocationFilter>[0] = [{ perkScope: 'multi_chain' }, chain(['תל אביב']), chain(['חיפה']), chain(['רמת גן']), { perkScope: 'single_business' }]
    expect(applyLocationFilter(offers, gps(DEFAULT_RADIUS_KM))).toHaveLength(3)
    expect(applyLocationFilter(offers, gps(25))).toHaveLength(3)
    expect(applyLocationFilter(offers, { kind: 'area', region: null, city: 'חיפה' })).toHaveLength(2)
    expect(applyLocationFilter(offers, { kind: 'area', region: 'north', city: null })).toHaveLength(2)
  })

  it('has six regions and every region has cities', () => {
    expect(ISRAEL_REGIONS).toHaveLength(6)
    for (const r of ISRAEL_REGIONS) expect(Object.values(ISRAEL_CITY_COORDS).some((c) => c.region === r.id)).toBe(true)
  })
})
