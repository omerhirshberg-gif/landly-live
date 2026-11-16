import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: () => '/admin', useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

import AdminSettingsMenu from '@/components/admin/AdminSettingsMenu'
import { AdminLocaleProvider } from '@/lib/admin/translations'
import { AdminThemeProvider } from '@/lib/admin/adminTheme'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'

const source = readFileSync(join(__dirname, '..', '..', 'components/admin/AdminSettingsMenu.tsx'), 'utf8')
const render = (locale: 'en' | 'he') =>
  renderToStaticMarkup(createElement(AdminLocaleProvider, { initialLocale: locale, children: createElement(AdminThemeProvider, { children: createElement(AdminSettingsMenu, { onLogout: () => {} }) }) }))

describe('AdminSettingsMenu', () => {
  it('renders a closed 44px gear that announces a menu, in both languages', () => {
    for (const [locale, dict] of [['en', en], ['he', he]] as const) {
      const html = render(locale)
      expect(html).toContain(`aria-label="${dict['settings.open']}"`)
      expect(html).toContain('aria-haspopup="menu"')
      expect(html).toContain('aria-expanded="false"')
      expect(html).toContain('h-11 w-11')
      expect(html).not.toContain('role="menu"')
    }
  })
  it('opens language, background and sign out, closes on Escape or an outside tap, and keeps 44px targets', () => {
    expect(source).toContain('<AdminLangSwitch')
    expect(source).toContain('<AdminThemeSwitch')
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain("addEventListener('pointerdown'")
    expect(source).toContain('onLogout()')
    expect(source).toContain('min-h-11')
    // Anchored to the end edge in the page's direction (RTL-safe) and capped to the viewport.
    expect(source).toContain('end-0')
    expect(source).toContain('max-w-[calc(100vw-2rem)]')
  })
  it('has English and Hebrew copy for every label', () => {
    for (const key of ['settings.open', 'settings.title', 'settings.theme', 'settings.signOut', 'header.language'] as const) {
      expect(en[key]).toBeTruthy()
      expect(he[key]).toBeTruthy()
    }
  })
})
