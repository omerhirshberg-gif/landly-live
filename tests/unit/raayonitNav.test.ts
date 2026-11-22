import { describe, expect, it } from 'vitest'
import { isNavLinkActive } from '@/lib/navActive'
import { translations } from '@/lib/i18n/translations'

describe('Raayonit nav tab', () => {
  it('is active on /raayonit (with or without a category), not on other pages', () => {
    expect(isNavLinkActive('/raayonit', '/raayonit', null)).toBe(true)
    expect(isNavLinkActive('/categories', '/raayonit', null)).toBe(false)
  })
  it('has a label and the 1-click strings in every language', () => {
    for (const lang of ['he', 'en', 'ru', 'fr', 'es'] as const) {
      const t = translations[lang]
      expect(t.nav_raayonit).toBeTruthy()
      expect(t.products_cta).toBeTruthy()
      expect(t.raayonit_continue_order).toContain('{price}')
      expect(t.products_details_link).toContain('{count}')
    }
    expect(translations.he.nav_raayonit).toBe('תו על')
  })
})
