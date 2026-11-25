import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const APP = 'landly-mobile/src/'
// Country flags (regional indicators) in the pre-existing dial-code picker are data, not decoration.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel, out)
    else if (rel.endsWith('.tsx')) out.push(rel)
  }
  return out
}
const nativeFiles = walk(`${APP}components`).concat(walk(`${APP}app`), walk(`${APP}auth`))

describe('native Hebrew RTL: directional layout', () => {
  it('Corner never uses a physical or absolute inset', () => {
    const src = read(`${APP}components/Corner.tsx`)
    expect(src).not.toMatch(/\b(left|right)\s*:/)
    expect(src).toContain('marginStart')
    expect(src).toContain('marginEnd')
  })

  it('no one-sided absolute start/end inset remains outside the allow-list', () => {
    const allow = new Set(['DevEnvironmentBadge.tsx', 'CategoryPhotoRail.tsx', 'ProviderTile.tsx', 'VoucherCover.tsx', 'RaayonitBanner.tsx'])
    const offenders = nativeFiles.filter((f) => {
      if (allow.has(f.split('/').pop() ?? '')) return false
      return /position: 'absolute',(?![^}\n]*\bstart: 0, end: 0)(?![^}\n]*\bend: 0, bottom: 0, start: 0)[^}\n]*\b(start|end): -?\d/.test(read(f))
    })
    expect(offenders).toEqual([])
  })

  it('the Home pass card pins its watermark and glow to the trailing corner and keeps text clear of it', () => {
    const src = read(`${APP}components/ActivePassCard.tsx`)
    expect(src.match(/<Corner at="top-end"/g)?.length).toBe(2)
    expect(src).toContain('MARK_CLEARANCE')
    expect(src).toMatch(/passTop:[^}]*paddingEnd: MARK_CLEARANCE/)
  })

  it('the offer screen pins back, heart, logo and ribbon through Corner', () => {
    const src = read(`${APP}app/offer/[offerId].tsx`)
    expect(src).toContain('<Corner at="top-start" top={6} start={6}>')
    expect(src).toContain('<Corner at="bottom-end"')
    expect(src).toContain('<Corner at="top-end">')
    expect(src).not.toMatch(/back: \{ position: 'absolute'/)
  })
})

describe('native Hebrew RTL: chevrons and arrows', () => {
  it('DirectionalIcon flips by language', () => {
    const src = read(`${APP}components/DirectionalIcon.tsx`)
    expect(src).toContain('flip={isRtl}')
  })

  it('no screen draws a chevron or arrow with plain LineIcon', () => {
    const offenders = nativeFiles.filter((f) => /<LineIcon[^>]*name="(chevron|arrow)(Start|End)"/.test(read(f)))
    expect(offenders).toEqual([])
  })

  it('"Browse all chains" and the pass CTA use DirectionalIcon', () => {
    expect(read(`${APP}components/BrandStrip.tsx`)).toContain('<DirectionalIcon')
    expect(read(`${APP}components/ActivePassCard.tsx`)).toContain('<DirectionalIcon name="arrowEnd"')
  })
})

describe('native Hebrew RTL: rails and inputs', () => {
  it('horizontal rails anchor at the start through useRailStart', () => {
    for (const f of ['PerkReach', 'BranchStrip', 'BrandStrip']) expect(read(`${APP}components/${f}.tsx`)).toContain('useRailStart')
    expect(read(`${APP}components/BranchStrip.tsx`).match(/useRailStart/g)!.length).toBeGreaterThanOrEqual(3)
  })

  it('TextField right-aligns in Hebrew even for left-to-right values', () => {
    expect(read(`${APP}components/TextField.tsx`)).toContain("textAlign: isRtl ? 'right' : 'left'")
  })
})

