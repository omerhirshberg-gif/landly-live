import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import snapshot from '@/lib/inventory/raayonitCatalog.snapshot.json'
import { dealPhotoFit } from '@/lib/offers/imageFit'
import { raayonitImageOpts } from '@/lib/offers/logoOnly'
import { isBlockedImageSource } from '@/lib/inventory/raayonitImageUtils'
import HowToRedeem from '@/components/offers/HowToRedeem'

vi.mock('@/lib/i18n/useLang', () => ({ useLang: () => ({ t: (key: string) => key, lang: 'en' }) }))

type B = { key: string; nameHe: string; nameEn: string; logoFile?: string; logoKind?: string }
const brands = (snapshot as { brands: B[] }).brands

describe('brands that used to sit on a flat white box get the ambient backdrop (OfferCard and Offer Detail share DealMedia)', () => {
  it.each(['ALDO', 'NINE WEST', 'SHOW/OFF', 'TALADA', 'TITANIUM', 'WALK IN', 'מגה ספורט', 'ESCAPELAND', 'HoLMES PLACE', 'סבון של פעם'])('%s', async (name) => {
    const brand = brands.find((b) => b.nameHe === name && b.logoFile)!
    expect(brand, name).toBeDefined()
    const meta = await sharp(`public/images/raayonit-brands/${brand.logoFile}`).metadata()
    const opts = raayonitImageOpts({ fulfillmentType: 'raayonit_pool', logoKind: brand.logoKind })
    expect(dealPhotoFit({ width: meta.width!, height: meta.height! }, { ambient: opts.raayonit, graphic: opts.graphic })).toBe('contain')
  })
  it('no trimmed asset carries a baked white margin', async () => {
    for (const b of brands.filter((x) => x.logoFile).slice(0, 60)) {
      // Transparent margins are fine (the backdrop shows through); an opaque white row is a baked-in margin.
      const { data, info } = await sharp(`public/images/raayonit-brands/${b.logoFile}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      const row = (y: number) => Array.from({ length: info.width }, (_, x) => (y * info.width + x) * 4).every((i) => data[i + 3]! > 0 && data[i]! >= 245 && data[i + 1]! >= 245 && data[i + 2]! >= 245)
      expect(row(0) && row(info.height - 1), `${b.nameHe} has opaque white top and bottom rows`).toBe(false)
    }
  })
})

describe('image sources', () => {
  it.each([
    'https://www.instagram.com/p/abc', 'https://scontent.cdninstagram.com/v/x.jpg', 'https://scontent-fra.xx.fbcdn.net/v/x.jpg', 'https://www.facebook.com/brand/photo.jpg',
    'https://www.tiktok.com/@a', 'https://p16.tiktokcdn.com/x.jpg', 'https://i.pinimg.com/x.jpg', 'https://pinterest.com/pin/1', 'https://twitter.com/a', 'https://x.com/a',
    'https://media.licdn.com/x.jpg', 'https://www.linkedin.com/in/a', 'https://i.ytimg.com/vi/x.jpg', 'https://www.youtube.com/watch?v=1', 'https://image.shutterstock.com/x.jpg',
    'https://media.gettyimages.com/x.jpg', 'https://media.istockphoto.com/x.jpg', 'https://www.alamy.com/x', 'https://st.depositphotos.com/x.jpg', 'not a url',
  ])('rejects %s', (url) => expect(isBlockedImageSource(url)).toBe(true))
  it.each(['https://www.eyeglow.co.il/x.png', 'https://assets.fattal.co.il/24_f75f04f310.jpg', 'http://joya.co.il/logo.png', 'https://notinstagram.com/x.jpg'])('accepts %s', (url) => expect(isBlockedImageSource(url)).toBe(false))
})

describe('Fine print and terms on Offer Detail', () => {
  it('web: the accordion renders the terms open by default', () => {
    const html = renderToStaticMarkup(createElement(HowToRedeem, { method: 'in_store', instructions: '', terms: 'No business lunches.', variant: 'accordion' }))
    expect(html).toContain('No business lunches.')
    expect(html).toMatch(/acc-body open/g)
    expect((html.match(/aria-expanded="true"/g) ?? []).length).toBe(2)
  })
  it('native: the fine print accordion is defaultOpen', () => {
    const src = readFileSync('landly-mobile/src/app/offer/[offerId].tsx', 'utf8')
    expect(src).toContain("<Accordion title={t('offer_fine_print_title')} defaultOpen>")
  })
})
