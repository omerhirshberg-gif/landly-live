import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { translations } from '@/lib/i18n/translations'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const APP = 'landly-mobile/src/'
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u

const nativeProfile = read(`${APP}app/(tabs)/profile.tsx`)
const webProfile = read('components/profile/ProfileSection.tsx')

describe('Edit profile opens without focusing anything', () => {
  it('has no autoFocus on the phone field, native or web', () => {
    const phoneNative = nativeProfile.slice(nativeProfile.indexOf("label={t('onb_phoneLabel')}"), nativeProfile.indexOf("label={t('onb_phoneLabel')}") + 700)
    expect(phoneNative).not.toContain('autoFocus')
    const phoneWeb = webProfile.slice(webProfile.indexOf('id="profile-phone"'), webProfile.indexOf('id="profile-phone"') + 500)
    expect(phoneWeb).not.toContain('autoFocus')
  })

  it('still focuses the first name only when "Add your name" is tapped', () => {
    expect(nativeProfile).toContain('autoFocus={focusName}')
    expect(webProfile).toContain("autoFocus={part === 'firstName' && focusName}")
  })
})

describe('the country of origin is one selector row', () => {
  it('replaces the open list with a row and a sheet (native)', () => {
    expect(nativeProfile).toContain('<OriginSelectRow')
    expect(nativeProfile).not.toContain('CountryOfOriginList')
    const row = read(`${APP}components/OriginSelectRow.tsx`)
    expect(row).toContain('flagEmoji(chosen)')
    expect(row).toMatch(/DirectionalIcon/)
    const sheet = read(`${APP}components/CountryOfOriginSheet.tsx`)
    expect(sheet).toContain('<CountryOfOriginList')
    expect(sheet).toContain('animationType="slide"')
  })

  it('opens a bottom sheet on phones and a centred dialog from md (web)', () => {
    expect(webProfile).toContain('<OriginSelect')
    expect(webProfile).not.toContain('<select id="profile-origin"')
    const dialog = read('components/profile/OriginSelect.tsx')
    expect(dialog).toContain('role="dialog"')
    expect(dialog).toContain('items-end md:items-center md:justify-center')
    expect(dialog).toContain('rtl:-scale-x-100')
    expect(dialog).toContain("e.key === 'Escape'")
  })
})

describe('customer type and region are symmetrical card grids', () => {
  it('shares one OptionGrid across onboarding, member type and Edit profile (native)', () => {
    const grid = read(`${APP}components/OptionGrid.tsx`)
    expect(grid).toContain("flexBasis: '45%'")
    expect(grid).toContain('minHeight: 56')
    expect(grid).toContain('options.length % 2 === 1')
    expect(read(`${APP}auth/onboarding/PersonaStep.tsx`)).toContain('<OptionGrid')
    expect(nativeProfile).toContain('<OptionGrid')
    expect(nativeProfile).not.toContain('styles.regions')
  })

  it('uses the same two-column cards on the web profile', () => {
    const grid = read('components/ui/OptionGrid.tsx')
    expect(grid).toContain('grid grid-cols-2 gap-3')
    expect(grid).toContain('min-h-[56px]')
    expect(grid).toContain('col-span-2')
    expect(webProfile).toContain('idPrefix="profile-region"')
    expect(webProfile).not.toContain('<select id="profile-region"')
  })
})

describe('Save and Cancel sit in a pinned footer', () => {
  it('is pinned under the scroll on native, equal width, outside the card', () => {
    expect(nativeProfile).toContain('{editFooter && (')
    expect(nativeProfile).toMatch(/footer: \{ flexDirection: 'row', gap: 12[^}]*borderTopWidth: 1/)
    expect(nativeProfile).not.toContain('styles.editActions')
  })

  it('is sticky with safe-area padding on the web', () => {
    expect(webProfile).toContain('sticky bottom-0')
    expect(webProfile).toContain('env(safe-area-inset-bottom)')
  })
})

