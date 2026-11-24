import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// The app resolves @shared/* to ../lib (tsconfig paths, metro.config.js); the root vitest config doesn't.
vi.mock('@shared/offers/dealImage', () => import('@/lib/offers/dealImage'))
const { brandImageFile, secureImageUrl } = await import('../src/lib/imageSource')
const read = (p: string) => readFileSync(p, 'utf8')

describe('native Raayonit image resolution', () => {
  it('finds a bundled brand image whatever the host, slash, query or case', () => {
    expect(brandImageFile('/images/raayonit-brands/231.png')).toBe('231.png')
    expect(brandImageFile('http://localhost:3000/images/raayonit-brands/L-9184.JPG?v=2')).toBe('l-9184.jpg')
    expect(brandImageFile('https://golandly.com/images/raayonit-brands/45.jpg#x')).toBe('45.jpg')
    expect(brandImageFile('https://cdn.example/pizza.jpg')).toBeNull()
  })
  it('upgrades http, encodes Hebrew and spaces, and rejects relative paths as web links', () => {
    expect(secureImageUrl('http://x.co.il/תמונה אחת.jpg')).toBe('https://x.co.il/%D7%AA%D7%9E%D7%95%D7%A0%D7%94%20%D7%90%D7%97%D7%AA.jpg')
    expect(secureImageUrl('https://x.co.il/a%20b.jpg')).toBe('https://x.co.il/a%20b.jpg')
    expect(secureImageUrl('/images/raayonit-brands/1.png')).toBe('')
  })
  it('bundles every image the site serves, and every image a card can point at', () => {
    const web = readdirSync('public/images/raayonit-brands').sort()
    expect(readdirSync('landly-mobile/assets/raayonit-brands').sort()).toEqual(web)
    const map = read('landly-mobile/src/lib/raayonitBrandImages.ts')
    for (const f of web) expect(map, f).toContain(`'${f}': require('../../assets/raayonit-brands/${f}')`)
    // What the sync writes into imageUrl / businessLogoUrl is {origin}/images/raayonit-brands/{logoFile}: every one resolves.
    const snap = JSON.parse(read('lib/inventory/raayonitCatalog.snapshot.json')) as { brands: { logoFile?: string }[] }
    for (const b of snap.brands) if (b.logoFile) { expect(web, b.logoFile).toContain(b.logoFile); expect(existsSync(`landly-mobile/assets/raayonit-brands/${b.logoFile}`)).toBe(true) }
  })
  it('resolves every brand picture through brandImageSource, never a raw stored link', () => {
    for (const f of ['BrandLogoWall', 'FindBusinessSheet']) {
      const src = read(`landly-mobile/src/components/${f}.tsx`)
      expect(src, f).toContain('brandImageSource(')
      expect(src, f).not.toMatch(/<BrandMedia source=\{(?:o|offer)\.imageUrl/)
    }
    expect(read('landly-mobile/src/lib/raayonitBrandImages.ts')).toContain('export function brandImageSource')
  })
  it('keeps the website logo wall tiles eager so a mobile browser never leaves them blank', () => {
    const wall = read('components/home/BrandLogoWall.tsx')
    const tiles = wall.match(/<BrandMedia [^>]*\/>/g) ?? []
    expect(tiles).toHaveLength(2)
    for (const t of tiles) expect(t).toContain(' eager')
  })
})
