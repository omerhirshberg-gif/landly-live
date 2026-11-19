import { existsSync, readdirSync, readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { firstPhone, normalizeWebsiteUrl, parsePhones } from '@/lib/offers/contact'
import { makePhoto, siteVariants } from '@/lib/inventory/raayonitImageUtils'
import { dealPhotoFit } from '@/lib/offers/imageFit'
import { parseBranches } from '@/lib/offers/branches'


const read = (p: string) => readFileSync(p, 'utf8')

describe('website normalisation', () => {
  it('repairs a doubled scheme, drops tracking and ignores Raayonit', () => {
    expect(normalizeWebsiteUrl('http://https://www.afi-hotels.co.il/vert-lagoon-netanya-hotel?gclid=abc&x=1')).toBe('https://www.afi-hotels.co.il/vert-lagoon-netanya-hotel?x=1')
    expect(normalizeWebsiteUrl('www.mrpretzels.co.il')).toBe('https://www.mrpretzels.co.il/')
    expect(normalizeWebsiteUrl('http://www.raayonit.co.il/')).toBe('')
    expect(normalizeWebsiteUrl('')).toBe('')
    expect(normalizeWebsiteUrl('not a url')).toBe('')
  })
  it('lists the site variants to try', () => {
    expect(siteVariants('https://www.a.co.il/x')).toEqual(expect.arrayContaining(['https://www.a.co.il/x', 'https://www.a.co.il/', 'https://a.co.il/', 'http://a.co.il/']))
  })
})

describe('per-branch phone parsing', () => {
  it('finds every dialable number', () => {
    expect(parsePhones('03-9223392 04-6714430 052-3600232').map((p) => p.href)).toEqual(['tel:03-9223392'.replace(/-/g, ''), 'tel:046714430', 'tel:0523600232'])
    expect(parsePhones('*5692 03-6447031').map((p) => p.display)).toEqual(['*5692', '03-6447031'])
    expect(firstPhone('* 3606')).toEqual({ display: '*3606', href: 'tel:*3606' })
    expect(firstPhone('Whatsapp-03-3767306')?.href).toBe('tel:033767306')
    expect(firstPhone('1-700-70-22-55')?.href).toBe('tel:1700702255')
    expect(parsePhones('')).toEqual([])
    expect(parsePhones(undefined)).toEqual([])
  })
  it('keeps a branch phone on the parsed branch', () => {
    expect(parseBranches([{ name: 'Dizengoff', city: 'TLV', address: 'x', phone: '03-1234567', kosher: false }])[0]?.phone).toBe('03-1234567')
  })
})

describe('makePhoto keeps the photo shape', () => {
  const jpeg = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#a33' } }).jpeg().toBuffer()
  it('does not pad a portrait or square photo to 3:2, so it is shown whole over the blur', async () => {
    for (const [w, h] of [[600, 900], [800, 800]] as const) {
      const out = await sharp(await makePhoto(await jpeg(w, h), w)).metadata()
      expect(dealPhotoFit({ width: out.width!, height: out.height! })).toBe('contain')
      expect(Math.max(out.width!, out.height!)).toBeLessThanOrEqual(720)
    }
  })
  it('crops a landscape photo to 720x480 so it fills its frame', async () => {
    const out = await sharp(await makePhoto(await jpeg(1600, 900), 1600)).metadata()
    expect([out.width, out.height]).toEqual([720, 480])
    expect(dealPhotoFit({ width: 720, height: 480 })).toBe('cover')
  })
})

describe('monogram boxes are gone', () => {
  it('draws no tile when there is no real logo, on the web and in the app', () => {
    for (const f of ['components/discover/MerchantBadge.tsx', 'landly-mobile/src/components/MerchantBadge.tsx']) {
      const src = read(f)
      expect(src, f).toContain('if (!logo) return null')
      expect(src, f).not.toMatch(/initial/i)
    }
  })
})

describe('legacy 150 NIS cleanup', () => {
  it('deletes retired cards nothing points at and archives the rest', async () => {
    const { purgeRetiredRaayonitOffers } = await import('@/lib/inventory/raayonitCatalogSync')
    const deleted: string[] = []
    const updated: string[] = []
    const referenced = new Set(['kept'])
    const db = {
      batch: () => ({ delete: (r: { id: string }) => deleted.push(r.id), update: (r: { id: string }) => updated.push(r.id), commit: async () => {} }),
      collection: (name: string) => ({
        doc: (id: string) => ({ id }),
        where: (_f: string, _o: string, id: string) => ({ limit: () => ({ get: async () => ({ empty: name === 'offers' || !referenced.has(id) }) }) }),
      }),
    }
    const result = await purgeRetiredRaayonitOffers(db as never, ['legacy150', 'kept'])
    expect(result).toEqual({ purged: 1, archived: 1 })
    expect(deleted).toEqual(['legacy150'])
    expect(updated).toEqual(['kept'])
  })
})
