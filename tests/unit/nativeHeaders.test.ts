import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { translations } from '@/lib/i18n/translations'

const MOBILE = 'landly-mobile'
const read = (path: string) => readFileSync(`landly-mobile/src/${path}`, 'utf8')

describe('native Home header', () => {
  const home = read('app/(tabs)/index.tsx')

  it('is just the avatar and the welcome, with no tagline', () => {
    expect(home).not.toContain("t('deals_title')")
    expect(home).toContain("<Avatar uri={photoURL} initials={initials} size={48} />")
    expect(home).toContain("t('home_welcome').replace('{name}', firstName)")
  })

  it('sits close under the safe area without a second gap', () => {
    expect(home).toContain("<SafeAreaView style={styles.safe} edges={['top']}>")
    expect(home).toContain("content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, flexGrow: 1 }")
    expect(home).toContain("greetingSlot: { minHeight: 48, marginBottom: 16, justifyContent: 'center' }")
  })
})

describe('native My Pass header', () => {
  const wallet = read('app/(tabs)/wallet.tsx')

  it('titles the screen My Pass, with no Member Dashboard label or repeated welcome', () => {
    expect(wallet).not.toContain("t('dash_label')")
    expect(wallet).not.toContain('dash_welcome')
    expect(wallet).toMatch(/<AppText accessibilityRole="header" style=\{type\.screenTitle\}>\s*\{t\('pass_screen_title'\)\}/)
  })

  it('keeps the customer-type badge and the stats right under the title', () => {
    const title = wallet.indexOf("t('pass_screen_title')")
    const badge = wallet.indexOf('styles.badge,')
    const stats = wallet.indexOf('<DashboardStats')
    expect(title).toBeGreaterThan(0)
    expect(badge).toBeGreaterThan(title)
    expect(stats).toBeGreaterThan(badge)
  })

  it('reads My Pass in English and השוברים שלי in Hebrew', () => {
    expect(translations.en.pass_screen_title).toBe('My Pass')
    expect(translations.he.pass_screen_title).toBe('השוברים שלי')
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) expect(translations[lang].pass_screen_title).toBeTruthy()
  })
})

describe('native back button', () => {
  const button = read('components/GlassBackButton.tsx')

  it('is glass on iOS and a tonal Material circle with a ripple on Android', () => {
    expect(button).toContain('<BlurView tint="systemChromeMaterial"')
    expect(button).toContain("borderWidth: hairline, borderColor: 'rgba(255, 255, 255, 0.5)'")
    expect(button).toContain('android_ripple={{ color: colors.border, borderless: true, radius: 24 }}')
    expect(button).toContain('colors.surfaceContainer')
  })

  it('falls back to a solid circle if the blur fails to render', () => {
    expect(button).toContain('static getDerivedStateFromError()')
    expect(button).toMatch(/<GlassFallback>\s*<BlurView/)
  })

  it('is a 42pt circle in a 48pt target whose chevron mirrors in Hebrew', () => {
    expect(button).toContain('const SIZE = 42')
    expect(button).toContain('target: { width: 48, height: 48')
    expect(button).toContain('name="chevronStart"')
    expect(button).toContain('flip={isRtl}')
  })

  it('backs every settings header and the category screen', () => {
    expect(read('components/ScreenHeader.tsx')).toContain("<GlassBackButton label={t('settings_back')} onPress={goBack} />")
    expect(read('app/category/[category].tsx')).toContain("<GlassBackButton label={t('cats_detail_back')} onPress={goBack} />")
  })
})

describe('native Home', () => {
  const home = read('app/(tabs)/index.tsx')

  it('leads with the pass hero card, which opens My Pass as one button', () => {
    expect(home).toContain('styles.passCard')
    expect(home).toContain('onPress={openPass}')
    expect(home).toContain("t('home_pass_cta')")
    expect(home).not.toContain('<Button ')
  })

  it('orders the pass, then the curated perks, then the categories rail', () => {
    const pass = home.indexOf('styles.passCard')
    const curated = home.indexOf("t('home_curated_title')")
    const categories = home.indexOf('<CategoryRail')
    expect(pass).toBeGreaterThan(-1)
    expect(curated).toBeGreaterThan(pass)
    expect(categories).toBeGreaterThan(curated)
  })
})

