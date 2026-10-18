import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { appPathForLink, appUrlForLink } from '@/lib/navigation/deepLinks'

const read = (path: string) => readFileSync(path, 'utf8')

describe('deep link mapping', () => {
  it.each([
    ['landly://offers/abc123', '/offer/abc123'],
    ['landly://offer/abc123', '/offer/abc123'],
    ['landly:///offers/abc123', '/offer/abc123'],
    ['https://www.golandly.com/offers/abc123?utm=email#top', '/offer/abc123'],
    ['/offers/abc123', '/offer/abc123'],
    ['offer/abc123', '/offer/abc123'],
    ['landly://member/vouchers/user_offer', '/voucher/user_offer'],
    ['https://www.golandly.com/member/vouchers/user_offer', '/voucher/user_offer'],
    ['/voucher/user_offer/', '/voucher/user_offer'],
  ])('%s opens %s', (link, route) => {
    expect(appPathForLink(link)).toBe(route)
  })

  it.each([
    '/', '/perks', '/offers', '/member', 'landly://settings',
    '/offers/a/b', '/offers/..', '/offers/%2Fescape', '/offers/%E0%A4%A',
    'exp+landly-live://expo-development-client/?url=http%3A%2F%2F192.168.1.5%3A8081',
    'mailto:team.landly@gmail.com',
  ])('leaves %s alone', (link) => {
    expect(appPathForLink(link)).toBeNull()
  })

  it('builds the landly:// link for the web hint', () => {
    expect(appUrlForLink('/offers/abc123')).toBe('landly://offer/abc123')
    expect(appUrlForLink('/member/vouchers/user_offer')).toBe('landly://voucher/user_offer')
    expect(appUrlForLink('/member')).toBeNull()
  })
})

describe('app wiring', () => {
  it('registers the landly scheme', () => {
    expect(JSON.parse(read('landly-mobile/app.json')).expo.scheme).toBe('landly')
  })

  it('maps incoming links in +native-intent and remembers them for after sign-in', () => {
    const intent = read('landly-mobile/src/app/+native-intent.tsx')
    expect(intent).toContain('export function redirectSystemPath')
    expect(intent).toContain("from '@shared/navigation/deepLinks'")
    expect(intent).toContain('rememberDeepLink(route)')
    const layout = read('landly-mobile/src/app/_layout.tsx')
    expect(layout).toContain('pendingDeepLink()')
    expect(layout).toContain('router.push(target as Href)')
  })

  it('opens offers on a native screen, never the browser', () => {
    const openOffer = read('landly-mobile/src/lib/openOffer.ts')
    expect(openOffer).toContain("router.push({ pathname: '/offer/[offerId]'")
    expect(openOffer).not.toMatch(/Linking|WebBrowser/)
  })

  it('shows the web hint on the offer and voucher pages', () => {
    for (const page of ['app/offers/[offerId]/page.tsx', 'app/member/vouchers/[voucherId]/page.tsx']) {
      expect(read(page)).toContain('<OpenInAppHint')
    }
    const hint = read('components/layout/OpenInAppHint.tsx')
    expect(hint).toContain('sm:hidden')
    expect(hint).toContain('appUrlForLink(pathname)')
  })
})
