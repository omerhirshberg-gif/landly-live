import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { check, CORNER_CLEARANCE, FILES, ICON_FILL, MASK_RADIUS, OPTICAL_SHIFT, PLAY_MARGIN, PLAY_SIZE } from '../../scripts/generate-app-icons.mjs'

// The icons are rendered from the vector emblem by scripts/generate-app-icons.mjs;
// these measure the committed files, so a hand-edited or stale icon fails here.
describe('app icons', async () => {
  const result = await check()

  it('pass every rule of the generator, and match what it renders', () => {
    expect(result.failures).toEqual([])
  })

  it('centre the whole emblem, arrow included, not the Star of David alone', () => {
    const { icon, play, adaptive } = result
    // iOS and Google Play centre the glyph's box vertically, and nudge it right by OPTICAL_SHIFT so its weight reads as centred.
    expect(Math.abs(icon.margins.left - icon.margins.right - 2 * OPTICAL_SHIFT)).toBeLessThanOrEqual(3)
    expect(Math.abs(play.margins.left - play.margins.right - OPTICAL_SHIFT)).toBeLessThanOrEqual(3)
    expect(Math.abs(play.margins.top - play.margins.bottom)).toBeLessThanOrEqual(2)
    // Android centres an optical point between box and circle, so the box sits within a few pixels of the middle.
    expect(Math.abs(adaptive.margins.left - adaptive.margins.right)).toBeLessThanOrEqual(8)
    expect(Math.abs(adaptive.margins.top - adaptive.margins.bottom)).toBeLessThanOrEqual(8)
  })

  it('fill about 72% of the iOS icon, on an opaque square, clear of the rounded corners', () => {
    const { icon } = result
    expect([icon.width, icon.height]).toEqual([1024, 1024])
    expect(icon.opaque).toBe(true)
    expect(icon.fill).toBeGreaterThanOrEqual(0.70)
    expect(icon.fill).toBeLessThanOrEqual(0.74)
    expect(Math.abs(icon.fill - ICON_FILL)).toBeLessThan(0.005)
    expect(Math.abs(icon.margins.top - icon.margins.bottom)).toBeLessThanOrEqual(2)
    expect(icon.cornerClearance).toBeGreaterThanOrEqual(CORNER_CLEARANCE)
  })

  it("keep Android's adaptive foreground transparent and inside the 72dp launcher-mask circle, as large as fits, and visibly bigger than a 66dp-safe-zone icon", async () => {
    const { adaptive } = result
    const meta = await sharp(FILES.adaptive).metadata()
    expect(meta.hasAlpha).toBe(true)
    expect(adaptive.background[3]).toBe(0)
    expect(adaptive.maxRadius).toBeLessThanOrEqual(MASK_RADIUS)
    expect(adaptive.maxRadius).toBeGreaterThan(MASK_RADIUS - 6)
    expect(adaptive.fill).toBeGreaterThan(0.46)
  })

  it("sits the Android foreground on app.json's white adaptive background", async () => {
    const config = JSON.parse(await readFile('landly-mobile/app.json', 'utf8'))
    expect(config.expo.android.adaptiveIcon).toEqual(
      expect.objectContaining({ foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#FFFFFF' })
    )
  })

  it('gives Google Play a 512x512 32-bit sRGB PNG, opaque white, with 15% clear on every side', async () => {
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
