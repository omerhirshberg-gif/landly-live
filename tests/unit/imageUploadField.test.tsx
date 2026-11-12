import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'

vi.mock('@/lib/admin/adminSession', () => ({ sendToLogin: () => {} }))
const { default: ImageUploadField } = await import('@/components/admin/ImageUploadField')

const render = (props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(ImageUploadField, { value: '', onChange: () => {}, linkInput: null, ...props } as never))

describe('ImageUploadField: an offer photo', () => {
  it('defaults to the full image, with the 16:9 crop one tap away', () => {
    const html = render()
    expect(html).toContain('role="radiogroup"')
    const full = html.match(/<button[^>]*role="radio"[^>]*aria-checked="(true|false)"[^>]*>\s*<?[^<]*Full image/)
    expect(full?.[1]).toBe('true')
    expect(html).toContain(en['img.cropFull'])
    expect(html).toContain(en['img.cropBanner'])
    const crop = html.match(/aria-checked="(true|false)"[^>]*>[^<]*Crop to 16:9/)
    expect(crop?.[1]).toBe('false')
    // The hint says the photo is kept whole.
    expect(html).toContain(en['img.photoSpec'])
    expect(html).not.toContain(en['img.photoSpecCrop'])
  })

  it('every radio is a 44px target', () => {
    for (const button of render().matchAll(/<button[^>]*role="radio"[^>]*>/g)) expect(button[0]).toContain('min-h-11')
  })

  it('shows an uploaded photo whole on a studio backdrop, not cut to fit the preview', () => {
    const html = render({ value: 'https://firebasestorage.googleapis.com/v0/b/b/o/banners%2Fx.jpg?alt=media' })
    expect(html).toContain('bg-[#F4F6F9]')
    expect(html).toContain('h-full w-full object-contain')
    expect(html).not.toContain('object-cover')
  })

  it('a business logo has no framing choice (it is always kept whole)', () => {
    expect(render({ shape: 'logo' })).not.toContain('role="radiogroup"')
  })
})

describe('ImageUploadField: wiring', () => {
  const field = readFileSync('components/admin/ImageUploadField.tsx', 'utf8')
  it('passes no aspect (no crop) unless 16:9 is chosen', () => {
    expect(field).toContain("useState<'none' | '16:9'>('none')")
    expect(field).toContain("aspect: crop === '16:9' ? BANNER_ASPECT : null")
  })
  it('has the framing strings in English and Hebrew', () => {
    for (const key of ['img.cropFull', 'img.cropBanner', 'img.photoSpec', 'img.photoSpecCrop'] as const) {
      expect(en[key]).toBeTruthy()
      expect(he[key]).toBeTruthy()
    }
    expect(en['img.photoSpec']).not.toBe(en['img.photoSpecCrop'])
  })
})
