import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DealMedia from '@/components/discover/DealMedia'

const read = (p: string) => readFileSync(p, 'utf8')
// The blurred copy behind a whole photo: an eighth of the frame, centred by flexbox, blurred 3px and scaled 8.8x (the look
// of a full-size blur-xl at scale-110 for 1/64 of the blur work), in a z-0 layer hidden from assistive tech.
const BACKDROP = /<div aria-hidden="true" class="absolute inset-0 z-0 flex items-center justify-center overflow-hidden"><img[^>]*aria-hidden="true"[^>]*class="h-\[12\.5%\] w-\[12\.5%\] flex-shrink-0 scale-\[8\.8\] transform-gpu object-cover blur-\[3px\]"/

const image = (size: { width: number; height: number } | null, role: 'photo' | 'pending' | 'logo' | 'none' = 'photo') =>
  ({ role, size, imgRef: { current: null }, onLoad: () => {}, onError: () => {} }) as never

const render = (props: Record<string, unknown>) =>
  renderToStaticMarkup(createElement(DealMedia, { src: 'https://cdn.example/p.jpg', alt: 'offer', category: 'food', aspect: 'aspect-[16/10]', ...props } as never))

describe('web DealMedia', () => {
  it('a landscape photo (1.33 and 1.77) fills the frame: object-cover, no backdrop', () => {
    for (const size of [{ width: 1600, height: 1200 }, { width: 1920, height: 1080 }]) {
      const html = render({ image: image(size), containAspect: 'aspect-[4/5]' })
      expect(html).toContain('object-cover')
      expect(html).not.toContain('object-contain')
      expect(html).not.toContain('blur-[3px]')
      expect(html).not.toContain('bg-[#F4F6F9]/45')
      expect(html).toContain('aspect-[16/10]')
      expect(html).not.toContain('aspect-[4/5]')
    }
  })

  it('a square or portrait photo is shown whole over a blurred, studio-tinted copy of itself', () => {
    for (const size of [{ width: 1200, height: 1200 }, { width: 1500, height: 2000 }, { width: 1080, height: 1920 }]) {
      const html = render({ image: image(size), containAspect: 'aspect-[4/5]' })
      expect(html).toContain('object-contain')
      // The backdrop: the same picture, blurred and enlarged so its edges are out of sight, hidden from assistive tech.
      expect(html).toMatch(BACKDROP)
      expect(html).toContain('bg-[#F4F6F9]/45')
      // The page's own taller frame replaces the card's.
      expect(html).toContain('aspect-[4/5]')
      expect(html).not.toContain('aspect-[16/10]')
    }
  })

  it('stacks the layers explicitly: blurred z-0, tint z-[1], crisp photo z-[2]', () => {
    const html = render({ image: image({ width: 800, height: 1200 }) })
    const [backdrop, photo] = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0])
    expect(html).toMatch(BACKDROP)
    expect(backdrop).toContain('blur-[3px]')
    expect(photo).toContain('z-[2]')
    expect(photo).not.toContain('blur')
    expect(html).toContain('absolute inset-0 z-[1] bg-[#F4F6F9]/45')
    expect(html.indexOf('absolute inset-0 z-0 flex')).toBeLessThan(html.indexOf('z-[1] bg-'))
    expect(html.indexOf('z-[1] bg-')).toBeLessThan(html.indexOf('z-[2]'))
  })

  it('a card (no containAspect) keeps its frame and only changes how the photo sits', () => {
    const html = render({ image: image({ width: 800, height: 1200 }) })
    expect(html).toContain('aspect-[16/10]')
    expect(html).toContain('object-contain')
  })

  it('covers until the size is known, and shows no photo for a logo or a missing image', () => {
    expect(render({ image: image(null, 'pending') })).not.toContain('blur-[3px]')
    expect(render({ image: image(null, 'pending') })).toContain('object-cover')
    const logo = render({ image: image({ width: 400, height: 380 }, 'logo') })
    expect(logo).not.toContain('<img')
    expect(render({ image: image(null, 'none') })).not.toContain('<img')
  })

  it('draws the foreground picture over the backdrop, with the alt text on the foreground only', () => {
    const html = render({ image: image({ width: 800, height: 1200 }) })
    const imgs = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0])
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toContain('alt=""')
    expect(imgs[1]).toContain('alt="offer"')
    expect(imgs[1]).toContain('object-contain')
  })
})

describe('web offer page', () => {
  it('lets a whole photo grow to 380px on a phone and 480px on desktop, and passes it to DealMedia', () => {
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page).toContain('containAspect="aspect-[4/5] max-h-[380px] lg:aspect-auto lg:h-[480px] lg:max-h-[480px] lg:min-h-0"')
    expect(page).toContain('aspect="aspect-video lg:aspect-[16/10] lg:min-h-[380px]"')
  })
  it('leaves the adaptive logo badge alone', () => {
    expect(read('components/discover/MerchantBadge.tsx')).toContain('h-[44px] min-w-[64px] max-w-[124px]')
  })
})

describe('web DealMedia for a Raayonit card (ambient)', () => {
  const raayonit = (size: { width: number; height: number }, graphic = false) => ({ ...(image(size) as object), ambient: true, graphic }) as never
  it('a trimmed brand logo or banner sits whole over the 3-layer backdrop, with 16px of air', () => {
    for (const size of [{ width: 320, height: 130 }, { width: 720, height: 450 }, { width: 600, height: 600 }]) {
      const html = render({ image: raayonit(size, true) })
      expect(html).toMatch(BACKDROP)
      expect(html).toContain('bg-[#F4F6F9]/45')
      expect(html).toMatch(/<img[^>]*class="absolute inset-0 z-\[2\] h-full w-full object-contain p-4/)
    }
  })
  it('a scene photograph between 1.38 and 1.78 still fills the frame', () => {
    const html = render({ image: raayonit({ width: 720, height: 480 }) })
    expect(html).toContain('object-cover')
    expect(html).not.toContain('blur-[3px]')
  })
  it('a Raayonit wordmark does not take the offer page’s tall portrait frame', () => {
    const html = render({ image: raayonit({ width: 320, height: 130 }, true), containAspect: 'aspect-[4/5]' })
    expect(html).toContain('aspect-[16/10]')
    expect(html).not.toContain('aspect-[4/5]')
  })
  it('the fallback Raayonit mark sits on a soft slate surface, not stark white', () => {
    const html = render({ image: image(null, 'none'), logo: { src: '/m.png', alt: 'x', small: true } })
    expect(html).toContain('from-[#F1F5F9]')
    expect(html).toContain('to-[#E2E8F0]')
    expect(html).not.toContain('bg-white')
  })
})
