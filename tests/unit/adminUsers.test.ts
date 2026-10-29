import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { formatIsraeliDate, formatIsraeliDateTime } from '@/lib/admin/formatDate'
import { displayPhone, parseBusinessPhone, whatsappHref } from '@/lib/admin/businessPhone'
import { countPasses, countryShares, dialCode, filterUsers, phoneCountryOf, segmentShares, toAdminUserRow, userTotals, type AdminUserRow, type UserFilters } from '@/lib/admin/userStats'
import { alternateBusinessName } from '@/lib/business/businessText'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'
import CategoryBadge, { categoryEmoji } from '@/components/admin/CategoryBadge'
import LogoTile from '@/components/admin/LogoTile'

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const row = (patch: Partial<AdminUserRow>): AdminUserRow => ({
  uid: 'u', name: '', email: '', photoURL: '', phone: '', phoneCountry: '', originCountry: '', customerType: '', customerTypeOther: '',
  emailVerified: false, phoneVerified: false, activePasses: 0, createdAt: null, lastSignInAt: null, ...patch,
})

describe('admin dates', () => {
  it('are DD.MM.YYYY (HH:mm, 24-hour) on Israel time, whatever the runtime zone', () => {
    // 14:36 UTC is 17:36 in Israel in October (summer time).
    expect(formatIsraeliDateTime('2026-10-23T14:36:00Z')).toBe('23.10.2026 17:36')
    expect(formatIsraeliDate('2026-10-23T14:36:00Z')).toBe('23.10.2026')
    // Just before midnight UTC is already the next day in Israel.
    expect(formatIsraeliDate('2026-01-04T22:30:00Z')).toBe('05.01.2026')
    expect(formatIsraeliDateTime(new Date('2026-01-05T07:05:00Z'))).toBe('05.01.2026 09:05')
    expect(formatIsraeliDate(null)).toBe('—')
    expect(formatIsraeliDateTime('not a date')).toBe('—')
  })

  it('leave no browser-locale date in the admin', () => {
    for (const path of ['app/admin/offers/page.tsx', 'app/admin/offers/[offerId]/edit/page.tsx', 'app/admin/orphans/page.tsx', 'app/admin/businesses/[uid]/page.tsx', 'components/admin/AdminDashboard.tsx', 'app/admin/users/page.tsx']) {
      expect(read(path), path).not.toMatch(/toLocaleDateString|toLocaleTimeString/)
    }
  })
})

describe('business phone', () => {
  it('is optional, stored as E.164, and typed the local Israeli way or with +country', () => {
    expect(parseBusinessPhone(undefined)).toEqual({ ok: true, phone: '' })
    expect(parseBusinessPhone('  ')).toEqual({ ok: true, phone: '' })
    expect(parseBusinessPhone('03-123-4567')).toEqual({ ok: true, phone: '+97231234567' })
    expect(parseBusinessPhone('050 123 4567')).toEqual({ ok: true, phone: '+972501234567' })
    expect(parseBusinessPhone('+44 20 7946 0958')).toEqual({ ok: true, phone: '+442079460958' })
    expect(parseBusinessPhone('12')).toMatchObject({ ok: false })
    expect(parseBusinessPhone(42)).toMatchObject({ ok: false })
  })

  it('shows Israeli numbers the local way and links WhatsApp by digits', () => {
    expect(displayPhone('+972501234567')).toBe('050-123-4567')
    expect(displayPhone('+442079460958')).toBe('+44 20 7946 0958')
    expect(whatsappHref('+972501234567')).toBe('https://wa.me/972501234567')
  })

  it('is saved on the business only, never copied onto its offers', () => {
    const patch = read('app/api/admin/businesses/[uid]/route.ts')
    expect(patch).toContain('parseBusinessPhone(business.phone)')
    const offerUpdate = patch.slice(patch.indexOf('for (const doc of offersSnap.docs)'), patch.indexOf('await batch.commit()'))
    expect(offerUpdate).not.toContain('phone')
    expect(read('app/api/admin/businesses/route.ts')).toContain("...(phone.phone ? { phone: phone.phone } : {})")
  })
})

