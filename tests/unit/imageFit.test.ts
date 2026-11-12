import { describe, expect, it } from 'vitest'
import { dealPhotoFit, PHOTO_COVER_MIN_RATIO, perkImageFit } from '@/lib/offers/imageFit'
import { dealImageRole } from '@/lib/offers/dealImage'

const size = (width: number, height: number) => ({ width, height })

describe('dealPhotoFit: how a perk photo sits in its hero frame', () => {
  it('uses 1.2 as the line between a landscape and a whole photo', () => {
    expect(PHOTO_COVER_MIN_RATIO).toBe(1.2)
    expect(dealPhotoFit(size(1200, 1000))).toBe('cover') // exactly 1.2
    expect(dealPhotoFit(size(1199, 1000))).toBe('contain') // just under
  })

  it.each([
    ['4:3', 1600, 1200],
    ['3:2', 1500, 1000],
    ['16:10', 1600, 1000],
    ['16:9', 1920, 1080],
    ['21:9', 2100, 900],
  ])('fills the frame with a %s landscape photo (cover)', (_name, w, h) => {
    expect(w / h).toBeGreaterThanOrEqual(1.2)
    expect(dealPhotoFit(size(w, h))).toBe('cover')
  })

  it.each([
    ['1:1 square', 1200, 1200],
    ['11:10', 1100, 1000],
    ['4:5', 1000, 1250],
    ['3:4 portrait', 1500, 2000],
    ['2:3 portrait', 1000, 1500],
    ['9:16 tall', 1080, 1920],
  ])('shows a %s photo whole (contain)', (_name, w, h) => {
    expect(w / h).toBeLessThan(1.2)
    expect(dealPhotoFit(size(w, h))).toBe('contain')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['0 x 0', size(0, 0)],
    ['zero width', size(0, 800)],
    ['zero height', size(800, 0)],
    ['negative', size(-4, 3)],
  ])('covers when the size is %s (nothing to judge by yet)', (_name, input) => {
    expect(dealPhotoFit(input)).toBe('cover')
  })
})

describe('the standalone logo rule is intact', () => {
  it('a small, roughly square bitmap or a logo-named URL is still a logo, not a photo', () => {
    expect(perkImageFit('https://cdn.example/mark.png', size(400, 380))).toBe('contain')
    expect(perkImageFit('https://cdn.example/brand-logo.png')).toBe('contain')
    expect(perkImageFit('https://cdn.example/mark.svg')).toBe('contain')
    expect(dealImageRole('https://cdn.example/mark.png', size(400, 380), false)).toBe('logo')
  })
  it('a large square is a photo (and dealPhotoFit then shows it whole)', () => {
    expect(perkImageFit('https://cdn.example/plate.jpg', size(1200, 1200))).toBe('cover')
    expect(dealImageRole('https://cdn.example/plate.jpg', size(1200, 1200), false)).toBe('photo')
    expect(dealPhotoFit(size(1200, 1200))).toBe('contain')
  })
  it('a portrait photo is a photo, not a logo', () => {
    expect(dealImageRole('https://cdn.example/model.jpg', size(1200, 1800), false)).toBe('photo')
  })
})
