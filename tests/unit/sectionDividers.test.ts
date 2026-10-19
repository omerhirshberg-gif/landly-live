import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { existsSync, readFileSync } from 'node:fs'
import SectionDivider from '@/components/ui/SectionDivider'

const read = (path: string) => readFileSync(path, 'utf8')
const count = (source: string) => (source.match(/<SectionDivider\b/g) ?? []).length

describe('section divider', () => {
  it('is one shared, soft, symmetric hairline: never a solid border', () => {
    expect(renderToStaticMarkup(createElement(SectionDivider))).toBe(
      '<div aria-hidden="true" class="section-divider max-w-6xl mx-auto px-4 sm:px-6"><div class="h-px w-full bg-gradient-to-r from-transparent via-brand/25 to-transparent"></div></div>',
    )
    expect(existsSync('components/home/SectionDivider.tsx')).toBe(false)
  })

  it('takes its spacing from the page where sections don\'t pad themselves', () => {
    expect(renderToStaticMarkup(createElement(SectionDivider, { className: 'my-10 sm:my-12' }))).toMatch(/^<div aria-hidden="true" class="section-divider max-w-6xl mx-auto px-4 sm:px-6 my-10 sm:my-12">/)
  })

  it.each([
    ['components/home/HomePage.tsx', 5],
    ['components/about/AboutPage.tsx', 3],
    ['app/olim/page.tsx', 7],
    ['app/categories/page.tsx', 3],
    ['app/business/page.tsx', 3],
    ['app/support/page.tsx', 2],
    ['app/member/page.tsx', 1],
  ] as const)('%s separates its sections with the shared divider', (file, n) => {
    const source = read(file)
    expect(source).toContain("import SectionDivider from '@/components/ui/SectionDivider'")
    expect(count(source)).toBe(n)
  })

  it('replaces the hard divide-y between the /categories rails', () => {
    expect(read('app/categories/page.tsx')).not.toContain('divide-y')
  })

  it("gives /olim's mentor and closing blocks their own top space now a hairline sits above them", () => {
    const olim = read('app/olim/page.tsx')
    expect(olim).toContain('<div id="mentor" className="max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20')
    expect(olim).toContain('className="max-w-4xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-[')
  })
})
