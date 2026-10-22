import { describe, expect, it } from 'vitest'
import { perkImageFit } from '@/lib/offers/imageFit'

describe('perkImageFit', () => {
  it('covers the frame with a photo', () => {
    expect(perkImageFit('https://cdn.example/cafe-terrace.jpg')).toBe('cover')
    expect(perkImageFit('https://cdn.example/cafe.jpg', { width: 1600, height: 900 })).toBe('cover')
    // A large square photo is still a photo.
    expect(perkImageFit('https://cdn.example/plate.jpg', { width: 1200, height: 1200 })).toBe('cover')
  })

  it('contains a logo, by its URL or by its small, roughly square size', () => {
    expect(perkImageFit('https://cdn.example/brand-logo.png')).toBe('contain')
    expect(perkImageFit('https://cdn.example/Logo_2024.webp')).toBe('contain')
    expect(perkImageFit('https://cdn.example/mark.svg?v=2')).toBe('contain')
    expect(perkImageFit('https://cdn.example/mark.png', { width: 400, height: 380 })).toBe('contain')
  })

  it('does not mistake a word containing "logo" mid-word for a logo', () => {
    expect(perkImageFit('https://cdn.example/catalogo-summer.jpg')).toBe('cover')
  })
})
