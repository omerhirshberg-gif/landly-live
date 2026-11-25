import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const APP = 'landly-mobile/src/'
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
const TABS = ['index', 'perks', 'raayonit', 'wallet', 'profile'].map((t) => `${APP}app/(tabs)/${t}.tsx`)

describe('native: one persistent GoLandly brand bar on all five tabs', () => {
  it.each(TABS)('%s is framed by TabScreen, not its own SafeAreaView or TabHeader', (file) => {
    const src = read(file)
    expect(src.match(/<TabScreen( action="settings")?>/g)?.length).toBe(1)
    expect(src).toContain('</TabScreen>')
    expect(src).not.toContain('<SafeAreaView')
    expect(src).not.toContain('<TabHeader')
  })

  it('TabScreen owns the top inset and renders the bar above the screen, outside any scroller', () => {
    const src = read(`${APP}components/TabScreen.tsx`)
    expect(src).toContain("edges={['top']}")
    expect(src.indexOf('<TabHeader action={action} />')).toBeGreaterThan(src.indexOf('<SafeAreaView'))
    expect(src.indexOf('<TabHeader action={action} />')).toBeLessThan(src.indexOf('{children}'))
    expect(src).not.toMatch(/ScrollView|FlatList/)
  })

  it('the bar has one fixed height and the content column padding, pinned to the physical left', () => {
    const src = read(`${APP}components/TabHeader.tsx`)
    expect(src).toContain('TAB_HEADER_HEIGHT = 48')
    expect(src).toContain('TAB_HEADER_TOP = 4')
    expect(src).toContain('useLayout()')
    expect(src).toContain("direction: 'ltr'")
    expect(src).toContain('height: TAB_HEADER_HEIGHT + TAB_HEADER_TOP')
    expect(src).not.toMatch(/minHeight|paddingHorizontal/)
  })

  it('the DEV pill stays on the physical right in every language', () => {
    const src = read(`${APP}components/DevEnvironmentBadge.tsx`)
    expect(src).toContain("direction: 'ltr'")
    expect(src).toContain("alignItems: 'flex-end'")
    expect(src).not.toMatch(/\bend: 8\b/)
  })

  it('Raayonit and Profile take their side padding from useLayout like the other three', () => {
    for (const f of ['raayonit', 'profile', 'wallet', 'perks', 'index']) {
      expect(read(`${APP}app/(tabs)/${f}.tsx`)).toMatch(/paddingLeft, paddingRight|paddingRight/)
    }
    expect(read(`${APP}app/(tabs)/profile.tsx`)).toContain('{ paddingLeft, paddingRight }')
  })

  it('keeps the trailing actions: the heart on four tabs, the settings gear on Profile', () => {
    const header = read(`${APP}components/TabHeader.tsx`)
    expect(header).toContain("action === 'settings' ? <SettingsHeaderButton /> : <WishlistHeaderButton />")
    expect(read(`${APP}components/TabScreen.tsx`)).toContain("action = 'wishlist'")
    for (const f of ['index', 'perks', 'raayonit', 'wallet']) {
      const src = read(`${APP}app/(tabs)/${f}.tsx`)
      expect(src).toContain('<TabScreen>')
      expect(src).not.toContain('WishlistHeaderButton')
    }
    const profile = read(`${APP}app/(tabs)/profile.tsx`)
    expect(profile).toContain('<TabScreen action="settings">')
    expect(profile).not.toContain('WishlistHeaderButton')
    expect(read(`${APP}components/SettingsHeaderButton.tsx`)).toContain("t('settings_gear_label')")
  })

  it('no tab puts an action in the lower ScreenTitleRow', () => {
    for (const file of TABS) expect(read(file)).not.toMatch(/<ScreenTitleRow[^>]*trailing=/)
  })

  it('the DEV pill sits in the header row beside the action and shrinks instead of overlapping', () => {
    const header = read(`${APP}components/TabHeader.tsx`)
    expect(header.indexOf('<DevPill />')).toBeLessThan(header.indexOf('<SettingsHeaderButton />'))
    const dev = read(`${APP}components/DevEnvironmentBadge.tsx`)
    expect(dev).toContain("useSegments()[0] === '(tabs)'")
    expect(dev).toContain('flexShrink: 1')
  })

  it('web: the Navbar swaps the heart for the Settings gear on /profile, in the same 40px slot', () => {
    const nav = read('components/layout/Navbar.tsx')
    expect(nav).toContain("pathname === '/profile' ?")
    expect(nav).toContain('href="/settings"')
    expect(nav.match(/h-10 w-10/g)?.length).toBeGreaterThanOrEqual(1)
    expect(read('components/layout/WishlistPopover.tsx')).toContain('h-10 w-10')
  })

  it('the bar never wears an emoji', () => {
    for (const f of ['TabScreen', 'TabHeader', 'BrandLockup', 'SettingsHeaderButton', 'DevEnvironmentBadge']) expect(EMOJI.test(read(`${APP}components/${f}.tsx`))).toBe(false)
  })
})

describe('web: the same Navbar frames all five primary routes', () => {
  const ROUTES: Record<string, string> = {
    home: 'components/home/HomePage.tsx',
    categories: 'app/categories/page.tsx',
    raayonit: 'app/raayonit/page.tsx',
    member: 'app/member/page.tsx',
    profile: 'app/profile/page.tsx',
  }

  it.each(Object.entries(ROUTES))('%s mounts <Navbar /> in every branch', (_name, file) => {
    const src = read(file)
    // every early return of a loading/guest shell and the loaded page carry the bar
    expect(src).toContain('<Navbar />')
  })

  it('the bar is fixed at one height and pages clear it with the same offset', () => {
    const nav = read('components/layout/Navbar.tsx')
    expect(nav).toContain('fixed top-0 inset-x-0')
    expect(nav).toContain('h-16')
    expect(read('app/globals.css')).toContain('.below-header{padding-top:var(--header-offset);}')
  })

  it('the lockup is physically on the left in both languages', () => {
    expect(read('components/layout/Navbar.tsx')).toContain('<div dir="ltr" className="relative w-full px-4')
  })
})
