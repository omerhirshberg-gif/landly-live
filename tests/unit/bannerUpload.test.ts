import { describe, expect, it } from 'vitest'
import { bannerPathFromUrl, isJpeg, storageDownloadUrl } from '@/lib/storage/bannerPath'
import { BANNER_ASPECT, BANNER_MAX_EDGE, BANNER_QUALITIES, centeredCrop, isLowResolution, MAX_UPLOAD_BYTES } from '@/lib/images/crop'

describe('banner storage URLs', () => {
  const bucket = 'landly-dev.firebasestorage.app'

  it('round-trips our own uploads', () => {
    const url = storageDownloadUrl(bucket, 'banners/0f8a-12.jpg', 'tok')
    expect(url).toBe(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/banners%2F0f8a-12.jpg?alt=media&token=tok`)
    expect(bannerPathFromUrl(url, bucket)).toBe('banners/0f8a-12.jpg')
  })

  it('never claims anything else for deletion', () => {
    expect(bannerPathFromUrl('https://i.imgur.com/abc.jpg', bucket)).toBeNull()
    expect(bannerPathFromUrl(storageDownloadUrl('other-bucket', 'banners/x.jpg', 't'), bucket)).toBeNull()
    expect(bannerPathFromUrl(storageDownloadUrl(bucket, 'avatars/uid123', 't'), bucket)).toBeNull()
    expect(bannerPathFromUrl(storageDownloadUrl(bucket, 'banners/../avatars/x.jpg', 't'), bucket)).toBeNull()
  })

  it('recognizes JPEG bytes', () => {
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })
})

describe('centeredCrop', () => {
  it('crops a 12MP portrait photo to a centred 16:9 band at its full 3024px width (under the 2400px cap: scaled to it)', () => {
    const box = centeredCrop(3024, 4032, BANNER_ASPECT, BANNER_MAX_EDGE)
    expect(box.sw).toBe(3024)
    expect(box.sh).toBe(1701)
    expect(box.sy).toBe(Math.floor((4032 - 1701) / 2))
    expect(box.width).toBe(2400)
    expect(box.height).toBe(1350)
  })

  it('keeps a 2x desktop hero sharp: quality 90 first, stepping down only to fit under Vercel’s body limit', () => {
    expect(BANNER_QUALITIES[0]).toBe(0.9)
    expect([...BANNER_QUALITIES]).toEqual([...BANNER_QUALITIES].sort((a, b) => b - a))
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024)
  })

  it('warns about a banner narrower than a phone at @3x', () => {
    expect(isLowResolution('banner', 1200, 675)).toBe(true)
    expect(isLowResolution('banner', 2400, 1350)).toBe(false)
  })

  it('crops a panorama’s sides and never upscales a small image', () => {
    const box = centeredCrop(1000, 300, BANNER_ASPECT, BANNER_MAX_EDGE)
    expect(box.sh).toBe(300)
    expect(box.sw).toBe(533)
    expect(box.sx).toBe(Math.floor((1000 - 533) / 2))
    expect(box.width).toBe(533)
  })

  it('makes the avatar square', () => {
    expect(centeredCrop(4000, 3000, 1, 1024)).toMatchObject({ sx: 500, sy: 0, sw: 3000, sh: 3000, width: 1024, height: 1024 })
  })
})
