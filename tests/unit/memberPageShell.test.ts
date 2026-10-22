import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import MemberPageShell, { PAGE_TITLE, PageTitle } from '@/components/layout/MemberPageShell'

const read = (path: string) => readFileSync(path, 'utf8')

const PAGES = ['components/home/LoggedInHome.tsx', 'app/categories/page.tsx', 'app/wishlist/page.tsx', 'app/member/page.tsx', 'app/support/page.tsx']

describe('MemberPageShell', () => {
  it('gives every signed-in tab the same column, gutters and top padding', () => {
    const html = renderToStaticMarkup(createElement(MemberPageShell, null, 'CONTENT'))
    expect(html).toBe('<div class="max-w-member mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 lg:pt-12 pb-10 sm:pb-12">CONTENT</div>')
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

  it('narrows text-heavy pages from the column’s start edge, never re-centring them', () => {
    expect(read('app/wishlist/page.tsx')).toContain('<div className="max-w-3xl">')
    expect(read('app/member/page.tsx')).toContain('<div className="max-w-4xl">')
    expect(read('app/support/page.tsx')).toContain('<div className="max-w-3xl">')
  })

  it('drops the My Pass eyebrow, so its title sits on the shared baseline', () => {
    expect(read('app/member/page.tsx')).not.toContain('dash_label')
  })
})
