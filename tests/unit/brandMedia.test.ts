import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')

describe('full-bleed brand media', () => {
  it('draws a logo over a blurred copy of itself, with a tint, never on a white box (web and native)', () => {
    const web = read('components/ui/BrandMedia.tsx')
    expect(web).toContain('blur-[3px]')
    expect(web).toContain('z-[1]')
    expect(web).toContain('object-contain')
    expect(web).toContain('object-cover')
    const native = read('landly-mobile/src/components/BrandMedia.tsx')
    expect(native).toContain('blurRadius')
    expect(native).toContain('zIndex: 0')
    expect(native).toContain('zIndex: 1')
    expect(native).toContain('zIndex: 2')
    expect(native).toContain("contentFit=\"contain\"")
    expect(native).toContain("contentFit=\"cover\"")
  })

  it.each([
    'components/raayonit/ChainTile.tsx',
    'components/home/BrandLogoWall.tsx',
    'components/offers/ChainOfferView.tsx',
    'components/discover/DealMedia.tsx',
    'landly-mobile/src/components/ChainTile.tsx',
    'landly-mobile/src/components/BrandLogoWall.tsx',
    'landly-mobile/src/components/ChainOfferView.tsx',
    'landly-mobile/src/components/DealMedia.tsx',
  ])('%s fills its frame through BrandMedia', (path) => {
    expect(read(path)).toContain('<BrandMedia')
  })
})
