import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { makeLogo, makePhoto } from '@/lib/inventory/raayonitImageUtils'
import { isRaayonitOffer, logoOnlyHero } from '@/lib/offers/logoOnly'

const white = { r: 255, g: 255, b: 255 }
// A 100x40 brand-coloured mark inside a 400x300 white field.
const padded = () => sharp({ create: { width: 400, height: 300, channels: 3, background: white } }).composite([{ input: { create: { width: 100, height: 40, channels: 3, background: { r: 200, g: 20, b: 20 } } }, gravity: 'centre' }]).png().toBuffer()

describe('Raayonit image build', () => {
  it('makeLogo trims the white field and adds no stage: the file keeps the mark’s own shape', async () => {
    const meta = await sharp(await makeLogo(await padded())).metadata()
    expect(meta.width! / meta.height!).toBeCloseTo(2.5, 1)
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(720)
  })
  it('makePhoto trims a baked white border before choosing its shape', async () => {
    const meta = await sharp(await makePhoto(await padded(), 400)).metadata()
    expect(meta.width! / meta.height!).toBeCloseTo(2.5, 1)
  })
})

describe('Raayonit offers have no corner badge or logo hero', () => {
  it('recognises the card by its fulfilment type', () => {
    expect(isRaayonitOffer({ fulfillmentType: 'raayonit_pool' })).toBe(true)
    expect(isRaayonitOffer({ fulfillmentType: 'direct' })).toBe(false)
    expect(isRaayonitOffer(null)).toBe(false)
  })
  it('a brand with its own image has no logo hero (the image is the hero)', () => {
    expect(logoOnlyHero({ fulfillmentType: 'raayonit_pool', imageUrl: '/images/raayonit-brands/1.png', businessLogoUrl: '', logoKind: 'photo' })).toBeNull()
  })
  it('a brand with no image shows the small Raayonit mark without needing a businessLogoUrl', () => {
    expect(logoOnlyHero({ fulfillmentType: 'raayonit_pool', imageUrl: '', businessLogoUrl: '', logoKind: 'fallback' })).toEqual({ kind: 'issuer', small: true })
  })
})

describe('logo backgrounds', () => {
  // Two white blocks with a transparent gap between them (120x30 overall).
  const block = { create: { width: 40, height: 30, channels: 4 as const, background: { r: 255, g: 255, b: 255, alpha: 1 } } }
  const whiteMark = () => sharp({ create: { width: 200, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: block, left: 40, top: 25 }, { input: block, left: 120, top: 25 }]).png().toBuffer()
  it('a white logo on transparent is kept (on a slate field), not erased on white', async () => {
    const { data, info } = await sharp(await makeLogo(await whiteMark())).flatten({ background: '#ff00ff' }).raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => (y * info.width + x) * info.channels
    expect(info.width / info.height).toBeCloseTo(4, 0)
    expect(data[at(5, 15)]).toBeGreaterThan(200) // a white block
    expect(data[at(Math.floor(info.width / 2), 15)]).toBeLessThan(80) // the gap is dark slate, not white
  })
  it('a dark logo on white loses the white: its field is transparent', async () => {
    const bar = { create: { width: 60, height: 20, channels: 3 as const, background: { r: 10, g: 10, b: 10 } } }
    const dark = await sharp({ create: { width: 400, height: 200, channels: 3, background: white } }).composite([{ input: bar, left: 100, top: 80 }, { input: bar, left: 160, top: 120 }]).png().toBuffer() // a diagonal pair: white corners top-right and bottom-left
    const out = await sharp(await makeLogo(dark)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => (y * out.info.width + x) * 4
    expect(out.data[at(out.info.width - 1, 0) + 3]).toBe(0) // the white corner is transparent
    expect(out.data[at(5, 5) + 3]).toBeGreaterThanOrEqual(240) // the mark itself is (all but) opaque
  })
})
