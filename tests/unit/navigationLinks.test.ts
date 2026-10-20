import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nativeNavigationUrls, navigationLinks } from '@/lib/maps/navigation'
import { translations } from '@/lib/i18n/translations'

const TEL_AVIV = { lat: 32.0853, lng: 34.7818 }

describe('navigationLinks', () => {
  it('navigates to the coordinates, naming the place for Google Maps', () => {
    expect(navigationLinks({ geo: TEL_AVIV, placeId: 'ChIJ123' })).toEqual({
      googleMaps: 'https://www.google.com/maps/dir/?api=1&destination=32.0853,34.7818&destination_place_id=ChIJ123',
      waze: 'https://waze.com/ul?ll=32.0853,34.7818&navigate=yes',
    })
  })

  it('leaves the place id out when there is none', () => {
    expect(navigationLinks({ geo: TEL_AVIV })?.googleMaps).toBe('https://www.google.com/maps/dir/?api=1&destination=32.0853,34.7818')
  })

  it('falls back to the encoded address for a business with no map position', () => {
    expect(navigationLinks({ address: 'דיזנגוף 50, תל אביב' })).toEqual({
      googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('דיזנגוף 50, תל אביב')}`,
      waze: `https://waze.com/ul?q=${encodeURIComponent('דיזנגוף 50, תל אביב')}&navigate=yes`,
    })
  })

  it('gives nothing to navigate to without coordinates or an address', () => {
    expect(navigationLinks({})).toBeNull()
    expect(navigationLinks({ address: '   ', placeId: 'ChIJ123' })).toBeNull()
  })
})

describe('nativeNavigationUrls', () => {
  it('opens the installed apps straight into navigation', () => {
    expect(nativeNavigationUrls(TEL_AVIV, 'ios')).toEqual({
      googleMaps: 'comgooglemaps://?daddr=32.0853,34.7818&directionsmode=driving',
      waze: 'waze://?ll=32.0853,34.7818&navigate=yes',
    })
    expect(nativeNavigationUrls(TEL_AVIV, 'android')?.googleMaps).toBe('google.navigation:q=32.0853,34.7818')
    expect(nativeNavigationUrls(null, 'ios')).toBeNull()
  })
})

describe('navigation buttons', () => {
  it('are labelled in all five languages', () => {
    for (const lang of ['en', 'ru', 'es', 'fr', 'he'] as const) {
      for (const key of ['offer_nav_heading', 'offer_nav_waze', 'offer_nav_google', 'offer_nav_opens_new_tab'] as const) {
        expect(translations[lang][key]).toBeTruthy()
      }
    }
    expect(translations.he.offer_nav_waze).toBe('ניווט בוויז')
    expect(translations.he.offer_nav_google).toBe('גוגל מפות')
  })

  it('open in a new tab on the website, without handing the page over', () => {
    const source = readFileSync('components/offers/NavigationLinks.tsx', 'utf8')
    expect(source.match(/target="_blank" rel="noopener noreferrer"/g)).toHaveLength(2)
  })

  it('sit on the offer page on the website and in the app', () => {
    expect(readFileSync('app/offers/[offerId]/page.tsx', 'utf8')).toContain('<NavigationLinks')
    expect(readFileSync('landly-mobile/src/app/offer/[offerId].tsx', 'utf8')).toContain('<NavigationButtons')
  })
})
