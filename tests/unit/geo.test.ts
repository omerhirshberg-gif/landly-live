import { describe, expect, it } from 'vitest'
import {
  ADDRESS_REFRESH_DAYS,
  deriveAreas,
  formatDistance,
  haversineDistanceKm,
  isAddressStale,
  localizedName,
  offerFullAddress,
  offerPlaceFields,
  offerPlaceLabel,
  parseGeoAddress,
  parsePlaceSnapshot,
  roundCoordinates,
  sortByDistance,
} from '@/lib/geo'

const TEL_AVIV = { lat: 32.0853, lng: 34.7818 }
const JERUSALEM = { lat: 31.7683, lng: 35.2137 }
const HAIFA = { lat: 32.794, lng: 34.9896 }

describe('distances', () => {
  it('measures Tel Aviv–Jerusalem at about 54 km', () => {
    expect(haversineDistanceKm(TEL_AVIV, JERUSALEM)).toBeGreaterThan(50)
    expect(haversineDistanceKm(TEL_AVIV, JERUSALEM)).toBeLessThan(58)
  })

  it('sorts nearest first and drops items without coordinates', () => {
    const items = [{ id: 'haifa', at: HAIFA }, { id: 'none', at: null }, { id: 'jlm', at: JERUSALEM }]
    expect(sortByDistance(items, TEL_AVIV, (item) => item.at).map((item) => item.id)).toEqual(['jlm', 'haifa'])
  })

  it('rounds to about a kilometre for the geocoding cache', () => {
    expect(roundCoordinates({ lat: 32.08531, lng: 34.78179 })).toEqual({ lat: 32.09, lng: 34.78 })
  })

  it('formats metres and kilometres in the reader’s language', () => {
    expect(formatDistance(0.34, 'en')).toMatch(/350\s?m/)
    expect(formatDistance(1.234, 'en')).toMatch(/1\.2\s?km/)
    expect(formatDistance(14.6, 'en')).toMatch(/15\s?km/)
    expect(formatDistance(1.234, 'he')).toMatch(/1\.2/)
  })
})

