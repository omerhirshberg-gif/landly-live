import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')
function sources(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    if (name === 'node_modules' || name.startsWith('.')) return []
    const path = join(dir, name)
    return statSync(join(root, path)).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}
const appCode = [...sources('app'), ...sources('components'), ...sources('lib'), ...sources('landly-mobile/src')]

describe('one set of voucher listeners per session', () => {
  it('only the shared provider opens voucher listeners; screens read them with useVouchers', () => {
    const openers = appCode.filter((file) => /subscribeToUserVouchers\(/.test(read(file))).filter((file) => !file.endsWith('lib/firebase/vouchers.ts'))
    expect(openers).toEqual(['lib/firebase/VouchersProvider.tsx'])
    for (const screen of ['landly-mobile/src/app/(tabs)/index.tsx', 'landly-mobile/src/app/(tabs)/wallet.tsx', 'components/home/LoggedInHome.tsx', 'app/member/page.tsx']) {
      expect(read(screen)).toContain('useVouchers(')
    }
  })

  it('is mounted once, on the web and in the app', () => {
    expect(read('app/layout.tsx')).toContain('<VouchersProvider>')
    expect(read('landly-mobile/src/app/_layout.tsx')).toContain('<VouchersProvider>')
  })

  it('the redeemed list opens only for the screens that show it', () => {
    expect(read('landly-mobile/src/app/(tabs)/wallet.tsx')).toContain('useVouchers({ redeemed: true })')
    expect(read('app/member/page.tsx')).toContain('useVouchers({ redeemed: true })')
    expect(read('landly-mobile/src/app/(tabs)/index.tsx')).not.toContain('redeemed: true')
    expect(read('components/home/LoggedInHome.tsx')).not.toContain('redeemed: true')
  })
})

describe('no read per item', () => {
  it('lists of ids are read in batches, never one getDoc per id', () => {
    for (const file of ['lib/firebase/offers.ts', 'lib/firebase/orders.ts', 'lib/firebase/WishlistProvider.tsx']) {
      expect(read(file)).not.toMatch(/ids\.map\(\(id\) => getOffer\(|orderIds\.map\(\(id\) =>\s*getDoc/)
    }
    expect(read('lib/firebase/offers.ts')).toContain("where(documentId(), 'in'")
    expect(read('lib/firebase/orders.ts')).toContain("where(documentId(), 'in'")
  })

  it('settlement reads the businesses and banks for a payout in one batch', () => {
    const settlement = read('lib/finance/settlement.ts')
    expect(settlement).toContain('getAllById(db')
    // No business or financials read inside a loop over the payout's lines.
    expect(settlement).not.toMatch(/for \(const line of payable\) \{[\s\S]*?await (loadBank|db\.collection\('businesses'\))/)
    expect(settlement).not.toMatch(/ids\.map\(async \(id\) => \{[\s\S]{0,120}\.get\(\)/)
    expect(read('lib/inventory/smartImport.ts')).toContain('getAllById(db')
  })

  it('every offers read from a client is bounded', () => {
    const offers = read('lib/firebase/offers.ts')
    expect(offers).not.toMatch(/getDocs\(collection\(db, 'offers'\)\)/)
    expect(offers).toContain('OFFERS_READ_LIMIT = 500')
  })
})

describe('app error boundaries', () => {
  it.each([
    'landly-mobile/src/app/(tabs)/_layout.tsx',
    'landly-mobile/src/app/(tabs)/_layout.web.tsx',
    'landly-mobile/src/app/checkout/[offerId].tsx',
    'landly-mobile/src/app/offer/[offerId].tsx',
    'landly-mobile/src/app/voucher/[voucherId].tsx',
    'landly-mobile/src/app/order-success/[orderId].tsx',
  ])('%s shows the retry card instead of closing the app', (file) => {
    expect(read(file)).toContain("export { default as ErrorBoundary } from '../../components/RouteErrorBoundary'")
  })

  it('the root layout exports one too and points offers at the cached API', () => {
    const layout = read('landly-mobile/src/app/_layout.tsx')
    expect(layout).toContain('export { RouteErrorBoundary as ErrorBoundary }')
    expect(layout).toContain('setOffersApiBase(API_BASE_URL)')
  })

  it('uses the website error words, in every language', () => {
    const boundary = read('landly-mobile/src/components/RouteErrorBoundary.tsx')
    for (const key of ['err_title', 'err_body', 'err_retry']) expect(boundary).toContain(`t('${key}')`)
  })
})

describe('checkout stays off shared hot documents', () => {
  it('writes no counter on the business document and no global order counter', () => {
    const claim = read('lib/payments/claimOfferForOrder.ts')
    expect(claim).not.toMatch(/voucherStats[.']|'voucherStats/)
    expect(claim).not.toMatch(/tx\.(update|create)\(legacyRef/)
    expect(claim).toContain('tx.set(shardRef')
  })

  it('the checkout transaction never reads the cached offers', () => {
    for (const file of ['lib/payments/claimOfferForOrder.ts', 'lib/payments/initiateOrder.ts']) {
      expect(read(file)).not.toMatch(/offersCache|api\/public\/offers|getAllOffers/)
    }
  })
})

describe('deploy config', () => {
  it('declares the TTL policy for the rate-limit windows, next to the other throttles', () => {
    const indexes = JSON.parse(read('firebase.indexes.json')) as { fieldOverrides: { collectionGroup: string; fieldPath: string; ttl?: boolean }[] }
    expect(indexes.fieldOverrides).toContainEqual(expect.objectContaining({ collectionGroup: 'rateLimits', fieldPath: 'expiresAt', ttl: true }))
  })

  it('keeps the new server-only collections closed to every client', () => {
    const rules = read('firestore.rules')
    expect(rules).toMatch(/match \/rateLimits\/\{key\} \{\s*allow read, write: if false;/)
    expect(rules).toMatch(/match \/orderCounter\/\{shard\} \{\s*allow read, write: if false;/)
  })
})
