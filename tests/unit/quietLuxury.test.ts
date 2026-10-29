import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { Gift } from 'lucide-react'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { BUSINESS_CATEGORIES } from '@/lib/categories'
import { categoryHref } from '@/lib/perks/perksFilter'
import { pillarHref, toShowcase, VALUE_PILLARS } from '@/lib/home/showcase'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ isWishlisted: () => false, toggleWishlist: () => {} }) }))

const { default: IconFrame } = await import('@/components/ui/IconFrame')
const { default: OfferCard } = await import('@/components/discover/OfferCard')
const { default: ValueProps } = await import('@/components/home/ValueProps')

const read = (path: string) => readFileSync(path, 'utf8')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

describe('the shekel sign in the price font', () => {
  it('loads Latin Extended for Inter and Manrope, whose range holds "₪" (U+20AA)', () => {
    const layout = read('app/layout.tsx')
    expect(layout).toContain("Inter({ subsets: ['latin', 'latin-ext', 'cyrillic'],")
    expect(layout).toContain("Manrope({ subsets: ['latin', 'latin-ext', 'cyrillic'],")
  })

  it('sets every price in <bdi> with the price tokens, never a display font', () => {
    const offer = {
      id: 'o1', businessName: 'Cafe Nadi', title: 'Two coffees', category: 'Restaurants and Cafes', location: 'Tel Aviv',
      originalPrice: 45, offerPrice: 29, redemptionMethod: 'in_store', imageUrl: '',
    } as never
    for (const lang of ['en', 'he'] as const) {
      const html = withLang(lang, createElement(OfferCard, { offer, layout: 'grid' }))
      expect(html).toContain('<bdi class="text-price tabular-nums text-brand">₪29</bdi>')
      expect(html).toContain('<bdi class="text-price-was tabular-nums text-slate-400 line-through decoration-slate-400/70">₪45</bdi>')
      expect(html).not.toContain('font-display')
      expect(html).not.toContain('fa-solid')
    }
    const page = read('app/offers/[offerId]/page.tsx')
    expect(page).toContain('<bdi className="text-price-lg tabular-nums text-brand">{formatPrice(offer.offerPrice)}</bdi>')
    expect(page).not.toMatch(/fa-(solid|regular)/)
  })

  it('frames the card photo at 16:9, with the merchant as an eyebrow over a two-line title and a pin chip for the place', () => {
    const offer = {
      id: 'o1', businessName: 'Cafe Nadi', title: 'Two coffees', category: 'Restaurants and Cafes', location: 'Tel Aviv',
      originalPrice: 45, offerPrice: 29, redemptionMethod: 'in_store', imageUrl: '',
    } as never
    const html = withLang('en', createElement(OfferCard, { offer, layout: 'grid' }))
    // The photo sits in a frame the merchant badge overlaps; the eyebrow clears the badge.
    expect(html).toContain('<div class="relative z-[1] mx-2 mt-2"><div class="relative aspect-video overflow-hidden rounded-[14px]')
    expect(html).toMatch(/rounded-xl bg-brandTint absolute start-2 -bottom-6"/)
    expect(html).toMatch(/<div class="truncate ps-\[60px\] text-micro font-bold uppercase[^"]*" dir="auto">Cafe Nadi<\/div><p class="mt-1 line-clamp-2 font-bold[^"]*" dir="auto">Two coffees<\/p>/)
    expect(html).toMatch(/rounded-full border border-slate-200\/80 bg-slate-50[^"]*"><svg [^>]*stroke-width="1.5"[^>]*class="lucide lucide-map-pin/)
  })
})

describe('IconFrame', () => {
  it('is a hairline frame around a fine 1.75 Lucide glyph, never a solid block', () => {
    const sizes = { sm: 'h-10 w-10 rounded-xl', md: 'h-11 w-11 rounded-xl', lg: 'h-12 w-12 rounded-xl', xl: 'h-14 w-14 rounded-2xl' } as const
    for (const [size, box] of Object.entries(sizes) as [keyof typeof sizes, string][]) {
      const html = renderToStaticMarkup(createElement(IconFrame, { icon: Gift, size }))
      expect(html).toContain(`<span aria-hidden="true" class="flex flex-shrink-0 items-center justify-center border ${box} border-sky-200/60 bg-brandTint text-brand">`)
      expect(html).toMatch(/stroke-width="1.75"[^>]*class="lucide lucide-gift/)
    }
    expect(renderToStaticMarkup(createElement(IconFrame, { icon: Gift, tone: 'success' }))).toContain('border-emerald-200/70 bg-emerald-50 text-emerald-600')
  })

  it('has replaced the solid blue tiles on /olim and /business', () => {
    for (const file of ['app/olim/page.tsx', 'app/business/page.tsx']) {
      expect(read(file)).not.toMatch(/rounded-(xl|2xl|full) bg-(brand|emerald-600) text-white/)
    }
    expect(read('app/olim/page.tsx')).not.toContain('fa-solid')
    expect(read('app/olim/page.tsx')).not.toContain('olim_free_note')
  })
})

describe('the hamburger', () => {
  it('is a 40px frosted tile with three identical 18×2px bars on whole pixels that fold into an X', () => {
    const nav = read('components/layout/Navbar.tsx')
    expect(nav).toContain('lg:hidden tap-target flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 shadow-btn-secondary')
    expect(nav).toContain('active:scale-95')
    const css = read('app/globals.css')
    expect(css).toContain('.hamburger{position:relative;display:block;width:18px;height:14px;}')
    // One rule sizes all three bars the same; each sits on a whole pixel.
    expect(css).toMatch(/\.hamburger span\{position:absolute;inset-inline:0;height:2px;/)
    expect(css).not.toMatch(/\.hamburger span:nth-child\(\d\)\{[^}]*(width|height|inset)/)
    expect(css).toContain('.hamburger span:nth-child(1){top:0;}')
    expect(css).toContain('.hamburger span:nth-child(2){top:6px;}')
    expect(css).toContain('.hamburger span:nth-child(3){top:12px;}')
    expect(css).not.toMatch(/\.hamburger[^{]*\{[^}]*top:\d+\.\d+px/)
    expect(css).toContain('.hamburger.open span:nth-child(1){top:6px;transform:rotate(45deg);}')
    expect(css).toContain('@media (prefers-reduced-motion: reduce){.hamburger span{transition:none;}}')
  })
})

describe("what's inside: lifestyle lines, no counts", () => {
  const PILLAR_KEYS = ['dining', 'lifestyle', 'experiences', 'community'] as const

  it('links each pillar to its perks without counting them', () => {
    expect(VALUE_PILLARS.map(pillarHref)).toEqual([categoryHref('Restaurants and Cafes'), '/categories', '/categories', '/olim'])
    // Only real categories.
    for (const pillar of VALUE_PILLARS) for (const c of pillar.categories) expect(BUSINESS_CATEGORIES).toContain(c)
    // The showcase no longer carries per-category counts.
    expect(toShowcase([])).toEqual({ offers: [] })
  })

  it.each(Object.keys(translations) as Lang[])('gives every card a 40px frame, its title, a lifestyle line and a mirrored arrow, with no count (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(ValueProps))
    const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')
    for (const key of PILLAR_KEYS) {
      expect(html).toContain(`>${esc(t[`vp_${key}_title`])}</h3><p class="mt-1 line-clamp-2 text-meta leading-snug text-slate-500">${esc(t[`vp_${key}_desc`])}</p>`)
    }
    expect(html.match(/<span aria-hidden="true" class="flex flex-shrink-0 items-center justify-center border h-10 w-10 rounded-xl border-sky-200\/60 bg-brandTint text-brand">/g)).toHaveLength(4)
    for (const icon of ['utensils-crossed', 'sparkles', 'compass', 'heart-handshake']) expect(html).toMatch(new RegExp(`stroke-width="1.75"[^>]*class="lucide lucide-${icon}`))
    expect(html.match(/lucide-arrow-right[^"]*rtl:-scale-x-100/g)).toHaveLength(4)
    expect(html).not.toContain('bg-emerald-500')
    // No "14 perks available" line, in whichever order the language puts the number.
    const countWords = t.cats_perks_count.split('{count}').map((part) => part.trim()).sort((a, b) => b.length - a.length)[0]
    expect(html).not.toContain(countWords)
  })

  it('keeps the new lines short enough for two lines on a 200px phone card', () => {
    for (const lang of Object.keys(translations) as Lang[]) {
      for (const key of PILLAR_KEYS) {
        const title = translations[lang][`vp_${key}_title`]
        const line = translations[lang][`vp_${key}_desc`]
        expect(title.length, `${lang} ${key} title`).toBeLessThanOrEqual(28)
        expect(line.length, `${lang} ${key} line`).toBeLessThanOrEqual(40)
      }
    }
  })
})

describe('the icon sweep', () => {
  // Every tracked or new web source outside the internal admin, as it is in
  // the working tree (a deleted file stays tracked until that's committed).
  const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard', 'app', 'components', 'lib'], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => /\.tsx?$/.test(f) && !/^(app|components)\/admin\//.test(f) && existsSync(f))

  it('draws no Font Awesome glyph outside admin', () => {
    expect(files.length).toBeGreaterThan(100)
    for (const file of files) expect(read(file), file).not.toMatch(/\bfa-(solid|regular|brands)\b|['"`]fa-[a-z]|<i [^>]*className/)
  })

  it('renders no emoji as an icon on a web page or component', () => {
    // Pictographs, but not the text symbols © ® ™.
    const PICTO = /(?![©®™])\p{Extended_Pictographic}/u
    for (const file of files.filter((f) => f.endsWith('.tsx'))) {
      // Comments may name a symbol; markup and strings may not.
      const code = read(file).replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(PICTO)
    }
  })

  it('no longer loads the icon font for the global error screen', () => {
    expect(read('app/global-error.tsx')).not.toContain('font-awesome')
  })
})
