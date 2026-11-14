// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { EMPTY_LANDING, toLandingData } from '@/lib/home/landingData'
import { isOfferClaimable, toPublicOffer, type PublicOffer } from '@/lib/offers/publicOffer'
import { lockBodyScroll } from '@/lib/useBodyScrollLock'
import { LANG_DIRECTION_SCRIPT } from '@/lib/i18n/langDirectionScript'
import { visualHebrewLine } from '@/lib/seo/ogText'
import AudienceCards from '@/components/landing/AudienceCards'
import StoreButtons from '@/components/landing/StoreButtons'
import BottomCta from '@/components/landing/BottomCta'
import LandingHero from '@/components/landing/LandingHero'
import { settledImage } from '@/components/discover/useDealImage'
import { dealImageRole } from '@/lib/offers/dealImage'
import { distinctDescription } from '@/lib/offers/offerText'

vi.mock('@/lib/firebase/config', () => ({ db: {}, auth: {} }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('@/lib/firebase/useWishlist', () => ({ useWishlist: () => ({ isWishlisted: () => false, toggleWishlist: () => {} }) }))

const read = (path: string) => readFileSync(path, 'utf8')
function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

const offer = (i: number, over: Partial<PublicOffer> = {}): PublicOffer => ({
  id: `o${i}`, businessId: `b${i}`, businessName: `Business ${i}`, businessLogoUrl: '', title: `Perk ${i}`, description: '', category: 'Beach and Sea', imageUrl: '', originalPrice: 100, offerPrice: 80, createdAt: null, expiryDate: null, ...over,
})

describe('landing data', () => {
  it('shows only live, claimable offers', () => {
    const { deals } = toLandingData([
      offer(1),
      offer(2, { totalQuantity: 5, claimedCount: 5 }),
      offer(3, { businessName: '   ' }),
      offer(4, { totalQuantity: 5, claimedCount: 4 }),
    ])
    expect(deals.map((d) => d.id).sort()).toEqual(['o1', 'o4'])
  })

  it('is empty with no offers, and never invents one', () => {
    expect(toLandingData([])).toEqual(EMPTY_LANDING)
    expect(read('lib/home/landingData.ts')).not.toMatch(/Demo|Sample|Lorem/)
  })

  it('reads a stored offer’s claim and logo fields', () => {
    const parsed = toPublicOffer('a', { title: 'T', businessName: 'B', businessLogoUrl: 'https://x/l.png', totalQuantity: 2, claimedCount: 2 })!
    expect(parsed.businessLogoUrl).toBe('https://x/l.png')
    expect(isOfferClaimable(parsed)).toBe(false)
    expect(isOfferClaimable(toPublicOffer('b', { title: 'T' })!)).toBe(true)
  })
})

describe('landing sections', () => {
  it.each(Object.keys(translations) as Lang[])('has six audiences and a store pair in %s, mirrored by logical properties', (lang) => {
    const html = withLang(lang, createElement(AudienceCards))
    expect(html.match(/<li[ >]/g)).toHaveLength(6)
    // Static information: no link, button or pointer cue.
    expect(html).not.toMatch(/<a |<button|role="button"|cursor-pointer|hover:/)
    expect(html).toContain(translations[lang].landing_aud_returnees)
    const stores = withLang(lang, createElement(StoreButtons))
    expect(stores).toContain('App Store')
    expect(stores).toContain('Google Play')
    expect(stores).not.toContain('<img')
    for (const file of ['AudienceCards', 'LandingHero', 'LiveDeals', 'StoreButtons', 'BottomCta']) {
      expect(read(`components/landing/${file}.tsx`), file).not.toMatch(/\b(pl|pr|ml|mr|left|right)-\d|\btext-(left|right)\b/)
      expect(read(`components/landing/${file}.tsx`), file).not.toMatch(/(^|[\s"`])hover:/m)
    }
  })

  it('closes on the headline, the subtitle and both stores, with no metric pills', () => {
    const html = withLang('en', createElement(BottomCta))
    expect(html).toContain(translations.en.landing_cta_title)
    expect(html).toContain(translations.en.landing_cta_sub)
    expect(html).toContain('App Store')
    expect(html).toContain('Google Play')
    expect(html).not.toMatch(/<ul|<li/)
  })

  it('has every landing string in every language, with the brief’s Hebrew headings', () => {
    const keys = Object.keys(translations.en).filter((k) => k.startsWith('landing_aud') || k.startsWith('landing_cta') || k.startsWith('landing_store')) as TranslationKey[]
    for (const lang of Object.keys(translations) as Lang[]) for (const key of keys) expect(translations[lang][key], `${lang}.${key}`).toBeTruthy()
    expect(translations.he.landing_aud_title).toBe('מגיע לכם, בכל דרך שהגעתם')
    expect(translations.he.landing_deals_title).toBe('הטבות שיש אצלנו')
    expect(translations.en.landing_deals_title).toBe('Our perks')
    expect(translations.he.home_top_categories).toBe('קטגוריות מובילות')
    expect(translations.he.how_title).toContain('שלושה צעדים וזהו')
    expect(translations.he.landing_pass_title).toContain('מציגים, חוסכים, נהנים')
    expect(translations.he.faq_title).toContain('שאלות שכולם שואלים')
  })
})

describe('luxury Bento surfaces', () => {
  const landingFiles = ['AudienceCards', 'BottomCta', 'LandingHero', 'LiveDeals']

  it('has no solid dark block or white-on-colour card left', () => {
    for (const file of landingFiles) {
      const source = read(`components/landing/${file}.tsx`)
      expect(source, file).not.toMatch(/from-brandDark|bg-(blue|emerald|violet|rose|amber|cyan)-[789]00|text-white/)
    }
    expect(read('components/home/HowItWorks.tsx')).not.toMatch(/radial-gradient|text-white/)
  })

  it('draws audience cards as pastel Bento tiles with 40px badges and 1.75 icons, filling every cell', () => {
    const html = withLang('he', createElement(AudienceCards))
    expect(html).toContain('rounded-3xl border border-slate-200/80 bg-gradient-to-br')
    expect(html).toContain('from-blue-50/40 to-indigo-50/20')
    expect(html.match(/h-10 w-10 items-center justify-center rounded-full/g)).toHaveLength(6)
    expect(html.match(/stroke-width="1.75"/g)).toHaveLength(6)
    expect(html.match(/<li class="col-span-2">/g)).toHaveLength(2)
  })

  it('blurs no landing surface', () => {
    for (const file of landingFiles) expect(read(`components/landing/${file}.tsx`), file).not.toContain('backdrop-blur')
  })
})

describe('hero', () => {
  it('is one centred column with no card, photo or motion left in it', () => {
    const html = withLang('he', createElement(LandingHero))
    expect(html).toContain('flex-col items-center')
    expect(html).not.toMatch(/href="\/offers\/|<img|hero-float|hero-flow|lg:grid-cols-2|lg:text-start/)
    expect(read('app/globals.css')).not.toMatch(/hero-float|hero-flow/)
  })

  it('accents the title’s second line in every language, with room for Hebrew descenders', () => {
    for (const lang of Object.keys(translations) as Lang[]) expect(translations[lang].landing_hero_accent, lang).toBeTruthy()
    expect(withLang('he', createElement(LandingHero))).toContain('bg-clip-text pb-1 text-transparent')
  })
})

describe('the landing’s way in', () => {
  it.each(Object.keys(translations) as Lang[])('leads with joining, signing in beside it, and shows both stores as Soon, not as links, in %s', (lang) => {
    const html = withLang(lang, createElement(StoreButtons))
    expect(html.match(/<a /g)).toHaveLength(2)
    expect(html.indexOf('href="/signup"')).toBeGreaterThan(-1)
    expect(html.indexOf('href="/signup"')).toBeLessThan(html.indexOf('href="/login"'))
    expect(html.indexOf(translations[lang].landing_cta_join)).toBeLessThan(html.indexOf(translations[lang].nav_login))
    expect(html.indexOf(translations[lang].nav_login)).toBeLessThan(html.indexOf('App Store'))
    expect(html.split(`>${translations[lang].deals_card_soon_badge}<`)).toHaveLength(3)
    expect(html).toContain('cursor-default border-slate-200/80 bg-slate-100 text-slate-500')
    expect(html).toContain('-top-2 -end-2')
  })

  it('offers both in the hero and the closing banner', () => {
    expect(read('components/landing/LandingHero.tsx')).toContain('<StoreButtons />')
    expect(read('components/landing/BottomCta.tsx')).toContain('<StoreButtons />')
  })

  it('turns a badge into its store link once the listing is live', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_STORE_ID', '1234567890')
    vi.resetModules()
    const { default: Live } = await import('@/components/landing/StoreButtons')
    const { LangContext: Context } = await import('@/lib/i18n/LangProvider')
    const html = renderToStaticMarkup(createElement(Context.Provider, { value: { lang: 'en', setLang: () => {}, t: (key: TranslationKey) => translations.en[key], isRtl: false } }, createElement(Live)))
    expect(html).toContain('href="https://apps.apple.com/app/id1234567890"')
    expect(html.split('>Soon<')).toHaveLength(2)
    vi.unstubAllEnvs()
    vi.resetModules()
  })
})

describe('deal images and logos', () => {
  it('reveals a photo that finished loading before hydration, and reports one that failed', () => {
    expect(settledImage(null)).toBeNull()
    expect(settledImage({ complete: false, naturalWidth: 0, naturalHeight: 0 })).toBeNull()
    expect(settledImage({ complete: true, naturalWidth: 427, naturalHeight: 240 })).toEqual({ width: 427, height: 240 })
    expect(settledImage({ complete: true, naturalWidth: 0, naturalHeight: 0 })).toBe('failed')
    expect(dealImageRole('https://cdn.example/banner.jpg', { width: 427, height: 240 }, false)).toBe('photo')
    expect(read('components/discover/DealMedia.tsx')).toContain('ref={imgRef}')
  })

  it('draws one logo tile on web and native, as wide as its logo needs', () => {
    const web = read('components/discover/MerchantBadge.tsx')
    expect(web).toContain('rounded-2xl [corner-shape:squircle] border border-slate-100 bg-white')
    expect(web).toContain("`h-full w-auto object-contain ${size === 'lg' ? 'min-w-0 max-w-full' : 'max-w-[96px]'}`")
    const native = read('landly-mobile/src/components/MerchantBadge.tsx')
    expect(native).toContain('resizeMode="contain"')
    expect(native).toContain('width: Math.min(logoMaxWidth, inner * aspect)')
    // A feed card's badge is one fixed tile for every logo (wide, square, round or tall), initial fallback included.
    expect(web).toContain('h-[44px] min-w-[64px] max-w-[124px] rounded-xl border border-slate-200/90 bg-white px-1.5 py-1 shadow-sm sm:h-[48px] sm:min-w-[72px] sm:max-w-[140px] sm:px-2')
    expect(web).toContain("size === 'sm' ? 'h-full w-auto max-w-full object-contain'")
    expect(native).toContain('const FIXED = { height: 44, minWidth: 64, maxWidth: 124, paddingX: 6, paddingY: 4,')
    expect(native).toMatch(/fixedTile: \{\s+height: FIXED\.height,\s+minWidth: FIXED\.minWidth,\s+maxWidth: FIXED\.maxWidth,\s+borderRadius: 12,/)
    for (const c of ["borderColor: '#E2E8F0'", "shadowColor: '#0B1B3D'", 'shadowOpacity: 0.08', 'paddingHorizontal: FIXED.paddingX', 'paddingVertical: FIXED.paddingY', 'overflow: \'hidden\'']) expect(native).toContain(c)
    expect(native).toContain('width: Math.min(FIXED.maxInnerWidth, FIXED.innerHeight * aspect)')
    expect(read('landly-mobile/src/components/OfferCard.tsx')).toMatch(/height=\{LOGO_HEIGHT\}\s+fixed/)
    expect(read('components/discover/OfferCard.tsx')).toContain('<MerchantBadge size="sm"')
  })
})

describe('offer page', () => {
  const page = read('app/offers/[offerId]/page.tsx')

  it('shares the cards’ 16:9 picture, with no frame around it', () => {
    expect(page).toContain('<DealMedia src={offer.imageUrl} image={image}')
    expect(page).not.toMatch(/<PerkImage|h-\[180px\]|border-line bg-canvas/)
    expect(read('components/discover/DealMedia.tsx')).toContain('aspect-video')
  })

  it('picks the badge’s logo as the cards do, and sits it beside the business’s name', () => {
    expect(page).toContain("<MerchantBadge size=\"lg\" logoUrl={badgeLogoUri(offer.businessLogoUrl ?? '', offer.imageUrl, image.role) ?? ''} businessName={businessName.text} />")
    expect(page.indexOf('<MerchantBadge')).toBeLessThan(page.indexOf('<h1'))
  })

  it('shows a description only when it adds to the title', () => {
    expect(distinctDescription('Falafel pita for only 15 NIS!', 'Falafel pita for only 15 NIS!')).toBe('')
    expect(distinctDescription('Falafel pita!', '  falafel   PITA ')).toBe('')
    expect(distinctDescription('פיתה פלאפל ב-15 שח בלבד!', 'פיתה פלאפל ב-15 שח בלבד')).toBe('')
    expect(distinctDescription('Falafel pita', 'Falafel pita with fries')).toBe('Falafel pita with fries')
    expect(distinctDescription('Falafel pita', '')).toBe('')
    expect(page).toContain('distinctDescription(title.text, description.text)')
  })

  it('draws the discount as a sign and digits, with words for screen readers', () => {
    const badge = read('components/discover/DiscountBadge.tsx')
    expect(badge).toContain('{`-${percent}%`}')
    expect(badge).toContain("t('offer_percent_off')")
    expect(page).toContain('flex-wrap items-baseline')
  })

  it('puts the ways to get there beside the address as 44px icon links', () => {
    const nav = read('components/offers/NavigationLinks.tsx')
    expect(nav).toContain('flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden')
    expect(nav).toContain("{t('offer_nav_waze')}")
    expect(nav).toContain("{t('offer_nav_google')}")
    expect(page.indexOf('<NavigationLinks')).toBeGreaterThan(page.indexOf('{address}'))
  })
})

describe('store links', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

  it('falls back to signup while neither store has a listing', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_STORE_ID', '')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_LIVE', '')
    vi.resetModules()
    const links = await import('@/lib/appLinks')
    expect(links.APP_STORE_HREF).toBe('/signup')
    expect(links.GOOGLE_PLAY_HREF).toBe('/signup')
    expect(links.downloadTarget('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X)')).toBe('/signup')
    expect(links.downloadTarget('Mozilla/5.0 (Macintosh)')).toBe('/')
  })

  it('sends each phone to its own store once configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_STORE_ID', '1234567890')
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_PLAY_LIVE', '1')
    vi.resetModules()
    const links = await import('@/lib/appLinks')
    expect(links.downloadTarget('iPhone')).toBe('https://apps.apple.com/app/id1234567890')
    expect(links.downloadTarget('Linux; Android 15')).toBe('https://play.google.com/store/apps/details?id=com.amitbd.landlyapp')
  })
})

describe('the iOS scroll freeze', () => {
  const css = read('app/globals.css')
  const body = () => ({ style: { overflow: '' } }) as HTMLElement

  it('releases on unmount, and overlapping locks hold until the last one goes', () => {
    const el = body()
    const first = lockBodyScroll(el)
    const second = lockBodyScroll(el)
    expect(el.style.overflow).toBe('hidden')
    first()
    first()
    expect(el.style.overflow).toBe('hidden')
    second()
    expect(el.style.overflow).toBe('')
  })

  it('has every drawer use the shared lock, with the old bare writes gone', () => {
    for (const file of ['components/layout/Navbar.tsx', 'components/perks/SortMenu.tsx']) {
      expect(read(file), file).toContain('useBodyScrollLock(')
      expect(read(file), file).not.toContain('document.body.style.overflow')
    }
  })

  it('clips sideways on the page wrapper, never on body, and hides the closed drawer', () => {
    expect(css).not.toMatch(/(^|\n)body\{[^}]*overflow/)
    expect(css).toContain('.page-clip{overflow-x:hidden;overflow-x:clip;}')
    expect(read('app/layout.tsx')).toContain('<div className="page-clip">{children}</div>')
    expect(css).toMatch(/\.mobile-menu\{[^}]*visibility:hidden/)
    expect(css).toMatch(/\.mobile-menu\.open\{[^}]*visibility:visible/)
  })

  it('never blocks pinch-zoom on the page, and rails pan both ways', () => {
    expect(css).not.toMatch(/(html|body)[^{]*\{[^}]*touch-action/)
    for (const file of ['components/home/HowItWorks.tsx', 'components/discover/OfferCardRail.tsx', 'components/landing/LiveDeals.tsx']) {
      expect(read(file), file).toContain('touch-pan-x touch-pan-y touch-pinch-zoom')
    }
  })
})

describe('direction before the first paint', () => {
  it('runs from <head>, in plain ES5, setting lang for every language and dir for right-to-left ones', () => {
    expect(read('app/layout.tsx')).toContain('__html: LANG_DIRECTION_SCRIPT')
    expect(LANG_DIRECTION_SCRIPT).not.toMatch(/=>|\bconst\b|\blet\b/)
    const run = (stored: string | null) => {
      const html = { dir: 'ltr', lang: 'en', classList: { add: vi.fn() } }
      new Function('localStorage', 'document', LANG_DIRECTION_SCRIPT)({ getItem: () => stored }, { documentElement: html })
      return html
    }
    expect(run('he').dir).toBe('rtl')
    expect(run('fr').dir).toBe('ltr')
    expect(run(null).dir).toBe('ltr')
    // The document's language follows the saved one too, before React runs.
    expect(run('he').lang).toBe('he')
    expect(run('ru').lang).toBe('ru')
    expect(run('es').lang).toBe('es')
    expect(run('fr').lang).toBe('fr')
    expect(run(null).lang).toBe('en')
    expect(run('xx').lang).toBe('en')
  })
})

describe('the share card', () => {
  it('turns Hebrew into visual order and keeps digits and Latin readable', () => {
    expect(visualHebrewLine('אבג')).toBe('גבא')
    expect(visualHebrewLine('חוסכים 30 שקל')).toBe('לקש 30 םיכסוח')
    expect(visualHebrewLine('www.golandly.com')).toBe('www.golandly.com')
  })

  it('renders a real 1200 × 630 JPEG, light enough for link scrapers, with its Hebrew fonts bundled', async () => {
    const { default: Image, size, contentType } = await import('@/app/opengraph-image')
    expect(size).toEqual({ width: 1200, height: 630 })
    expect(contentType).toBe('image/jpeg')
    const jpeg = Buffer.from(await (await Image()).arrayBuffer())
    const { default: sharp } = await import('sharp')
    expect(await sharp(jpeg).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 })
    expect(jpeg.length).toBeLessThan(300 * 1024)
  }, 30000)
})
