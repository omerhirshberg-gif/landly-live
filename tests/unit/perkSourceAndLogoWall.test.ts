import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parsePerkSource } from '@/lib/perks/perksFilter'
import { logoWallOffers } from '@/lib/home/logoWall'
import { translations } from '@/lib/i18n/translations'
import type { OfferDocument } from '@/lib/firebase/offers'

const offer = (id: string, businessName: string, imageUrl: string, logoKind?: string) => ({ id, businessName, imageUrl, logoKind }) as unknown as OfferDocument

describe('Explore Perks source segment (?src=)', () => {
  it('reads all, landly and raayonit; anything else is all', () => {
    expect(parsePerkSource('landly')).toBe('landly')
    expect(parsePerkSource('raayonit')).toBe('raayonit')
    for (const raw of [null, undefined, '', 'all', 'x']) expect(parsePerkSource(raw)).toBe('all')
  })

  it('Explore Perks is GoLandly perks only: no source segment, no Raayonit card or chains directory (web and native)', () => {
    const web = readFileSync('app/categories/page.tsx', 'utf8')
    const native = readFileSync('landly-mobile/src/app/(tabs)/perks.tsx', 'utf8')
    for (const [path, src] of [['web', web], ['native', native]]) {
      expect(src, path).not.toContain('SourceSegment')
      expect(src, path).not.toContain('RaayonitTab')
      expect(src, path).not.toContain('GiftCardBand')
    }
    // While there are no GoLandly perks: the entry row and the businesses available now lead, then a hairline and the categories (both platforms).
    expect(native).toContain("list.push({ key: 'entry', type: 'entry' }, { key: 'live', type: 'live' })")
    expect(native).toContain("list.push({ key: 'browse', type: 'browse' })")
    for (const [path, src] of [['web', web], ['native', native]]) {
      for (const part of ['<LiveChainsSection', '<RaayonitPromoStrip']) expect(src, `${path} ${part}`).toContain(part)
      expect(src, path).not.toContain('PerksSoonCard')
    }
  })

  it('has its labels and the gift card copy in all five languages', () => {
    for (const lang of ['en', 'he', 'ru', 'fr', 'es'] as const) {
      for (const key of ['perks_src_all', 'perks_src_landly', 'perks_src_raayonit', 'perks_explore_title', 'gift_valid_chains', 'home_logo_wall_title'] as const) expect(translations[lang][key].length, `${lang}.${key}`).toBeGreaterThan(0)
      expect(translations[lang].gift_valid_chains).toContain('{count}+')
    }
    expect(translations.en.products_title).toBe('Gift cards')
    expect(translations.he.products_title).toBe('כרטיסי מתנה')
  })
})

describe('logo wall tiles', () => {
  it('keeps real logos only, one per business, capped at 24', () => {
    const list = [offer('a', 'A', 'u'), offer('b', 'B', 'u', 'photo'), offer('c', 'a', 'u'), offer('d', 'D', '')]
    expect(logoWallOffers(list).map((o) => o.id)).toEqual(['a'])
    const many = Array.from({ length: 40 }, (_, i) => offer(`o${i}`, `Biz${i}`, 'u'))
    expect(logoWallOffers(many)).toHaveLength(24)
  })
})
