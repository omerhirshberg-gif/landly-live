import { describe, expect, it, vi } from 'vitest'
import { translations } from '@/lib/i18n/translations'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))
vi.mock('@/lib/firebase/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }))
vi.mock('@/lib/firebase/useMemberProfile', () => ({ useMemberProfile: () => ({}) }))

const { ACCOUNT_MENU_GROUPS } = await import('@/components/layout/AccountMenu')

describe('avatar menu', () => {
  it('runs Profile and My Pass, then Settings', () => {
    expect(ACCOUNT_MENU_GROUPS.map((g) => g.map((i) => i.href))).toEqual([['/profile', '/member'], ['/settings']])
    expect(ACCOUNT_MENU_GROUPS.flat().map((i) => i.label)).toEqual(['nav_profile', 'nav_my_pass', 'nav_settings_heading'])
  })

  it('has no standalone Privacy & Security item (it lives on /settings)', () => {
    const items = ACCOUNT_MENU_GROUPS.flat()
    expect(items.map((i) => i.href)).not.toContain('/settings/privacy-security')
    expect(items.map((i) => i.label)).not.toContain('nav_security')
  })

  it('labels every item in every language', () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const item of ACCOUNT_MENU_GROUPS.flat()) expect(translations[lang][item.label]).toBeTruthy()
    }
    expect(translations.en.dash_segment_value_unset).toBe('Member')
  })
})
