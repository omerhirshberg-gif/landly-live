import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
vi.mock('@/lib/firebase/config', () => ({ auth: {}, db: {} }))

import MemberPageShell, { PAGE_TITLE, PageTitle } from '@/components/layout/MemberPageShell'

const read = (path: string) => readFileSync(path, 'utf8')

const PAGES = ['components/home/LoggedInHome.tsx', 'app/categories/page.tsx', 'app/wishlist/page.tsx', 'app/member/page.tsx', 'app/support/page.tsx', 'app/profile/page.tsx']

describe('MemberPageShell', () => {
  it('gives every signed-in tab the same column, gutters and top padding', () => {
    const html = renderToStaticMarkup(createElement(MemberPageShell, null, 'CONTENT'))
    expect(html).toBe('<div class="max-w-member mx-auto px-3 min-[380px]:px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-10 sm:pb-12">CONTENT</div>')
  })

  it('pins a footer to the bottom of the screen below the navbar', () => {
    const html = renderToStaticMarkup(createElement(MemberPageShell, { footer: 'FOOTER', children: 'CONTENT' }))
    expect(html).toContain('flex min-h-[calc(100dvh-var(--header-offset))] flex-col')
    expect(html).toContain('<div class="flex-1">CONTENT</div><div class="mt-auto pt-10 pb-6">FOOTER</div>')
  })

  it('titles a page with the shared type, anchored to the start edge in both directions', () => {
    expect(PAGE_TITLE).toContain('text-start')
    expect(PAGE_TITLE).not.toMatch(/\btext-(center|left|right)\b/)
    expect(renderToStaticMarkup(createElement(PageTitle, null, 'Wishlist'))).toBe(`<h1 class="${PAGE_TITLE} mb-6">Wishlist</h1>`)
  })

  it.each(PAGES)('%s sits in the shell, with no column of its own', (path) => {
    const source = read(path)
    expect(source).toContain("from '@/components/layout/MemberPageShell'")
    expect(source).toContain('<MemberPageShell')
    expect(source).not.toMatch(/max-w-3xl[^"]*mx-auto|py-8 sm:py-10|text-\[26px\]/)
  })

  it('narrows text-heavy pages from the column’s start edge below 1024px, never re-centring them, and uses the full column from there', () => {
    expect(read('app/wishlist/page.tsx')).toContain('<div className="max-w-3xl lg:max-w-none">')
    expect(read('app/support/page.tsx')).toContain('<div className="max-w-3xl lg:max-w-none lg:grid lg:grid-cols-12 lg:gap-x-8 lg:items-start">')
    // My Pass: one top-to-bottom flow in a centred 960px column, on every screen: no side rail.
    const member = read('app/member/page.tsx')
    expect(member).toContain('<div className="mx-auto w-full max-w-[960px] space-y-6">')
    expect(member).not.toMatch(/<aside|lg:grid-cols-\[minmax\(0,1fr\)_300px\]|lg:sticky/)
    const order = ['<h1 className={PAGE_TITLE}>', '<SegmentBadge', '<DashboardStats', '<MemberTabs', '<PerksTab'].map((s) => member.indexOf(s))
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(order.every((i) => i > -1)).toBe(true)
  })

  it.each(['app/member/page.tsx', 'app/profile/page.tsx', 'app/settings/page.tsx'])('%s has no Member Dashboard eyebrow, so its title sits on the shared baseline', (path) => {
    expect(read(path)).not.toContain('dash_label')
  })

  it('drops the Member Dashboard string from every language', () => {
    expect(read('lib/i18n/translations.ts')).not.toMatch(/\bdash_label\b/)
  })
})
