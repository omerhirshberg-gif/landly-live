import { describe, expect, it } from 'vitest'
import { ADMIN_LANG_COOKIE, dirOf, localeFromCookieString, parseAdminLocale } from '@/lib/admin/adminLocale'
import { en } from '@/lib/admin/translations/en'
import { he } from '@/lib/admin/translations/he'
import { format, routeLabel, translate, translatePlural } from '@/lib/admin/translations'
import { ADMIN_ROUTES } from '@/lib/admin/routes'

describe('admin locale', () => {
  it('only ever resolves to en or he, defaulting to English', () => {
    expect(parseAdminLocale('he')).toBe('he')
    expect(parseAdminLocale('en')).toBe('en')
    for (const junk of ['fr', '', null, undefined, 42, 'HE']) expect(parseAdminLocale(junk)).toBe('en')
  })

  it('sets the direction from the language', () => {
    expect(dirOf('he')).toBe('rtl')
    expect(dirOf('en')).toBe('ltr')
  })

  it('reads the admin_lang cookie out of a cookie string', () => {
    expect(ADMIN_LANG_COOKIE).toBe('admin_lang')
    expect(localeFromCookieString('a=1; admin_lang=he; b=2')).toBe('he')
    expect(localeFromCookieString('admin_lang=en')).toBe('en')
    expect(localeFromCookieString('admin_lang=xx')).toBe('en')
    expect(localeFromCookieString('other=he')).toBeNull()
    expect(localeFromCookieString('')).toBeNull()
    expect(localeFromCookieString(undefined)).toBeNull()
  })
})

describe('admin dictionary', () => {
  it('has a Hebrew string for every English key and no extras', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort())
  })

  it('uses the same placeholders in both languages', () => {
    // A singular may spell the number out ("בית עסק אחד"), so {n} is not required in `.one` forms.
    const holes = (key: string, text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).filter((name) => !(key.endsWith('.one') && name === 'n')).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) expect(holes(key, he[key]), key).toEqual(holes(key, en[key]))
  })

  it('has no empty strings', () => {
    for (const [key, value] of Object.entries(he)) expect(value.trim(), key).not.toBe('')
  })

  it('uses the approved Hebrew terms for the main sections', () => {
    expect(he['nav.dashboard']).toBe('לוח בקרה')
    expect(he['nav.businesses']).toBe('בתי עסק')
    expect(he['nav.offers']).toBe('ניהול והעלאת הטבות')
    expect(he['nav.inventory']).toBe('מעקב מלאי וקופונים')
    expect(he['nav.merchants']).toBe('הזמנת עסקים והסכמים')
    expect(he['nav.payouts']).toBe('תשלומי מס״ב')
    expect(he['nav.users']).toBe('ניהול חברים ומשתמשים')
    expect(he['offers.add']).toBe('הוספת הטבה חדשה')
    expect(he['mer.batchUpload']).toBe('טעינת קובץ אקסל / אצווה')
  })

  it('translates every route title of the admin tree', () => {
    for (const route of ADMIN_ROUTES) {
      expect(`route.${route.title}` in en, route.title).toBe(true)
      expect(routeLabel('he', route.title)).not.toBe('')
    }
    // A business's own name is a crumb too: it passes through untouched.
    expect(routeLabel('he', 'קפה נדי')).toBe('קפה נדי')
    expect(routeLabel('en', 'Pizza Hut')).toBe('Pizza Hut')
  })

  it('fills placeholders and picks singular or plural by count', () => {
    expect(format('{a} of {b}', { a: 1, b: 'x' })).toBe('1 of x')
    expect(format('{missing}', { a: 1 })).toBe('{missing}')
    expect(translate('he', 'offers.confirmDelete', { title: 'X' })).toBe('למחוק את "X"?')
    expect(translatePlural('en', 'pay.merchants', 1)).toBe('1 merchant')
    expect(translatePlural('en', 'pay.merchants', 2)).toBe('2 merchants')
    expect(translatePlural('he', 'pay.merchants', 1)).toBe('בית עסק אחד')
    expect(translatePlural('he', 'pay.merchants', 3)).toBe('3 בתי עסק')
  })

  it('has both forms for every counted noun, in both languages', () => {
    for (const dict of [en, he] as Record<string, string>[]) {
      for (const key of Object.keys(dict).filter((k) => k.endsWith('.one'))) expect(dict[key.replace(/\.one$/, '.other')], key).toBeTruthy()
    }
  })
})

describe('admin Hebrew coverage', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const read = (path: string) => readFileSync(`${__dirname}/../../${path}`, 'utf8')

  it('shows the compact EN | עב switcher, with the full names kept for screen readers', () => {
    const source = read('components/admin/AdminLangSwitch.tsx')
    expect(source).toContain("label: 'EN'")
    expect(source).toContain("label: 'עב'")
    expect(source).not.toMatch(/label: 'עברית'/)
    expect(source).toContain('aria-label={t(option.nameKey)}')
    expect(en['header.langHeName']).toBe('עברית')
  })

  it('has no hard-coded English on the businesses list', () => {
    const page = read('app/admin/businesses/page.tsx')
    expect(page).toContain('useAdminT')
    for (const text of ['Add new business', 'Refresh addresses', 'Search by name', 'Active offers', 'Redeemed', 'No businesses yet']) expect(page, text).not.toContain(`"${text}`)
    expect(he['biz.add']).not.toBe(en['biz.add'])
  })

  it('titles the tab in the admin language', async () => {
    const { adminDocumentTitle } = await import('@/components/admin/AdminDocumentTitle')
    const heRoute = (label: string) => routeLabel('he', label)
    expect(adminDocumentTitle(heRoute, '/admin/businesses')).toBe('בתי עסק | Landly Admin')
    expect(adminDocumentTitle((l) => routeLabel('en', l), '/admin/businesses')).toBe('Businesses | Landly Admin')
    expect(adminDocumentTitle(heRoute, '/admin/inventory')).toBe('מעקב מלאי וקופונים | Landly Admin')
  })

  it('names the two catalog tabs', () => {
    expect([en['nav.offers'], en['nav.inventory']]).toEqual(['Perk Management', 'Stock & Vouchers'])
  })
})
