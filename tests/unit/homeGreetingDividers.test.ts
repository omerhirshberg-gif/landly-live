import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { greetingKey, greetingPeriod } from '@/lib/auth/greeting'
import { translations } from '@/lib/i18n/translations'

const read = (p: string) => readFileSync(p, 'utf8')

describe('time-based greeting', () => {
  it('maps hours to periods at the boundaries', () => {
    const at = (h: number) => greetingPeriod(h)
    expect([at(5), at(11), at(12), at(17), at(18), at(21), at(22), at(4)]).toEqual(['morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night'])
  })
  it('has all four periods, with and without a name, in every language', () => {
    for (const lang of Object.keys(translations) as (keyof typeof translations)[]) {
      for (const p of ['morning', 'afternoon', 'evening', 'night'] as const) {
        expect(translations[lang][greetingKey(p, true)], `${lang} ${p}`).toContain('{name}')
        expect(translations[lang][greetingKey(p, false)], `${lang} ${p}`).toBeTruthy()
      }
    }
    expect(translations.en.greet_night).toBe('Good night, {name}')
  })
  it('Home uses the hook for both headings', () => {
    const src = read('components/home/LoggedInHome.tsx')
    expect(src).toContain('useGreetingPeriod()')
    expect(src.match(/\{greeting\}/g)).toHaveLength(2)
  })
})

describe('Home dividers', () => {
  const src = read('components/home/LoggedInHome.tsx')
  it('puts a hairline before curated, New, Best Sellers and each category rail', () => {
    for (const marker of ['name="home-curated"', 'name="home-new"', 'name="home-bestsellers"', 'name="home-category-rail"']) {
      const i = src.indexOf(marker)
      expect(i).toBeGreaterThan(-1)
      expect(src.slice(Math.max(0, i - 120), i)).toContain('<HomeDivider />')
    }
    expect(src).toContain('data-home-divider')
    expect(src).toContain('aria-hidden="true"')
  })
})

describe('Wishlist and My Pass layout', () => {
  it('wishlist uses the wide column and 280px grid, with no search bar', () => {
    const w = read('app/wishlist/page.tsx')
    expect(w).toContain('<MemberPageShell fluid>')
    expect(w).toContain('<MemberColumn wide')
    expect(w).toContain('repeat(auto-fill,280px)')
    expect(w).not.toContain('globalSearch')
  })
  it('my pass is one flow with a three-column stats row', () => {
    const m = read('app/member/page.tsx')
    expect(m).toContain('max-w-[960px]')
    expect(m).not.toMatch(/globalSearch|<aside/)
    expect(read('components/member/DashboardStats.tsx')).toContain('grid-cols-3')
  })
})