describe('native Wishlist tab', () => {
  it('is the third of five tabs on the native and web bars, with the live count as its badge', () => {
    const native = read('app/(tabs)/_layout.tsx')
    const web = read('app/(tabs)/_layout.web.tsx')
    for (const layout of [native, web]) {
      const order = ['"index"', '"perks"', '"wishlist"', '"wallet"', '"profile"'].map((name) => layout.indexOf(`name=${name}`))
      expect(order.every((i) => i > -1)).toBe(true)
      expect([...order].sort((a, b) => a - b)).toEqual(order)
    }
    expect(native).toContain("sf={{ default: 'heart', selected: 'heart.fill' }}")
    // An empty Badge still draws a dot, so the element itself only renders with saved perks.
    expect(native).toContain('{wishlistCount > 0 && <NativeTabs.Trigger.Badge>{String(wishlistCount)}</NativeTabs.Trigger.Badge>}')
    expect(native).not.toContain(': undefined}</NativeTabs.Trigger.Badge>')
    expect(web).toContain('tabBarBadge: wishlistCount > 0 ? wishlistCount : undefined')
    // The tab replaces the heart that used to end the Perks search row.
    const perks = read('app/(tabs)/perks.tsx')
    expect(perks).not.toContain('WishlistButton')
    expect(perks).toMatch(/<PerksSearchField [^>]*\/>\s*<NearMeButton/)
  })
})

describe('native navigation buttons', () => {
  const nav = read('components/NavigationButtons.tsx')

  it('sits Waze and Google Maps side by side in equal halves, with the official app marks', () => {
    expect(nav).toContain("row: { flexDirection: 'row', gap: 12")
    expect(nav).toContain('borderRadius: 14,')
    expect(nav).toContain('height: 46,')
    expect(nav).toContain('flex: 1,')
    expect(nav).not.toContain('flexWrap')
    expect(nav).toContain("require('../../assets/icons/waze.webp')")
    expect(nav).toContain("require('../../assets/icons/google-maps.webp')")
    expect(nav).toContain('icon: { width: 20, height: 20 }')
    for (const file of ['assets/icons/waze.webp', 'assets/icons/google-maps.webp', '../public/icons/waze.webp', '../public/icons/google-maps.webp']) {
      expect(existsSync(join(MOBILE, file))).toBe(true)
    }
  })
})

describe('native offer screen heart', () => {
  it('is the glass heart floating over the framed picture, with no discount pill on the picture', () => {
    const screen = read('app/offer/[offerId].tsx')
    const heart = read('components/GlassHeartButton.tsx')
    expect(screen).toContain('<GlassHeartButton')
    expect(heart).toContain('<BlurView tint="systemChromeMaterial"')
    expect(heart).toContain('borderWidth: hairline')
    expect(heart).toContain("borderColor: 'rgba(255, 255, 255, 0.6)'")
    expect(heart).toContain('color={saved ? colors.heart : colors.heading}')
    expect(screen.indexOf('styles.discount')).toBeGreaterThan(screen.indexOf('styles.priceRow'))
  })
})

describe('native offer card', () => {
  const card = read('components/OfferCard.tsx')

  it('keeps the photo short and framed, and the discount in the price row', () => {
    expect(card).toContain('mediaStandard: { height: 130 }')
    expect(card).toContain('mediaCompact: { height: 130 }')
    expect(card).toMatch(/media: \{\s*marginHorizontal: 8,\s*marginTop: 8,\s*borderRadius: radius.frame,\s*borderWidth: 1,\s*borderColor: colors.border,\s*overflow: 'hidden',\s*backgroundColor: colors.background,/)
    const price = card.indexOf('styles.priceRow')
    expect(card.indexOf('<View style={styles.discount}>')).toBeGreaterThan(price)
  })
})