describe('the Wishlist heart', () => {
  const tabs = ['index', 'perks', 'raayonit', 'wallet'] as const

  it('is in the Home, Perks, Raayonit Card and My Pass headers (native)', () => {
    for (const tab of tabs) {
      const src = read(`${APP}app/(tabs)/${tab}.tsx`)
      // The heart lives in the top brand bar (TabHeader), so the tab file only frames itself in TabScreen.
      expect(src, tab).toContain('<TabScreen>')
      expect(src, tab).not.toContain('WishlistHeaderButton')
    }
  })

  it('is gone from the Profile header, which keeps the gear', () => {
    expect(nativeProfile).not.toContain("router.push('/wishlist')")
    expect(nativeProfile).not.toContain('name="heart"')
    expect(nativeProfile).toContain('<TabScreen action="settings">')
  })

  it('opens the wishlist from a 44pt button', () => {
    const button = read(`${APP}components/WishlistHeaderButton.tsx`)
    expect(button).toContain("router.push('/wishlist')")
    expect(button).toContain('header.action')
  })

  it('is hidden by the web navbar on /profile only', () => {
    const navbar = read('components/layout/Navbar.tsx')
    expect(navbar).toContain("pathname === '/profile' ?")
    expect(navbar).toContain('<WishlistPopover />')
    expect(navbar).toContain("href=\"/settings\"")
  })
})

describe('Sign out is a calm destructive row', () => {
  it('uses the soft rose tokens on native, not a solid red button', () => {
    const row = read(`${APP}components/SignOutRow.tsx`)
    expect(row).toContain('colors.dangerBg')
    expect(row).toContain('colors.dangerBorder')
    expect(row).toContain('color: colors.danger')
    expect(row).toContain('borderWidth: 1,')
    expect(row).toMatch(/DirectionalIcon/)
    expect(row).not.toMatch(/backgroundColor: colors\.danger[,\s]/)
    expect(nativeProfile).toContain('<SignOutRow')
    expect(nativeProfile).not.toContain("label={t('nav_logout')}")
  })

  it('carries the same colours on the web and sits below the profile card', () => {
    const row = read('components/profile/SignOutRow.tsx')
    expect(row).toContain('border-[#fecaca]')
    expect(row).toContain('bg-[#fef2f2]')
    expect(row).toContain('text-[#dc2626]')
    expect(row).toContain('rtl:-scale-x-100')
    const page = read('app/profile/page.tsx')
    expect(page.indexOf('<ProfileSection')).toBeLessThan(page.indexOf('<SignOutRow'))
    expect(page).toContain('endWebSession(user.uid)')
  })

  it('matches the theme tokens', () => {
    const theme = read(`${APP}theme.ts`)
    expect(theme).toContain("dangerBg: '#fef2f2'")
    expect(theme).toContain("dangerBorder: '#fecaca'")
    expect(theme).toContain("danger: '#dc2626'")
  })
})

describe('translations and emojis', () => {
  it('gives the empty country row a label in every language', () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) expect(translations[lang].profile_origin_select, lang).toBeTruthy()
  })

  it('adds no emoji to the new or changed files (the flag is data, from flagEmoji)', () => {
    const files = [
      `${APP}components/OptionGrid.tsx`,
      `${APP}components/OriginSelectRow.tsx`,
      `${APP}components/CountryOfOriginSheet.tsx`,
      `${APP}components/SignOutRow.tsx`,
      `${APP}components/WishlistHeaderButton.tsx`,
      `${APP}auth/onboarding/PersonaStep.tsx`,
      'components/ui/OptionGrid.tsx',
      'components/profile/OriginSelect.tsx',
      'components/profile/SignOutRow.tsx',
      'components/profile/ProfileSection.tsx',
      'app/profile/page.tsx',
    ]
    for (const file of files) expect(EMOJI.test(read(file)), file).toBe(false)
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) expect(EMOJI.test(translations[lang].profile_origin_select)).toBe(false)
  })
})
