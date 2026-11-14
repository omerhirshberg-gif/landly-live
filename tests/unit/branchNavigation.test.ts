import { describe, expect, it } from 'vitest'
import { branchSearchQuery, buildBranchNavigationUrls } from '@/lib/maps/navigation'

describe('branchSearchQuery', () => {
  it('puts the brand in front unless the branch already names it', () => {
    expect(branchSearchQuery('Azrieli', 'Fox')).toBe('Fox Azrieli')
    expect(branchSearchQuery('fox  azrieli', 'FOX')).toBe('fox azrieli')
    expect(branchSearchQuery('עזריאלי ת״א', '')).toBe('עזריאלי ת״א')
    expect(branchSearchQuery(' Dizengoff   Center ', null)).toBe('Dizengoff Center')
  })
})

describe('buildBranchNavigationUrls', () => {
  it('builds encoded https and app links', () => {
    const urls = buildBranchNavigationUrls('Azrieli & Co', 'Fox')
    expect(urls.waze).toBe('https://waze.com/ul?q=Fox%20Azrieli%20%26%20Co&navigate=yes')
    expect(urls.googleMaps).toBe('https://www.google.com/maps/search/?api=1&query=Fox%20Azrieli%20%26%20Co')
    expect(urls.nativeWaze).toBe('waze://?q=Fox%20Azrieli%20%26%20Co&navigate=yes')
    expect(urls.nativeGoogleMaps).toBe('comgooglemaps://?q=Fox%20Azrieli%20%26%20Co')
    expect(buildBranchNavigationUrls('X', null, 'android').nativeGoogleMaps).toBeNull()
  })

  it('goes to the exact position of a branch picked from Google, and searches only for a legacy name', () => {
    const urls = buildBranchNavigationUrls('BIG Fashion Glilot', 'BIG', 'ios', { lat: 32.1403, lng: 34.8065, placeId: 'ChIJ_abc-1' })
    expect(urls.waze).toBe('https://waze.com/ul?ll=32.1403,34.8065&navigate=yes')
    expect(urls.googleMaps).toBe('https://www.google.com/maps/search/?api=1&query=32.1403,34.8065&query_place_id=ChIJ_abc-1')
    expect(urls.nativeWaze).toBe('waze://?ll=32.1403,34.8065&navigate=yes')
    expect(urls.nativeGoogleMaps).toBe('comgooglemaps://?q=32.1403,34.8065')
    expect(buildBranchNavigationUrls('x', null, 'android', { lat: 1, lng: 2 }).nativeGoogleMaps).toBeNull()
    expect(buildBranchNavigationUrls('BIG גלילות', null).waze).toContain('?q=')
  })
})
