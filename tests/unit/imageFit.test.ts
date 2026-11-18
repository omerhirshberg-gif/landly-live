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

describe('dealPhotoFit for a Raayonit card (ambient)', () => {
  it.each([
    ['2.46 wordmark', 320, 130, 'contain'],
    ['1.01 square', 720, 715, 'contain'],
    ['0.70 portrait', 251, 359, 'contain'],
    ['1.30 under the band', 1300, 1000, 'contain'],
    ['1.37 just under the band', 1370, 1000, 'contain'],
    ['1.38 band start', 1380, 1000, 'cover'],
    ['3:2', 720, 480, 'cover'],
    ['16:9', 1920, 1080, 'cover'],
    ['1.78 band end', 1780, 1000, 'cover'],
    ['1.79 just over', 1790, 1000, 'contain'],
  ] as const)('%s -> %s', (_n, w, h, fit) => {
    expect(dealPhotoFit(size(w, h), { ambient: true })).toBe(fit)
  })
  it('leaves every other merchant on the 1.2 rule', () => {
    expect(dealPhotoFit(size(1300, 1000))).toBe('cover')
    expect(dealPhotoFit(size(2460, 1000))).toBe('cover')
  })
  it('a trimmed brand graphic is whole whatever its shape, even inside the band', () => {
    expect(dealPhotoFit(size(720, 480), { ambient: true, graphic: true })).toBe('contain')
    expect(dealPhotoFit(size(720, 480), { ambient: false, graphic: true })).toBe('cover')
  })
  it('never calls a Raayonit image a logo, whatever its size', () => {
    expect(dealImageRole('/images/raayonit-brands/1.png', size(320, 320), false)).toBe('logo')
    expect(dealImageRole('/images/raayonit-brands/1.png', size(320, 320), false, { raayonit: true })).toBe('photo')
    expect(dealImageRole('/images/raayonit-brands/1.png', null, false, { raayonit: true })).toBe('pending')
  })
})
