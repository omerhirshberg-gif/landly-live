import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { translations } from '@/lib/i18n/translations'

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
