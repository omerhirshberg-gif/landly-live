import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LangContext } from '@/lib/i18n/LangProvider'
import { RTL_LANGS, translations, type Lang, type TranslationKey } from '@/lib/i18n/translations'
import { CUSTOMER_TYPES } from '@/lib/customerTypes'

vi.mock('@/components/layout/Navbar', () => ({ default: () => null }))
vi.mock('@/lib/firebase/offers', () => ({ getAllOffers: () => new Promise(() => {}) }))

const { default: BusinessPage } = await import('@/app/business/page')
const { default: SupportPage } = await import('@/app/support/page')

const css = readFileSync('app/globals.css', 'utf8')
const read = (path: string) => readFileSync(path, 'utf8')

function withLang(lang: Lang, element: ReturnType<typeof createElement>) {
  const t = (key: TranslationKey) => translations[lang][key]
  const isRtl = (RTL_LANGS as readonly string[]).includes(lang)
  return renderToStaticMarkup(createElement(LangContext.Provider, { value: { lang, setLang: () => {}, t, isRtl } }, element))
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('one site canvas', () => {
  it('defines the canvas tokens once and paints body with them', () => {
    expect(css).toContain(':root{--canvas:#F8FAFC;--canvas-wash:#EEF3FB;}')
    expect(css).toContain('body{background:var(--canvas);}')
  })

  it('gives the member and the guest page wrappers the exact same quiet wash, at every width', () => {
    expect(css).toContain('.member-canvas,.home-ambient{min-height:100vh;min-height:100dvh;background:linear-gradient(180deg,var(--canvas-wash) 0,var(--canvas) 420px) var(--canvas);}')
    expect(css).not.toMatch(/\.(member-canvas|home-ambient)\{[^}]*radial-gradient/)
    expect(css).not.toContain('perks-canvas')
  })

  it('has no blurred halos left on the public pages', () => {
    for (const file of [...sourceFiles('app'), ...sourceFiles('components')]) {
      if (file.includes('/admin/')) continue
      expect(read(file), file).not.toMatch(/\bblur-(2xl|3xl)\b/)
    }
  })

  it('keeps every public page on the canvas', () => {
    expect(read('components/about/AboutPage.tsx')).toContain('<main className="home-ambient below-header">')
    for (const page of ['app/business/page.tsx', 'app/support/page.tsx', 'app/categories/page.tsx']) expect(read(page)).toContain('below-header member-canvas')
  })
})

describe('typography and buttons', () => {
  it('inherits Inter (Heebo for Hebrew) from html instead of forcing it on every element', () => {
    expect(css).not.toMatch(/\*\{font-family:/)
    expect(css).toContain("html{font-family:var(--font-sans,'Heebo'),'Heebo',sans-serif;}")
    expect(css).toContain(`html[lang="he"]{font-family:'Heebo',sans-serif;}`)
    expect(css).toContain('button,input,select,textarea,optgroup{font-family:inherit;}')
  })

  it('sets headings in Manrope, and keeps Hebrew headings in Heebo', () => {
    expect(css).toContain(":where(h1,h2){font-family:var(--font-display,'Heebo'),'Heebo',sans-serif;letter-spacing:-0.02em;}")
    expect(css).toContain(`[lang="he"] :where(h1,h2),[lang="he"] .font-display{font-family:'Heebo',sans-serif;}`)
    const layout = read('app/layout.tsx')
    expect(layout).toContain("import { Inter, Manrope } from 'next/font/google'")
    expect(layout).toContain("Manrope({ subsets: ['latin', 'latin-ext', 'cyrillic'], weight: ['700', '800'], variable: '--font-display', display: 'swap' })")
    expect(layout).toContain("Inter({ subsets: ['latin', 'latin-ext', 'cyrillic'], variable: '--font-sans', display: 'swap' })")
    expect(layout).toContain('className={`${manrope.variable} ${inter.variable}`}')
    expect(read('tailwind.config.js')).toContain("sans: [\"var(--font-sans, 'Heebo')\", 'Heebo', 'sans-serif']")
    expect(read('tailwind.config.js')).toContain("display: ['var(--font-display)', 'Heebo', 'sans-serif']")
  })

  it('gives every design-system button a 12px radius and slightly tight tracking', () => {
    const btn = css.match(/\.ds-btn\{[^}]*\}/)![0]
    expect(btn).toContain('border-radius:12px;')
    expect(btn).toContain('letter-spacing:-0.01em;')
    expect(read('components/about/AboutPage.tsx')).not.toContain('rounded-full bg-white px-8')
  })
})

describe('/business and /support', () => {
  it.each(Object.keys(translations) as Lang[])('/business shows only real product facts, counting up (%s)', (lang) => {
    const t = translations[lang]
    const html = withLang(lang, createElement(BusinessPage))
    for (const key of ['biz_stats_title', 'biz_stat_perks', 'biz_stat_categories', 'biz_stat_languages', 'biz_stat_segments'] as const) expect(html).toContain(t[key].replace(/'/g, '&#x27;'))
    expect(html).toContain('<span class="sr-only">12</span>')
    expect(html).toContain('<span class="sr-only">5</span>')
    expect(html).toContain('<span class="sr-only">7</span>')
    // The page's mark: a handshake in the shared frame, not a solid blue tile.
    expect(html).toMatch(/<span aria-hidden="true" class="flex flex-shrink-0 items-center justify-center border h-12 w-12 rounded-xl border-sky-200\/60 bg-white text-brand mx-auto mb-5 shadow-card"><svg [^>]*lucide-handshake/)
    expect(html).not.toContain('bg-brand text-white shadow-[0_10px_24px')
    expect(html).not.toMatch(/revenue|₪\d/i)
  })

  it.each(['en', 'he'] as const)('/support makes each channel one card link with its address in <bdi> (%s)', (lang) => {
    const html = withLang(lang, createElement(SupportPage))
    expect(html).toMatch(/<a href="mailto:[^"]+" class="group flex h-full min-h-\[64px\][^"]*">/)
    expect(html).toMatch(/<a href="https:\/\/wa\.me\/[^"]+" target="_blank" rel="noopener noreferrer" class="group flex/)
    expect(html).toMatch(/<bdi dir="ltr" class="[^"]*">\+972/)
    expect(html.match(/cat-card-nudge/g)).toHaveLength(2)
    expect(html).not.toMatch(/online/i)
  })
})