describe('native Hebrew RTL: text sits at the start edge', () => {
  const appText = read(`${APP}components/AppText.tsx`)

  it('AppText never sets textAlign "right" or "left" for Hebrew (iOS mirrors them under the root direction)', () => {
    expect(appText).toContain("textAlign: 'auto'")
    expect(appText).not.toMatch(/textAlign: isRtl \? 'right'/)
    expect(appText).toContain("writingDirection: ltr && !plain ? 'ltr' : 'rtl'")
    expect(appText).toContain("writingDirection: 'auto', textAlign: 'auto'")
  })

  it('a left-to-right value in Hebrew is isolated, not left-aligned', () => {
    expect(appText).toContain('\\u2066')
    expect(appText).toContain('\\u2069')
  })

  it('admin content stays flush right on a Hebrew screen whatever its own direction', () => {
    expect(read(`${APP}components/ContentText.tsx`)).toContain("isRtl ? { writingDirection: 'rtl', textAlign: 'auto' }")
  })

  it('the segmented control pill is anchored at the start edge and travels the other way in Hebrew', () => {
    const src = read(`${APP}components/SegmentedControl.tsx`)
    expect(src).toMatch(/pill: \{[^}]*\bstart: 0/s)
    expect(src).not.toMatch(/pill: \{[^}]*\bleft: 0/s)
    expect(src).toContain('isRtl ? -index : index')
  })

  it('the branch accent stripe is a logical border', () => {
    expect(read(`${APP}components/BranchStrip.tsx`)).toContain('borderStartWidth: 4')
  })

  it('short rails still start at the start edge', () => {
    for (const f of ['BranchStrip', 'PerkReach', 'BrandStrip']) expect(read(`${APP}components/${f}.tsx`)).toContain("minWidth: '100%'")
  })

  it('the iOS tab bar keeps the English order: Home far left, Profile far right', () => {
    expect(read(`${APP}app/(tabs)/_layout.tsx`)).toContain("unstable_nativeProps={{ direction: 'ltr' }}")
  })
})

describe('web Hebrew RTL', () => {
  it('typed values sit at the start edge in Hebrew', () => {
    expect(read('app/globals.css')).toMatch(/\[dir="rtl"\] \.inp-consumer:is[^{]*\{text-align:right;\}/)
  })

  it('the Raayonit hero slab uses a logical edge', () => {
    const src = read('components/raayonit/RaayonitHero.tsx')
    expect(src).toContain('-end-8')
    expect(src).not.toContain('-right-8')
  })
})

describe('no emojis in the touched sources', () => {
  it('has none', () => {
    const files = [...nativeFiles, 'components/raayonit/RaayonitHero.tsx']
    expect(files.filter((f) => EMOJI.test(read(f)))).toEqual([])
  })
})

describe('native Hebrew RTL: sheets, rails and alignment', () => {
  it('opens a screen from a sheet only after the sheet has dismissed', () => {
    const src = read(`${APP}lib/openAfterSheet.ts`)
    expect(src).toMatch(/dismiss\(\)\s*\n\s*setTimeout\(open/)
    expect(read(`${APP}components/ChainTile.tsx`)).toContain('openAfterSheet(dismiss')
    expect(read(`${APP}components/RaayonitCategorySheet.tsx`)).toContain('dismiss={onClose}')
    expect(read(`${APP}components/BrandStrip.tsx`)).toContain('openAfterSheet(onClose')
    expect(read(`${APP}components/FindBusinessSheet.tsx`)).toContain('openAfterSheet(onClose')
  })
  it('never pushes a route directly from inside a Modal handler', () => {
    expect(read(`${APP}components/BrandStrip.tsx`)).not.toMatch(/onClose\(\)\s*;?\s*router\.push/)
  })
  it('the native brand rail has a single show-all button, below the rail', () => {
    const src = read(`${APP}components/BrandStrip.tsx`)
    expect(src).not.toContain("t('brands_show_all')")
    expect(src.match(/brands_show_all_cta/g)).toHaveLength(1)
    expect(src).toContain('useRailStart')
  })
  it('the web brand strip drops the duplicate link unless compact', () => {
    const src = read('components/offers/BrandStrip.tsx')
    expect(src).toMatch(/\{compact && \(\s*<button[\s\S]*?\{t\('brands_show_all'\)/)
  })
  it('Hebrew text and content are flush right through auto alignment, never physical right', () => {
    const app = read(`${APP}components/AppText.tsx`)
    expect(app).toContain("textAlign: 'auto'")
    expect(app).toContain('\\u2068')
    const content = read(`${APP}components/ContentText.tsx`)
    expect(content).toContain("{ writingDirection: 'rtl', textAlign: 'auto' }")
  })
})