describe('users and demographics', () => {
  it('merges the member doc with Auth and their active passes', () => {
    const merged = toAdminUserRow(
      'u1',
      { firstName: 'Dana', lastName: 'Levi', email: 'dana@x.com', phone: '+12025550123', customerType: 'lone_soldier', countryOfOrigin: 'US', phoneVerified: true },
      { emailVerified: true, creationTime: 'Mon, 05 Jan 2026 07:05:00 GMT', lastSignInTime: 'Fri, 23 Oct 2026 14:36:00 GMT' },
      2,
    )
    expect(merged).toMatchObject({
      name: 'Dana Levi', phoneCountry: 'US', originCountry: 'US', customerType: 'lone_soldier', emailVerified: true, phoneVerified: true, activePasses: 2,
      createdAt: '2026-01-05T07:05:00.000Z', lastSignInAt: '2026-10-23T14:36:00.000Z',
    })
    // Unknown types and malformed countries read as "not set"; a missing Auth record as unverified.
    expect(toAdminUserRow('u2', { customerType: 'tourist', countryOfOrigin: 'usa' }, undefined, 0)).toMatchObject({ customerType: '', originCountry: '', emailVerified: false, createdAt: null })
  })

  it('tells the phone country by the number, not just the dialling code', () => {
    expect(phoneCountryOf('+972501234567')).toBe('IL')
    expect(phoneCountryOf('+12025550123')).toBe('US')
    expect(phoneCountryOf('+14165550123')).toBe('CA')
    expect(phoneCountryOf('')).toBe('')
    expect(dialCode('IL')).toBe('+972')
    expect(dialCode('RU')).toBe('+7')
    expect(dialCode('')).toBe('')
  })

  it('counts passes from one query of active vouchers', () => {
    expect([...countPasses(['a', 'b', 'a', null, ''])]).toEqual([['a', 2], ['b', 1]])
    const route = read('app/api/admin/users/route.ts')
    expect(route).toContain(".where('status', '==', 'active').select('userId')")
    expect(route).toContain('.select(...USER_FIELDS)')
    expect(route).toContain('CACHE_MS = 5 * 60 * 1000')
    expect(route).toContain('requireAdminAuth(request)')
  })

  it('lists every member type in onboarding order, then "not set" only when someone is', () => {
    const rows = [row({ customerType: 'student' }), row({ customerType: 'student' }), row({ customerType: 'traveler' }), row({})]
    const shares = segmentShares(rows)
    expect(shares.map((s) => s.key)).toEqual([...CUSTOMER_TYPES.map((t) => t.value), ''])
    expect(shares.find((s) => s.key === 'student')).toEqual({ key: 'student', count: 2, percent: 50 })
    expect(segmentShares([row({ customerType: 'other' })]).some((s) => s.key === '')).toBe(false)
    // The route's exact totals win over the (capped) rows.
    expect(segmentShares(rows, { student: 10, '': 0 }).find((s) => s.key === 'student')?.percent).toBe(100)
  })

  it('ranks countries, folds the long tail into "other" and puts "not set" last', () => {
    const rows = [...['IL', 'IL', 'IL', 'US', 'US', 'FR', 'GB', 'RU'].map((c) => row({ phoneCountry: c })), row({})]
    const shares = countryShares(rows, (r) => r.phoneCountry, 3)
    expect(shares.map((s) => [s.key, s.count])).toEqual([['IL', 3], ['US', 2], ['FR', 1], ['*', 2], ['', 1]])
    expect(shares[0]!.percent).toBe(33.3)
  })

  it('searches by name, email or phone typed any way, and filters by type and country', () => {
    const rows = [
      row({ uid: 'a', name: 'Dana Levi', email: 'dana@x.com', phone: '+972501234567', phoneCountry: 'IL', customerType: 'student', originCountry: 'US' }),
      row({ uid: 'b', name: 'Yossi', email: 'y@x.com', customerType: 'traveler', originCountry: 'FR' }),
    ]
    const none: UserFilters = { query: '', customerType: null, originCountry: null, phoneCountry: null }
    const ids = (filters: Partial<UserFilters>) => filterUsers(rows, { ...none, ...filters }).map((r) => r.uid)
    expect(ids({ query: 'levi' })).toEqual(['a'])
    expect(ids({ query: 'Y@X' })).toEqual(['b'])
    expect(ids({ query: '050-123' })).toEqual(['a'])
    expect(ids({ query: '+972 50' })).toEqual(['a'])
    expect(ids({ customerType: 'traveler' })).toEqual(['b'])
    expect(ids({ originCountry: 'US' })).toEqual(['a'])
    expect(ids({ phoneCountry: '' })).toEqual(['b'])
    expect(userTotals(rows)).toEqual({ members: 2, emailVerified: 0, phoneVerified: 0, withPasses: 0 })
  })

  it('has its own page in the admin, under Dashboard, linked from the sidebar', () => {
    expect(read('components/admin/Sidebar.tsx')).toContain("href: '/admin/users'")
    const page = read('app/admin/users/page.tsx')
    expect(page).toContain("adminFetch(`/api/admin/users${fresh ? '?fresh=1' : ''}`)")
    expect(page).toContain('href={whatsappHref(user.phone)}')
    expect(page).toContain('formatIsraeliDateTime(user.lastSignInAt)')
  })
})

describe('business showcase', () => {
  it('names a business in the other language too, when it reads differently', () => {
    const translations = { sourceLang: 'he', fields: { en: { businessName: { text: 'Cafe Nadi', manual: true } } } } as never
    expect(alternateBusinessName('קפה נדי', translations)).toBe('Cafe Nadi')
    expect(alternateBusinessName('Pizza Hut', null)).toBe('')
  })

  it('gives categories their emoji, and logos a squircle that falls back to the initial', () => {
    expect(categoryEmoji('Restaurants and Cafes')).toBe('🍽️')
    expect(categoryEmoji('Something else')).toBe('')
    expect(renderToStaticMarkup(createElement(CategoryBadge, { category: 'Beach and Sea' }))).toContain('🏖️')
    const empty = renderToStaticMarkup(createElement(LogoTile, { logoUrl: '', name: 'pizza' }))
    expect(empty).toContain('h-12 w-12 rounded-[14px]')
    expect(empty).toContain('>P</span>')
    const hero = renderToStaticMarkup(createElement(LogoTile, { logoUrl: 'https://x/logo.png', name: 'Pizza', size: 'xl' }))
    expect(hero).toContain('h-20 w-20')
    expect(hero).toContain('object-contain')
  })

  it('shows the business page as a hero over Offers and Details tabs, with map and phone links', () => {
    const page = read('app/admin/businesses/[uid]/page.tsx')
    expect(page).toContain('<BusinessHero')
    expect(page).toContain('<OfferShowcaseCard')
    const hero = read('components/admin/BusinessHero.tsx')
    expect(hero).toContain('https://www.google.com/maps/search/?api=1')
    expect(hero).toContain('https://waze.com/ul?ll=')
    expect(hero).toContain('href={whatsappHref(business.phone)}')
  })
})
