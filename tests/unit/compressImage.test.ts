import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BANNER_ASPECT, BANNER_MAX_EDGE, BANNER_QUALITIES, MAX_UPLOAD_BYTES } from '@/lib/images/crop'
import { compressImage } from '@/lib/images/compressImage'

// A just-enough browser: an Image that "decodes" to a chosen size, and a canvas that records what was drawn and
// how it was encoded. The JPEG's size follows a table, so the quality stepping can be driven.
let natural = { width: 3024, height: 4032 }
let sizeAtQuality: (quality: number) => number = () => 100
const canvases: { width: number; height: number; draws: number[][]; encoded: { type: string; quality?: number }[] }[] = []

beforeEach(() => {
  canvases.length = 0
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
  vi.stubGlobal(
    'Image',
    class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      get naturalWidth() {
        return natural.width
      }
      get naturalHeight() {
        return natural.height
      }
      set src(_: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
  )
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = {
        width: 0,
        height: 0,
        draws: [] as number[][],
        encoded: [] as { type: string; quality?: number }[],
        getContext: () => ({
          imageSmoothingEnabled: false,
          imageSmoothingQuality: '',
          fillStyle: '',
          fillRect: () => {},
          drawImage: (_image: unknown, ...args: number[]) => canvas.draws.push(args),
        }),
        toBlob: (done: (blob: Blob) => void, type: string, quality?: number) => {
          canvas.encoded.push({ type, quality })
          done(new Blob([new Uint8Array(sizeAtQuality(quality ?? 1))], { type }))
        },
      }
      canvases.push(canvas)
      return canvas
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

const OPTIONS = { maxEdge: BANNER_MAX_EDGE, qualities: BANNER_QUALITIES, maxBytes: MAX_UPLOAD_BYTES }
const file = new Blob(['x'], { type: 'image/jpeg' })

describe('compressImage without a crop (aspect: null), the default for an offer photo', () => {
  it('keeps a portrait whole: no 16:9 cut, longest edge capped at 2400px', async () => {
    natural = { width: 3024, height: 4032 }
    await compressImage(file, { ...OPTIONS, aspect: null })
    const canvas = canvases[0]!
    expect([canvas.width, canvas.height]).toEqual([1800, 2400])
    // The whole source is drawn: from (0,0), all 3024 x 4032, scaled to the canvas.
    expect(canvas.draws[0]).toEqual([0, 0, 3024, 4032, 0, 0, 1800, 2400])
  })

  it('keeps a square and a landscape in their own shape, and never upscales a small photo', async () => {
    natural = { width: 3000, height: 3000 }
    await compressImage(file, { ...OPTIONS, aspect: null })
    expect([canvases.at(-1)!.width, canvases.at(-1)!.height]).toEqual([2400, 2400])
    natural = { width: 4000, height: 3000 }
    await compressImage(file, { ...OPTIONS, aspect: null })
    expect([canvases.at(-1)!.width, canvases.at(-1)!.height]).toEqual([2400, 1800])
    natural = { width: 800, height: 1000 }
    await compressImage(file, { ...OPTIONS, aspect: null })
    expect([canvases.at(-1)!.width, canvases.at(-1)!.height]).toEqual([800, 1000])
  })

  it('encodes a JPEG at quality 0.90 when it fits', async () => {
    natural = { width: 3024, height: 4032 }
    const { blob } = await compressImage(file, { ...OPTIONS, aspect: null })
    expect(canvases[0]!.encoded).toEqual([{ type: 'image/jpeg', quality: 0.9 }])
    expect(blob.type).toBe('image/jpeg')
  })

  it('steps the quality down only when the file is over the cap', async () => {
    natural = { width: 3024, height: 4032 }
    sizeAtQuality = (q) => (q > 0.87 ? MAX_UPLOAD_BYTES + 1 : 1000)
    await compressImage(file, { ...OPTIONS, aspect: null })
    expect(canvases[0]!.encoded.map((e) => e.quality)).toEqual([0.9, 0.86])
    sizeAtQuality = () => 100
  })

  it('warns a whole photo by its longest side, a portrait being narrow by nature', async () => {
    natural = { width: 1200, height: 1600 }
    expect((await compressImage(file, { ...OPTIONS, aspect: null })).lowResolution).toBe(false)
    natural = { width: 1000, height: 1400 }
    expect((await compressImage(file, { ...OPTIONS, aspect: null })).lowResolution).toBe(true)
  })
})

describe('compressImage with the optional 16:9 crop', () => {
  it('still crops around the centre when the admin chose it, baking the crop into the file', async () => {
    natural = { width: 3024, height: 4032 }
    await compressImage(file, { ...OPTIONS, aspect: BANNER_ASPECT })
    const canvas = canvases[0]!
    expect([canvas.width, canvas.height]).toEqual([2400, 1350])
    // The middle band of the portrait: 3024 x 1701 starting 1165px down.
    expect(canvas.draws[0]).toEqual([0, 1165, 3024, 1701, 0, 0, 2400, 1350])
  })
})
