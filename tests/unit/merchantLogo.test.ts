import { describe, expect, it } from 'vitest'
import { resolveMerchantLogo } from '@/lib/offers/merchantLogo'
import { merchantBadgeProps } from '@/lib/offers/merchantLogoProps'

describe('resolveMerchantLogo', () => {
  it("prefers the business's own logo", () => {
    expect(resolveMerchantLogo({ businessLogoUrl: 'https://cdn.test/mega.png', imageUrl: '/images/raayonit-brands/l-greg.png', fulfillmentType: 'raayonit_pool' }))
      .toEqual({ kind: 'url', url: 'https://cdn.test/mega.png' })
  })

  it("then a bundled Raayonit brand image named by the offer's image", () => {
    expect(resolveMerchantLogo({ businessLogoUrl: '', imageUrl: 'https://golandly.com/images/raayonit-brands/l-greg.png' }))
      .toEqual({ kind: 'url', url: 'https://golandly.com/images/raayonit-brands/l-greg.png' })
  })

  it("then the offer's image when it is a logo, not a photo", () => {
    expect(resolveMerchantLogo({ imageUrl: 'https://cdn.test/mega-sport-logo.png' })).toEqual({ kind: 'url', url: 'https://cdn.test/mega-sport-logo.png' })
    expect(resolveMerchantLogo({ imageUrl: 'https://cdn.test/gym-photo.jpg' })).toBeNull()
  })

  it('falls back to the Raayonit logo for a Raayonit-issued offer with no brand logo', () => {
    expect(resolveMerchantLogo({ businessLogoUrl: '  ', imageUrl: '', fulfillmentType: 'raayonit_pool' })).toEqual({ kind: 'raayonit' })
    expect(resolveMerchantLogo({ redemptionKind: 'code_only' })).toEqual({ kind: 'raayonit' })
    expect(resolveMerchantLogo({ issuer: { id: 'raayonit' } })).toEqual({ kind: 'raayonit' })
  })

  it('draws nothing for any other offer without a logo: no square, no icon, no monogram', () => {
    expect(resolveMerchantLogo({ businessLogoUrl: '', imageUrl: '' })).toBeNull()
    expect(resolveMerchantLogo({ fulfillmentType: 'external' })).toBeNull()
  })
})

describe('merchantBadgeProps', () => {
  it("maps each kind to MerchantBadge's props", () => {
    expect(merchantBadgeProps({ businessLogoUrl: 'https://cdn.test/a.png' })).toEqual({ logoUrl: 'https://cdn.test/a.png', raayonit: false })
    expect(merchantBadgeProps({ fulfillmentType: 'raayonit_pool' })).toEqual({ logoUrl: '', raayonit: true })
    expect(merchantBadgeProps({})).toBeNull()
    expect(merchantBadgeProps(null)).toBeNull()
  })
})

describe('purchaseMedia', () => {
  it("reads the order's frozen snapshot first, so nothing waits for the offer", async () => {
    const { purchaseMedia } = await import('@/lib/offers/merchantLogo')
    expect(purchaseMedia({ order: { businessLogoUrl: 'https://cdn.test/toys.png', offerImageUrl: 'https://cdn.test/shop.jpg' }, offer: null }))
      .toEqual({ logo: { kind: 'url', url: 'https://cdn.test/toys.png' }, photoUrl: '' })
  })

  it('falls back to the live offer for an older order, then to the offer photo, then to nothing', async () => {
    const { purchaseMedia } = await import('@/lib/offers/merchantLogo')
    expect(purchaseMedia({ order: {}, offer: { businessLogoUrl: 'https://cdn.test/a.png' } }).logo).toEqual({ kind: 'url', url: 'https://cdn.test/a.png' })
    expect(purchaseMedia({ order: { offerImageUrl: 'https://cdn.test/gym.jpg' } })).toEqual({ logo: null, photoUrl: 'https://cdn.test/gym.jpg' })
    expect(purchaseMedia({ order: {}, offer: null })).toEqual({ logo: null, photoUrl: '' })
    expect(purchaseMedia({ order: { fulfillmentType: 'raayonit_pool' } }).logo).toEqual({ kind: 'raayonit' })
    // An offer with its own photo (the multi-chain one) shows it, not the Raayonit tile.
    expect(purchaseMedia({ order: { fulfillmentType: 'raayonit_pool', offerImageUrl: '/images/raayonit/super-tav-multi-chain.jpg' } })).toEqual({ logo: null, photoUrl: '/images/raayonit/super-tav-multi-chain.jpg' })
  })
})
