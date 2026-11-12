import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { insetBounds, LOGO_INSET, logoBounds, logoContentBox, NEAR_WHITE } from '@/lib/images/crop'

const read = (p: string) => readFileSync(p, 'utf8')

/** An RGBA picture of width x height, every pixel `fill`, then `paint` over it. */
function picture(width: number, height: number, fill: [number, number, number, number], paint: (set: (x: number, y: number, rgba: [number, number, number, number]) => void) => void) {
  const data = new Uint8ClampedArray(width * height * 4)
  const set = (x: number, y: number, rgba: [number, number, number, number]) => data.set(rgba, (y * width + x) * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) set(x, y, fill)
  paint(set)
  return data
}
const BLACK: [number, number, number, number] = [0, 0, 0, 255]
const WHITE: [number, number, number, number] = [255, 255, 255, 255]
const mark = (set: (x: number, y: number, c: [number, number, number, number]) => void) => {
  for (let y = 4; y < 8; y++) for (let x = 3; x < 17; x++) set(x, y, BLACK)
}

describe('logo margin trim', () => {
  it('trims white bands when three of four corners are white (the odd corner may be transparent)', () => {
    const data = picture(20, 12, WHITE, (set) => {
      mark(set)
      set(0, 0, [0, 0, 0, 0])
    })
    expect(logoBounds(data, 20, 12)).toEqual({ x: 3, y: 4, width: 14, height: 4 })
  })

  it('reads RGB >= 242 as white; a flat 241 paper is still blank light paper', () => {
    expect(NEAR_WHITE).toBe(242)
    const near = picture(20, 12, [242, 242, 242, 255], mark)
    expect(logoBounds(near, 20, 12)).toEqual({ x: 3, y: 4, width: 14, height: 4 })
    const grey = picture(20, 12, [241, 241, 241, 255], mark)
    expect(logoBounds(grey, 20, 12)).toEqual({ x: 3, y: 4, width: 14, height: 4 })
  })

  it('trims a flat light-grey scanner band and a noise line when the corners are not all white (a Matanski)', () => {
    // Top two rows light grey with a darker line across row 2, white below the mark: two grey corners, two white.
    const data = picture(20, 16, WHITE, (set) => {
      for (let x = 0; x < 20; x++) {
        set(x, 0, [217, 217, 217, 255])
        set(x, 1, [212, 212, 212, 255])
        set(x, 2, [195, 195, 195, 255])
      }
      for (let y = 4; y < 10; y++) for (let x = 0; x < 20; x++) set(x, y, BLACK)
    })
    expect(logoBounds(data, 20, 16)).toEqual({ x: 0, y: 4, width: 20, height: 6 })
  })

  it('keeps a pale mark: a light line that varies is content, not paper (only the blank rows below it go)', () => {
    const data = picture(20, 12, [255, 255, 255, 255], (set) => {
      for (let x = 2; x < 18; x++) set(x, 1, [200, 200, 200, 255])
      for (let y = 5; y < 8; y++) for (let x = 3; x < 17; x++) set(x, y, BLACK)
      set(0, 0, [217, 217, 217, 255])
      set(19, 0, [217, 217, 217, 255])
    })
    expect(logoBounds(data, 20, 12)).toEqual({ x: 0, y: 0, width: 20, height: 8 })
  })

  it('leaves a wholly pale image whole', () => {
    const data = picture(10, 6, [230, 230, 230, 255], () => {})
    expect(logoBounds(data, 10, 6)).toEqual({ x: 0, y: 0, width: 10, height: 6 })
  })

  it('keeps 4% of the long edge as breathing room on every side, even past the picture', () => {
    expect(LOGO_INSET).toBe(0.04)
    expect(insetBounds({ x: 0, y: 0, width: 250, height: 133 })).toEqual({ x: -10, y: -10, width: 270, height: 153 })
    const data = picture(20, 12, WHITE, mark)
    expect(logoContentBox(data, 20, 12)).toEqual({ x: 2, y: 3, width: 16, height: 6 })
    expect(logoContentBox(new Uint8ClampedArray(20 * 12 * 4), 20, 12)).toEqual({ x: 0, y: 0, width: 20, height: 12 })
  })
})

describe('the upload and the re-trim script share one rule', () => {
  it('compressLogo trims with logoContentBox and keeps the logo\'s own shape', () => {
    const upload = read('lib/images/compressImage.ts')
    expect(upload).toContain('logoContentBox(probeContext.getImageData')
    expect(upload).toContain('trimmedBox(drawn, content')
  })
  it('the script defaults to a dry run, needs an explicit env, and guards production', () => {
    const script = read('scripts/retrimBusinessLogos.ts')
    expect(script).toContain("from '../lib/images/crop.ts'")
    expect(script).toContain("dev: 'landly-dev', prod: 'landly-be752'")
    expect(script).toContain("const apply = args.includes('--apply')")
    expect(script).toContain("Refusing to write to PRODUCTION (landly-be752) without --confirm-prod.")
    expect(script).toContain('logos/{uuid}')
    expect(script).toContain("where('businessId', '==', doc.id)")
    expect(script).toContain('MIN_SAVING = 0.06')
  })
})
