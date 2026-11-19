import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { applyCanonical, NO_IMAGE_BRAND_KEYS } from '@/lib/inventory/raayonitCanonicalCatalog'
import { bundledCatalog } from '@/lib/inventory/raayonitCatalogSync'

describe('brands that never get an image of their own', () => {
  it('lists Torta Loca (its only image was another restaurant\'s logo)', () => {
    expect(NO_IMAGE_BRAND_KEYS).toContain('l-7902')
  })
  it('strips a stale logo reference whatever the snapshot says', () => {
    const stale = [{ key: 'l-7902', nameHe: 'Torta Loca', nameEn: '', category: '', logoUrl: 'https://x/y.png', siteUrl: '', restrictions: [], methods: [], branches: [], logoFile: 'l-7902.png', logoKind: 'logo' as const }]
    const [out] = applyCanonical(stale) as (typeof stale)[number][]
    expect(out!.logoFile).toBeUndefined()
    expect(out!.logoKind).toBeUndefined()
    expect(out!.logoUrl).toBe('')
  })
  it('has no bundled file, no snapshot reference and no native map entry', () => {
    expect(bundledCatalog().find((b) => b.key === 'l-7902')?.logoFile).toBeUndefined()
    for (const dir of ['public/images/raayonit-brands', 'landly-mobile/assets/raayonit-brands']) expect(existsSync(`${dir}/l-7902.png`)).toBe(false)
    expect(readFileSync('landly-mobile/src/lib/raayonitBrandImages.ts', 'utf8')).not.toContain('l-7902')
  })
})
