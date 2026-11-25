import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { ARCH, ARROW, EMBLEM_AXIS_X, STAR } from '@/lib/brand/emblemPaths'
import { LOADER, LOADER_OFFSET, loaderDirection, loaderTilt, loaderTravel, STAR_CENTRE } from '@/lib/brand/loaderSpec'
import { LangContext } from '@/lib/i18n/LangProvider'
import { translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))

const { default: BrandLoader } = await import('@/components/ui/BrandLoader')

const WEB = 'components/ui/BrandLoader.tsx'
const NATIVE = 'landly-mobile/src/components/BrandLoader.tsx'
const SPEC = 'lib/brand/loaderSpec.ts'
const css = readFileSync('app/globals.css', 'utf8')
const read = (p: string) => readFileSync(p, 'utf8')

function render(element: ReturnType<typeof createElement>, lang: Lang = 'en') {
  const t = (key: TranslationKey) => translations[lang][key]
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl: lang === 'he' } }, element))
}

// Every coordinate pair of a path made of absolute M/L/C commands (the emblem's own tessellated outlines).
function bounds(d: string) {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const xs = n.filter((_, i) => i % 2 === 0)
  const ys = n.filter((_, i) => i % 2 === 1)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

describe('brand loader geometry', () => {
  it('puts the Star of David on the exact centre of the box', () => {
    expect(STAR_CENTRE.x).toBe(EMBLEM_AXIS_X)
    expect(STAR_CENTRE.x + LOADER_OFFSET.x).toBe(LOADER.half)
    expect(STAR_CENTRE.y + LOADER_OFFSET.y).toBe(LOADER.half)
    expect(LOADER.size).toBe(LOADER.half * 2)
  })

  it('centres on the star the paths actually draw, not on the arrow-heavy bounding box', () => {
    const star = bounds(STAR.light)
    expect((star.minX + star.maxX) / 2).toBeCloseTo(STAR_CENTRE.x, 0)
    // Vertically the hexagram's lower apex is cut away by the arch's clearance, so its centre is its circumcentre:
    // the upright triangle's apex sits one circumradius (253.7, see emblemPaths.ts) above it.
    expect(STAR_CENTRE.y - star.minY).toBeCloseTo(253.7, 0)
    // The whole emblem is wider to the right (the arrow), so its own box centre sits well off the star's.
    const all = [STAR.light, ARCH.light, ARROW.light].map(bounds)
    const boxCentreX = (Math.min(...all.map((b) => b.minX)) + Math.max(...all.map((b) => b.maxX))) / 2
    expect(boxCentreX - STAR_CENTRE.x).toBeGreaterThan(20)
  })

  it('keeps every part of the emblem inside the square box, so nothing is clipped', () => {
    for (const d of [STAR.light, STAR.dark, ARCH.light, ARCH.dark, ARROW.light, ARROW.dark]) {
      const b = bounds(d)
      expect(b.minX + LOADER_OFFSET.x).toBeGreaterThanOrEqual(0)
      expect(b.maxX + LOADER_OFFSET.x).toBeLessThanOrEqual(LOADER.size)
      expect(b.minY + LOADER_OFFSET.y).toBeGreaterThanOrEqual(0)
      expect(b.maxY + LOADER_OFFSET.y).toBeLessThanOrEqual(LOADER.size)
    }
  })

  it('starts and ends every sweep with the band wholly off the mark, so the loop has no intro or outro', () => {
    const { from, to } = loaderTravel(false)
    const reach = Math.hypot(LOADER.half, LOADER.half) // the box's half-diagonal bounds the mark
    const bandHalf = LOADER.band.width / 2
    expect(Math.abs(from) - bandHalf).toBeGreaterThan(reach * 0.6)
    expect(from).toBe(-to)
    expect(LOADER.sweepShare).toBeLessThan(1)
  })
})

describe('direction', () => {
  it('flips the tilt and the sweep in RTL, never the mark', () => {
    expect(loaderDirection(false)).toBe(1)
    expect(loaderDirection(true)).toBe(-1)
    expect(loaderTilt(false)).toBe(-LOADER.band.tiltDeg)
    expect(loaderTilt(true)).toBe(LOADER.band.tiltDeg)
    expect(loaderTravel(true)).toEqual({ from: LOADER.travel, to: -LOADER.travel })
    expect(loaderTravel(false)).toEqual({ from: -LOADER.travel, to: LOADER.travel })
  })

  it('mirrors on the web from [dir=rtl] in CSS and on native from the app language', () => {
    expect(css).toContain('[dir="rtl"] .brand-loader{--bl-dir:-1;}')
    expect(css).toContain('.brand-loader__tilt{transform:rotate(calc(var(--bl-dir) * var(--bl-tilt)));}')
    expect(css).toContain('translateX(calc(var(--bl-dir) * var(--bl-travel) * -1))')
    const native = read(NATIVE)
    expect(native).toContain('const { t, isRtl } = useLang()')
    expect(native).toContain('loaderTilt(isRtl)')
    expect(native).toContain('loaderTravel(isRtl)')
    // The web markup never transforms the emblem horizontally.
    expect(render(createElement(BrandLoader), 'he')).not.toMatch(/scale\(-1|scaleX\(-1/)
  })
})

describe('Reduce Motion', () => {
  it('drops the band and only breathes in opacity on the web', () => {
    const block = css.slice(css.indexOf('.brand-loader{--bl-dir'))
    expect(block).toContain('@media (prefers-reduced-motion: reduce){')
    expect(block).toMatch(/prefers-reduced-motion: reduce\)\{\s*\.brand-loader__band\{animation:none;opacity:0;\}/)
    expect(block).toContain('.brand-loader{animation:brand-loader-breathe var(--bl-breathe) ease-in-out infinite alternate;}')
  })

  it('does the same on native: no band, an opacity breathe, no sweep', () => {
    const native = read(NATIVE)
    expect(native).toContain('useReducedMotion()')
    expect(native).toContain('{!reduced && (')
    expect(native).toContain('LOADER.breatheFrom')
  })

  it('feeds the CSS the spec’s own numbers, and the keyframe rest matches the spec', () => {
    const web = read(WEB)
    for (const v of ['cycleMs', 'travel', 'breatheMs', 'breatheFrom', 'showDelayMs', 'fadeInMs']) expect(web, v).toContain(`LOADER.${v}`)
    expect(css).toContain(`82%,100%{transform:translateX(calc(var(--bl-dir) * var(--bl-travel)));}`)
    expect(Math.round(LOADER.sweepShare * 100)).toBe(82)
  })
})

describe('the web component', () => {
  it('is one status with a localized label, hiding the drawing from screen readers', () => {
    const en = render(createElement(BrandLoader))
    expect(en.match(/role="status"/g)).toHaveLength(1)
    expect(en).toContain(`<span class="sr-only">${translations.en.bizdash_loading}</span>`)
    expect(en).toContain('aria-hidden="true"')
    expect(render(createElement(BrandLoader), 'he')).toContain(`<span class="sr-only">${translations.he.bizdash_loading}</span>`)
    expect(render(createElement(BrandLoader, { label: 'Confirming' }))).toContain('<span class="sr-only">Confirming</span>')
  })

  it('draws the real emblem, clipped to its silhouette, in the star-centred square box', () => {
    const html = render(createElement(BrandLoader, { size: 'lg' }))
    expect(html).toContain(`width="${LOADER.sizes.lg}" height="${LOADER.sizes.lg}"`)
    expect(html).toContain(`viewBox="0 0 ${LOADER.size} ${LOADER.size}"`)
    expect(html).toContain(`translate(${LOADER_OFFSET.x} ${LOADER_OFFSET.y})`)
    for (const d of [STAR.light, ARCH.light, ARROW.light]) expect(html).toContain(`d="${d}"`)
    expect(html.match(/<clipPath/g)).toHaveLength(1)
    expect(html).toContain(LOADER.pale.light)
  })

  it('gives each loader its own clip and gradient ids, so two on a page never collide', () => {
    const html = render(createElement('div', null, createElement(BrandLoader), createElement(BrandLoader)))
    const ids = [...html.matchAll(/ id="(landlyLoader[A-Za-z]+[^"]*)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
  })

  it('offers the three sizes and a centred fill', () => {
    expect(LOADER.sizes).toEqual({ sm: 56, md: 112, lg: 212 })
    expect(render(createElement(BrandLoader))).toContain(`width="${LOADER.sizes.md}"`)
    expect(render(createElement(BrandLoader, { fill: true }))).toContain('items-center justify-center')
  })
})

describe('where it replaces the full-area spinners', () => {
  it('uses it on every Expo screen that waited on an ActivityIndicator', () => {
    for (const screen of ['offer/[offerId].tsx', 'voucher/[voucherId].tsx', 'order-success/[orderId].tsx', 'checkout/[offerId].tsx']) {
      const src = read(`landly-mobile/src/app/${screen}`)
      expect(src, screen).toContain("import BrandLoader from '../../components/BrandLoader'")
      expect(src, screen).not.toContain('ActivityIndicator')
    }
  })

  it('uses it on the web voucher, checkout and offer-list waits', () => {
    expect(read('app/member/vouchers/[voucherId]/page.tsx')).not.toContain('animate-spin')
    expect(read('app/member/vouchers/[voucherId]/page.tsx')).toContain('<BrandLoader size="lg" fill />')
    expect(read('app/checkout/page.tsx')).toContain('<BrandLoader size="lg" label={t(\'checkout_loading\')} />')
    const list = read('components/discover/OfferListView.tsx')
    expect(list).toContain('<BrandLoader size="md" />')
    expect(list).not.toContain('LoaderCircle')
  })

  it('brands the session gate where the member pages used to show a blank canvas', () => {
    for (const page of ['app/member/page.tsx', 'app/profile/page.tsx', 'app/wishlist/page.tsx', 'app/order-success/page.tsx']) {
      const src = read(page)
      expect(src, page).toContain('<BrandLoader size="lg" fill />')
      expect(src, page).not.toContain('<div className="below-header member-canvas" />')
    }
  })

  it('leaves the list skeletons, pull-to-refresh and the inline button spinners alone', () => {
    expect(read('components/ui/Skeleton.tsx')).not.toContain('BrandLoader')
    expect(read('landly-mobile/src/components/Button.tsx')).toContain('ActivityIndicator')
    expect(read('landly-mobile/src/app/(tabs)/perks.tsx')).toContain('RefreshControl')
  })
})

describe('hygiene and environment parity', () => {
  const files = [SPEC, WEB, NATIVE]

  it('has no emoji anywhere in the loader', () => {
    for (const f of files) expect(read(f), f).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(css.slice(css.indexOf('.brand-loader{--bl-dir'))).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('is the same on DEV (landly-dev) and PROD (landly-be752): no environment, network or Firebase code', () => {
    for (const f of files) {
      const src = read(f)
      expect(src, f).not.toMatch(/process\.env|landly-dev|landly-be752|golandly\.com|fetch\(|firebase/i)
    }
    expect(read(SPEC).match(/^import .*$/gm)).toEqual(["import { EMBLEM_AXIS_X, EMBLEM_COLORS } from './emblemPaths'"])
  })

  it('reuses the real emblem vectors and no raster or remote asset', () => {
    for (const f of [WEB, NATIVE]) {
      const src = read(f)
      expect(src, f).toMatch(/brand\/emblemPaths/)
      expect(src, f).not.toMatch(/\.png|\.jpg|\.webp|https?:\/\//)
    }
  })
})
