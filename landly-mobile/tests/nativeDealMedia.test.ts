import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(p, 'utf8')

// The Expo twin of components/discover/DealMedia.tsx: a landscape photo fills the frame, a square or portrait one is shown whole.
describe('native DealMedia', () => {
  const media = read('landly-mobile/src/components/DealMedia.tsx')

  it('judges the photo with the shared rule (1.2) once its size is known', () => {
    expect(media).toContain("import { dealPhotoFit } from '@shared/offers/imageFit'")
    expect(media).toContain("const whole = role === 'photo' && dealPhotoFit(size) === 'contain'")
  })

  it('shows a square or portrait photo whole, over a blurred copy with the #F4F6F9 studio tint', () => {
    expect(media).toContain("resizeMode={whole ? 'contain' : 'cover'}")
    expect(media).toContain('{whole && <Image source={{ uri }} style={styles.backdrop} resizeMode="cover" blurRadius={24}')
    expect(media).toContain('{whole && <View pointerEvents="none" style={styles.studio} />}')
    // #F4F6F9 = rgb(244, 246, 249).
    expect(media).toContain("backgroundColor: 'rgba(244, 246, 249, 0.45)'")
  })

  // The bug: the blurred copy and the photo were both in normal flow at 100% height, so the blurred one filled the frame and pushed the crisp photo out of it.
  it('stacks four absolute layers: blurred 0, tint 1, crisp photo 2, overlays 10', () => {
    const style = (name: string) => media.match(new RegExp(`${name}: \\{([^}]*)\\}`))![1]!
    for (const [name, z] of [['backdrop', 0], ['studio', 1], ['photo', 2], ['overlays', 10]] as const) {
      expect(style(name), name).toContain('...StyleSheet.absoluteFill')
      expect(style(name), name).toContain(`zIndex: ${z}`)
    }
    // Neither the foreground nor anything but the backdrop is blurred, and nothing keeps the old in-flow "fill" style.
    const photo = media.match(/<Image source=\{\{ uri \}\} style=\{styles\.photo\}[^>]*>/)![0]
    expect(photo).not.toContain('blurRadius')
    expect(photo).toContain("resizeMode={whole ? 'contain' : 'cover'}")
    expect(media.match(/blurRadius/g)).toHaveLength(2) // the comment's mention excluded below
    expect(media).not.toContain('styles.fill')
    // The backdrop comes first in the tree, the photo last, so the crisp one is on top even where zIndex is ignored.
    expect(media.indexOf('styles.backdrop')).toBeLessThan(media.indexOf('styles.studio'))
    expect(media.indexOf('styles.studio')).toBeLessThan(media.indexOf('styles.photo'))
  })

  it('lifts the overlays (pills, heart, merchant badge) above the photo without taking its touches', () => {
    expect(media).toContain('<View pointerEvents="box-none" style={styles.overlays}>')
    expect(media).toMatch(/<View pointerEvents="box-none" style=\{styles\.overlays\}>\s*\{children\}/)
  })

  it('keeps one foreground picture, the one that reports its size and failure', () => {
    expect(media.match(/onLoad=\{onLoad\}/g)).toHaveLength(1)
    expect(media.match(/onError=\{onError\}/g)).toHaveLength(1)
  })

  it('lets the offer screen reshape the frame for a whole photo, and leaves the cards on their ratio', () => {
    expect(media).toContain('const frameRatio = whole && containRatio ? containRatio : ratio')
    expect(media).toContain('const frameMax = whole && containRatio ? containMaxHeight : maxHeight')
    expect(media).toContain('Math.min(width / frameRatio, frameMax ?? Infinity)')
    const offer = read('landly-mobile/src/app/offer/[offerId].tsx')
    expect(offer).toContain('containRatio={4 / 5} containMaxHeight={380}')
    expect(read('landly-mobile/src/components/OfferCard.tsx')).not.toContain('containRatio')
  })

  it('reports the loaded size from the hook, keyed on the URL', () => {
    expect(read('landly-mobile/src/lib/useDealImage.ts')).toContain('size: loaded?.uri === uri ? { width: loaded.width, height: loaded.height } : null')
  })

  it('leaves the adaptive logo badge alone', () => {
    const badge = read('landly-mobile/src/components/MerchantBadge.tsx')
    expect(badge).toContain('const FIXED = { height: 44, minWidth: 64, maxWidth: 124')
  })
})