describe('parseGeoAddress', () => {
  const valid = {
    placeId: 'ChIJ123',
    formatted: { he: 'דיזנגוף 50, תל אביב', en: 'Dizengoff St 50, Tel Aviv' },
    short: { he: 'דיזנגוף 50, תל אביב', en: 'Dizengoff St 50' },
    city: { he: 'תל אביב', en: 'Tel Aviv' },
    ...TEL_AVIV,
  }

  it('accepts a picked place', () => {
    expect(parseGeoAddress(valid)).toEqual(valid)
  })

  it('reads addresses picked before short lines and fetch times existed', () => {
    const { short: _short, ...old } = valid
    expect(parseGeoAddress(old)).toEqual({ ...old, short: {} })
    expect(parseGeoAddress({ ...valid, fetchedAt: '2026-10-01T00:00:00.000Z' })?.fetchedAt).toBe('2026-10-01T00:00:00.000Z')
    expect(parseGeoAddress({ ...valid, fetchedAt: 'yesterday' })).not.toHaveProperty('fetchedAt')
  })

  it('keeps all five languages and drops anything else', () => {
    const address = parseGeoAddress({ ...valid, formatted: { ...valid.formatted, ru: 'ул. Дизенгоф 50', fr: 'Dizengoff 50', de: 'Dizengoffstraße 50' } })
    expect(Object.keys(address!.formatted).sort()).toEqual(['en', 'fr', 'he', 'ru'])
    expect(parseGeoAddress({ ...valid, formatted: { es: 'Dizengoff 50' } })?.formatted).toEqual({ es: 'Dizengoff 50' })
  })

  it('rejects bad coordinates, a missing place id or no address text', () => {
    expect(parseGeoAddress({ ...valid, lat: 120 })).toBeNull()
    expect(parseGeoAddress({ ...valid, placeId: '' })).toBeNull()
    expect(parseGeoAddress({ ...valid, formatted: {} })).toBeNull()
    expect(parseGeoAddress('Tel Aviv')).toBeNull()
  })

  it('becomes the fields an offer copies', () => {
    expect(offerPlaceFields({ location: 'דיזנגוף 50', address: valid })).toEqual({
      location: 'דיזנגוף 50',
      geo: TEL_AVIV,
      city: valid.city,
      address: { placeId: 'ChIJ123', formatted: valid.formatted, short: valid.short },
    })
    expect(offerPlaceFields({ location: 'Somewhere' })).toEqual({ location: 'Somewhere', geo: null, city: {}, address: null })
  })

  it('reads an offer’s copy of the address lines', () => {
    expect(parsePlaceSnapshot({ placeId: 'ChIJ123', formatted: valid.formatted, short: valid.short })).toEqual({ placeId: 'ChIJ123', formatted: valid.formatted, short: valid.short })
    expect(parsePlaceSnapshot({ placeId: 'ChIJ123', formatted: {} })).toBeNull()
    expect(parsePlaceSnapshot(null)).toBeNull()
  })

  it('asks Google again when a language or the short line is missing, or the address is old', () => {
    const now = Date.parse('2026-10-20T00:00:00Z')
    const fresh = {
      ...valid,
      formatted: { he: 'א', en: 'a', ru: 'б', es: 'c', fr: 'd' },
      fetchedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
    }
    expect(isAddressStale(fresh, now)).toBe(false)
    expect(isAddressStale({ ...fresh, formatted: { he: 'א', en: 'a' } }, now)).toBe(true)
    expect(isAddressStale({ ...fresh, short: {} }, now)).toBe(true)
    expect(isAddressStale({ ...fresh, fetchedAt: undefined }, now)).toBe(true)
    expect(isAddressStale({ ...fresh, fetchedAt: new Date(now - (ADDRESS_REFRESH_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString() }, now)).toBe(true)
  })
})

describe('names and labels', () => {
  it('picks the reader’s language, then English, then Hebrew', () => {
    expect(localizedName({ he: 'חיפה', en: 'Haifa' }, 'he')).toBe('חיפה')
    expect(localizedName({ he: 'חיפה', en: 'Haifa', ru: 'Хайфа' }, 'ru')).toBe('Хайфа')
    expect(localizedName({ he: 'חיפה', en: 'Haifa' }, 'ru')).toBe('Haifa')
    expect(localizedName({ he: 'חיפה' }, 'en')).toBe('חיפה')
    expect(localizedName({ fr: 'Haïfa' }, 'es')).toBe('Haïfa')
    expect(localizedName(undefined, 'en')).toBe('')
  })

  it('shows every reader the street and city in their language once Google has it', () => {
    const offer = {
      location: 'הרצל 1, חיפה',
      city: { he: 'חיפה', en: 'Haifa' },
      address: { placeId: 'p', formatted: { he: 'הרצל 1, חיפה, ישראל', fr: 'Herzl 1, Haïfa, Israël' }, short: { he: 'הרצל 1, חיפה', fr: 'Herzl 1, Haïfa' } },
    }
    expect(offerPlaceLabel(offer, 'fr')).toBe('Herzl 1, Haïfa')
    expect(offerPlaceLabel(offer, 'he')).toBe('הרצל 1, חיפה')
    expect(offerFullAddress(offer, 'fr')).toBe('Herzl 1, Haïfa, Israël')
    expect(offerFullAddress({ location: 'Online' }, 'en')).toBe('Online')
  })

  it('shows Hebrew readers the street address and others the city', () => {
    const offer = { location: 'הרצל 1, חיפה', city: { he: 'חיפה', en: 'Haifa' } }
    expect(offerPlaceLabel(offer, 'he')).toBe('הרצל 1, חיפה')
    expect(offerPlaceLabel(offer, 'en')).toBe('Haifa')
    expect(offerPlaceLabel({ location: 'Online' }, 'en')).toBe('Online')
  })
})

describe('deriveAreas', () => {
  it('groups offers by city, centres each area and puts the busiest first', () => {
    const areas = deriveAreas([
      { geo: TEL_AVIV, city: { en: 'Tel Aviv', he: 'תל אביב' } },
      { geo: { lat: 32.0753, lng: 34.7718 }, city: { en: 'Tel Aviv' } },
      { geo: HAIFA, city: { en: 'Haifa' } },
      { geo: null, city: { en: 'Eilat' } },
      { geo: JERUSALEM, city: {} },
    ])
    expect(areas.map((area) => area.key)).toEqual(['tel aviv', 'haifa'])
    expect(areas[0]!.count).toBe(2)
    expect(areas[0]!.name).toEqual({ en: 'Tel Aviv', he: 'תל אביב' })
    expect(deriveAreas([{ geo: HAIFA, city: { en: 'Haifa' } }, { geo: HAIFA, city: { en: 'Haifa', ru: 'Хайфа' } }])[0]!.name).toEqual({ en: 'Haifa', ru: 'Хайфа' })
    expect(areas[0]!.center.lat).toBeCloseTo(32.0803, 4)
  })
})
