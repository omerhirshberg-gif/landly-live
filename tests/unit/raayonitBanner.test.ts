import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BANNER_INTERVAL_MS, BANNER_SLIDES, nextSlide } from '@/lib/home/raayonitBanner'
import { translations } from '@/lib/i18n/translations'

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const KEYS = ['chains_banner_1', 'chains_banner_2', 'chains_banner_3', 'chains_banner_label', 'chains_banner_prev', 'chains_banner_next', 'chains_banner_pause', 'chains_banner_play', 'chains_banner_go']

describe('Raayonit Card banner on Home', () => {
  it('has each photo as WebP in the web and native asset folders, byte-identical, and logged in the licence doc', () => {
    const doc = read('docs/IMAGE_LICENSES.md')
    for (const { photo } of BANNER_SLIDES) {
      const web = readFileSync(new URL(`../../public/images/raayonit-banner/${photo}.webp`, import.meta.url))
      const native = readFileSync(new URL(`../../landly-mobile/assets/raayonit-banner/${photo}.webp`, import.meta.url))
      expect(web.equals(native), photo).toBe(true)
      expect(web.length).toBeLessThan(700_000)
      expect(doc).toContain(`raayonit-banner/${photo}.webp`)
    }
  })
  it('wraps around in both directions and advances every six seconds', () => {
    expect(nextSlide(2, 3)).toBe(0)
    expect(nextSlide(0, 3, -1)).toBe(2)
    expect(BANNER_INTERVAL_MS).toBe(6000)
    expect(BANNER_SLIDES.map((s) => s.photo)).toEqual(['dining', 'spa', 'shopping'])
  })
  it('has every string in all five languages, with the slide counter keeping its placeholders', () => {
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) {
      const dict = translations[lang] as Record<string, string>
      for (const k of KEYS) expect(dict[k], `${lang}.${k}`).toBeTruthy()
      expect(dict.chains_banner_go).toContain('{n}')
      expect(dict.chains_banner_go).toContain('{total}')
    }
  })
  it('opens the Raayonit tab from every slide, stops for Reduce Motion, and has no emoji', () => {
    const web = read('components/perks/RaayonitBanner.tsx')
    const native = read('landly-mobile/src/components/RaayonitBanner.tsx')
    expect(web).toContain('href={RAAYONIT_HUB}')
    expect(web).toContain('prefers-reduced-motion: reduce')
    expect(web).toContain('h-11 w-11')
    expect(native).toContain('router.push(RAAYONIT_HUB)')
    expect(native).toContain('isReduceMotionEnabled')
    expect(web + native).not.toMatch(/\p{Extended_Pictographic}/u)
  })
  it('leads Home with the carousel and Explore with the compact entry row, never a button', () => {
    expect(read('components/home/HomeCategoryRails.tsx')).toContain('<RaayonitBanner />')
    expect(read('landly-mobile/src/app/(tabs)/index.tsx')).toContain("return <RaayonitBanner />")
    expect(read('app/categories/page.tsx')).toMatch(/<RaayonitPromoStrip [^>]*\bentry\b/)
    expect(read('landly-mobile/src/app/(tabs)/perks.tsx')).toContain('<RaayonitPromoStrip offer={flagship} count={chainCount} entry />')
    for (const file of ['components/perks/LiveChainsSection.tsx', 'landly-mobile/src/components/LiveChainsSection.tsx']) expect(read(file)).not.toContain('chains_live_cta')
  })
})

describe('member Home category rail arrows', () => {
  it('ride the heading line instead of taking a row of their own, on member Home only', () => {
    expect(read('components/home/CategoryPhotoRail.tsx')).toContain('onTitle={!contained}')
    expect(read('components/discover/OfferCardRail.tsx')).toContain("'tile-rail-bar tile-rail-bar-up'")
    expect(read('app/globals.css')).toMatch(/\.tile-rail-bar-up\{margin-top:-44px/)
  })
})
