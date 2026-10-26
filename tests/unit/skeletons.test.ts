import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { translations, type TranslationKey } from '@/lib/i18n/translations'
vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))

const { OfferGridSkeleton, VoucherListSkeleton } = await import('@/components/ui/Skeleton')
const { OFFER_FEED_GRID } = await import('@/components/discover/offerFeedGrid')

function render(element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations.en[key]
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang: 'en', setLang: () => {}, t, isRtl: false } }, element))
}

describe('loading skeletons', () => {
  it('holds a perk feed in its own grid, one status for screen readers and still under reduced motion', () => {
    const html = render(createElement(OfferGridSkeleton, { count: 4 }))
    expect(html.startsWith(`<div role="status" class="${OFFER_FEED_GRID}"><span class="sr-only">${translations.en.bizdash_loading}</span>`)).toBe(true)
    expect(html.match(/aspect-video rounded-\[14px\]/g)).toHaveLength(4)
    expect(html).toContain('animate-pulse motion-reduce:animate-none')
    expect(html.match(/role="status"/g)).toHaveLength(1)
  })

  it('holds My Pass in the tab’s own grid with the thumbnail at the card’s size', () => {
    const html = render(createElement(VoucherListSkeleton))
    expect(html).toContain('<div role="status" class="grid gap-3 fold:grid-cols-2">')
    expect(html.match(/h-16 w-16 flex-shrink-0 rounded-xl sm:h-20 sm:w-20/g)).toHaveLength(3)
  })

  it('replaces the spinners on the web feeds and the Expo lists', () => {
    expect(readFileSync('app/categories/page.tsx', 'utf8')).not.toContain('fa-spinner')
    expect(readFileSync('app/wishlist/page.tsx', 'utf8')).not.toContain('fa-spinner')
    for (const screen of ['(tabs)/index.tsx', '(tabs)/perks.tsx', '(tabs)/wallet.tsx', '(tabs)/wishlist.tsx', 'category/[category].tsx']) {
      expect(readFileSync(`landly-mobile/src/app/${screen}`, 'utf8'), screen).not.toContain('ActivityIndicator')
    }
  })
})

describe('onboarding finish', () => {
  it('draws the tick in and bursts a little confetti outside the transformed step', () => {
    expect(readFileSync('components/auth/onboarding/CelebrationStep.tsx', 'utf8')).toContain('pathLength={1} className="check-draw"')
    const wizard = readFileSync('components/auth/onboarding/OnboardingWizard.tsx', 'utf8')
    expect(wizard).toContain("{step === 'done' && createPortal(<Confetti count={60} />, document.body)}")
    const css = readFileSync('app/globals.css', 'utf8')
    expect(css).toContain('.check-draw{ stroke-dasharray:1; stroke-dashoffset:1;')
    expect(css).toContain('.check-draw{ animation:none; stroke-dashoffset:0; }')
  })
})
