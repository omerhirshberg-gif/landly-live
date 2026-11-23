import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { appleAppSiteAssociation, assetLinks, parseFingerprints, UNIVERSAL_LINK_PATHS } from '@/lib/universalLinks'
import { isOfferComingSoon } from '@/lib/offers/purchaseAvailability'
import { translations } from '@/lib/i18n/translations'

const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':')

describe('universal links files', () => {
  it('builds the AASA only for a valid Team ID', () => {
    expect(appleAppSiteAssociation(undefined)).toBeNull()
    expect(appleAppSiteAssociation('short')).toBeNull()
    const aasa = appleAppSiteAssociation('abcde12345')!
    expect(aasa.applinks.details[0].appIDs).toEqual(['ABCDE12345.com.amitbd.landlyapp'])
    expect(aasa.applinks.details[0].components.map((c) => c['/'])).toEqual([...UNIVERSAL_LINK_PATHS])
  })
  it('builds assetlinks only from valid SHA-256 fingerprints', () => {
    expect(assetLinks('')).toBeNull()
    expect(assetLinks('AB:CD')).toBeNull()
    expect(parseFingerprints(`${FP}, bad`)).toEqual([FP])
    expect(assetLinks(FP)![0].target.package_name).toBe('com.amitbd.landlyapp')
  })
})

describe('purchase availability', () => {
  it('blocks every offer while no gateway is live', () => {
    expect(isOfferComingSoon({ fulfillmentType: 'direct', raayonitComingSoon: false, paymentsLive: false })).toBe(true)
  })
  it('with a live gateway only the Raayonit launch flag blocks, and only Raayonit pools', () => {
    expect(isOfferComingSoon({ fulfillmentType: 'raayonit_pool', raayonitComingSoon: true, paymentsLive: true })).toBe(true)
    expect(isOfferComingSoon({ fulfillmentType: 'direct', raayonitComingSoon: true, paymentsLive: true })).toBe(false)
    expect(isOfferComingSoon({ fulfillmentType: 'raayonit_pool', raayonitComingSoon: false, paymentsLive: true })).toBe(false)
  })
  it('has the generic notice copy in every language', () => {
    for (const lang of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      const dict = translations[lang] as Record<string, string>
      for (const key of ['perk_purchase_soon_title', 'perk_purchase_soon_body', 'perk_purchase_soon_cta']) expect(dict[key], `${lang}.${key}`).toBeTruthy()
    }
  })
})

describe('native app store config', () => {
  const app = json('landly-mobile/app.json').expo
  it('is iPhone only, with no push and the app languages', () => {
    expect(app.ios.supportsTablet).toBe(false)
    expect(app.plugins).not.toContain('expo-notifications')
    expect(app.ios.infoPlist.CFBundleLocalizations).toEqual(['en', 'he', 'ru', 'fr', 'es'])
    expect(app.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false)
    expect(Object.keys(app.locales).sort()).toEqual(['en', 'es', 'fr', 'he', 'ru'])
  })
  it('localizes every permission string in every language', () => {
    const keys = ['NSCameraUsageDescription', 'NSFaceIDUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSLocationWhenInUseUsageDescription']
    for (const path of Object.values(app.locales) as string[]) {
      const file = path.replace('./', 'landly-mobile/')
      expect(existsSync(file), file).toBe(true)
      for (const key of keys) expect(json(file).ios[key], `${file} ${key}`).toBeTruthy()
    }
  })
  it('registers the website links on iOS and Android', () => {
    expect(app.ios.associatedDomains).toEqual(['applinks:www.golandly.com'])
    const filter = app.android.intentFilters[0]
    expect(filter.autoVerify).toBe(true)
    expect(filter.data.map((d: { pathPrefix: string }) => d.pathPrefix)).toEqual(['/offers/', '/member/vouchers/'])
    expect(app.android.blockedPermissions).toContain('android.permission.SYSTEM_ALERT_WINDOW')
  })
  it('has EAS profiles and keeps identifiers out of the repo', () => {
    const eas = json('landly-mobile/eas.json')
    expect(Object.keys(eas.build)).toEqual(expect.arrayContaining(['development', 'preview', 'production']))
    expect(eas.build.production.autoIncrement).toBe(true)
    // `eas init` writes the (non-secret) EAS project id and owner into app.json; Apple and Firebase values never belong there.
    const text = readFileSync('landly-mobile/eas.json', 'utf8') + readFileSync('landly-mobile/app.json', 'utf8')
    expect(text).not.toMatch(/appleTeamId|ascAppId/)
    expect(app.extra?.firebase).toBeUndefined()
    expect(readFileSync('landly-mobile/eas.json', 'utf8')).not.toMatch(/projectId/)
  })
})
