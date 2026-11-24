import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { check, CORNER_CLEARANCE, FILES, ICON_FILL, MASKABLE_RADIUS, PLAY_MARGIN, PLAY_SIZE, SAFE_RADIUS, layouts } from '../../scripts/generate-app-icons.mjs'

// The icons are rendered from the vector emblem by scripts/generate-app-icons.mjs;
// these measure the committed files, so a hand-edited or stale icon fails here.
describe('app icons', async () => {
  const result = await check()

  it('pass every rule of the generator, and match what it renders', () => {
    expect(result.failures).toEqual([])
  })

  it("put the Star of David's apex and the bottom arch on the vertical centre line x = 512", async () => {
    const { icon, play, adaptive } = result
    const { ios, android, playStore } = await layouts()
    expect(Math.abs(ios.apexX - 512)).toBeLessThanOrEqual(2)
    expect(Math.abs(ios.feetX - 512)).toBeLessThanOrEqual(3)
    // The axis, not the box, is centred: the arrow reaches out to the right, so the box sits right of the centre line by `offset`.
    expect(ios.offset).toBeGreaterThan(0)
    expect(Math.abs(icon.margins.left - icon.margins.right - 2 * ios.offset)).toBeLessThanOrEqual(3)
    expect(Math.abs(play.margins.left - play.margins.right - 2 * playStore.offset)).toBeLessThanOrEqual(3)
    expect(Math.abs(icon.margins.top - icon.margins.bottom)).toBeLessThanOrEqual(2)
    expect(Math.abs(play.margins.top - play.margins.bottom)).toBeLessThanOrEqual(2)
    // Android shares the axis (and so the same centre x as iOS, in viewBox units).
    expect(android.center.x).toBeCloseTo(ios.center.x, 6)
    expect(adaptive.margins.left).toBeGreaterThan(adaptive.margins.right)
  })

  it('fill about 74.5% of the iOS icon, on an opaque square, clear of the rounded corners', () => {
    const { icon } = result
    expect([icon.width, icon.height]).toEqual([1024, 1024])
    expect(icon.opaque).toBe(true)
    expect(icon.fill).toBeGreaterThanOrEqual(0.73)
    expect(icon.fill).toBeLessThanOrEqual(0.76)
    expect(Math.abs(icon.fill - ICON_FILL)).toBeLessThan(0.01)
    expect(Math.abs(icon.margins.top - icon.margins.bottom)).toBeLessThanOrEqual(2)
    expect(icon.cornerClearance).toBeGreaterThanOrEqual(CORNER_CLEARANCE)
  })

  it("keep Android's adaptive foreground transparent and inside the 66dp safe circle, as large as fits", async () => {
    const { adaptive } = result
    const meta = await sharp(FILES.adaptive).metadata()
    expect(meta.hasAlpha).toBe(true)
    expect(adaptive.background[3]).toBe(0)
    expect(adaptive.maxRadius).toBeLessThanOrEqual(SAFE_RADIUS)
    expect(adaptive.maxRadius).toBeGreaterThan(SAFE_RADIUS - 6)
    expect(adaptive.fill).toBeGreaterThan(0.40)
  })

  it('keeps the web maskable icon inside its 40% safe circle, full-bleed and opaque', () => {
    const { maskable } = result
    expect([maskable.width, maskable.height]).toEqual([512, 512])
    expect(maskable.opaque).toBe(true)
    expect(maskable.maxRadius).toBeLessThanOrEqual(MASKABLE_RADIUS * 512)
  })

  it("sits the Android foreground on app.json's white adaptive background", async () => {
    const config = JSON.parse(await readFile('landly-mobile/app.json', 'utf8'))
    expect(config.expo.android.adaptiveIcon).toEqual(
      expect.objectContaining({ foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#FFFFFF' })
    )
  })

  it('gives Google Play a 512x512 32-bit sRGB PNG, opaque white, with at least 5% clear on every side', async () => {
    const { play } = result
    expect([play.width, play.height]).toEqual([PLAY_SIZE, PLAY_SIZE])
    expect(play.meta.format).toBe('png')
    expect(play.meta.channels).toBe(4)
    expect(play.meta.depth).toBe('uchar')
    expect(play.meta.space).toBe('srgb')
    expect(play.meta.icc).toBeTruthy()
    expect(play.opaque).toBe(true)
    expect(play.background).toEqual([255, 255, 255, 255])
    expect(play.minMargin).toBeGreaterThanOrEqual(PLAY_MARGIN)
    expect(Math.abs(play.margins.top - play.margins.bottom)).toBeLessThanOrEqual(2)
    // Play's limit is 1024KB.
    expect((await readFile(FILES.playStore)).byteLength).toBeLessThan(1024 * 1024)
  })
})
